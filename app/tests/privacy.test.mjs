import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import worker from '../deploy/worker.js';
import {pages} from '../deploy/pages.js';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const origin='https://fixmycity.online';
test('privacy is publicly accessible with a clean URL, query preservation and HTML redirects',async()=>{
 const response=await worker.fetch(new Request(origin+'/privacy?from=scan-card'),{ASSETS:{fetch(){assert.fail('Pages must render without a static asset lookup');}}});
 assert.equal(response.status,200);assert.equal(await response.text(),pages['privacy.html']);
 for(const path of ['/privacy.html','/privacy/']){
  const redirected=await worker.fetch(new Request(origin+path+'?from=home'),{});
  assert.equal(redirected.status,308);assert.equal(redirected.headers.get('Location'),origin+'/privacy?from=home');
 }
});
test('policy has contact details and is independent of camera, session and consent scripts',()=>{
 const html=pages['privacy.html'];
 assert.match(html,/mailto:contact@fixmycity\.online/);
 for(const script of ['app-flow.js','camera-permission.js','verification-api.js','verification-card.js'])assert.ok(!html.includes(script));
 for(const resource of ['privacy.js','privacy.css','app.css','manifest.webmanifest'])assert.ok(html.includes(resource));
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]));
 for(const match of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.has(match[1]),'missing anchor '+match[1]);
 assert.match(pages['scan-card.html'],/id="privacy-policy-link"[^>]+href="privacy\?from=scan-card"/);
 assert.ok(!pages['scan-card.html'].includes('<details'));
 assert.ok(read('home-app.js').includes("if(action==='privacy')location.assign('privacy?from=home')"));
});
test('policy back uses same-origin history or a safe explicit fallback',()=>{
 for(const example of [
  {from:'scan-card',referrer:origin+'/scan-card',length:2,back:true,target:'scan-card#consent'},
  {from:'home',referrer:origin+'/home',length:2,back:true,target:'home#settings'},
  {from:'home',referrer:'',length:1,back:false,target:'home#settings'},
  {from:'https://evil.example/',referrer:'https://evil.example/scan-card',length:5,back:false,target:'scan-card#consent'},
  {from:'scan-card',referrer:origin+'/privacy',length:3,back:false,target:'scan-card#consent'}
 ]){
  let handler,back=0,prevented=0;const node={setAttribute(){},addEventListener(_name,fn){handler=fn;}};
  vm.runInNewContext(read('privacy.js'),{URL,document:{referrer:example.referrer,getElementById:()=>node},location:{href:origin+'/privacy?from='+encodeURIComponent(example.from),origin},history:{length:example.length,back(){back++;}}});
  handler({preventDefault(){prevented++;}});assert.equal(node.href,example.target);assert.equal(back,Number(example.back));assert.equal(prevented,Number(example.back));
 }
});
test('back leaves the policy after using a section link',()=>{
 let handler,destination;
 vm.runInNewContext(read('privacy.js'),{URL,document:{referrer:origin+'/home',getElementById:()=>({setAttribute(){},addEventListener(_name,fn){handler=fn;}})},location:{href:origin+'/privacy?from=home#contact',hash:'#contact',origin,replace(path){destination=path;}},history:{length:4,back(){throw Error('Would stay in policy anchors');}}});
 handler({preventDefault(){}});assert.equal(destination,'home#settings');
});
