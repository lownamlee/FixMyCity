import assert from 'node:assert/strict';
import test from 'node:test';
import { IdentitySession, VerificationBudget } from '../deploy/identity-api.js';
import worker from '../deploy/worker.js';
import {actionSamples} from './fixtures/face-actions.mjs';
import { MYKAD_REFERENCES } from '../deploy/mykad-reference-data.js';

const origin='https://fixmycity.online';
class Storage {
  values=new Map(); alarm=null;
  async get(key){if(Array.isArray(key))return new Map(key.filter(k=>this.values.has(k)).map(k=>[k,structuredClone(this.values.get(k))]));return structuredClone(this.values.get(key));}
  async put(key,value){if(typeof key==='object'){for(const [k,v] of Object.entries(key))await this.put(k,v);return;}assert.ok(JSON.stringify(value).length<128*1024,'KV value exceeds limit');this.values.set(key,structuredClone(value));}
  async deleteAll(){this.values.clear();}
  async deleteAlarm(){this.alarm=null;}
  async setAlarm(time){this.alarm=time;}
}
function context(){const storage=new Storage();let tail=Promise.resolve();return {storage,blockConcurrencyWhile(fn){const pending=tail.then(fn);tail=pending.catch(()=>{});return pending;}};}
function namespace(Class,env){const objects=new Map();return {objects,idFromName:id=>id,get(id){if(!objects.has(id)){const ctx=context();objects.set(id,{ctx,object:new Class(ctx,env)});}return objects.get(id).object;}};}
function setup(){const env={IDENTITY_SESSION_SECRET:'unit-test-secret-only-32-bytes-minimum',OPENAI_API_KEY:'unit-test-not-a-real-key',IDENTITY_RATE_LIMIT:{async limit(){return {success:true};}},IDENTITY_DAILY_START_LIMIT:'200',IDENTITY_DAILY_MODEL_LIMIT:'100',ASSETS:{fetch(){assert.fail('API must not reach assets');}}};env.IDENTITY_SESSIONS=namespace(IdentitySession,env);env.VERIFICATION_BUDGET=namespace(VerificationBudget,env);return env;}
async function request(env,path,body,cookie='',headers={}){return worker.fetch(new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)}),env);}
async function start(env){const response=await request(env,'/api/verification/start',{consent:true});assert.equal(response.status,200);return {cookie:response.headers.get('Set-Cookie').split(';')[0],state:await response.json()};}
// Deliberately synthetic image byte fixtures: no real card/face and no paid API calls.
function image(n,bytes=2048){const data=Buffer.alloc(bytes,n%255);Buffer.from([255,216,255,192,0,17,8,2,88,3,32,3,1,17,0,2,17,0,3,17,0]).copy(data);data[data.length-2]=255;data[data.length-1]=217;return 'data:image/jpeg;base64,'+data.toString('base64');}
function frames(challenge,bytes=2048){let n=1;return challenge.flatMap(({step})=>['front','back'].includes(step)?Array.from({length:3},(_,sample)=>({step,sample,capturedAt:Date.now()+sample*450,mediaTime:10+sample*.45,image:image(n++,bytes)})):step==='blink'?Array.from({length:5},(_,sample)=>({step,sample,capturedAt:Date.now(),image:image(n++,bytes)})):[{step,capturedAt:Date.now(),image:image(n++,bytes)}]);}
function assessment(payload,changes={}){const result={};for(const [key,prop]of Object.entries(payload.text.format.schema.properties)){result[key]=prop.type==='boolean'?true:key==='decision'?'pass':key==='confidence'?0.999:key==='risk_flags'?[]:key==='best_frame_index'?0:'mykad';}return {...result,...changes};}
function modelOutput(value,changes={}){return new Response(JSON.stringify({status:'completed',output:[{type:'message',status:'completed',content:[{type:'output_text',text:JSON.stringify(value)}]}],...changes}),{headers:{'Content-Type':'application/json'}});}
function mockModel(t,fn){const calls=[];t.mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body);calls.push(body);return fn?fn(body,options):modelOutput(assessment(body));});return calls;}
function sessionObject(env,cookie){const id=cookie.split('=')[1].split('.')[0];return env.IDENTITY_SESSIONS.objects.get(id);}
async function passIC(env,session){const response=await request(env,'/api/verification/ic',{frames:frames(session.state.cardChallenge,100000)},session.cookie);assert.equal(response.status,200);const value=await response.json();assert.equal(value.passed,true);return value.faceChallenge;}
async function nextFrame(env,session){const {ctx}=sessionObject(env,session.cookie);const state=await ctx.storage.get('session');state.lastCardFrameAt=0;await ctx.storage.put('session',state);}
const cardFrame=(step,n=1)=>Array.from({length:3},(_,sample)=>({step,sample,image:image(n*10+sample,100000),capturedAt:Date.now()+sample*450,mediaTime:10+sample*.45}));

test('readable coherent card passes at 0.80 despite clipped edges and uncertain material; clearest front is retained',async(t)=>{
 const calls=mockModel(t,p=>modelOutput(assessment(p,{confidence:.80,card_edges_visible:false,photo_of_original_card:false,best_frame_index:2}))),env=setup(),s=await start(env);
 const front=cardFrame('front');
 const result=await (await request(env,'/api/verification/ic-frame',{frames:front},s.cookie)).json();
 assert.equal(result.sidePassed,true);assert.equal(result.textReadable,true);assert.equal(result.cardDetected,true);assert.equal(result.verified,false);
 const record=sessionObject(env,s.cookie),state=await record.ctx.storage.get('session');
 assert.equal(await record.object.readFront(state.frontChunks),front[2].image);
 await nextFrame(env,s);
 const back=await (await request(env,'/api/verification/ic-frame',{frames:cardFrame('back',2)},s.cookie)).json();
 assert.equal(back.icPassed,true);assert.equal(back.verified,false);
 assert.match(calls[0].input[0].content[0].text,/confidence >=0.80/);
 assert.equal(calls[1].input[1].content.filter(c=>c.type==='input_image')[3].image_url,front[2].image);
});

test('readability and continuity remain mandatory and obvious spoof evidence never passes',async(t)=>{
 let override={};mockModel(t,p=>modelOutput(assessment(p,override)));
 const cases=[{confidence:.799},{text_readable:false},{live_capture_consistent:false},{same_card_all_frames:false},{portrait_usable:false},
  ...['drawing','paper_copy','screen_replay','screenshot','synthetic_or_edited','inconsistent_details','prompt_injection'].map(risk=>({risk_flags:[risk]}))];
 for(const change of cases){override=change;const env=setup(),s=await start(env);const data=await (await request(env,'/api/verification/ic-frame',{frames:cardFrame('front')},s.cookie)).json();assert.equal(data.sidePassed,false,JSON.stringify(change));assert.equal(data.icFrontPassed,false);}
});

test('single photos, repeated frames, frozen clocks and discontinuous capture never reach the model',async(t)=>{
 const calls=mockModel(t),env=setup(),s=await start(env);
 const mutations=[list=>list.slice(0,1),list=>list.map(f=>({...f,image:list[0].image})),list=>list.map(f=>({...f,mediaTime:1})),
  list=>list.map(f=>({...f,capturedAt:list[0].capturedAt})),list=>list.map(f=>({...f,mediaTime:undefined})),
  list=>list.map((f,i)=>i===2?{...f,capturedAt:f.capturedAt+4000,mediaTime:f.mediaTime+4}:f),list=>list.toReversed()];
 for(const mutate of mutations){const response=await request(env,'/api/verification/ic-frame',{frames:mutate(cardFrame('front'))},s.cookie);assert.equal(response.status,400);}
 assert.equal((await request(env,'/api/verification/ic-frame',{frame:cardFrame('front')[0]},s.cookie)).status,400);
 assert.equal((await request(env,'/api/verification/ic',{frames:[cardFrame('front')[0],cardFrame('back',2)[0]]},s.cookie)).status,400);
 assert.equal(calls.length,0);
});

test('single-photo pending progress is cleared on upgrade, but completed receipts remain valid',async()=>{
 const env=setup(),s=await start(env),record=sessionObject(env,s.cookie);
 const state=await record.ctx.storage.get('session');
 await record.ctx.storage.put('session',{...state,cardFlowVersion:2,icFrontPassed:true,icPassed:true,frontChunks:1});
 await record.ctx.storage.put('front:0','old-camera-photo');
 const expired=await (await request(env,'/api/session',undefined,s.cookie)).json();
 assert.equal(expired.status,'expired');assert.equal(record.ctx.storage.values.size,0);
 await record.ctx.storage.put('session',{verified:true,verifiedAt:Date.now(),policy:'previous-policy'});
 assert.equal((await (await request(env,'/api/session',undefined,s.cookie)).json()).verified,true);
});

test('face actions use no model call and cannot accept legacy photo-only submissions',async(t)=>{
 const calls=mockModel(t),env=setup(),session=await start(env);await passIC(env,session);
 const response=await request(env,'/api/verification/face',{frames:[]},session.cookie);assert.equal(response.status,400);assert.equal(calls.length,1);
});

test('automatic front is only partial acceptance; back must match stored front before face unlocks',async(t)=>{
 const calls=mockModel(t),env=setup(),s=await start(env);
 assert.equal((await request(env,'/api/verification/ic-frame',{frames:cardFrame('back')},s.cookie)).status,409);
 const front=await request(env,'/api/verification/ic-frame',{frames:cardFrame('front')},s.cookie),partial=await front.json();
 assert.equal(front.status,200);assert.equal(partial.sidePassed,true);assert.equal(partial.icFrontPassed,true);assert.equal(partial.passed,false);assert.equal(partial.icPassed,false);
 assert.equal((await request(env,'/api/verification/face',{frames:[]},s.cookie)).status,409);
 assert.equal(calls[0].text.format.name,'identity_ic_front_assessment');assert.equal(calls[0].input[1].content.filter(c=>c.type==='input_image').length,MYKAD_REFERENCES.length+3);
 await nextFrame(env,s);
 assert.equal((await request(env,'/api/verification/ic-frame',{frames:cardFrame('back')},s.cookie)).status,400,'same front bytes cannot masquerade as back');
 const back=await request(env,'/api/verification/ic-frame',{frames:cardFrame('back',2)},s.cookie);assert.equal((await back.json()).icPassed,true);
 const allImages=calls[1].input[1].content.filter(c=>c.type==='input_image');assert.equal(allImages.length,MYKAD_REFERENCES.length+4);
 assert.deepEqual(allImages.slice(0,MYKAD_REFERENCES.length).map(i=>i.image_url),MYKAD_REFERENCES.map(r=>r.imageUrl));
 assert.deepEqual(calls[0].input[1].content.slice(0,8),calls[1].input[1].content.slice(0,8),'reference prefix is identical on both sides');
 const images=allImages.slice(MYKAD_REFERENCES.length);assert.equal(images[0].image_url,cardFrame('front')[0].image);assert.equal(images[1].image_url,cardFrame('back',2)[0].image);
 assert.equal(calls[1].model,'gpt-6-luna');assert.equal(calls[1].service_tier,'priority');
});

test('wrong front side, drawings and failed back comparison do not advance the automatic stage',async(t)=>{
 let override={front_side_visible:false};mockModel(t,p=>modelOutput(assessment(p,override)));const env=setup(),s=await start(env);
 for(const value of [{front_side_visible:false},{risk_flags:['drawing']},{confidence:.79}]){override=value;await nextFrame(env,s);const response=await request(env,'/api/verification/ic-frame',{frames:cardFrame('front')},s.cookie);const data=await response.json();assert.equal(data.sidePassed,false);assert.equal(data.icFrontPassed,false);}
 override={};await nextFrame(env,s);await request(env,'/api/verification/ic-frame',{frames:cardFrame('front')},s.cookie);
 override={front_back_consistent:false};await nextFrame(env,s);const back=await request(env,'/api/verification/ic-frame',{frames:cardFrame('back',2)},s.cookie);const data=await back.json();assert.equal(data.icFrontPassed,true);assert.equal(data.icPassed,false);
});

test('automatic check returns specific safe guidance without retaining raw assessment details',async(t)=>{
 let override={quality_usable:false,decision:'retry'};
 const calls=mockModel(t,p=>modelOutput(assessment(p,override))),env=setup(),s=await start(env);
 const check=async()=>{await nextFrame(env,s);return (await request(env,'/api/verification/ic-frame',{frames:cardFrame('front')},s.cookie)).json();};
 let result=await check();assert.equal(result.failureCode,'capture_unclear');assert.equal(result.sidePassed,false);assert.doesNotMatch(result.message,/four edges/);
 override={confidence:.79};result=await check();assert.equal(result.failureCode,'check_inconclusive');assert.equal(result.sidePassed,false);
 override={card_edges_visible:false,text_readable:false};result=await check();assert.equal(result.failureCode,'text_unclear');assert.match(result.message,/text is clear/);
 override={quality_usable:false,photo_of_original_card:false,risk_flags:['screenshot','screen_replay']};
 result=await check();assert.equal(result.failureCode,'screen_or_screenshot');assert.match(result.message,/screenshot/);
 assert.equal(result.sidePassed,false);assert.equal(result.icPassed,false);assert.equal(result.verified,false);
 const stored=JSON.stringify([...sessionObject(env,s.cookie).ctx.storage.values]);assert.doesNotMatch(stored,/risk_flags|confidence|failureCode|portrait_usable/);
 for(const call of calls){
   const content=call.input[1].content, marker=content.findIndex(c=>c.type==='input_text'&&c.text.startsWith('USER_CAMERA_EVIDENCE.'));
   assert.equal(content.slice(0,marker).filter(c=>c.type==='input_image').length,3);
   assert.equal(content.slice(marker).filter(c=>c.type==='input_image').length,3);
   assert.match(call.input[0].content[0].text,/Only images labelled USER_CAMERA_EVIDENCE/);
 }
});

test('auto frame cadence, per-side limit and duplicate accepted-front calls bound paid work',async(t)=>{
 const calls=mockModel(t,p=>modelOutput(assessment(p,{decision:'retry'}))),env=setup(),s=await start(env);
 const send=()=>request(env,'/api/verification/ic-frame',{frames:cardFrame('front')},s.cookie);
 assert.equal((await send()).status,200);assert.equal((await send()).status,429);assert.equal(calls.length,1);
 for(let i=1;i<12;i++){await nextFrame(env,s);assert.equal((await send()).status,200);}
 await nextFrame(env,s);assert.equal((await send()).status,429);assert.equal(calls.length,12);
});

test('late automatic frame pass cannot resurrect a cancelled session',async(t)=>{
 let entered,finish;const started=new Promise(resolve=>entered=resolve);
 const calls=mockModel(t,async p=>{entered();await new Promise(resolve=>finish=resolve);return modelOutput(assessment(p));});
 const env=setup(),s=await start(env),body={frames:cardFrame('front')};
 const pending=request(env,'/api/verification/ic-frame',body,s.cookie);await started;
 assert.equal((await request(env,'/api/verification/ic-frame',body,s.cookie)).status,409);assert.equal(calls.length,1);
 await request(env,'/api/logout',{},s.cookie);finish();assert.equal((await pending).status,410);assert.equal(sessionObject(env,s.cookie).ctx.storage.values.size,0);
});

test('accepted automatic front resumes without another paid call and expires with its media',async(t)=>{
 const calls=mockModel(t),env=setup(),s=await start(env),body={frames:cardFrame('front')};
 await request(env,'/api/verification/ic-frame',body,s.cookie);
 const again=await request(env,'/api/verification/ic-frame',body,s.cookie);assert.equal((await again.json()).icFrontPassed,true);assert.equal(calls.length,1);
 const resumed=await request(env,'/api/verification/start',{consent:true},s.cookie);assert.equal((await resumed.json()).icFrontPassed,true);
 const {ctx,object}=sessionObject(env,s.cookie),state=await ctx.storage.get('session');state.expiresAt=Date.now()-1;await ctx.storage.put('session',state);await object.alarm();assert.equal(ctx.storage.values.size,0);
});

test('new status cannot be authorized by local flags or a forged cookie',async()=>{
  const env=setup();
  for(const cookie of ['', '__Host-fmc-session=verified', '__Host-fmc-session='+ 'a'.repeat(64)+'.'+'b'.repeat(43)]){
    const response=await request(env,'/api/session?verified=true&icPassed=true',undefined,cookie);
    assert.deepEqual(await response.json(),{verified:false,icPassed:false,status:'new'});
    assert.match(response.headers.get('Cache-Control'),/no-store/);
  }
});

test('API rejects wrong origin/method/content type and fails closed without bindings',async()=>{
  const env=setup();
  for(const headers of [{Origin:'https://evil.example'},{Origin:''},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await request(env,'/api/verification/start',{consent:true},'',headers)).status,403);
  assert.equal((await request(env,'/api/verification/start',undefined)).status,405);
  assert.equal((await request(env,'/api/verification/start',{consent:true},'',{'Content-Type':'text/plain'})).status,415);
  assert.equal((await request(env,'/api/verification/start',{consent:false})).status,400);
  assert.equal((await request({},'/api/session',undefined)).status,503);
  assert.equal((await request(env,'/api/not-real',undefined)).status,404);
});

test('stage cookie is signed secure HttpOnly SameSite Strict and pending challenge resumes',async()=>{
  const env=setup();const response=await request(env,'/api/verification/start',{consent:true});
  const cookie=response.headers.get('Set-Cookie');
  assert.match(cookie,/^__Host-fmc-session=[a-f0-9]{64}\.[\w-]{43}; Path=\/; Max-Age=900; HttpOnly; Secure; SameSite=Strict$/);
  const state=await response.json();assert.deepEqual(state.cardChallenge.map(item=>item.step),['front','back']);
  const resumed=await request(env,'/api/verification/start',{consent:true},cookie.split(';')[0]);
  assert.deepEqual(await resumed.json(),state);assert.equal(env.IDENTITY_SESSIONS.objects.size,1);
  assert.ok(sessionObject(env,cookie.split(';')[0]).ctx.storage.alarm>Date.now());
});

test('size limit checks actual streaming bytes as well as declared length',async()=>{
  const env=setup();
  const declared=await request(env,'/api/verification/start',{consent:true},'',{'Content-Length':'99999999'});assert.equal(declared.status,413);
  const response=await request(env,'/api/verification/start',{consent:true,padding:'x'.repeat(5000)});assert.equal(response.status,413);
});

test('invalid images, duplicated frames and bad step order never call the model',async(t)=>{
  const calls=mockModel(t);const env=setup();const session=await start(env);const valid=frames(session.state.cardChallenge);
  for(const candidate of [[],valid.map(f=>({...f,image:'https://evil.example/id.jpg'})),[valid[1],valid[0],valid[2]],valid.map(f=>({...f,image:valid[0].image})),valid.map(f=>({...f,image:'data:image/jpeg;base64,'+Buffer.alloc(2000).toString('base64')}))]){
    const response=await request(env,'/api/verification/ic',{frames:candidate},session.cookie);assert.equal(response.status,400);
  }
  assert.equal(calls.length,0);
  assert.equal((await request(env,'/api/verification/face',{frames:[]},session.cookie)).status,409);
});

test('strict IC pass uses exact model settings, keeps only front in bounded chunks and issues a three-action browser challenge',async(t)=>{
  const calls=mockModel(t);const env=setup();const session=await start(env);const challenge=await passIC(env,session);
  assert.deepEqual(challenge.map(c=>c.step).filter(s=>s.startsWith('look')).sort(),['look_left','look_right']);
  assert.equal(challenge.length,3);assert.equal(challenge[2].step,'blink');
  const call=calls[0];assert.equal(call.model,'gpt-6-luna');assert.deepEqual(call.reasoning,{effort:'high'});assert.equal(call.service_tier,'priority');assert.equal(call.store,false);assert.equal(call.text.format.strict,true);
  assert.equal(call.input[1].content.filter(c=>c.type==='input_image').length,MYKAD_REFERENCES.length+6);
  assert.ok(!JSON.stringify(call).includes('capturedAt'));
  const {ctx}=sessionObject(env,session.cookie);const stored=await ctx.storage.get('session');assert.ok(stored.frontChunks>1);assert.equal(stored.icPassed,true);
  const restored=Array.from({length:stored.frontChunks},(_,i)=>ctx.storage.values.get('front:'+i)).join('');assert.equal(restored,frames(session.state.cardChallenge,100000)[0].image);
  assert.ok(!JSON.stringify([...ctx.storage.values]).includes(frames(session.state.cardChallenge,100000)[1].image));
  assert.equal((await (await request(env,'/api/session',undefined,session.cookie)).json()).status,'face');
});

test('completed session-bound actions issue a receipt, clear photos and are revoked on logout',async(t)=>{
 const calls=mockModel(t),env=setup(),session=await start(env),challenge=await passIC(env,session);
 const state=await (await request(env,'/api/session',undefined,session.cookie)).json();
 const proof={version:1,challengeToken:state.faceToken,samples:actionSamples(challenge.map(c=>c.step))};
 const response=await request(env,'/api/verification/face',{proof},session.cookie);assert.equal(response.status,200);
 const result=await response.json();assert.equal(result.verified,true);assert.equal(result.faceMatched,false);assert.equal(result.faceCheck,'browser_actions');
 assert.match(response.headers.get('Set-Cookie'),/Max-Age=34560000/);assert.equal(calls.length,1,'face stage never calls external AI');
 const {ctx}=sessionObject(env,session.cookie);assert.deepEqual([...ctx.storage.values.keys()],['session']);assert.equal(ctx.storage.alarm,null);
 assert.equal(JSON.stringify([...ctx.storage.values]).includes('data:image'),false);
 const logout=await request(env,'/api/logout',{},session.cookie);assert.equal(logout.status,200);assert.equal(ctx.storage.values.size,0);assert.ok(logout.headers.getSetCookie().some(c=>c.startsWith('fmc_report_device=;')&&c.includes('Max-Age=0')));
 const replay=await request(env,'/api/session',undefined,session.cookie);assert.equal((await replay.json()).verified,false);
 const resubmit=await request(env,'/api/verification/face',{proof},session.cookie);assert.equal(resubmit.status,410);
});

test('spoof risk, uncertainty, wrong card, false checks, missing fields and low confidence never pass',async(t)=>{
  const variations=[{risk_flags:['drawing']},{decision:'review'},{document_type:'other'},{text_readable:false},{confidence:.79},{confidence:1.2},{extra:true}];
  let next={};mockModel(t,payload=>modelOutput(assessment(payload,next)));
  for(const change of variations){next=change;const env=setup();const session=await start(env);const response=await request(env,'/api/verification/ic',{frames:frames(session.state.cardChallenge)},session.cookie);assert.equal((await response.json()).passed,false);assert.equal((await sessionObject(env,session.cookie).ctx.storage.get('session')).icPassed,false);}
});

test('missing movements, stale or cross-session action proofs cannot finish verification',async(t)=>{
 const calls=mockModel(t),env=setup(),session=await start(env),challenge=await passIC(env,session);
 const state=await (await request(env,'/api/session',undefined,session.cookie)).json();
 const samples=actionSamples(challenge.map(c=>c.step));
 for(const proof of [
  {version:1,challengeToken:'wrong',samples},
  {version:1,challengeToken:state.faceToken,samples:samples.slice(0,10)},
  {version:1,challengeToken:state.faceToken,samples:samples.map(s=>({...s,at:s.at-90000}))},
  {version:1,challengeToken:state.faceToken,samples:samples.map(s=>({...s,faceCount:2}))},
 ]){assert.equal((await request(env,'/api/verification/face',{proof},session.cookie)).status,400);}
 assert.equal(calls.length,1);assert.equal((await (await request(env,'/api/session',undefined,session.cookie)).json()).verified,false);
});

test('upstream refusal, incomplete, error and malformed output fail closed without leaking raw output',async(t)=>{
  let output;mockModel(t,()=>output());
  for(const make of [()=>new Response('SECRET RAW UPSTREAM',{status:500}),()=>modelOutput({},{status:'incomplete'}),()=>modelOutput({},{output:[{type:'message',content:[{type:'refusal',refusal:'SECRET RAW REFUSAL'}]}]}),()=>modelOutput({},{output:[{type:'message',content:[{type:'output_text',text:'NOT JSON SECRET'}]}]})]){
    output=make;const env=setup();const session=await start(env);const response=await request(env,'/api/verification/ic',{frames:frames(session.state.cardChallenge)},session.cookie);assert.equal(response.status,503);assert.ok(!(await response.text()).includes('SECRET'));assert.equal((await sessionObject(env,session.cookie).ctx.storage.get('session')).icPassed,false);
  }
});

test('alarm expires retained IC media and a late model response cannot undo logout',async(t)=>{
  let finish;let delay=false;let entered;
  const started=new Promise(resolve=>entered=resolve);
  mockModel(t,async payload=>{if(delay){entered();await new Promise(resolve=>finish=resolve);}return modelOutput(assessment(payload));});
  const env=setup();const session=await start(env);await passIC(env,session);const record=sessionObject(env,session.cookie);
  const state=await record.ctx.storage.get('session');state.expiresAt=Date.now()-1;await record.ctx.storage.put('session',state);await record.object.alarm();assert.equal(record.ctx.storage.values.size,0);
  assert.equal((await request(env,'/api/verification/ic',{frames:frames(session.state.cardChallenge)},session.cookie)).status,410);
  const fresh=await start(env);delay=true;
  const pending=request(env,'/api/verification/ic',{frames:frames(fresh.state.cardChallenge)},fresh.cookie);await started;
  assert.equal((await request(env,'/api/logout',{},fresh.cookie)).status,200);finish();assert.equal((await pending).status,410);assert.equal(sessionObject(env,fresh.cookie).ctx.storage.values.size,0);
});

test('per-session attempts, edge limiter and global daily budget bound costs',async(t)=>{
  const calls=mockModel(t,payload=>modelOutput(assessment(payload,{decision:'retry'})));const env=setup();const session=await start(env);
  for(let i=0;i<2;i++)assert.equal((await request(env,'/api/verification/ic',{frames:frames(session.state.cardChallenge)},session.cookie)).status,200);
  assert.equal((await request(env,'/api/verification/ic',{frames:frames(session.state.cardChallenge)},session.cookie)).status,429);assert.equal(calls.length,2);
  const capped=setup();capped.IDENTITY_DAILY_START_LIMIT='1';await start(capped);assert.equal((await request(capped,'/api/verification/start',{consent:true})).status,429);
  const noModel=setup();noModel.IDENTITY_DAILY_MODEL_LIMIT='0';const pending=await start(noModel);const count=calls.length;assert.equal((await request(noModel,'/api/verification/ic',{frames:frames(pending.state.cardChallenge)},pending.cookie)).status,429);assert.equal(calls.length,count);
  env.IDENTITY_RATE_LIMIT.limit=async()=>({success:false});assert.equal((await request(env,'/api/session',undefined)).status,429);
});

test('overlapping checks reserve one paid call and logout failure never clears the browser cookie',async(t)=>{
  let finish,entered;const started=new Promise(resolve=>entered=resolve);
  const calls=mockModel(t,async payload=>{entered();await new Promise(resolve=>finish=resolve);return modelOutput(assessment(payload,{decision:'retry'}));});
  const env=setup();const session=await start(env);const body={frames:frames(session.state.cardChallenge)};
  const pending=request(env,'/api/verification/ic',body,session.cookie);await started;
  const overlap=await request(env,'/api/verification/ic',body,session.cookie);
  assert.equal(overlap.status,409);assert.equal((await overlap.json()).error,'check_in_progress');assert.equal(calls.length,1);
  finish();await pending;
  const record=sessionObject(env,session.cookie);record.object.clear=async()=>{throw new Error('storage unavailable secret details');};
  const logout=await request(env,'/api/logout',{},session.cookie);
  assert.equal(logout.status,503);assert.equal(logout.headers.get('Set-Cookie'),null);assert.ok(!(await logout.text()).includes('secret details'));
});

test('refusal cannot be masked by a second pass message and an invalid schema never passes',async(t)=>{
  let refusal=true;mockModel(t,payload=>{
    if(refusal)return modelOutput(assessment(payload),{output:[{type:'message',status:'completed',content:[{type:'refusal',refusal:'no'},{type:'output_text',text:JSON.stringify(assessment(payload))}]}]});
    const result=assessment(payload);delete result.portrait_usable;return modelOutput(result);
  });
  for(const mode of [true,false]){
    refusal=mode;const env=setup();const session=await start(env);const response=await request(env,'/api/verification/ic',{frames:frames(session.state.cardChallenge)},session.cookie);
    assert.equal((await response.json()).passed,false);assert.equal((await sessionObject(env,session.cookie).ctx.storage.get('session')).icPassed,false);
  }
});
