import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../deploy/worker.js';
import {VoiceGateway} from '../deploy/voice-api.js';

const origin='https://fixmycity.online', sdp='v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n';
function context(){const values=new Map();let tail=Promise.resolve();return {
  storage:{alarm:null,async get(key){return structuredClone(values.get(key));},async put(key,value){values.set(key,structuredClone(value));},async setAlarm(time){this.alarm=time;}},
  blockConcurrencyWhile(fn){const task=tail.then(fn);tail=task.catch(()=>{});return task;}
};}
function setup(){const ctx=context(),env={VOICE_OPENAI_API_KEY:'test-voice-secret',IDENTITY_SESSION_SECRET:'test-signing-key-32-bytes-minimum-only',VOICE_RATE_LIMIT:{async limit(){return {success:true};}},VOICE_DAILY_CALL_LIMIT:'60',VOICE_IP_DAILY_CALL_LIMIT:'20',ASSETS:{fetch(){assert.fail('Voice must never reach assets');}}};
  let object=new VoiceGateway(ctx,env);env.VOICE_GATEWAY={idFromName:name=>name,get:()=>object};return {env,ctx,reload(){object=new VoiceGateway(ctx,env);},get object(){return object;}};}
function request(env,action,body,headers={}){return worker.fetch(new Request(origin+'/api/voice/'+action,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.10',...headers},body:body===undefined?undefined:JSON.stringify(body)}),env);}
function provider(t,custom){let count=0;const calls=[];t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url,options});if(custom)return custom(url,options);return url.endsWith('/hangup')?new Response(null,{status:200}):new Response(sdp,{status:201,headers:{location:'https://api.openai.com/v1/realtime/calls/rtc_test'+(++count)}});});return calls;}

test('production voice requires configured bindings and same-origin POST',async t=>{
  const calls=provider(t),{env}=setup();
  assert.equal((await request(env,'status')).status,200);
  assert.equal((await (await request(env,'status')).json()).available,true);
  assert.equal((await request(env,'session',{sdp},{Origin:'https://evil.example'})).status,403);
  assert.equal((await request(env,'session',{sdp},{'CF-Connecting-IP':''})).status,403);
  delete env.VOICE_RATE_LIMIT;
  assert.equal((await (await request(env,'status')).json()).available,false);
  assert.equal((await request(env,'session',{sdp})).status,503);assert.equal(calls.length,0);
});
test('production voice rejects invalid and oversized offers before paid requests',async t=>{
  const calls=provider(t),{env}=setup();
  for(const [body,status] of [[{sdp:''},400],[{sdp,context:'x'.repeat(2501)},400],[{sdp,language:'unknown'},400],[{sdp:'x'.repeat(66000)},413],[null,400]])assert.equal((await request(env,'session',body)).status,status);
  assert.equal(calls.length,0);
});
test('production call keeps credential, draft, SDP and raw IP out of persistent state',async t=>{
  const calls=provider(t),state=setup();
  const response=await request(state.env,'session',{sdp,context:'A test report',language:'ms'}),body=await response.json();
  assert.equal(response.status,200);assert.match(body.token,/^[a-f0-9]{48}$/);assert.equal(body.maxSeconds,300);
  assert.equal(response.headers.get('Cache-Control'),'no-store, private');
  assert.equal(calls[0].options.headers.Authorization,'Bearer test-voice-secret');
  const config=JSON.parse(calls[0].options.body.get('session'));assert.equal(config.model,'gpt-realtime-2.1');
  assert.match(config.instructions,/Start in Bahasa Malaysia/);assert.match(config.instructions,/Hai, apa yang boleh saya bantu hari ini\?/);
  const persisted=JSON.stringify(await state.ctx.storage.get('voice'));
  for(const privateValue of ['test-voice-secret','A test report','192.0.2.10','m=audio'])assert.ok(!persisted.includes(privateValue));
  assert.ok(state.ctx.storage.alarm<=Date.now()+300000);
  state.reload();assert.equal((await request(state.env,'end',{token:body.token})).status,200);
  assert.deepEqual((await state.ctx.storage.get('voice')).calls,{});
  assert.equal((await request(state.env,'end',{token:body.token})).status,200);assert.equal(calls.length,2);
});
test('persistent daily budget survives object recreation and early hangups',async t=>{
  provider(t);const state=setup();state.env.VOICE_DAILY_CALL_LIMIT='1';
  const first=await (await request(state.env,'session',{sdp})).json();await request(state.env,'end',{token:first.token});state.reload();
  assert.equal((await request(state.env,'session',{sdp})).status,429);
});
test('simultaneous requests reserve capacity before external API completes',async t=>{
  let release;const ready=new Promise(resolve=>release=resolve);let paid=0;
  provider(t,async()=>{paid++;await ready;return new Response(sdp,{status:201,headers:{location:'https://api.openai.com/v1/realtime/calls/rtc_concurrent'+paid}});});
  const state=setup();const responses=Array.from({length:3},()=>request(state.env,'session',{sdp}));
  while(paid<2)await new Promise(resolve=>setImmediate(resolve));
  release();const results=await Promise.all(responses);assert.deepEqual(results.map(r=>r.status).sort(),[200,200,429]);assert.equal(paid,2);
});
test('alarm ends expired calls after object recreation and retries failed provider hangups',async t=>{
  let failHangup=true;
  const calls=provider(t,async url=>url.endsWith('/hangup')?new Response(null,{status:failHangup?503:200}):new Response(sdp,{status:201,headers:{location:'https://api.openai.com/v1/realtime/calls/rtc_alarm'}}));
  const state=setup(),body=await (await request(state.env,'session',{sdp})).json();
  const expire=async()=>{const data=await state.ctx.storage.get('voice');data.calls[body.token].expiresAt=Date.now()-1;await state.ctx.storage.put('voice',data);};
  await expire();state.reload();await state.object.alarm();
  assert.ok((await state.ctx.storage.get('voice')).calls[body.token]);assert.ok(state.ctx.storage.alarm>Date.now());
  failHangup=false;await expire();await state.object.alarm();assert.deepEqual((await state.ctx.storage.get('voice')).calls,{});assert.equal(calls.length,3);
});
test('failed starts consume budget but release active capacity and hide provider errors',async t=>{
  provider(t,async()=>new Response('private provider failure test-voice-secret',{status:500}));const state=setup();
  const response=await request(state.env,'session',{sdp});assert.equal(response.status,502);assert.ok(!(await response.text()).includes('test-voice-secret'));
  const data=await state.ctx.storage.get('voice');assert.equal(data.daily,1);assert.deepEqual(data.calls,{});
});
test('incomplete SDP with a provider call ID is explicitly hung up',async t=>{
  const calls=provider(t,async url=>url.endsWith('/hangup')?new Response(null,{status:200}):new Response('bad sdp',{status:201,headers:{location:'/v1/realtime/calls/rtc_bad'}}));const state=setup();
  assert.equal((await request(state.env,'session',{sdp})).status,502);assert.equal(calls.length,2);assert.deepEqual((await state.ctx.storage.get('voice')).calls,{});
});
test('ending calls remains possible when the edge start limiter is exhausted',async t=>{
  provider(t);const state=setup(),body=await (await request(state.env,'session',{sdp})).json();state.env.VOICE_RATE_LIMIT.limit=async()=>({success:false});
  assert.equal((await request(state.env,'session',{sdp})).status,429);assert.equal((await request(state.env,'end',{token:body.token})).status,200);
});
