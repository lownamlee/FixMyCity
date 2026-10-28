import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../app-flow.js', import.meta.url), 'utf8');
const base = 'https://fixmycity.online/';
const keys = {
  progress: 'fixmycity2-onboarding-v1', seen: 'fixmycity2-intro-seen',
  activity: 'fixmycity2-last-active', route: 'fixmycity2-return-route',
  app: 'fixmycity2-app-progress-v1', consent: 'fixmycity2-identity-consent-v2',
  guest: 'fixmycity2-guest-mode-v1',
};
const anonymous = {verified:false,icPassed:false,status:'new'};
const icPassed = {verified:false,icPassed:true,status:'face'};
const verified = {verified:true,icPassed:true,status:'verified'};
const plain = value => JSON.parse(JSON.stringify(value));
const flush = async () => { for(let i=0;i<12;i++) await Promise.resolve(); };
const deferred = () => { let resolve,reject; const promise=new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject}; };

function storage(seed={},blocked=false) {
  const values=new Map(Object.entries(seed)),reads=[],writes=[],removes=[];
  return {values,reads,writes,removes,
    getItem(key){reads.push(key);if(blocked)throw Error('Unavailable');return values.get(key)??null;},
    setItem(key,value){writes.push([key,String(value)]);if(blocked)throw Error('Unavailable');values.set(key,String(value));},
    removeItem(key){removes.push(key);if(blocked)throw Error('Unavailable');values.delete(key);},
  };
}
class Element {
  constructor(tag){this.tagName=tag;this.children=[];this.style={};this.attributes={};this.listeners={};this.parent=null;this.ownText='';}
  append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
  appendChild(child){this.append(child);return child;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}
  setAttribute(name,value){this.attributes[name]=value;}
  addEventListener(name,listener){(this.listeners[name]??=[]).push(listener);}
  click(){for(const listener of this.listeners.click??[])listener({type:'click'});}
  set textContent(value){this.ownText=String(value);this.children=[];}
  get textContent(){return this.ownText+this.children.map(child=>child.textContent).join(' ');}
}
function find(root,id){if(root.id===id)return root;for(const child of root.children){const result=find(child,id);if(result)return result;}return null;}
function loadFlow({page='',progress,local={},session={},now=2_000_000,server=anonymous,fetcher=null,referrer='',historyState=null,historyLength=1,localBlocked=false,sessionBlocked=false}={}) {
  let currentURL=new URL(page,base),serverReply=server,override=fetcher;
  const transitions=[],listeners=new Map(),events=[],requests=[];
  const localStorage=storage({...local,...(progress===undefined?{}:{[keys.progress]:JSON.stringify(progress)})},localBlocked);
  const sessionStorage=storage(session,sessionBlocked);
  const location={get pathname(){return currentURL.pathname;},get hash(){return currentURL.hash;},get href(){return currentURL.href;},assign(url){transitions.push({method:'assign',url});},replace(url){transitions.push({method:'replace',url});}};
  const root=new Element('html'),head=new Element('head'),body=new Element('body');root.append(head,body);
  const document={currentScript:{src:base+'app-flow.js'},referrer,hidden:false,documentElement:root,head,body,createElement:tag=>new Element(tag),getElementById:id=>find(root,id),addEventListener(){}};
  const history={state:historyState,length:historyLength,back(){transitions.push({method:'back'});}};
  class Clock extends Date {static now(){return now;}}
  class Event {constructor(type,init={}){this.type=type;this.detail=init.detail;}}
  const timers=new Map();let timerId=0;
  const context={URL,Date:Clock,Promise,AbortController,CustomEvent:Event,document,location,history,localStorage,sessionStorage,
    setTimeout(callback){timers.set(++timerId,callback);return timerId;},clearTimeout(id){timers.delete(id);},
    addEventListener(name,callback){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(callback);},
    dispatchEvent(event){events.push(event);for(const listener of listeners.get(event.type)??[])listener(event);},
    async fetch(url,options){
      const request={url:String(url),options};requests.push(request);
      if(override)return await override(request);
      return {ok:true,json:async()=>request.url.endsWith('/api/logout')?{loggedOut:true,verified:false}:serverReply};
    },
  };
  context.window=context;
  vm.runInNewContext(source,context,{filename:'app-flow.js'});
  return {flow:context.FMCFlow,localStorage,sessionStorage,transitions,document,location,requests,events,timers,
    dispatch(type,detail={}){context.dispatchEvent({type,...detail});},
    setURL(path){currentURL=new URL(path,base);},setServer(reply){serverReply=reply;},setFetcher(fn){override=fn;},
    gate(){return document.getElementById('fmc-session-gate');},
  };
}
async function ready(options){const app=loadFlow(options);await app.flow.ready;await flush();return app;}

for(const [name,progress,server,expected] of [
  ['first launch',{},anonymous,'welcome'],
  ['welcome completed',{welcome:true},anonymous,'scan-card'],
  ['IC verified on server',{welcome:true},icPassed,'scan-face'],
  ['server IC retained after local preferences cleared',{},icPassed,'scan-face'],
])test(`${name}: intro resolves the correct stage`,async()=>{
  const app=await ready({progress,server});await app.flow.afterIntro();
  assert.deepEqual(app.transitions,[{method:'replace',url:base+expected}]);
  assert.equal(app.sessionStorage.values.get(keys.seen),'1');
});

test('Home is hidden synchronously until its server session is confirmed',async()=>{
  const pending=deferred();const app=loadFlow({page:'home#map',progress:{face:true},fetcher:()=>pending.promise});
  assert.equal(app.document.documentElement.style.visibility,'hidden');
  assert.match(app.gate().textContent,/Checking your session/);
  assert.equal(app.transitions.length,0);
  assert.equal(app.flow.getSession(),null);
  pending.resolve({ok:true,json:async()=>verified});await app.flow.ready;await flush();
  assert.equal(app.document.documentElement.style.visibility,'');
  assert.equal(app.gate(),null);
  assert.equal(app.location.hash,'#map');
  assert.equal(app.transitions.length,0);
});

for (const page of ['', 'welcome#welcome-1']) test(`${page || 'intro'} stays painted while session validation is pending`,async()=>{
  const pending=deferred();const app=loadFlow({page,fetcher:()=>pending.promise});
  assert.notEqual(app.document.documentElement.style.visibility,'hidden');
  assert.equal(app.gate(),null,'a session check must not replace the public phone with a full-screen overlay');
  const navigation=app.flow.go('home');await flush();
  assert.equal(app.transitions.length,0,'visible onboarding must not bypass server access checks');
  pending.resolve({ok:true,json:async()=>anonymous});await navigation;await flush();
  assert.equal(app.gate(),null);
  assert.equal(app.transitions.at(-1).url,base+'welcome');
});

test('public onboarding still offers recovery when the session service fails',async()=>{
  const app=loadFlow({page:'welcome',fetcher:()=>Promise.reject(Error('offline'))});await flush();
  assert.match(app.gate().textContent,/Reconnect to continue/);
  assert.equal(app.flow.getSession(),null);
  assert.equal(app.transitions.length,0);
});

test('session reads are same-origin, uncached requests and never use a frontend token',async()=>{
  const app=await ready();const {url,options}=app.requests[0];
  assert.equal(url,base+'api/session');assert.equal(options.credentials,'same-origin');
  assert.equal(options.cache,'no-store');assert.equal(options.headers,undefined);
  assert.equal(app.timers.size,0);
});

test('local legacy face and IC flags cannot unlock Home or skip verification',async()=>{
  const app=await ready({page:'home#profile',progress:{welcome:true,ic:true,face:true},server:anonymous});
  assert.equal(app.document.documentElement.style.visibility,'hidden');
  assert.deepEqual(app.transitions,[{method:'replace',url:base+''}]);
  assert.deepEqual(JSON.parse(app.localStorage.values.get(keys.progress)),{welcome:true});
  assert.equal(app.flow.complete('face'),false);assert.equal(app.flow.complete('ic'),false);
  assert.equal(app.flow.shouldSkipIntro(),false);
  await app.flow.go('home#home');
  assert.equal(app.transitions.at(-1).url,base+'scan-card');
});

test('only welcome UI progress is persisted and identity results stay in memory',async()=>{
  const app=await ready({server:{...icPassed,faceChallenge:[{step:'blink',instruction:'Blink twice'}],expiresAt:'2026-10-28T23:00:00Z'}});
  assert.equal(app.flow.complete('welcome'),true);app.flow.complete('face');
  for(const store of [app.localStorage,app.sessionStorage]){
    assert.deepEqual(JSON.parse(store.values.get(keys.progress)),{welcome:true});
    assert.equal([...store.values.values()].some(value=>/challenge|expiresAt|icPassed|verified|data:image/.test(value)),false);
  }
  const data=app.flow.getSession();assert.equal(data.faceChallenge[0].step,'blink');
  assert.ok(Object.isFrozen(data));assert.ok(Object.isFrozen(data.faceChallenge[0]));
});

test('Skip enters Home without requesting either verification or claiming a verified session',async()=>{
  const app=await ready({page:'welcome#welcome-3'});
  await app.flow.skipVerification();
  assert.equal(app.transitions.at(-1).url,base+'home#home');
  assert.equal(app.flow.isGuest(),true);
  assert.deepEqual(plain(app.flow.getSession()),anonymous);
  assert.deepEqual(app.requests.map(r=>r.url),[base+'api/session']);
  for(const store of [app.localStorage,app.sessionStorage])assert.equal(store.values.get(keys.guest),'1');
  assert.equal(app.flow.complete('ic'),false);assert.equal(app.flow.complete('face'),false);
});

test('skipped onboarding survives Home refresh and Back without opening scanners',async()=>{
  const local={[keys.guest]:'1'};
  const home=await ready({page:'home#map',local,progress:{welcome:true}});
  assert.equal(home.gate(),null);assert.equal(home.transitions.length,0);
  assert.equal(home.document.documentElement.style.visibility,'');
  home.dispatch('pageshow',{persisted:true});await flush();assert.equal(home.transitions.length,0);
  for(const page of ['','welcome#welcome-2','scan-card','scan-face']){
    const app=await ready({page,local,progress:{welcome:true}});
    assert.equal(app.transitions.at(-1).url,base+'home#home');
    assert.equal(app.flow.getSession().verified,false);
  }
});

test('sign out clears Skip preference and the next entry shows normal onboarding',async()=>{
  const app=await ready({page:'home#settings',local:{[keys.guest]:'1'},session:{[keys.guest]:'1'},progress:{welcome:true}});
  await app.flow.logout();assert.equal(app.flow.isGuest(),false);
  for(const store of [app.localStorage,app.sessionStorage])assert.equal(store.values.has(keys.guest),false);
  const next=await ready({local:Object.fromEntries(app.localStorage.values)});await next.flow.afterIntro();
  assert.equal(next.transitions.at(-1).url,base+'welcome');
});

test('Get Started still follows normal card then face prerequisites without Skip',async()=>{
  const app=await ready({page:'welcome#welcome-3'});
  app.flow.complete('welcome');await app.flow.go('scan-card');
  assert.equal(app.transitions.at(-1).url,base+'scan-card');assert.equal(app.flow.isGuest(),false);
  await app.flow.go('scan-face');assert.equal(app.transitions.at(-1).url,base+'scan-card');
});

test('verified returning users always enter Home regardless of elapsed time or replay URL',async()=>{
  for(const page of ['','./','?replay=1','welcome#welcome-2','scan-card','scan-face']){
    const app=await ready({page,server:verified,session:{[keys.activity]:'1',[keys.seen]:'1',[keys.route]:'home#map'}});
    assert.equal(app.flow.shouldSkipIntro(),true);
    assert.deepEqual(app.transitions,[{method:'replace',url:base+'home#home'}],page);
    assert.equal(app.document.documentElement.style.visibility,'hidden');
  }
});

test('anonymous incomplete flow retains the five-minute intro rule',async()=>{
  for(const [age,expected] of [[0,true],[299_999,true],[300_000,false],[300_001,false],[-1,false]]){
    const app=await ready({session:{[keys.seen]:'1',[keys.activity]:String(2_000_000-age)}});
    assert.equal(app.flow.shouldSkipIntro(),expected,`age ${age}`);
    app.flow.markIntroSeen();assert.equal(app.flow.shouldSkipIntro(),expected,'new activity must not change the entry decision');
  }
});

test('known routes respect server prerequisites and external or unknown routes are rejected',async()=>{
  const app=await ready({page:'home',server:verified});
  await app.flow.go('home#map');
  assert.equal(app.transitions.at(-1).url,base+'home#map');
  for(const target of ['https://example.com/home','//example.com/home','../fixmycity/home','assets/home','missing.html','javascript:alert(1)'])await assert.rejects(app.flow.go(target),/Unknown app page/);
  const incomplete=await ready({progress:{welcome:true}});
  await incomplete.flow.go('scan-face');assert.equal(incomplete.transitions.at(-1).url,base+'scan-card');
});

test('refreshing after backend verification updates authoritative access without local completion',async()=>{
  const app=await ready({page:'scan-card',progress:{welcome:true}});
  app.setServer(icPassed);const ic=await app.flow.refreshSession();assert.equal(ic.icPassed,true);
  await app.flow.go('scan-face');assert.equal(app.transitions.at(-1).url,base+'scan-face');
  app.setServer(verified);const face=await app.flow.refreshSession();assert.equal(face.verified,true);
  assert.equal(app.transitions.at(-1).url,base+'home#home');
  assert.deepEqual(JSON.parse(app.localStorage.values.get(keys.progress)),{welcome:true});
});

for(const [name,reply] of [
  ['network failure',()=>Promise.reject(Error('offline'))],
  ['service error',()=>({ok:false,json:async()=>({verified:false,icPassed:false})})],
  ['malformed session',()=>({ok:true,json:async()=>({verified:true})})],
  ['contradictory session',()=>({ok:true,json:async()=>({verified:true,icPassed:false})})],
])test(`${name} fails closed with a retry screen`,async()=>{
  const app=loadFlow({page:'home',progress:{welcome:true,ic:true,face:true},fetcher:reply});
  let resolved=false;app.flow.ready.then(()=>{resolved=true;});await flush();
  assert.equal(resolved,false);assert.equal(app.flow.getSession(),null);
  assert.equal(app.document.documentElement.style.visibility,'hidden');
  assert.match(app.gate().textContent,/Reconnect to continue/);assert.equal(app.transitions.length,0);
  app.setFetcher(null);app.setServer(verified);
  app.gate().children.find(child=>child.tagName==='button').click();
  await app.flow.ready;await flush();
  assert.equal(app.document.documentElement.style.visibility,'');assert.equal(app.gate(),null);
});

test('navigation queued before session check waits without leaking protected Home',async()=>{
  const pending=deferred();const app=loadFlow({progress:{welcome:true},fetcher:()=>pending.promise});
  const navigation=app.flow.go('home');await flush();assert.equal(app.transitions.length,0);
  pending.resolve({ok:true,json:async()=>anonymous});await navigation;
  assert.equal(app.transitions.at(-1).url,base+'scan-card');
});

test('logout waits for server revocation before clearing local state or navigating',async()=>{
  const app=await ready({page:'home#settings',progress:{welcome:true},server:verified,local:{[keys.consent]:'{"version":1,"accepted":true}'},session:{[keys.seen]:'1',[keys.activity]:'1999999',[keys.app]:'{"draft":"keep until confirmed"}'}});
  const pending=deferred();app.setFetcher(()=>pending.promise);
  const result=app.flow.logout();assert.equal(app.flow.isLoggingOut(),true);
  assert.equal(app.sessionStorage.values.has(keys.seen),true);
  assert.equal(app.localStorage.values.has(keys.consent),true);
  assert.equal(app.transitions.length,0);assert.match(app.gate().textContent,/Signing out/);
  assert.equal(app.flow.logout(),result,'multiple clicks share one revocation request');
  const request=app.requests.at(-1);
  assert.equal(request.url,base+'api/logout');assert.equal(request.options.method,'POST');
  assert.equal(request.options.credentials,'same-origin');assert.equal(request.options.headers['Content-Type'],'application/json');assert.equal(request.options.body,'{}');
  pending.resolve({ok:true,json:async()=>({loggedOut:true,verified:false})});
  assert.deepEqual(plain(await result),{loggedOut:true});
  assert.deepEqual(JSON.parse(app.localStorage.values.get(keys.progress)),{});
  assert.equal(app.localStorage.values.has(keys.consent),false);
  for(const key of [keys.seen,keys.activity,keys.route,keys.app])assert.equal(app.sessionStorage.values.has(key),false,key);
  assert.deepEqual(app.transitions,[{method:'replace',url:base+'?replay=1'}]);
  app.dispatch('pagehide');app.document.hidden=true;app.dispatch('visibilitychange');
  assert.equal(app.sessionStorage.values.has(keys.activity),false);assert.equal(app.sessionStorage.values.has(keys.route),false);
});

test('failed or unconfirmed logout preserves state and provides a real retry action',async()=>{
  for(const response of [{ok:false,json:async()=>({})},{ok:true,json:async()=>({loggedOut:true,verified:true})}]){
    const app=await ready({page:'home',progress:{welcome:true},server:verified,session:{[keys.seen]:'1'}});
    app.setFetcher(()=>response);assert.deepEqual(plain(await app.flow.logout()),{loggedOut:false});
    assert.equal(app.flow.isLoggingOut(),false);assert.equal(app.flow.getSession().verified,true);
    assert.equal(app.sessionStorage.values.get(keys.seen),'1');assert.equal(app.transitions.length,0);
    assert.match(app.gate().textContent,/Couldn’t confirm sign out/);assert.match(app.gate().textContent,/session may still be active/);
    app.setFetcher(null);app.gate().children.find(child=>child.textContent==='Retry sign out').click();await flush();
    assert.equal(app.transitions.at(-1).url,base+'?replay=1');
  }
});

test('logout touches only owned state, preserving original FixMyCity and report drafts',async()=>{
  const legacy={'fixmycity-intro-seen':'1','fixmycity-last-active':'2000000','fixmycity-reports-v1':'["original report"]','fixmycity2-home-drafts-v1':'["keep draft"]','other-app':'keep'};
  const app=await ready({page:'home',server:verified,local:legacy,session:legacy});await app.flow.logout();
  for(const store of [app.localStorage,app.sessionStorage]){
    for(const key of store.reads)assert.ok(key.startsWith('fixmycity2-'),key);
    for(const [key] of store.writes)assert.ok(key.startsWith('fixmycity2-'),key);
    for(const key of store.removes)assert.ok(key.startsWith('fixmycity2-'),key);
    for(const [key,value] of Object.entries(legacy))assert.equal(store.values.get(key),value,key);
  }
});

test('Back-restored Home revalidates server revocation and hides content during check',async()=>{
  const app=await ready({page:'home#profile',server:verified});
  app.setServer(anonymous);app.dispatch('pageshow',{persisted:true});
  assert.equal(app.document.documentElement.style.visibility,'hidden');await flush();
  assert.equal(app.transitions.at(-1).url,base+'');
  assert.equal(app.flow.getSession().verified,false);
});

test('failed later revalidation cannot reuse ready to navigate on stale credentials',async()=>{
  const app=await ready({page:'home',server:verified});app.setFetcher(()=>Promise.reject(Error('offline')));
  app.dispatch('pageshow',{persisted:true});await flush();await app.flow.go('home#map');
  assert.equal(app.flow.getSession(),null);assert.equal(app.transitions.length,0);assert.match(app.gate().textContent,/Reconnect/);
});

test('route changes and page hiding retain the last route without changing fresh-launch destination',async()=>{
  const app=await ready({page:'home#home',server:verified});app.setURL('home#map');app.dispatch('pagehide');
  assert.equal(app.sessionStorage.values.get(keys.route),'home#map');
  app.setURL('home#profile');app.dispatch('hashchange');assert.equal(app.sessionStorage.values.get(keys.route),'home#profile');
  const reopened=await ready({server:verified,session:Object.fromEntries(app.sessionStorage.values)});
  assert.equal(reopened.transitions.at(-1).url,base+'home#home');
});

test('back uses owned history and safe replacement when entered directly',async()=>{
  const internal=await ready({page:'welcome',referrer:base+'',historyLength:2});internal.flow.back('');assert.deepEqual(internal.transitions,[{method:'back'}]);
  const direct=await ready({page:'welcome',referrer:'https://other.example/',historyLength:2});direct.flow.back('');await flush();assert.deepEqual(direct.transitions,[{method:'replace',url:base+''}]);
});

test('malformed local progress falls back to session welcome while server remains authoritative',async()=>{
  for(const saved of ['{broken','1','true','[]','null']){
    const app=await ready({local:{[keys.progress]:saved},session:{[keys.progress]:'{"welcome":true,"ic":true,"face":true}'}});
    await app.flow.afterIntro();assert.equal(app.transitions.at(-1).url,base+'scan-card');
    assert.deepEqual(JSON.parse(app.localStorage.values.get(keys.progress)),{welcome:true});
  }
});

test('storage denial does not stop in-memory onboarding or server verification',async()=>{
  const app=await ready({localBlocked:true,sessionBlocked:true});app.flow.complete('welcome');await app.flow.afterIntro();assert.equal(app.transitions.at(-1).url,base+'scan-card');
  app.setServer(verified);await app.flow.refreshSession();assert.equal(app.transitions.at(-1).url,base+'home#home');
});

test('new browser with only HttpOnly server session reaches Home without local flags',async()=>{
  const app=await ready({server:verified});assert.equal(app.transitions.at(-1).url,base+'home#home');
  assert.deepEqual(JSON.parse(app.localStorage.values.get(keys.progress)),{welcome:false});
});


test('legacy HTML routes remain compatible but all emitted URLs are clean',async()=>{
  const app=await ready({page:'home.html#profile',server:verified});
  assert.equal(app.transitions.length,0);
  await app.flow.go('home.html#map');assert.equal(app.transitions.at(-1).url,base+'home#map');
  app.setServer(icPassed);await app.flow.refreshSession();
  for(const [input,expected] of [['welcome.html?page=2','welcome?page=2'],['scan-card.html#back','scan-card#back'],['scan-face.html','scan-face'],['index.html?replay=1','?replay=1']]){
    await app.flow.go(input);assert.equal(app.transitions.at(-1).url,base+expected);
  }
  assert.equal(app.transitions.some(item=>item.url.includes('.html')),false);
});

test('verified sessions cannot navigate back into onboarding until logout',async()=>{
  const app=await ready({page:'home',server:verified});
  for(const path of ['./','welcome','scan-card','scan-face']){
    await app.flow.go(path);assert.equal(app.transitions.at(-1).url,base+'home#home');
  }
});
