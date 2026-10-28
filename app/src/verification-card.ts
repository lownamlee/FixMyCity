import {RememberedConsent} from './lib/remembered-consent';
import {captureCardSequence} from './lib/live-card-sequence';

type Side='front'|'back';
type ServiceError=Error&{status?:number;code?:string;retryAfter?:number};
const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const camera=window.FMCCamera,api=window.FMCVerificationAPI;
const capture=element<HTMLButtonElement>('capture-button'),frame=element('scan-frame'),flash=element('flash');
const consent=element<HTMLDialogElement>('verification-consent'),result=element<HTMLDialogElement>('verification-result');
const checkbox=element<HTMLInputElement>('verification-consent-check'),agree=element<HTMLButtonElement>('consent-continue');
const next=element<HTMLButtonElement>('continue-button'),privacy=element<HTMLButtonElement>('privacy-choices');
const preference=new RememberedConsent('fixmycity2-identity-consent-v2',2);
let side:Side='front',challenge:ChallengeStep[]=[],expiresAt=0,active=false,busy=false,checked=false,initialized=false;
let controller:AbortController|null=null,generation=0,lastCheckAt=0,retryAt=0,errors=0,cancelFailed=false,cancelling=false;
let autoTimer:ReturnType<typeof setTimeout>|undefined,successTimer:ReturnType<typeof setTimeout>|undefined;

function setBusy(value:boolean){busy=value;capture.disabled=value;agree.disabled=value||!checkbox.checked;next.disabled=value;privacy.disabled=value;frame.classList.toggle('checking',value);}
function sampleProgress(count:number,checking=false){
  for(let i=1;i<=3;i++){const dot=element('card-dot-'+i);dot.classList.toggle('captured',i<=count);dot.classList.toggle('pending',checking);}
  element('card-capture-progress').setAttribute('aria-label',`${count} of 3 photos captured${checking?' · checking MyKad':''}`);
}
function stopTimers(){clearTimeout(autoTimer);clearTimeout(successTimer);autoTimer=undefined;successTimer=undefined;}
function abort(){generation++;controller?.abort();controller=null;stopTimers();setBusy(false);sampleProgress(0);flash.classList.remove('on');}
function closeDialogs(){for(const dialog of [consent,result])if(dialog.open)dialog.close();}
function status(text:string){element('scanner-status').textContent=text;}
function route(step:string){history.replaceState({fmcCardStep:step},'','#'+step);render();}
function showResult(title:string,message:string,action='Try again'){active=false;stopTimers();closeDialogs();element('verification-result-title').textContent=title;element('verification-result-message').textContent=message;element('verification-result-action').textContent=action;result.showModal();}
function cancellationGate(){if(cancelling)return true;if(cancelFailed){showResult('Cancellation not confirmed','Retry cancellation before continuing.','Retry cancellation');return true;}return false;}
function canCheck(){return active&&!busy&&!checked&&!document.hidden&&camera.ready()&&preference.accepted()&&location.hash==='#'+side&&!result.open&&!consent.open&&!cancellationGate();}
function schedule(delay=2000){clearTimeout(autoTimer);if(canCheck())autoTimer=setTimeout(()=>check(),Math.max(delay,lastCheckAt+7000-Date.now(),retryAt-Date.now()));}
function useSession(data:VerificationState){
  challenge=data.cardChallenge||[];expiresAt=Date.parse(data.expiresAt||'');checked=data.icPassed===true;side=data.icFrontPassed?'back':'front';
  if(!checked&&(challenge.length!==2||challenge[0]?.step!=='front'||challenge[1]?.step!=='back'))throw new Error('Please reload the app to start a new MyKad check.');
}
async function refresh(){return window.FMCFlow?.refreshSession?window.FMCFlow.refreshSession():api.session();}
function render(){
  if(!camera.require()||cancellationGate())return;
  const scanning=active&&(location.hash==='#front'||location.hash==='#back');
  element('guidance-page').hidden=scanning;element('scanner-page').hidden=!scanning;
  if(scanning){
    if(location.hash!=='#'+side)history.replaceState(null,'','#'+side);
    element('step-count').textContent=side==='front'?'1/2':'2/2';
    element('instruction').textContent=challenge.find(item=>item.step===side)?.instruction||`Show the ${side} of your original MyKad.`;
    capture.setAttribute('aria-label','Capture '+side+' of MyKad');
  }
  document.title=(scanning?'Scan MyKad':'MyKad photo guidance')+' · FixMyCity';
}
async function continueFace(){
  if(!checked||!camera.require())return;
  clearTimeout(successTimer);
  try{const state=await refresh();if(state.icPassed!==true)throw new Error('Your check expired. Please start again.');if(!camera.ready())return;if(window.FMCFlow)window.FMCFlow.go('scan-face');else location.assign('scan-face');}
  catch(error){checked=false;showResult('Please start again',(error as Error).message,'Start again');}
}
function passed(){
  checked=true;active=false;showResult('MyKad check passed','Front and back checked. Continuing to your face check…','Continue to face scan');
  successTimer=setTimeout(()=>continueFace(),1100);
}
async function start(){
  if(busy||!camera.require()||!preference.accepted()||cancellationGate())return;
  if(Date.now()<retryAt){showResult('Please wait','Checking can resume at '+new Date(retryAt).toLocaleTimeString()+'.','Close');return;}
  controller=new AbortController();const version=++generation;setBusy(true);element('consent-status').textContent='Preparing your check…';
  try{
    const data=await api.start(controller.signal);if(version!==generation||!camera.ready())return;
    useSession(data);closeDialogs();if(checked){passed();return;}
    active=true;errors=0;route(side);status('Auto-check is on. Hold your MyKad steady, or tap to capture.');
  }catch(error){if(version===generation&&(error as Error).name!=='AbortError')showResult('Check unavailable',(error as Error).message);}
  finally{if(version===generation){controller=null;setBusy(false);schedule(900);}}
}
function showConsent(){
  if(busy||!camera.require()||cancellationGate())return;
  abort();active=false;closeDialogs();route('consent');
  checkbox.checked=false;agree.disabled=true;element('consent-status').textContent='';consent.showModal();
}
function requestConsent(){
  if(busy||!camera.require()||cancellationGate())return;
  if(checked){passed();return;}
  abort();active=false;closeDialogs();
  if(preference.accepted()){start();return;}
  showConsent();
}
async function check(manual=false){
  if(!canCheck())return;
  if(Date.now()<retryAt){schedule();return;}
  if(Number.isFinite(expiresAt)&&Date.now()>=expiresAt){showResult('Your check expired','Start a new MyKad check to continue.','Start again');return;}
  if(Date.now()-lastCheckAt<5000){status('Hold steady. Your next check will start shortly.');schedule(0);return;}
  clearTimeout(autoTimer);lastCheckAt=Date.now();controller=new AbortController();const version=++generation,capturedSide=side;
  setBusy(true);sampleProgress(0);status('Hold your MyKad still — capturing 3 photos…');
  if(manual){flash.classList.remove('on');flash.classList.add('on');}
  try{
    const frames=await captureCardSequence(camera,capturedSide,controller.signal,count=>{sampleProgress(count);status('Hold still · '+count+' of 3 photos captured');});
    if(version!==generation||!camera.ready()||!active)return;
    sampleProgress(3,true);status('Photos captured. Keep your MyKad in place while we check…');
    const data=await api.icFrame(frames,controller.signal);
    if(version!==generation||!camera.ready()||!active)return;errors=0;
    if(data.passed===true||data.icPassed===true){
      const state=await refresh();if(version!==generation||!camera.ready())return;
      if(state.icPassed!==true)throw new Error('The server has not confirmed your MyKad check.');
      passed();return;
    }
    if(capturedSide==='front'&&data.sidePassed===true&&data.icFrontPassed===true){
      const state=await refresh();if(version!==generation||!camera.ready())return;
      if(state.icFrontPassed!==true)throw new Error('The server has not confirmed the front of your MyKad.');
      useSession(state);sampleProgress(0);route('back');status('Front checked. Turn your MyKad over — the back will scan automatically.');
    }else status(data.message||'Keep the text clear. Checking again automatically.');
  }catch(caught){
    const error=caught as ServiceError;
    if(version!==generation||error.name==='AbortError')return;
    if(error.status===429){
      if(error.code==='attempts_exhausted'||error.code==='daily_limit'){
        retryAt=error.code==='daily_limit'?Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth(),new Date().getUTCDate()+1):expiresAt;
        showResult('Automatic checks paused',error.message,'Close');
      }else{retryAt=Date.now()+Math.max(60,error.retryAfter||0)*1000;status('Checks will resume in a minute. Keep your MyKad ready.');}
    }else if(error.code==='check_in_progress'){retryAt=Date.now()+8000;status('Your previous check is still finishing. Please hold steady.');}
    else if(error.status===401||error.status===410||error.code==='front_required')showResult('Please start again',error.message,'Start again');
    else if(error.status===400||error.code==='capture_incomplete'){status(error.message);}
    else if(++errors>=3)showResult('Check unavailable',error.message);
    else{retryAt=Date.now()+10000;status('Connection interrupted. Retrying automatically…');}
  }finally{if(version===generation){controller=null;setBusy(false);sampleProgress(0);flash.classList.remove('on');schedule();}}
}
async function cancelCheck(){
  if(cancelling)return;cancelling=true;cancelFailed=false;active=false;abort();setBusy(true);
  try{await api.cancel();await refresh();checked=false;challenge=[];retryAt=0;}
  catch{cancelFailed=true;}
  finally{cancelling=false;setBusy(false);if(cancelFailed)cancellationGate();else route('guide');}
}
function showGuide(){active=false;abort();closeDialogs();route('guide');}
async function initialize(){
  if(initialized){if(location.hash==='#consent'&&!checked)showConsent();else render();return;}initialized=true;
  try{await window.FMCFlow?.ready;const state=window.FMCFlow?.getSession?.()||await api.session();checked=state.icPassed===true;if(checked&&camera.ready())passed();}
  catch{}finally{if(!checked){if(location.hash==='#consent')showConsent();else route('guide');}}
}
next.addEventListener('click',requestConsent);
privacy.addEventListener('click',()=>{if(busy)return;preference.forget();requestConsent();});
element('privacy-policy-link').addEventListener('click',()=>{active=false;abort();history.replaceState({fmcCardStep:'consent'},'','#consent');});
checkbox.addEventListener('change',()=>agree.disabled=busy||!checkbox.checked);
agree.addEventListener('click',()=>{if(busy||!consent.open||!checkbox.checked||!camera.require())return;preference.accept();start();});
element('consent-cancel').addEventListener('click',showGuide);
consent.addEventListener('cancel',event=>{event.preventDefault();showGuide();});
capture.addEventListener('click',()=>check(true));
element('verification-help').addEventListener('click',showGuide);
element('back-button').addEventListener('click',showGuide);
element('guide-back').addEventListener('click',()=>{showGuide();if(window.FMCFlow)window.FMCFlow.back('welcome#welcome-3');else location.assign('welcome#welcome-3');});
element('verification-result-action').addEventListener('click',()=>{
  if(checked){continueFace();return;}
  if(cancelFailed){cancelCheck();return;}
  const closing=element('verification-result-action').textContent==='Close';result.close();if(closing)showGuide();else requestConsent();
});
result.addEventListener('cancel',event=>{event.preventDefault();showGuide();});
element('cancel-verification-check').addEventListener('click',cancelCheck);
for(const name of ['hashchange','popstate'])addEventListener(name,()=>{if(location.hash==='#consent'&&!checked)showConsent();else if(location.hash!=='#'+side)showGuide();else render();});
addEventListener('pagehide',()=>{active=false;abort();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){active=false;abort();}});
camera.subscribe(state=>{
  if(state.ready){initialize();if(checked)passed();else render();}
  else{const pending=busy;active=false;abort();closeDialogs();if(pending&&!document.hidden&&!cancelling)cancelCheck();}
});
