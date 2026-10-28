import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../verification-card.js',import.meta.url),'utf8');
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const key='fixmycity2-identity-consent-v2';
function setup({storage=new Map(),blocked=false,ready=true,pass=true,authoritative=true,error,pending=false,frontPassed=false,initialPassed=false,initialHash='#guide',frozen=false,repeated=false}={}){
 const nodes=new Map(),events=new Map(),jobs=new Map(),calls=[],navigation=[];let time=Date.now(),id=0,live=ready,subscriber,finish;
 let state={verified:false,icPassed:initialPassed,icFrontPassed:frontPassed,cardChallenge:[{step:'front',instruction:'Show front'},{step:'back',instruction:'Show back'}],expiresAt:new Date(time+900000).toISOString()};
 class Node{hidden=false;open=false;disabled=false;checked=false;textContent='';listeners=new Map();classes=new Set();attributes=new Map();classList={add:(v)=>this.classes.add(v),remove:(v)=>this.classes.delete(v),toggle:(v,on)=>on?this.classes.add(v):this.classes.delete(v)};setAttribute(k,v){this.attributes.set(k,v);}addEventListener(n,fn){const list=this.listeners.get(n)||[];list.push(fn);this.listeners.set(n,list);}dispatch(n,extra={}){for(const fn of this.listeners.get(n)||[])fn({preventDefault(){},...extra});}click(){this.dispatch('click');}showModal(){this.open=true;}close(){this.open=false;}}
 const node=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
 const on=(name,fn)=>{events.set(name,[...(events.get(name)||[]),fn]);};
 const document={hidden:false,getElementById:node,addEventListener:on};
 const location={hash:initialHash,assign:path=>navigation.push(path)},history={replaceState(_state,_title,hash){location.hash=hash;}};
 const api={session:async()=>state,start:async()=>{calls.push({endpoint:'start'});return state;},icFrame:async(frames,signal)=>{
  calls.push({endpoint:'frame',frames,signal});if(pending)await new Promise(resolve=>finish=resolve);if(error)throw error;
  if(!pass)return{passed:false,sidePassed:false,message:'Keep the text clear.'};
  if(frames[0].step==='front'){if(authoritative)state={...state,icFrontPassed:true};return{passed:false,sidePassed:true,icFrontPassed:true};}
  if(authoritative)state={...state,icPassed:true};return{passed:true,icPassed:true};
 },cancel:async()=>{calls.push({endpoint:'cancel'});state={...state,icPassed:false,icFrontPassed:false};}};
 class Clock extends Date{static now(){return time;}}
 let photo=0;
 const context={document,location,history,AbortController,Date:Clock,setTimeout(fn,delay){jobs.set(++id,{fn,at:time+delay});return id;},clearTimeout:id=>jobs.delete(id),addEventListener:on,
  localStorage:{getItem(k){if(blocked)throw Error();return storage.get(k)??null;},setItem(k,v){if(blocked)throw Error();storage.set(k,v);},removeItem(k){storage.delete(k);}},
  window:{FMCCamera:{ready:()=>live,require:()=>live,captureSample:()=>live?{image:'data:image/jpeg;base64,test'+(repeated?0:++photo),capturedAt:time,mediaTime:frozen?0:time/1000}:null,subscribe(fn){subscriber=fn;fn({ready:live});}},FMCVerificationAPI:api,FMCFlow:{ready:Promise.resolve(),getSession:()=>state,refreshSession:async()=>state,go:path=>navigation.push(path),back:path=>navigation.push(path)}}};
 vm.runInNewContext(source,context);
 return{node,calls,navigation,storage,location,finish:()=>finish?.(),async advance(ms){const end=time+ms;for(;;){const next=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;jobs.delete(next[0]);next[1].fn();await flush();}time=end;await flush();},camera(value){live=value;subscriber({ready:live});},fire(name){for(const fn of events.get(name)||[])fn({});},hide(){document.hidden=true;this.fire('visibilitychange');},state:()=>state};
}
async function begin(p){await flush();p.node('continue-button').click();if(p.node('verification-consent').open){p.node('verification-consent-check').checked=true;p.node('consent-continue').click();}await flush();}

test('capture sends three distinct ordered live frames across 900 ms, never one still',async()=>{
 const p=setup({pending:true});await begin(p);p.node('capture-button').click();
 await p.advance(899);assert.equal(p.calls.filter(c=>c.endpoint==='frame').length,0);
 await p.advance(1);const sequence=p.calls.find(c=>c.endpoint==='frame').frames;
 assert.deepEqual(Array.from(sequence,f=>f.sample),[0,1,2]);assert.equal(new Set(sequence.map(f=>f.image)).size,3);
 assert.equal(sequence[2].capturedAt-sequence[0].capturedAt,900);
 assert.ok(Math.abs(sequence[2].mediaTime-sequence[0].mediaTime-.9)<.001);
});

test('frozen camera or repeated image is retried locally without sending photos',async()=>{
 for(const options of [{frozen:true},{repeated:true}]){
  const p=setup(options);await begin(p);await p.advance(16000);
  assert.equal(p.calls.filter(c=>c.endpoint==='frame').length,0);assert.match(p.node('scanner-status').textContent,/Camera paused/);assert.deepEqual(p.navigation,[]);
 }
});

test('navigation, hiding or permission loss during capture cancels the entire burst',async()=>{
 for(const exit of ['hide','tips','pagehide','camera']){
  const p=setup();await begin(p);p.node('capture-button').click();await p.advance(450);
  if(exit==='hide')p.hide();else if(exit==='tips')p.node('verification-help').click();else if(exit==='camera')p.camera(false);else p.fire('pagehide');
  await p.advance(10000);assert.equal(p.calls.filter(c=>c.endpoint==='frame').length,0,exit);assert.deepEqual(p.navigation,[]);
 }
});
test('no upload before consent; manual front then automatic back proceeds exactly once',async()=>{
 const p=setup();await flush();p.node('continue-button').click();p.node('consent-continue').click();await flush();assert.equal(p.calls.length,0);
 p.node('verification-consent-check').checked=true;p.node('consent-continue').click();await flush();assert.equal(p.location.hash,'#front');
 p.node('capture-button').click();await p.advance(900);assert.equal(p.location.hash,'#back');assert.equal(p.node('step-count').textContent,'2/2');
 await p.advance(7000);assert.equal(p.node('verification-result-title').textContent,'MyKad check passed');assert.deepEqual(p.calls.filter(c=>c.endpoint==='frame').map(c=>c.frames[0].step),['front','back']);
 await p.advance(1200);assert.deepEqual(p.navigation,['scan-face']);await p.advance(10000);assert.equal(p.calls.length,3);
});
test('both sides work automatically without pressing the capture button',async()=>{const p=setup();await begin(p);await p.advance(10000);assert.deepEqual(p.navigation,['scan-face']);assert.equal(p.calls.filter(c=>c.endpoint==='frame').length,2);});
test('failed frames keep checking the same side with a bounded interval',async()=>{const p=setup({pass:false});await begin(p);await p.advance(16000);assert.equal(p.calls.filter(c=>c.endpoint==='frame').length,3);assert.equal(p.location.hash,'#front');assert.deepEqual(p.navigation,[]);});
test('manual taps and timer never overlap a running model request',async()=>{const p=setup({pending:true});await begin(p);p.node('capture-button').click();p.node('capture-button').click();await p.advance(15000);assert.equal(p.calls.filter(c=>c.endpoint==='frame').length,1);p.finish();await flush();assert.equal(p.location.hash,'#back');});
test('camera loss cancels an in-flight check and ignores late acceptance',async()=>{const p=setup({pending:true});await begin(p);p.node('capture-button').click();await p.advance(900);p.camera(false);await flush();assert.ok(p.calls.some(c=>c.endpoint==='cancel'));assert.equal(p.calls.find(c=>c.endpoint==='frame').signal.aborted,true);p.finish();await flush();await p.advance(15000);assert.deepEqual(p.navigation,[]);});
test('leaving or hiding the scanner stops future camera uploads',async()=>{for(const exit of ['hide','tips','pagehide']){const p=setup({pass:false});await begin(p);if(exit==='hide')p.hide();else if(exit==='tips')p.node('verification-help').click();else p.fire('pagehide');await p.advance(30000);assert.equal(p.calls.filter(c=>c.endpoint==='frame').length,0,exit);}});
test('a claimed pass without authoritative server confirmation cannot advance',async()=>{const p=setup({authoritative:false});await begin(p);await p.advance(2000);assert.equal(p.location.hash,'#front');assert.deepEqual(p.navigation,[]);});
test('accepted consent persists and resumes the server-confirmed back side',async()=>{const p=setup();await begin(p);assert.deepEqual(JSON.parse(p.storage.get(key)),{version:2,accepted:true});const next=setup({storage:p.storage,frontPassed:true});await flush();assert.equal(next.calls.length,0);await begin(next);assert.equal(next.node('verification-consent').open,false);assert.equal(next.location.hash,'#back');});
test('old consent, Not now, and Privacy choices never silently authorize automatic uploads',async()=>{
 const p=setup({storage:new Map([['fixmycity2-identity-consent-v1','{"version":1,"accepted":true}']])});await flush();p.node('continue-button').click();assert.equal(p.node('verification-consent').open,true);p.node('consent-cancel').click();assert.equal(p.storage.has(key),false);assert.equal(p.calls.length,0);
 p.storage.set(key,'{"version":2,"accepted":true}');p.node('privacy-choices').click();assert.equal(p.storage.has(key),false);assert.equal(p.node('verification-consent-check').checked,false);
});
test('remembered choice never bypasses camera permission; storage denial still permits explicit consent',async()=>{const denied=setup({ready:false,storage:new Map([[key,'{"version":2,"accepted":true}']])});await begin(denied);assert.equal(denied.calls.length,0);const p=setup({blocked:true});await begin(p);await p.advance(10000);assert.deepEqual(p.navigation,['scan-face']);assert.equal(p.storage.size,0);});
test('rate limits delay auto checks instead of creating a request storm',async()=>{const p=setup({error:Object.assign(Error('Wait'),{status:429,code:'rate_limited',retryAfter:60})});await begin(p);await p.advance(59000);assert.equal(p.calls.filter(c=>c.endpoint==='frame').length,1);await p.advance(4000);assert.equal(p.calls.filter(c=>c.endpoint==='frame').length,2);});
test('an existing accepted front/back session goes straight to the face step',async()=>{const p=setup({initialPassed:true});await flush();await p.advance(1200);assert.deepEqual(p.navigation,['scan-face']);assert.equal(p.calls.length,0);});
test('returning from privacy reopens consent without starting uploads, even with a saved choice',async()=>{
 for(const ready of [true,false]){
  const p=setup({initialHash:'#consent',ready,storage:new Map([[key,'{"version":2,"accepted":true}']])});await flush();
  if(!ready){assert.equal(p.node('verification-consent').open,false);p.camera(true);await flush();}
  assert.equal(p.node('verification-consent').open,true);assert.equal(p.node('verification-consent-check').checked,false);
  await p.advance(20000);assert.equal(p.calls.length,0);
 }
});
test('privacy navigation preserves consent return state and camera restoration never uploads automatically',async()=>{
 const p=setup();await flush();p.node('continue-button').click();p.node('privacy-policy-link').click();
 assert.equal(p.location.hash,'#consent');p.camera(false);p.fire('pagehide');p.camera(true);await flush();
 assert.equal(p.node('verification-consent').open,true);await p.advance(20000);assert.equal(p.calls.length,0);
 p.node('consent-cancel').click();assert.equal(p.location.hash,'#guide');
});


test('three capture dots track real captured frames and reset on cancellation',async()=>{
 const p=setup({pending:true});await begin(p);p.node('capture-button').click();await flush();
 assert.ok(p.node('card-dot-1').classes.has('captured'));assert.ok(!p.node('card-dot-2').classes.has('captured'));assert.match(p.node('scanner-status').textContent,/Hold still/);
 await p.advance(450);assert.ok(p.node('card-dot-2').classes.has('captured'));assert.ok(!p.node('card-dot-3').classes.has('captured'));
 await p.advance(450);assert.ok(p.node('card-dot-3').classes.has('captured'));assert.ok(p.node('card-dot-1').classes.has('pending'));
 assert.match(p.node('card-capture-progress').attributes.get('aria-label'),/3 of 3/);
 p.hide();for(let i=1;i<=3;i++)assert.ok(!p.node('card-dot-'+i).classes.has('captured'));
});
