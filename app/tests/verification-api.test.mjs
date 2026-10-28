import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../verification-api.js',import.meta.url),'utf8');
function setup(reply){const calls=[],window={};vm.runInNewContext(source,{window,URL,document:{currentScript:{src:'https://fixmycity.online/verification-api.js'}},fetch:async(url,options)=>{calls.push({url:String(url),options});return reply;}},{filename:'verification-api.js'});return{api:window.FMCVerificationAPI,calls};}
test('verification requests use same-origin cookies, no cache, and explicit consent',async()=>{
 const p=setup(new Response(JSON.stringify({cardChallenge:[]})));await p.api.start();assert.equal(p.calls[0].url,'https://fixmycity.online/api/verification/start');assert.equal(p.calls[0].options.credentials,'same-origin');assert.equal(p.calls[0].options.cache,'no-store');assert.deepEqual(JSON.parse(p.calls[0].options.body),{consent:true});
});
test('IC API sends the ordered live sequence and forwards its abort signal',async()=>{
 const p=setup(new Response(JSON.stringify({sidePassed:false}))),controller=new AbortController();
 const frames=Array.from({length:3},(_,sample)=>({step:'front',sample,image:'synthetic-'+sample,capturedAt:1000+sample*450,mediaTime:1+sample*.45}));
 await p.api.icFrame(frames,controller.signal);
 const call=p.calls[0];assert.equal(call.url,'https://fixmycity.online/api/verification/ic-frame');
 assert.deepEqual(JSON.parse(call.options.body),{frames});assert.equal(call.options.signal,controller.signal);
 assert.equal(call.options.credentials,'same-origin');assert.equal(call.options.cache,'no-store');
});
test('server error field and Retry-After reach the recovery UI',async()=>{
 const p=setup(new Response(JSON.stringify({error:'rate_limited',message:'Wait one minute'}),{status:429,headers:{'Retry-After':'60'}}));await assert.rejects(p.api.face([]),error=>error.status===429&&error.code==='rate_limited'&&error.retryAfter===60&&error.message==='Wait one minute');
});
test('unreadable server response fails closed',async()=>{
 const p=setup(new Response('<html>Error</html>',{status:503}));await assert.rejects(p.api.session(),/valid response/);
});
test('cancelling revokes the cookie session through a small keepalive request',async()=>{
 const p=setup(new Response(JSON.stringify({loggedOut:true})));await p.api.cancel();assert.equal(p.calls[0].url,'https://fixmycity.online/api/logout');assert.equal(p.calls[0].options.keepalive,true);assert.equal(p.calls[0].options.body,'{}');
});
