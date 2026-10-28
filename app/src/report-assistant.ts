import {reviewReport,preparePhoto,type Assessment} from './lib/report-ai';
import {saveIncident,submitIncident} from './lib/local-reports';
const holder=document.createElement('section');holder.className='ai-report-panel';holder.id='ai-report-panel';
holder.innerHTML='<div class="ai-panel-heading"><h2>AI report review</h2><span>BM / EN</span></div><p>Review the facts, suggested authorities and linked tasks. Attached photos are included in the AI review.</p><button type="button" class="fmc-button" id="ai-review-draft">Review with AI</button><p id="ai-review-status" role="status"></p><div id="ai-review-result"></div>';
document.querySelector('#page-review .rp-contact')?.before(holder);
const status=holder.querySelector<HTMLElement>('#ai-review-status')!,result=holder.querySelector<HTMLElement>('#ai-review-result')!,button=holder.querySelector<HTMLButtonElement>('#ai-review-draft')!;
const serviceChoice=document.createElement('label');serviceChoice.hidden=true;
const serviceConsent=document.createElement('input');serviceConsent.type='checkbox';
serviceChoice.append(serviceConsent,document.createTextNode(' Use Gemini to review my text report. The report text and confirmed location will be sent to Google.'));
button.before(serviceChoice);
if(['localhost','127.0.0.1'].includes(location.hostname))void fetch('/api/ai/status',{cache:'no-store'}).then(response=>response.ok?response.json():null).then(info=>{serviceChoice.hidden=info?.incidentServiceAvailable!==true;}).catch(()=>{});
let controller:AbortController|null=null,reviewEpoch=0;
let current:Assessment|null=null,protectedPhotos:string[]=[],lastContext='';
const fingerprint=()=>JSON.stringify(window.FMCReportBridge?.context(),(key,value)=>key==='assessment'?undefined:value);
const element=(tag:string,text:string,className='')=>{const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;};
function render(a:Assessment){
 current=a;
 result.replaceChildren();result.append(element('h3',a.facts.title),element('p',a.facts.summaryEn));
 const source=document.createElement('details');source.append(element('summary','Original words and Malay summary'),element('p',a.originalText),element('p',a.facts.summaryMs));result.append(source);
 if(a.emergency.required){const alert=element('p',a.emergency.message!,'ai-urgent');const call=document.createElement('a');call.href='tel:999';call.textContent='Call 999';alert.append(document.createElement('br'),call);result.append(alert);}
 result.append(element('h3','Location'),element('p',a.location.text||'Not supplied'),element('p',a.location.confirmed?'Coordinates confirmed by you':'Confirm the map pin before routing.'));
 result.append(element('h3','Suggested authorities'));
 for(const authority of a.authorities){const line=element('p',authority.name+' · review required');const link=document.createElement('a');link.href=authority.source;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Official source';line.append(document.createElement('br'),link);result.append(line);}
 if(!a.authorities.length)result.append(element('p','Ownership and local jurisdiction need review.'));
 result.append(element('h3','Separate tasks'));
 const list=document.createElement('ul');for(const task of a.proposal.tasks)list.append(element('li',task.title+' · '+task.status.replaceAll('_',' ')));result.append(list);
 const plan=document.createElement('details');plan.append(element('summary','Response proposal'),element('p',a.proposal.vehicle.capability),element('p','Access point: '+(a.proposal.accessPoint||'Not supplied')),element('p','Personnel count, assigned vehicle and route need agency confirmation. No dispatch has been made.'));result.append(plan);
 if(a.related.length){result.append(element('h3','Possible related reports'));const select=document.createElement('select');select.id='ai-related-hazard';select.append(new Option('Keep separate — no confirmed link',''));for(const r of a.related)select.append(new Option(`${r.demo?'Demo · ':''}${r.id} · ${r.relationship.replaceAll('_',' ')}`,r.id));result.append(element('p','Confirm the same location and hazard before linking. An injury keeps its own response record.'),select);}
 if(a.facts.unknownFields.length)result.append(element('h3','Still to confirm'),element('p',a.facts.unknownFields.join(' · ')));
 result.append(element('p',a.facts.nextQuestionEn,'ai-next-question'));
}
async function analyze(){
 const bridge=window.FMCReportBridge;if(!bridge)return;
 const epoch=++reviewEpoch;controller?.abort();controller=new AbortController();const context=bridge.context(),stamp=fingerprint();button.disabled=true;status.textContent='Preparing your report…';result.replaceChildren();protectedPhotos=[];current=null;lastContext='';
 try{
  const photos=await Promise.all(context.photos.slice(0,3).map(preparePhoto));
  if(serviceConsent.checked&&photos.length)throw Error('Gemini text review does not include photos. Uncheck Gemini to review this report with photos.');
  const assessment=await reviewReport({mode:'intake',transcript:context.transcript,location:context.location,photos,allowExternalProcessing:serviceConsent.checked,language:document.documentElement.lang==='ms'?'ms':'en'},controller.signal);
  if(epoch!==reviewEpoch)return;
  if(stamp!==fingerprint())throw Error('Your report changed during the review. Review it again to include the changes.');
  const stored=await saveIncident(assessment,context);if(epoch!==reviewEpoch)return;
  bridge.apply(stored.assessment);render(stored.assessment);lastContext=fingerprint();status.textContent='Draft saved. Check the facts, then submit your report.';
  if(photos.length){const privacy=document.createElement('details');privacy.append(element('summary','Photo privacy preview · review required'),element('p','Suggested masks can miss faces or plates. These copies are not published; check them before sharing.'));
   for(const [index,protectedImage]of (stored.safePhotos as string[]).entries()){if(epoch!==reviewEpoch)return;protectedPhotos.push(protectedImage);const image=document.createElement('img');image.src=protectedImage;image.alt='Protected photo '+(index+1);privacy.append(image);}const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.id='ai-privacy-reviewed';label.append(check,document.createTextNode(' I reviewed every image and the visible identifying details are covered.'));privacy.append(label);result.append(privacy);
  }
 }catch(error){if(epoch===reviewEpoch&&(error as Error).name!=='AbortError')status.textContent=(error as Error).message;}
 finally{if(epoch===reviewEpoch)button.disabled=false;}
}
button.addEventListener('click',()=>void analyze());
window.addEventListener('fixmycity:report-assessed',event=>{const a=(event as CustomEvent<Assessment>).detail;render(a);lastContext=fingerprint();status.textContent='AI draft · confirm the details.';});
let chatEpoch=0,chatAbort:AbortController|null=null;
window.addEventListener('fixmycity:ai-chat',async event=>{
 const bridge=window.FMCReportBridge;if(!bridge)return;
 const context=bridge.context(),epoch=++chatEpoch;chatAbort?.abort();chatAbort=new AbortController();
 try{const a=await reviewReport({mode:'intake',transcript:context.transcript,location:context.location,allowExternalProcessing:serviceConsent.checked,language:document.documentElement.lang==='ms'?'ms':'en'},chatAbort.signal);if(epoch!==chatEpoch)return;const stored=await saveIncident(a,context);if(epoch!==chatEpoch)return;bridge.apply(stored.assessment);bridge.chat((a.sourceLanguage==='ms'?'Saya sedang sediakan laporan anda. ':'I’m preparing your report. ')+(a.emergency.required?a.emergency.message+' ':'')+(a.sourceLanguage==='ms'?a.facts.nextQuestionMs:a.facts.nextQuestionEn));}
 catch(error){if(epoch===chatEpoch&&(error as Error).name!=='AbortError')bridge.chat((error as Error).message);}
});
window.addEventListener('fixmycity:submit-report',async()=>{const submit=document.querySelector<HTMLButtonElement>('#rp-submit');if(submit)submit.disabled=true;try{if(!current||lastContext!==fingerprint())await analyze();if(!current||lastContext!==fingerprint())throw Error('Review the report before submitting.');const receipt=await submitIncident({linkedHazard:result.querySelector<HTMLSelectElement>('#ai-related-hazard')?.value||undefined,privacyReviewed:result.querySelector<HTMLInputElement>('#ai-privacy-reviewed')?.checked===true,protectedPhotos});status.textContent='Report '+receipt.id+' created.';}catch(error){status.textContent=(error as Error).message;holder.scrollIntoView({block:'center'});}finally{if(submit)submit.disabled=false;}});
const localLinks=document.createElement('p');localLinks.className='local-report-links';localLinks.innerHTML='<a href="cases">Saved reports</a>'+(['localhost','127.0.0.1'].includes(location.hostname)?' · <a href="admin">Admin workspace</a> · <a href="ai-lab">AI knowledge & tests</a>':'');document.querySelector('#page-scroll .nearby')?.before(localLinks);if(!localLinks.isConnected)document.querySelector('.shortcuts')?.after(localLinks);
window.addEventListener('pagehide',()=>{reviewEpoch++;chatEpoch++;controller?.abort();chatAbort?.abort();});
