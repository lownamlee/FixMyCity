import test from 'node:test';
import assert from 'node:assert/strict';
import {FaceActions,validateFaceProof} from '../deploy/face-actions.js';
import {actionSamples} from './fixtures/face-actions.mjs';
const now=Date.now(),token='session-token',actions=['look_left','look_right','blink'];
const proof=samples=>({version:1,challengeToken:token,samples});
test('both challenge orders accept continuous turns and an open-close-open blink',()=>{
 for(const order of [actions,['look_right','look_left','blink']])assert.equal(validateFaceProof(proof(actionSamples(order,now)),order,token,now),true);
});
test('a still face, only turns, only blink, or wink cannot complete the check',()=>{
 for(const modify of [s=>({...s,yaw:0}),s=>({...s,blinkLeft:.05,blinkRight:.05}),s=>({...s,blinkRight:.05})])assert.equal(validateFaceProof(proof(actionSamples(actions,now).map(modify)),actions,token,now),false);
 assert.equal(validateFaceProof(proof(actionSamples(actions,now).slice(0,18)),actions,token,now),false);
});
test('wrong nonce, expired evidence, repeated timestamps or frozen video are rejected',()=>{
 const samples=actionSamples(actions,now);
 assert.equal(validateFaceProof(proof(samples),actions,'different',now),false);
 assert.equal(validateFaceProof(proof(samples),actions,token,now+70000),false);
 for(const field of ['at','mediaTime']){const copy=structuredClone(samples);copy[5][field]=copy[4][field];assert.equal(validateFaceProof(proof(copy),actions,token,now),false);}
});
test('multiple faces, face outside frame and non-finite measurements cannot pass',()=>{
 for(const change of [{faceCount:2},{faceCount:0},{inFrame:false},{yaw:NaN},{blinkLeft:2}])assert.equal(validateFaceProof(proof(actionSamples(actions,now).map(s=>({...s,...change}))),actions,token,now),false);
});
test('no face resets the current hold, not an automatic successful step',()=>{
 const tracker=new FaceActions(actions),samples=actionSamples(actions,now);
 samples.slice(0,6).forEach(s=>tracker.update(s));tracker.update({...samples[6],faceCount:0});samples.slice(7,9).forEach(s=>tracker.update(s));assert.equal(tracker.position,0);assert.equal(tracker.complete,false);
});
test('missing camera for over 1.2 seconds starts a fresh sequence',()=>{
 const tracker=new FaceActions(actions),samples=actionSamples(actions,now);samples.slice(0,9).forEach(s=>tracker.update(s));assert.equal(tracker.position,1);
 tracker.update({...samples[9],at:samples[9].at+2000,mediaTime:samples[9].mediaTime+2});assert.equal(tracker.position,0);
});
