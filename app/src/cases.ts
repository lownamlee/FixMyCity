import {localRequest as apiRequest} from './lib/local-reports';
import {preparePhoto} from './lib/report-ai';
const $=(id:string)=>document.getElementById(id)!;
const el=(tag:string,value:string,cls='')=>{const n=document.createElement(tag);n.textContent=value;n.className=cls;return n;};
const authority=(location.pathname.includes('authority')||location.pathname==='/admin');
const localRequest=(path:string,body?:unknown)=>apiRequest(path,body,authority);let record:any=null,replay=0,selectedId='',loading=0,locationWatch:number|null=null,locationBusy=false;
const status=(s:string)=>$('case-status').textContent=s;
const human=(s:string)=>s.replaceAll('_',' ');
if(!['localhost','127.0.0.1'].includes(location.hostname)){document.querySelectorAll<HTMLAnchorElement>('a[href="admin"],a[href="ai-lab"]').forEach(a=>a.remove());$('case-scenario').hidden=true;$('case-scenario').nextElementSibling?.remove();}
if(authority){$('case-heading').textContent='Authority workspace';document.title='FixMyCity · Authority';}
function link(label:string,href:string,cls=''){const a=el('a',label,cls) as HTMLAnchorElement;a.href=href;return a;}
function button(label:string,fn:()=>Promise<unknown>,cls='secondary'){const b=el('button',label,cls) as HTMLButtonElement;b.onclick=async()=>{b.disabled=true;try{await fn();status('Saved.');await refresh();}catch(error){status((error as Error).message);}finally{b.disabled=false;}};return b;}
function section(title:string){const s=document.createElement('section');s.append(el('h3',title));return s;}
async function refresh(){
 const list=await localRequest('');window.dispatchEvent(new CustomEvent('fixmycity:case-list',{detail:list}));$('case-list').replaceChildren(...list.map((r:any)=>{const a=link('',`#${r.id}`,'case-list-item'+(selectedId===r.id?' active':''));a.append(el('strong',r.title),el('small',r.id+' · '+human(r.response_state)+(r.fixture?' · prepared hazard':'')));return a;}));
 const standings=await localRequest('/leaderboard');window.dispatchEvent(new CustomEvent('fixmycity:standings',{detail:standings}));$('case-leaderboard').replaceChildren(...standings.rows.map((r:any,i:number)=>{const row=el('div','','ranking'+(r.you?' you':''));row.append(el('span',String(i+1),'rank-number'),el('strong',r.name+(r.you?' · You':'')),el('b',r.points+' pts'));return row;}));
 $('case-contributions').replaceChildren(el('p',standings.recognitionAvailable?`${standings.verified} verified contributions · ${standings.points} points`:'Identity verification is required for contribution recognition.','muted'));
 for(const c of standings.contributions)$('case-contributions').append(el('p',`${c.report_id} · reviewed repair check · +${c.points} pts`,'tiny'));
 if(selectedId)await load(selectedId);
}
function images(values:string[],labels:string[]){const box=el('div','','case-images');values.forEach((value,i)=>{const f=document.createElement('figure'),img=new Image();img.src=value;img.alt=labels[i]||'Report evidence';f.append(img,el('figcaption',labels[i]||''));box.append(f);});return box;}
async function load(id:string){const own=++loading;const r=await localRequest('/'+id);if(own!==loading)return;record=r;render(r);window.dispatchEvent(new CustomEvent('fixmycity:case-view',{detail:r}));if(authority)void addDiagnostics(r);}
function render(r:any){
 const a=r.assessment,f=a.facts,host=$('case-detail');host.replaceChildren();const head=el('div','','section-heading');head.append(el('h2',f.title),el('span',human(r.response_state),'pill '+(r.response_state==='response_complete'?'green':'amber')));host.append(head,el('p',r.id+' · '+r.resident+' · '+new Date(r.created_at).toLocaleString(),'muted tiny'),el('p',f.summaryEn));
 const facts=el('div','','fact-grid');for(const [title,value]of [['People needing help',f.injuredCount===null?'Not confirmed':String(f.injuredCount)],['Location',a.location.text||'Needs confirmation'],['Safe access',a.location.accessPoint||'Needs confirmation']]){const d=el('div','','fact');d.append(el('small',title),el('strong',value));facts.append(d);}host.append(facts);
 const original=document.createElement('details');original.append(el('summary','Original conversation & Malay summary'),el('p',a.originalText,'case-original'),el('p',f.summaryMs));host.append(original);
 if(a.emergency.required){const urgent=el('p','If help is needed now, call 999 while this report is processed. ','case-urgent');urgent.append(link('Call 999','tel:999'));host.append(urgent);}
 const routing=section('Suggested authorities');routing.append(el('p','Suggestions need local ownership and jurisdiction review.','muted tiny'));for(const org of a.authorities){const l=link(org.name,org.source);l.target='_blank';l.rel='noopener noreferrer';routing.append(l,document.createElement('br'));}host.append(routing);
 if(r.linked_hazard){const s=section('Linked repair');s.append(link(r.linked_hazard+' · Pothole repair','cases#'+r.linked_hazard),el('p','The accident response and the road repair remain separate.','muted'));host.append(s);}
 if(r.photos.length){const evidence=section('Photo evidence');evidence.append(el('p',r.privacy_reviewed?'Protected copies reviewed by the submitter.':'Private evidence · public preview is held until reviewed.','muted tiny'),images(authority?r.photos:r.protected_photos.length?r.protected_photos:r.photos,r.photos.map(()=>r.privacy_reviewed?'Reviewed preview':'Private evidence')));host.append(evidence);}
 if(authority)renderOfficer(host,r);else host.append(el('p',r.dispatch_receipt?'Assignment acknowledged by the responsible authority.':'Report received. Awaiting authority review.','muted'));
 renderTracking(host,r);
 if(r.repair)renderRepair(host,r);
 const timeline=section('Progress history'),list=el('ol','','case-timeline');for(const e of r.events){const li=el('li','');li.append(el('strong',e.event),el('time',new Date(e.created_at).toLocaleString()));list.append(li);}timeline.append(list);host.append(timeline);
}
function renderOfficer(host:HTMLElement,r:any){
 const s=section('Response proposal'),form=el('div','','case-form');
 function input(label:string,id:string,value:string,type='text'){const l=el('label',label),i=document.createElement('input');i.id=id;i.type=type;i.value=value;l.append(i);form.append(l);return i;}
 const count=input('Responders','case-count',String(r.proposal.personnel?.[0]?.count||2),'number'),vehicle=input('Vehicle identifier','case-vehicle',r.proposal.vehicle?.assignedId||''),entrance=input('Safe access point','case-entrance',r.proposal.accessPoint||r.assessment.location.accessPoint||''),capability=input('Vehicle capability','case-capability',r.proposal.vehicle?.capability||'maintenance'),vehicleLat=input('Vehicle latitude','case-vehicle-lat','','number'),vehicleLng=input('Vehicle longitude','case-vehicle-lng','','number');
 if(!r.assessment.location.confirmed){const lat=input('Reviewed latitude','case-lat','','number'),lng=input('Reviewed longitude','case-lng','','number');s.append(el('p','The report has no confirmed map coordinates. Confirm the exact location before planning.','muted'),button('Confirm reviewed coordinates',async()=>{if(!lat.value||!lng.value)throw Error('Enter the reviewed coordinates.');await localRequest('/'+r.id+'/confirm-location',{location:{text:r.assessment.location.text,lat:Number(lat.value),lng:Number(lng.value),confirmed:true,accessPoint:entrance.value}});}));}
 s.append(el('p',`Version ${r.proposal_version} · ${r.approved_version?'Approved':'Awaiting review'}${r.proposal.route?.etaSeconds?' · estimated '+Math.round(r.proposal.route.etaSeconds/60)+' min':''}`,'muted tiny'),form);
 const actions=el('div','','case-actions');
 const plan=button('Prepare route and save plan',()=>{if(!vehicleLat.value||!vehicleLng.value)throw Error('Enter the current vehicle coordinates.');return localRequest('/'+r.id+'/plan',{count:Number(count.value),vehicle:vehicle.value,entrance:entrance.value,capability:capability.value,vehicleLocation:{lat:Number(vehicleLat.value),lng:Number(vehicleLng.value)}});});plan.disabled=!r.assessment.location.confirmed||!['proposed','approved'].includes(r.response_state);
 const approve=button('Approve plan',()=>localRequest('/'+r.id+'/approve',{version:r.proposal_version}),'primary');approve.disabled=r.proposal.mode!=='authority_review'||r.response_state!=='proposed';
 const dispatch=button('Dispatch approved plan',()=>localRequest('/'+r.id+'/dispatch',{version:r.proposal_version}));dispatch.disabled=r.response_state!=='approved';
 actions.append(plan,approve,dispatch);s.append(actions,el('p','Only an approved plan can be sent to the configured authority dispatch connection.','muted tiny'));host.append(s);
}
function renderTracking(host:HTMLElement,r:any){
 const s=section('Response tracking'),route=r.proposal.route;
 if(route?.geometry?.length){const description=el('p',`Route: ${(route.distanceMetres/1000).toFixed(1)} km · estimated ${Math.ceil(route.etaSeconds/60)} min`,'muted');s.append(description);}
 const position=el('p','','muted');position.id='case-position-status';s.append(position);host.append(s);updatePosition(r);
 if(authority){const active=['dispatch_acknowledged','en_route'].includes(r.response_state),actions=el('div','','case-actions');
 const share=el('button',locationWatch===null?'Share this device location':'Stop sharing location','secondary') as HTMLButtonElement;share.disabled=!active;share.onclick=()=>{if(locationWatch!==null){stopLocationSharing();share.textContent='Share this device location';return;}if(!navigator.geolocation){status('Location sharing is unavailable in this browser.');return;}const id=r.id;share.textContent='Stop sharing location';locationWatch=navigator.geolocation.watchPosition(async p=>{if(locationBusy||selectedId!==id)return;locationBusy=true;try{const current=await localRequest('/'+id);await localRequest('/'+id+'/telemetry',{position:{lat:p.coords.latitude,lng:p.coords.longitude,at:p.timestamp,sequence:(current.tracking.position?.sequence||0)+1}});const fresh=await localRequest('/'+id);record=fresh;updatePosition(fresh);}catch(e){status((e as Error).message);}finally{locationBusy=false;}},e=>{stopLocationSharing();share.textContent='Share this device location';status(e.message);},{enableHighAccuracy:true,maximumAge:5000,timeout:15000});};
 const complete=button('Mark response complete',async()=>{stopLocationSharing();await localRequest('/'+r.id+'/complete-response',{});});complete.disabled=!active;actions.append(share,complete);s.append(el('p','Share the responding officer’s device location while the assignment is active.','muted tiny'),actions);}
}
function stopLocationSharing(){if(locationWatch!==null)navigator.geolocation.clearWatch(locationWatch);locationWatch=null;}
function updatePosition(r:any){
 const target=document.getElementById('case-position-status');if(!target)return;
 const position=r.tracking?.position;
 if(r.response_state==='response_complete'){target.textContent='Response complete. Repair follow-through remains separate.';return;}
 if(!position){target.textContent=r.dispatch_receipt?'Awaiting a vehicle position.':'No vehicle has been dispatched.';return;}
 target.textContent=`Last position: ${Number(position.lat).toFixed(5)}, ${Number(position.lng).toFixed(5)} · ${new Date(position.sampled_at).toLocaleString()}${r.tracking.stale?' · location is outdated':''}`;
}
function renderRepair(host:HTMLElement,r:any){
 const p=r.repair,s=section('Repair follow-through');if(r.repairTarget&&r.repairTarget!==r.id)s.append(el('p','Shared repair record: '+r.repairTarget+' · original report preserved','muted'));s.append(el('span',human(p.state),'pill '+(p.state==='resident_verified'?'green':'')));
 if(p.before_photo&&p.after_photo)s.append(images([p.before_photo,p.after_photo],['Before','After — authority evidence']));
 if(p.authority_note)s.append(el('p',p.authority_note));if(p.comparison)s.append(el('p','AI comparison: '+p.comparison.visibleChanges,'muted'));
 if(authority&&p.state!=='resident_verified'){
  const form=el('div','','case-form');function file(label:string){const l=el('label',label),i=document.createElement('input');i.type='file';i.accept='image/*';l.append(i);form.append(l);return i;}
  const before=file('Before photo'),after=file('After photo'),label=el('label','Authority completion note','full'),note=document.createElement('textarea');note.rows=2;label.append(note);form.append(label);s.append(form);
  s.append(button('Compare and record repair',async()=>{if(!before.files?.[0]||!after.files?.[0]||!note.value.trim())throw Error('Choose both photos and enter the completion note.');const convert=async(f:File)=>{const u=URL.createObjectURL(f);try{return await preparePhoto(u);}finally{URL.revokeObjectURL(u);}};const photos=await Promise.all([convert(before.files[0]),convert(after.files[0])]);status('Comparing the repair evidence…');const response=await fetch('/api/ai/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'repair',photos,transcript:note.value})});const a=await response.json();if(!response.ok)throw Error(a.message);await localRequest('/'+r.id+'/complete-repair',{before:photos[0],after:photos[1],comparison:a.comparison,note:note.value});},'primary'));
 }else if(!authority&&p.state==='authority_completed'){
  const label=el('label',''),check=document.createElement('input');check.type='checkbox';label.append(check,document.createTextNode(' I reviewed the evidence and confirm the reported issue is fixed.'));s.append(label,button('Confirm repair',async()=>{if(!check.checked)throw Error('Review the repair and check the confirmation first.');await localRequest('/'+r.id+'/review-repair',{confirmed:true});},'primary'));
 }host.append(s);
}
async function addDiagnostics(r:any){
 const s=section('Model diagnostics · officer view');s.id='case-diagnostics';
 for(const photo of r.photo_diagnostics||[]){s.append(el('p',photo.source==='browser'?'MediaPipe on-device masks · submitter reviewed':`${photo.facesBlurred} faces blurred · MTCNN · metadata removed · ${photo.durationMs} ms`,'muted tiny'));for(const c of photo.classification||[]){const row=el('div','','diagnostic-row'),track=el('span','','confidence-track'),fill=el('i','');fill.style.width=c.score*100+'%';track.append(fill);row.append(el('strong',c.label),track,el('span',(c.score*100).toFixed(1)+'%','admin-score'));s.append(row);}s.append(el('p',photo.scoreMeaning,'muted tiny'),el('p',`${photo.classificationReview} · threshold ${photo.threshold} · config v${photo.configVersion}`,'muted tiny'));}
 if(!r.photo_diagnostics?.length)s.append(el('p','No image model ran for this text-only report.','muted'));
 const matches=await localRequest('/'+r.id+'/candidates');if(selectedId!==r.id)return;
 s.append(el('h3','Duplicate & recurrence review'));
 if(!matches.length)s.append(el('p','No compatible nearby hazard found with the confirmed coordinates.','muted'));
 for(const candidate of matches){const card=el('div','','match-card');card.append(el('strong',candidate.id+' · '+candidate.location),el('p',`${candidate.distanceMetres} m away · ${candidate.hoursApart} h apart · ${candidate.visualSimilarity===null?'No image similarity available':'Visual similarity '+(candidate.visualSimilarity*100).toFixed(1)+'%'} · text overlap ${(candidate.textOverlap*100).toFixed(0)}%`,'muted tiny'),el('p',candidate.warning,'muted tiny'));
  const kind=document.createElement('select');kind.append(new Option('Related hazard — keep response separate','related_hazard'),new Option('Same issue — group as duplicate','duplicate'),new Option('Damage returned after repair','recurrence'));
  if(candidate.relationship==='possible_recurrence')kind.value='recurrence';const reason=document.createElement('input');reason.placeholder='Explain the matching asset, location and evidence';reason.setAttribute('aria-label','Case link reason');card.append(kind,reason,button('Approve case link',()=>localRequest('/'+r.id+'/link-case',{target:candidate.id,kind:kind.value,reason:reason.value})));s.append(card);
 }
 for(const l of r.links||[]){const p=el('p',`${l.source_id} → ${l.target_id} · ${l.kind} · ${l.active?'Active':'Reversed'}`);if(l.active&&l.source_id===r.id)p.append(button('Undo link',()=>localRequest('/'+r.id+'/undo-link',{linkId:l.id})));s.append(p);}
 document.getElementById('case-diagnostics')?.remove();$('case-detail').append(s);
}
$('case-scenario').onclick=()=>location.assign('home#report');
function locationHash(id:string){location.hash=id;selectedId=id;}
window.addEventListener('hashchange',()=>{stopLocationSharing();clearTimeout(replay);replay=0;selectedId=/^FMC-\d+$/.test(location.hash.slice(1))?location.hash.slice(1):'';void refresh().catch(e=>status(e.message));});
selectedId=/^FMC-\d+$/.test(location.hash.slice(1))?location.hash.slice(1):'';
const poll=window.setInterval(async()=>{if(document.hidden||!selectedId||replay)return;try{const fresh=await localRequest('/'+selectedId);if(record&&(fresh.response_state!==record.response_state||fresh.repair?.state!==record.repair?.state||fresh.proposal_version!==record.proposal_version)){record=fresh;render(fresh);void refresh();}else{record=fresh;updatePosition(fresh);}}catch{}},3000);
async function officerAccess(){
 try{await localRequest('/config');return;}catch{}
 const dialog=document.createElement('dialog');dialog.className='admin-key-dialog';
 const form=document.createElement('form'),title=el('h2','Open admin workspace'),description=el('p','Use the private admin key on this laptop to access FixMyCity’s Supabase records.');
 const label=el('label','Admin key'),input=document.createElement('input');input.type='password';input.autocomplete='off';input.required=true;input.maxLength=200;label.append(input);
 const fileLabel=el('label','Or choose your key file'),file=document.createElement('input');file.type='file';file.accept='.key,.txt';file.onchange=async()=>{if(file.files?.[0]&&file.files[0].size<2048)input.value=(await file.files[0].text()).trim();};fileLabel.append(file);
 const error=el('p','','admin-key-error'),submit=el('button','Unlock workspace','primary') as HTMLButtonElement;submit.type='submit';
 form.append(title,description,label,fileLabel,error,submit);dialog.append(form);document.body.append(dialog);dialog.addEventListener('cancel',e=>e.preventDefault());dialog.showModal();
 await new Promise<void>(resolve=>{form.onsubmit=async event=>{event.preventDefault();submit.disabled=true;try{await localRequest('/session',{key:input.value.trim()});input.value='';dialog.close();dialog.remove();resolve();}catch(e){error.textContent=(e as Error).message;}finally{submit.disabled=false;}};});
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopLocationSharing();});
window.addEventListener('pagehide',()=>{stopLocationSharing();clearTimeout(replay);clearInterval(poll);});void (async()=>{if(authority)await officerAccess();await refresh();})().catch(e=>status(e.message));
