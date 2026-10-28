import {AUTHORITIES,KNOWLEDGE_VERSION} from './ai/knowledge';
import {DATASETS} from './ai/datasets';
import {DemoWorkflow} from './ai/workflow';
import {reviewReport,preparePhoto,protectedPhoto} from './lib/report-ai';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const text=(tag:string,value:string)=>{const e=document.createElement(tag);e.textContent=value;return e;};
const value=(id:string)=>$<HTMLInputElement>(id).value;
const selected=(id:string)=>[...($<HTMLInputElement>(id).files||[])];
async function photo(file:File){const url=URL.createObjectURL(file);try{return await preparePhoto(url);}finally{URL.revokeObjectURL(url);}}
$('lab-analyze').onclick=async()=>{
 const button=$<HTMLButtonElement>('lab-analyze');button.disabled=true;$('lab-status').textContent='Reviewing the incident…';
 try{
  const photos=await Promise.all(selected('lab-photos').slice(0,3).map(photo));
  const a=await reviewReport({mode:'intake',transcript:value('lab-text'),demo:true,location:{text:value('lab-place'),lat:Number(value('lab-lat')),lng:Number(value('lab-lng')),confirmed:$<HTMLInputElement>('lab-confirm').checked,accessPoint:value('lab-access')},photos});
  const result=$('lab-result');result.hidden=false;result.replaceChildren(text('h3',a.facts.title),text('p',a.facts.summaryEn),text('p',a.facts.summaryMs));
  if(a.emergency.required)result.append(text('p',a.emergency.message!));
  result.append(text('h3','Suggested authorities'),text('p',a.authorities.map(x=>x.name).join(' · ')),text('h3','Next question'),text('p',a.facts.nextQuestionMs),text('p',a.facts.nextQuestionEn));
  result.append(text('h3','Possible links'),text('p',a.related.length?a.related.map(r=>`${r.id} · ${r.relationship.replaceAll('_',' ')} · review required`).join('\n'):'Confirm coordinates to compare the demo hazard.'));
  result.append(text('h3','Separate tasks'),text('p',a.proposal.tasks.map(t=>t.title).join(' + ')));
  for(const [index,p]of photos.entries()){const image=document.createElement('img');image.src=await protectedPhoto(p,a.privacy.regions,index);image.alt='Suggested privacy masks, requiring review';result.append(image);}
  const details=document.createElement('details');details.append(text('summary','Structured draft / provenance'),text('pre',JSON.stringify(a,null,2)));result.append(details);
  $('lab-status').textContent='AI draft ready. No report or dispatch was sent.';
 }catch(error){$('lab-status').textContent=(error as Error).message;}finally{button.disabled=false;}
};
const workflow=new DemoWorkflow();let replay=0,sequence=0;
function render(){
 $('lab-plan').replaceChildren(text('p',`Proposal v${workflow.version} · ${workflow.response.replaceAll('_',' ')}`),text('p',`2 test responders · ${workflow.plan.vehicle} · ${workflow.plan.entrance}`),text('p',workflow.plan.template));
 $('lab-audit').textContent=JSON.stringify(workflow.history,null,2);
 $('lab-reward').textContent=`Demo Aina · ${workflow.points} points · ${workflow.verifiedContributions} verified contributions · Repair: ${workflow.repair.replaceAll('_',' ')}`;
}
function action(fn:()=>void){try{fn();$('lab-workflow-status').textContent='Test state updated.';}catch(error){$('lab-workflow-status').textContent=(error as Error).message;}render();}
$('lab-approve').onclick=()=>action(()=>workflow.approve(workflow.version));
$('lab-revise').onclick=()=>action(()=>workflow.revise(workflow.plan.entrance==='Main gate'?'East gate':'Main gate'));
$('lab-dispatch').onclick=()=>action(()=>{workflow.acknowledge('demo-dispatch-'+workflow.version,workflow.version);});
$('lab-track').onclick=()=>action(()=>{
 if(!['dispatch_acknowledged','en_route'].includes(workflow.response))throw Error('Approve and acknowledge the test assignment first.');
 clearInterval(replay);let point=0;
 replay=window.setInterval(()=>{const accepted=workflow.telemetry({lat:3.1593,lng:101.7100+point*.00004,at:Date.now(),sequence:++sequence});if(accepted){$('lab-vehicle').setAttribute('cx',String(25+point*16));$('lab-vehicle').setAttribute('cy',String(100-point*1.5));$('lab-telemetry').textContent='Demo replay · last position '+new Date().toLocaleTimeString();render();}if(++point>=20)clearInterval(replay);},1000);
});
const freshness=window.setInterval(()=>{if(workflow.position&&workflow.tracking().stale)$('lab-telemetry').textContent='Demo replay stopped · location outdated · last update '+new Date(workflow.position.at).toLocaleTimeString();},1000);
$('lab-complete').onclick=()=>action(()=>{clearInterval(replay);workflow.completeResponse();$('lab-telemetry').textContent='Test response complete. Vehicle sharing ended; pothole repair remains open.';});
$('lab-authority-repair').onclick=()=>action(()=>workflow.authorityRepairComplete());
$('lab-resident-check').onclick=()=>action(()=>{workflow.confirmRepair(true);});
$('lab-compare').onclick=async()=>{
 const before=selected('lab-before')[0],after=selected('lab-after')[0];if(!before||!after){$('lab-repair-status').textContent='Choose a before and an after photo.';return;}
 const button=$<HTMLButtonElement>('lab-compare');button.disabled=true;$('lab-repair-status').textContent='Comparing visible changes…';
 try{const response=await fetch('/api/ai/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'repair',transcript:'Compare the same reported pothole before and after repair.',photos:await Promise.all([photo(before),photo(after)])})});const result=await response.json();if(!response.ok)throw Error(result.message);$('lab-repair-result').replaceChildren(text('p',result.comparison.visibleChanges),text('pre',JSON.stringify(result,null,2)));$('lab-repair-status').textContent='Advisory comparison only; no verification or points awarded.';}
 catch(error){$('lab-repair-status').textContent=(error as Error).message;}finally{button.disabled=false;}
};
for(const a of AUTHORITIES){const article=document.createElement('article'),link=document.createElement('a');link.href=a.source;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Official source';article.append(text('strong',a.name),text('p',a.use),text('p',a.phone||'Online referral'),link);$('lab-knowledge').append(article);}
$('lab-datasets').append(text('p','Knowledge version: '+KNOWLEDGE_VERSION));
for(const d of DATASETS){const item=document.createElement('details');item.append(text('summary',d.name+' · '+d.status),text('p',d.use),text('p',d.caution));if(d.source?.startsWith('https:')){const a=document.createElement('a');a.href=d.source;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Dataset / source';item.append(a);}$('lab-datasets').append(item);}
window.addEventListener('pagehide',()=>{clearInterval(replay);clearInterval(freshness);});render();
