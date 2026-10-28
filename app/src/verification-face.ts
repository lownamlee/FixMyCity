import {FaceActions,type FaceAction,type FaceSample} from './lib/face-actions';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const camera=window.FMCCamera,api=window.FMCVerificationAPI,video=document.querySelector<HTMLVideoElement>('[data-camera-video]')!;
const canvas=$<HTMLCanvasElement>('face-landmarks'),dialog=$<HTMLDialogElement>('face-result');
let worker:Worker|null=null,tracker:FaceActions|null=null,token='',generation=0,frameJob=0,homeJob=0,loadJob=0,lastVideo=-1,lastTick=0,requestId=0,pending=false,running=false,submitting=false,starting=false,confirmed=false,abort:AbortController|null=null;
const labels:Record<FaceAction,string>={look_left:'Turn left',look_right:'Turn right',blink:'Blink once'};
let cancellationPending=false;
function fit(){document.documentElement.style.setProperty('--scale',String(innerWidth<=520?1:Math.max(.2,Math.min(1,(innerWidth-48)/426,(innerHeight-48)/884))));}
function screen(name:string){document.querySelectorAll<HTMLElement>('.device-slot').forEach(n=>n.dataset.active=String(n.id===name+'-screen'));history.replaceState({fmcFaceStep:name},'','#'+name);}
function message(title:string,detail:string){$('scan-instruction').textContent=title;$('scan-caption').textContent=detail;}
function clearCanvas(){canvas.getContext('2d')?.clearRect(0,0,canvas.width,canvas.height);}
function stop(){generation++;running=false;starting=false;pending=false;submitting=false;cancelAnimationFrame(frameJob);clearTimeout(homeJob);clearTimeout(loadJob);abort?.abort();abort=null;worker?.terminate();worker=null;clearCanvas();$('face-checking').hidden=true;}
function failure(messageText:string){stop();$('face-result-title').textContent='Face check paused';$('face-result-message').textContent=messageText;if(!dialog.open)dialog.showModal();}
function progress(){
 const count=tracker?.position||0,circumference=2*Math.PI*168;
 $('ring-progress').style.strokeDasharray=String(circumference);$('ring-progress').style.strokeDashoffset=String(circumference*(1-count/3));$('ring-tip').style.transform=`rotate(${count*120}deg)`;
 document.querySelector('.face-circle')?.setAttribute('aria-valuenow',String(Math.round(count/3*100)));
 if(!tracker)return;
 tracker.actions.forEach((action,i)=>{const node=$('face-action-'+i);node.textContent=(i<count?'✓ ':i===count?'● ':'○ ')+labels[action];node.className='face-action'+(i<count?' done':i===count?' current':'');});
 $('face-step-count').textContent=count<3?`${count+1} of 3`:'3 of 3';
}
const contours=[[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,10],[33,160,158,133,153,144,33],[362,385,387,263,373,380,362],[61,40,37,0,267,270,291,321,314,17,84,91,61],[70,63,105,66,107],[336,296,334,293,300]];
function detection(data:any){
 const faces=data.faces as Array<Array<{x:number;y:number;z:number}>>,points=faces[0];clearCanvas();
 const size=canvas.clientWidth||314,dpr=Math.min(2,devicePixelRatio||1);if(canvas.width!==Math.round(size*dpr)){canvas.width=Math.round(size*dpr);canvas.height=canvas.width;}
 const scale=Math.max(size/data.width,size/data.height),dx=(data.width*scale-size)/2,dy=(data.height*scale-size)/2;
 const mapped=points?.map(p=>({x:size-(p.x*data.width*scale-dx),y:p.y*data.height*scale-dy}));
 const bounds=mapped?{left:Math.min(...mapped.map(p=>p.x))/size,right:Math.max(...mapped.map(p=>p.x))/size,top:Math.min(...mapped.map(p=>p.y))/size,bottom:Math.max(...mapped.map(p=>p.y))/size}:null;
 const inFrame=!!bounds&&bounds.left>.015&&bounds.right<.985&&bounds.top>.015&&bounds.bottom<.985&&bounds.bottom-bounds.top>.28;
 if(mapped){const ctx=canvas.getContext('2d')!;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.lineWidth=1.3;ctx.strokeStyle=faces.length===1&&inFrame?'#63bdff':'#ffc45c';ctx.fillStyle=ctx.strokeStyle;ctx.shadowColor='#005dff';ctx.shadowBlur=3;
  for(const path of contours){ctx.beginPath();path.forEach((i,k)=>{if(mapped[i])k?ctx.lineTo(mapped[i].x,mapped[i].y):ctx.moveTo(mapped[i].x,mapped[i].y);});ctx.stroke();}
  for(const i of [1,4,33,133,362,263,61,291])if(mapped[i]){ctx.beginPath();ctx.arc(mapped[i].x,mapped[i].y,2,0,Math.PI*2);ctx.fill();}
  ctx.setTransform(1,0,0,1,0,0);
 }
 const width=points?Math.abs(points[454].x-points[234].x):0;
 const yaw=width>.01?(points[1].x-(points[454].x+points[234].x)/2)/width:0;
 const sample:FaceSample={at:data.at,mediaTime:data.mediaTime,faceCount:Math.min(2,faces.length),inFrame,yaw:Math.max(-2,Math.min(2,yaw)),blinkLeft:data.blinkLeft,blinkRight:data.blinkRight};
 tracker!.update(sample);progress();
 const step=tracker!.actions[tracker!.position];
 message(step?labels[step]:'Movements complete',tracker!.hint);
 $('face-capture-help').textContent=faces.length===1&&inFrame?'Face detected · follow the prompt':'Keep your whole face inside the circle';
 if(tracker!.complete)void complete();
}
async function tick(time:number,epoch:number){
 if(epoch!==generation||!running||submitting||!camera.ready()||document.hidden)return;
 frameJob=requestAnimationFrame(next=>void tick(next,epoch));
 if(pending||time-lastTick<80||video.paused||video.readyState<2||video.currentTime===lastVideo)return;
 pending=true;lastTick=time;lastVideo=video.currentTime;const mediaTime=video.currentTime,at=Date.now();
 try{const bitmap=await createImageBitmap(video,{resizeWidth:640,resizeHeight:Math.round(video.videoHeight/video.videoWidth*640),resizeQuality:'low'});
  if(epoch!==generation||!running){bitmap.close();return;}
  worker!.postMessage({type:'frame',id:++requestId,bitmap,at,mediaTime,timestamp:performance.now()},[bitmap]);
 }catch{if(epoch===generation)failure('Your camera frame is unavailable. Allow the camera and try again.');}
}
async function start(){
 if(cancellationPending||starting||running||submitting||document.hidden||!camera.ready())return;
 stop();starting=true;const epoch=generation;screen('scan');message('Finding your face','Preparing face detection…');$('face-capture-help').textContent='Left, right, then blink — no tapping needed';
 try{
  await window.FMCFlow?.ready;if(epoch!==generation)return;
  const state=await (window.FMCFlow?.refreshSession?window.FMCFlow.refreshSession():api.session());if(epoch!==generation)return;
  if(state.verified){confirmed=true;screen('success');homeJob=window.setTimeout(()=>void enterHome(),900);return;}
  if(!state.icPassed){window.FMCFlow?.go('scan-card');return;}
  if(!state.faceToken||state.faceChallenge?.length!==3)throw Error('Refresh this page to load the latest face check.');
  token=state.faceToken;tracker=new FaceActions(state.faceChallenge.map(s=>s.step as FaceAction));progress();
  worker=new Worker(new URL('face-landmarker-worker.js',location.href));
  loadJob=window.setTimeout(()=>{if(epoch===generation)failure('Face detection took too long to load. Check your connection and try again.');},30000);
  worker.onerror=()=>{if(epoch===generation)failure('Face detection is unavailable in this browser. Try a current Chrome, Edge or Safari browser.');};
  worker.onmessage=event=>{
   if(epoch!==generation||!camera.ready()||document.hidden)return;
   const data=event.data;
   if(data.type==='ready'){clearTimeout(loadJob);starting=false;running=true;lastVideo=-1;lastTick=0;frameJob=requestAnimationFrame(t=>void tick(t,epoch));}
   else if(data.type==='error')failure(data.message);
   else if(data.type==='result'&&running&&!submitting){pending=false;detection(data);}
  };
  worker.postMessage({type:'init',base:new URL('./',location.href).href});
 }catch(error){if(epoch===generation)failure((error as Error).message);}
 finally{if(epoch===generation&&!worker)starting=false;}
}
async function complete(){
 if(submitting||!tracker?.complete||!camera.ready())return;
 submitting=true;running=false;cancelAnimationFrame(frameJob);worker?.terminate();worker=null;const epoch=generation;abort=new AbortController();$('face-checking').hidden=false;
 try{
  const result=await api.faceActions({version:1,challengeToken:token,samples:tracker.samples},abort.signal);
  if(epoch!==generation||!camera.ready()||document.hidden)return;
  if(!result.verified||!result.passed)throw Error(result.message||'Please follow the movements again.');
  const state=await (window.FMCFlow?.refreshSession?window.FMCFlow.refreshSession():api.session());if(epoch!==generation)return;
  if(!state.verified)throw Error('Your result could not be confirmed. Try again.');
  confirmed=true;$('face-checking').hidden=true;screen('success');homeJob=window.setTimeout(()=>void enterHome(),1100);
 }catch(error){if(epoch===generation&&(error as Error).name!=='AbortError')failure((error as Error).message);}
 finally{if(epoch===generation){submitting=false;abort=null;}}
}
async function enterHome(){if(!confirmed)return;clearTimeout(homeJob);if(window.FMCFlow)await window.FMCFlow.go('home');else location.assign('home');}
async function cancel(){cancellationPending=true;stop();try{await api.cancel();cancellationPending=false;await window.FMCFlow?.refreshSession();if(window.FMCFlow)window.FMCFlow.go('scan-card');else location.assign('scan-card');}catch{failure('Cancellation could not be confirmed. Try again before continuing.');$('face-result-action').textContent='Retry cancellation';}}
$('cancel-scan').addEventListener('click',()=>void cancel());$('cancel-face-check').addEventListener('click',()=>void cancel());
$('continue-button').addEventListener('click',()=>void enterHome());
$('face-result-action').addEventListener('click',()=>{dialog.close();void (cancellationPending?cancel():start());});dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close();void (cancellationPending?cancel():start());});
addEventListener('pagehide',()=>{const checking=submitting;stop();if(checking)void api.cancel().catch(()=>{});});
addEventListener('popstate',()=>{if(!confirmed)void cancel();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){const checking=submitting;stop();if(checking)void api.cancel().catch(()=>{});}else if(camera.ready())void start();});
camera.subscribe(state=>{if(state.ready){if(!confirmed)void start();}else{const checking=submitting;stop();if(checking)void api.cancel().catch(()=>{});}});
fit();addEventListener('resize',fit);
