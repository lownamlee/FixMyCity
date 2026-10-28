import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewServer} from '../tools/serve.mjs';
import {createLocalIdentityRuntime} from '../tools/local-identity-runtime.mjs';
async function server(t,key=''){
 const runtime=createLocalIdentityRuntime(key),app=createPreviewServer(runtime);
 await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>app.close(resolve)));
 const origin=`http://127.0.0.1:${app.address().port}`;
 return {origin,runtime,request:(path,body,cookie='',headers={})=>fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,...headers},body:body===undefined?undefined:JSON.stringify(body)})};
}
test('localhost serves clean routes and never fabricates verification without a key',async(t)=>{
 const s=await server(t);
 const page=await s.request('/scan-card');assert.equal(page.status,200);assert.match(page.headers.get('Content-Type'),/html/);assert.equal(page.headers.get('Cache-Control'),'no-store');
 assert.equal((await (await s.request('/api/session')).json()).verified,false);
 assert.equal((await s.request('/api/verification/start',{consent:true})).status,503);
 assert.equal((await s.request('/api/logout',{})).status,200);
 assert.equal((await s.request('/api/logout',{},'',{Origin:'https://unrelated.example'})).status,403);
 assert.equal((await s.request('/tools/local-identity-runtime.mjs')).status,404);
});

test('local admin and clean redirects preserve status and headers',async t=>{
 const s=await server(t);assert.equal((await s.request('/admin')).status,200);
 for(const path of ['/authority','/authority.html','/admin/']){const r=await fetch(s.origin+path,{redirect:'manual'});assert.equal(r.status,308);assert.equal(r.headers.get('location'),s.origin+'/admin');assert.equal(r.headers.get('Cache-Control'),'no-store');}
});
test('localhost forwards POST bodies and signed cookies to the actual Worker without a remote call',async(t)=>{
 const s=await server(t,'unit-test-not-a-real-credential');
 const started=await s.request('/api/verification/start',{consent:true});assert.equal(started.status,200);
 const cookie=started.headers.get('Set-Cookie').split(';')[0],initial=await started.json();
 assert.equal(initial.cardChallenge.length,2);assert.match(started.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Strict/);
 const resumed=await (await s.request('/api/session',undefined,cookie)).json();assert.equal(resumed.status,'ic');
 const rejected=await s.request('/api/verification/ic-frame',{frame:{step:'front'}},cookie);
 assert.equal(rejected.status,400);assert.equal((await rejected.json()).error,'continuous_capture_required');
 const budget=s.runtime.VERIFICATION_BUDGET.get('identity-global-daily-v1');
 assert.equal((await budget.ctx.storage.get('counter')).call,0);
 await s.request('/api/logout',{},cookie);
 assert.equal((await (await s.request('/api/session',undefined,cookie)).json()).status,'expired');
});
