import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/lib/live-voice.ts'],bundle:true,format:'cjs',write:false});
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function harness({microphone,session,tool}={}){
  const track={enabled:true,readyState:'live',addEventListener(){},stop(){this.readyState='ended';}};
  const stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
  const contexts=[],peers=[],requests=[],states=[],messages=[];
  class Context {
    state='running';constructor(){contexts.push(this);}resume(){return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
    createMediaStreamSource(){return {connect(){},disconnect(){}};}createAnalyser(){return {fftSize:256,getByteTimeDomainData(data){data.fill(128);}};}
  }
  class Peer {
    connectionState='new';constructor(){peers.push(this);}addTrack(){}createDataChannel(){this.channel={readyState:'open',send(value){messages.push(JSON.parse(value));},close(){}};return this.channel;}
    async createOffer(){return {sdp:'v=0\r\nm=audio 9 RTP/AVP 0'};}async setLocalDescription(){}async setRemoteDescription(){this.connectionState='connected';this.channel.onopen?.();}close(){this.connectionState='closed';}
  }
  const mod={exports:{}};
  vm.runInNewContext(bundle.outputFiles[0].text,{module:mod,exports:mod.exports,Uint8Array,Map,Math,Error,JSON,Promise,
    navigator:{mediaDevices:{getUserMedia:microphone||(()=>Promise.resolve(stream))}},window:{RTCPeerConnection:Peer,setTimeout},RTCPeerConnection:Peer,AudioContext:Context,
    document:{createElement:()=>({setAttribute(){},play(){return Promise.resolve();},pause(){}})},clearTimeout,requestAnimationFrame:()=>1,cancelAnimationFrame(){},
    fetch:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});if(url.endsWith('/end'))return {ok:true,json:async()=>({ended:true})};return session?session():{ok:true,json:async()=>({sdp:'answer',token:'opaque-test-token',maxSeconds:300})};}
  });
  const call=new mod.exports.LiveVoice({state:(...v)=>states.push(v),transcript(){},levels(){},playbackBlocked(){},tool});
  return {call,track,stream,contexts,peers,requests,states,messages};
}

test('chosen language reaches the session API and opening response stays short despite a draft',async()=>{
  for(const [language,greeting] of [['en','Hi, how can I help you today?'],['ms','Hai, apa yang boleh saya bantu hari ini?']]){
    const h=harness();await h.call.start('A long existing report draft',language);
    assert.equal(h.requests[0].body.language,language);
    assert.ok(h.messages[0].response.instructions.includes(greeting));
    assert.match(h.messages[0].response.instructions,/nothing else/);
    assert.ok(!h.messages[0].response.instructions.includes('follow-up instead'));
    h.call.stop();
  }
});
test('closing during microphone permission stops late tracks without creating a call',async()=>{
  let resolve;const h=harness({microphone:()=>new Promise(r=>resolve=r)});const pending=h.call.start('');h.call.stop();resolve(h.stream);await pending;
  assert.equal(h.track.readyState,'ended');assert.equal(h.requests.length,0);assert.ok(h.contexts.every(c=>c.state==='closed'));
});
test('a late SDP response after close is explicitly hung up and cannot reopen the call',async()=>{
  let resolve;const h=harness({session:()=>new Promise(r=>resolve=r)});const pending=h.call.start('test draft');await turn();h.call.stop();
  resolve({ok:true,json:async()=>({sdp:'answer',token:'late-token',maxSeconds:300})});await pending;
  assert.equal(h.track.readyState,'ended');assert.equal(h.peers[0].connectionState,'closed');assert.equal(h.call.connected,false);
  assert.deepEqual(h.requests.at(-1),{url:'/api/voice/end',body:{token:'late-token'}});
});
test('mute toggles the actual track and stop cleans every media resource',async()=>{
  const h=harness();await h.call.start('test');assert.equal(h.call.connected,true);
  assert.equal(h.call.mute(),true);assert.equal(h.track.enabled,false);h.call.mute();assert.equal(h.track.enabled,true);
  h.call.stop();assert.equal(h.track.readyState,'ended');assert.equal(h.peers[0].connectionState,'closed');assert.ok(h.contexts.every(c=>c.state==='closed'));assert.ok(h.requests.some(r=>r.url.endsWith('/end')));
});
test('microphone denial shows a recoverable message without contacting the voice API',async()=>{
  const denied=Object.assign(Error('denied'),{name:'NotAllowedError'});const h=harness({microphone:async()=>{throw denied;}});await h.call.start('');
  assert.equal(h.states.at(-1)[0],'error');assert.match(h.states.at(-1)[1],/site settings/);assert.equal(h.requests.length,0);assert.ok(h.contexts.every(c=>c.state==='closed'));
});
test('a dropped data channel ends audio and offers reconnection',async()=>{
  const h=harness();await h.call.start('');h.peers[0].channel.onclose();
  assert.equal(h.track.readyState,'ended');assert.equal(h.states.at(-1)[0],'error');assert.ok(h.requests.some(r=>r.url.endsWith('/end')));
});

test('voice function calls save once, return the actual result, and reject unknown tools',async()=>{
 const calls=[];const h=harness({tool:async(name,args)=>{calls.push({name,args});return {saved:true,reportId:'FMC-045'};}});await h.call.start('');
 const output=[{type:'function_call',call_id:'test-1',name:'create_incident_report',arguments:'{"confirmedByUser":true}'}];
 const done=()=>h.peers[0].channel.onmessage({data:JSON.stringify({type:'response.done',response:{status:'completed',output}})});
 done();await turn();done();await turn();assert.equal(calls.length,1);assert.equal(h.messages.filter(m=>m.item?.type==='function_call_output').length,1);assert.equal(JSON.parse(h.messages.find(m=>m.item?.type==='function_call_output').item.output).reportId,'FMC-045');
 h.peers[0].channel.onmessage({data:JSON.stringify({type:'response.done',response:{status:'completed',output:[{...output[0],call_id:'test-2',name:'dispatch_ambulance'}]}})});await turn();assert.equal(calls.length,1);assert.equal(JSON.parse(h.messages.filter(m=>m.item?.type==='function_call_output').at(-1).item.output).saved,false);h.call.stop();
});

test('closing a voice call while a tool saves cannot emit a late reply',async()=>{
 let complete;const h=harness({tool:()=>new Promise(r=>complete=r)});await h.call.start('');h.peers[0].channel.onmessage({data:JSON.stringify({type:'response.done',response:{status:'completed',output:[{type:'function_call',call_id:'late-save',name:'update_incident_draft',arguments:'{}'}]}})});await turn();h.call.stop();complete({saved:true});await turn();assert.equal(h.messages.filter(m=>m.item?.type==='function_call_output').length,0);
});
