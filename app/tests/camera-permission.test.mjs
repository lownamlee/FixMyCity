import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../camera-permission.js',import.meta.url),'utf8');
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function setup({permissionState='prompt',facing='environment',secure=true,getUserMedia}={}){
  const nodes=new Map(),events=new Map(),calls=[],streams=[];
  const element=id=>{if(!nodes.has(id)){const listeners=new Map();nodes.set(id,{id,hidden:false,disabled:false,textContent:'',listeners,addEventListener(type,fn){listeners.set(type,fn);},focus(){},close(){this.open=false;}});}return nodes.get(id);};
  const classes=new Set(['camera-blocked']);
  const video={srcObject:null,muted:false,playsInline:false,paused:false,ended:false,readyState:4,currentTime:1,videoWidth:1280,videoHeight:960,play:async()=>{},getBoundingClientRect:()=>({left:0,top:0,width:390,height:844})};
  const permission={state:permissionState,listeners:new Map(),addEventListener(type,fn){this.listeners.set(type,fn);},change(value){this.state=value;this.listeners.get('change')?.();}};
  function makeStream(){const track={readyState:'live',stopped:false,listeners:new Map(),stop(){this.stopped=true;this.readyState='ended';},addEventListener(type,fn){this.listeners.set(type,fn);},end(){this.readyState='ended';this.listeners.get('ended')?.();}};const stream={track,getTracks:()=>[track],getVideoTracks:()=>[track]};streams.push(stream);return stream;}
  const document={hidden:false,body:{dataset:{cameraFacing:facing},classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}},getElementById:element,querySelector:()=>video,querySelectorAll:()=>[],
    addEventListener(type,fn){events.set(type,fn);},createElement:()=>({getContext:()=>({drawImage(){}}),toDataURL:()=> 'data:image/jpeg;base64,c2FtcGxl'})};
  const navigator={permissions:{query:async()=>permission},mediaDevices:{getUserMedia:async constraints=>{calls.push(constraints);return getUserMedia?getUserMedia(makeStream):makeStream();}}};
  const window={isSecureContext:secure};
  vm.runInNewContext(source,{window,document,navigator,location:{assign(){}},addEventListener:document.addEventListener,console},{filename:'camera-permission.js'});
  return{api:window.FMCCamera,document,permission,calls,streams,video,classes,element,fire:type=>events.get(type)?.(),makeStream};
}
test('initial prompt state does not request camera until explicit action',async()=>{
  const p=setup();await flush();assert.equal(p.calls.length,0);assert.equal(p.api.ready(),false);assert.equal(p.element('camera-permission').hidden,false);
  await p.api.request();assert.equal(p.api.ready(),true);assert.equal(p.element('camera-permission').hidden,true);assert.equal(p.classes.has('camera-blocked'),false);
  assert.equal(p.calls[0].audio,false);assert.equal(p.calls[0].video.facingMode.ideal,'environment');assert.ok(p.video.srcObject);
});
test('face camera requests user-facing video without audio',async()=>{
  const p=setup({facing:'user'});await p.api.request();assert.equal(p.calls[0].video.facingMode.ideal,'user');assert.equal(p.calls[0].audio,false);
});

test('live samples expose the raw video clock and refuse paused or ended video',async()=>{
 const p=setup();assert.equal(p.api.captureSample(),null);await p.api.request();
 const first=p.api.captureSample();assert.equal(first.mediaTime,1);assert.equal(typeof first.capturedAt,'number');assert.match(first.image,/^data:image\/jpeg/);
 p.video.currentTime=1.45;assert.equal(p.api.captureSample().mediaTime,1.45);
 p.video.paused=true;assert.equal(p.api.captureSample(),null);p.video.paused=false;
 p.video.ended=true;assert.equal(p.api.captureSample(),null);p.video.ended=false;
 p.video.readyState=1;assert.equal(p.api.captureSample(),null);
});
test('denied camera stays gated and provides browser-settings recovery',async()=>{
  const p=setup({permissionState:'denied',getUserMedia:()=>Promise.reject(Object.assign(new Error('denied'),{name:'NotAllowedError'}))});await flush();
  assert.equal(p.calls.length,0);assert.equal(p.element('camera-settings-help').hidden,false);
  await p.api.request();assert.equal(p.api.require(),false);assert.equal(p.element('camera-enable').textContent,'Try again');assert.match(p.element('camera-permission-message').textContent,/browser/);
});
test('permission revocation stops the stream and blocks completion immediately',async()=>{
  const p=setup({permissionState:'granted'});await flush();assert.equal(p.api.ready(),true);
  p.permission.change('denied');assert.equal(p.api.ready(),false);assert.equal(p.streams[0].track.stopped,true);assert.equal(p.video.srcObject,null);assert.equal(p.classes.has('camera-blocked'),true);
});
test('hidden page stops tracks; visible page reacquires only an already-granted permission',async()=>{
  const p=setup({permissionState:'granted'});await flush();p.document.hidden=true;p.fire('visibilitychange');
  assert.equal(p.streams[0].track.stopped,true);assert.equal(p.api.ready(),false);
  p.document.hidden=false;p.fire('visibilitychange');await flush();assert.equal(p.calls.length,2);assert.equal(p.api.ready(),true);
  const q=setup();await q.api.request();q.document.hidden=true;q.fire('visibilitychange');q.document.hidden=false;q.fire('visibilitychange');await flush();assert.equal(q.calls.length,1);assert.equal(q.api.ready(),false);
});
test('a grant that resolves after navigation is stopped instead of opening the camera',async()=>{
  let resolve;const p=setup({getUserMedia:make=>new Promise(done=>{resolve=()=>done(make());})});
  const pending=p.api.request();p.fire('pagehide');resolve();await pending;assert.equal(p.api.ready(),false);assert.equal(p.streams[0].track.stopped,true);assert.equal(p.video.srcObject,null);
});
test('insecure context never attempts to request camera',async()=>{
  const p=setup({secure:false});await p.api.request();assert.equal(p.calls.length,0);assert.equal(p.api.ready(),false);assert.match(p.element('camera-permission-title').textContent,/secure/);
});
test('missing camera and camera-in-use errors have recovery messages',async()=>{
  for(const [name,phrase]of[['NotFoundError',/No camera/],['NotReadableError',/unavailable/]]){
    const p=setup({getUserMedia:()=>Promise.reject(Object.assign(new Error(name),{name}))});await p.api.request();assert.equal(p.api.ready(),false);assert.match(p.element('camera-permission-title').textContent,phrase);
  }
});
test('hardware disconnection clears the live stream and requires recovery',async()=>{
  const p=setup();await p.api.request();p.streams[0].track.end();assert.equal(p.api.ready(),false);assert.equal(p.video.srcObject,null);assert.match(p.element('camera-permission-title').textContent,/disconnected/);
});
