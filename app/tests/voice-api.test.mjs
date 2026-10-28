import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalVoiceAPI,voiceSessionConfig,VOICE_MODEL} from '../tools/local-voice-api.mjs';
const origin='http://127.0.0.1:9189';
const sdp='v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n';
function request(path,body={},headers={}){return new Request(origin+'/api/voice/'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});}
test('voice is unavailable without a server credential',async()=>{
  const api=createLocalVoiceAPI();assert.equal((await api.handle(request('session',{sdp}))).status,503);
  const status=await api.handle(new Request(origin+'/api/voice/status'));assert.equal((await status.json()).available,false);
});
test('voice rejects cross-origin, bad media and oversized requests before provider access',async()=>{
  let count=0;const api=createLocalVoiceAPI('test-secret',{fetchAPI:async()=>{count++;throw Error();}});
  assert.equal((await api.handle(request('session',{sdp},{Origin:'https://other.example'}))).status,403);
  assert.equal((await api.handle(request('session',{sdp:''}))).status,400);
  assert.equal((await api.handle(request('session',{sdp,context:'x'.repeat(2501)}))).status,400);
  assert.equal((await api.handle(request('session',{sdp,language:'unknown'}))).status,400);
  assert.equal((await api.handle(request('session',{sdp:'x'.repeat(66000)}))).status,413);
  assert.equal(count,0);
});
test('server sets voice policy, keeps the credential private and ends opaque-token calls',async t=>{
  const calls=[];const api=createLocalVoiceAPI('test-secret',{fetchAPI:async(url,options)=>{
    calls.push({url,options});return url.endsWith('/hangup')?new Response(null,{status:200}):new Response(sdp,{status:201,headers:{Location:'https://api.openai.com/v1/realtime/calls/rtc_test'}});
  }});t.after(()=>api.close());
  const response=await api.handle(request('session',{sdp,context:'Broken streetlight',language:'ms'}));assert.equal(response.status,200);
  const result=await response.json();assert.equal(result.sdp,sdp);assert.equal(result.maxSeconds,300);assert.match(result.token,/^[a-f0-9]{48}$/);
  assert.ok(!JSON.stringify(result).includes('test-secret'));assert.ok(!JSON.stringify(result).includes('rtc_test'));
  assert.equal(calls[0].options.headers.Authorization,'Bearer test-secret');
  const config=JSON.parse(calls[0].options.body.get('session'));assert.equal(config.model,VOICE_MODEL);assert.equal(config.audio.input.turn_detection.interrupt_response,true);assert.match(config.instructions,/Only say a report was created after the creation tool returns a saved report ID/);assert.match(config.instructions,/Broken streetlight/);
  assert.match(config.instructions,/Start in Bahasa Malaysia/);assert.match(config.instructions,/Hai, apa yang boleh saya bantu hari ini\?/);
  await api.handle(request('end',{token:result.token}));await api.handle(request('end',{token:result.token}));assert.equal(calls.length,2);assert.ok(calls[1].url.endsWith('/rtc_test/hangup'));
});
test('provider failures do not disclose provider payloads or keys',async()=>{
  const api=createLocalVoiceAPI('test-secret',{fetchAPI:async()=>new Response('sensitive diagnostic test-secret',{status:401})});
  const response=await api.handle(request('session',{sdp}));assert.equal(response.status,502);assert.ok(!(await response.text()).includes('test-secret'));
});
test('active-call limit and independent start limit bound paid connection attempts',async t=>{
  let count=0;const api=createLocalVoiceAPI('test',{fetchAPI:async url=>{if(url.endsWith('/hangup'))return new Response();count++;return new Response(sdp,{status:201,headers:{Location:'https://api.openai.com/v1/realtime/calls/rtc_'+count}});}});t.after(()=>api.close());
  const a=await (await api.handle(request('session',{sdp}))).json();const b=await (await api.handle(request('session',{sdp}))).json();
  assert.equal((await api.handle(request('session',{sdp}))).status,429);assert.equal(count,2);
  await api.handle(request('end',a));await api.handle(request('end',b));
  for(let i=0;i<4;i++){const c=await (await api.handle(request('session',{sdp}))).json();await api.handle(request('end',c));}
  assert.equal((await api.handle(request('session',{sdp}))).status,429);assert.equal(count,6);
});
test('abandoned calls are ended by the server timer',async()=>{
  let ended=false;const api=createLocalVoiceAPI('test',{maxSeconds:.02,fetchAPI:async url=>{if(url.endsWith('/hangup')){ended=true;return new Response();}return new Response(sdp,{status:201,headers:{Location:'https://api.openai.com/v1/realtime/calls/rtc_expiry'}});}});
  await api.handle(request('session',{sdp}));await new Promise(r=>setTimeout(r,40));assert.equal(ended,true);await api.close();
});
test('voice uses audio output, transcript input and concise civic guidance',()=>{
  const config=voiceSessionConfig();assert.deepEqual(config.output_modalities,['audio']);assert.equal(config.audio.output.voice,'marin');assert.equal(config.audio.input.transcription.model,'gpt-4o-mini-transcribe');assert.match(config.instructions,/Do not request MyKad numbers/);
  assert.match(config.instructions,/Start in English/);assert.match(config.instructions,/Hi, how can I help you today\?/);
});
