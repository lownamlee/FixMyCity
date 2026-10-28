// This fragment is inserted inside the existing Home app closure by build.py.
const originalFillSubHeaders = fillSubHeaders;
fillSubHeaders = function () {
  originalFillSubHeaders();
  const primaryPages = new Set(['home','map','report','community','profile']);
  const fallbackBack = {assistant:'report',signin:'profile',signup:'signin',certificates:'profile'};
  $$('.sub-header-slot').forEach(slot => {
    const page = slot.closest('[data-page]'), route = page?.dataset.page;
    if (!page || primaryPages.has(route)) return;
    const header = slot.querySelector('.sub-header');
    const bodyTitle = !slot.dataset.title ? page.querySelector('h1') : null;
    const title = slot.dataset.title || bodyTitle?.textContent.trim() || route.replaceAll('-',' ');
    const back = slot.dataset.back || fallbackBack[route] || 'home';
    const topbar = header.querySelector('.sub-topbar');
    const contextualActions = topbar.querySelector('.sub-actions');
    header.querySelectorAll('.sub-title,.sub-brand,.account-actions').forEach(el => el.remove());
    header.className = 'sub-header sub-variant-title fmc-subpage-header';
    topbar.innerHTML = `<button class="sub-back" data-app-back="${escape(back)}" aria-label="Back">${icon('arrow-left')}</button><h1 class="sub-title inline">${escape(title)}</h1>`;
    if (contextualActions) topbar.append(contextualActions);
    if (bodyTitle) bodyTitle.hidden = true;
    if (route === 'assistant') page.querySelector('.rp-assistant-heading').hidden = true;
    page.dataset.compactHeader = header.querySelector('.location-row') ? 'location' : header.querySelector('.sub-subtitle') ? 'step' : 'plain';
  });
};
window.addEventListener('fixmycity:languagechange',()=>{
 accountPreview.language=window.FMCLanguage.get()==='ms'?'Bahasa Melayu':'English';
 const languageValue=$('#ac-language-value');if(languageValue)languageValue.textContent=accountPreview.language;
});
window.FMCReportBridge={
 context(){
  const r=rpGetReport(),field=currentPage==='home'?$('#description'):$('#rp-description');
  return{transcript:(field?.value||r.originalText||r.description||'').slice(0,8000),location:{text:r.locationConfirmed?r.location:'',lat:r.coordinates?.lat??null,lng:r.coordinates?.lng??null,confirmed:r.locationConfirmed===true,accessPoint:r.accessPoint||''},photos:currentPage==='home'?(typeof photoUrl!=='undefined'&&photoUrl?[photoUrl]:[]):(r.photos||[]).filter(url=>typeof url==='string'),assessment:r.aiAssessment};
 },
 apply(a){
  const r=rpGetReport();r.aiAssessment=a;r.originalText=a.originalText;
  Object.assign(r,{title:a.facts.title,category:({road_accident:'Road accident',road_damage:'Road damage',lighting:'Lighting',cleanliness:'Cleanliness',drainage:'Drainage',flood:'Flood',fire:'Fire',crime:'Crime',fallen_tree:'Fallen tree'})[a.facts.category]||'Other',description:a.originalText||a.facts.summaryEn,accessPoint:a.location.accessPoint});
  if(a.location.text)r.location=a.location.text;
  $('#description').value=r.description;$('#rp-description').value=r.description;
  rpRenderReport();rpRenderReview();rpRenderConversation();
  const authority=$('#page-review .rp-authority strong');if(authority)authority.textContent=a.authorities.map(x=>x.name).join(' / ')||'Ownership review needed';
  window.dispatchEvent(new CustomEvent('fixmycity:report-assessed',{detail:a}));saveAppProgress();
 },
 review(){navigate('review');},
 chat(text){rpConversation.push({role:'assistant',text});rpRenderConversation();}
};
document.addEventListener('click',event=>{if(event.target.closest('#rp-confirm-location')&&$('#rp-location-input')?.value.trim()){rpGetReport().locationConfirmed=true;}},true);
rpSubmitReport=function(){window.dispatchEvent(new Event('fixmycity:submit-report'));};
window.addEventListener('fixmycity:report-created',event=>{const id=event.detail?.id;if(!/^FMC-\d+$/.test(id||''))return;showSheet('Report created',`<p>Your report <strong>${escape(id)}</strong> is saved in FixMyCity on this computer.</p><a class="primary" href="cases#${id}">View report ${icon('arrow')}</a><p class="demo-note">Available to the local test authority workspace. No real agency dispatch has been made.</p>`,'saved-report');});
const baseRenderConversation=rpRenderConversation;
rpRenderConversation=function(){baseRenderConversation();const label=$('.rp-location-confirmed');if(label)label.textContent=rpGetReport().locationConfirmed?'Place confirmed by you':'Confirm the report location';};
addEventListener('fixmycity:voice-draft',event=>{
  const text=event.detail?.text;if(typeof text!=='string'||!text.trim())return;
  const field=currentPage==='home'?$('#description'):$('#rp-description');
  const description=[field.value.trim(),text.trim()].filter(Boolean).join(' ').slice(0,2000);
  $('#description').value=description;$('#rp-description').value=description;
  rpGetReport().description=description;saveAppProgress();
  toast('Your words were added to the report. Review the details before continuing.');
});
let fmcModalSequence = 0;
const fmcModalRecords = new Map();
const nativeShowSheet = showSheet, nativeCloseSheet = closeSheet;
showSheet = function(title, html, type) {
  const id = history.state?.fmcModal || ++fmcModalSequence;
  if(!history.state?.fmcModal) history.pushState({...history.state,fmcModal:id},'',location.href);
  nativeShowSheet(title, html, type);
  fmcModalRecords.set(id, {title,type,nodes:[...$('#sheet-content').childNodes]});
};
closeSheet = function(silent = false) {
  const wasOpen = !$('#modal').hidden;
  nativeCloseSheet();
  if(wasOpen && !silent && history.state?.fmcModal) history.back();
};
$('#close-sheet').removeEventListener('click',nativeCloseSheet);
$('#close-sheet').addEventListener('click',()=>closeSheet());
function installApp() {
  const api = window.FixMyCityPWA;
  if(!api) { toast('Installation is available when the app finishes loading.'); return; }
  api.install().then(result => {
    if(result.status === 'installed' || result.status === 'accepted') toast('FixMyCity is installed or ready to install.');
    else if(result.status === 'instructions') showSheet(result.title,`<ol class="install-steps">${result.steps.map(step=>`<li>${escape(step)}</li>`).join('')}</ol><p class="demo-note">The app opens in its own window. An internet connection is required to confirm your verification session when you open it.</p>`,'install-app');
    else if(result.status === 'dismissed') toast('You can install later from Settings.');
  }).catch(()=>toast('Use your browser menu to install FixMyCity.'));
}
addEventListener('fixmycity:logout-state', event => {
  for(const button of document.querySelectorAll('[data-account-action="signout"]')) {
    button.disabled = event.detail.pending;
    button.setAttribute('aria-busy',String(event.detail.pending));
  }
  if(event.detail.loggedOut === true) {
    accountPreview.signedIn=false; accountPreview.guest=false;
    for(const selector of ['#ac-signin-password','#ac-signup-password']) { const input=$(selector); if(input)input.value=''; }
  }
});
function saveAppProgress() {
  if(window.FMCFlow?.isLoggingOut())return;
  const r=flowState.report;
  const data={report:{title:r.title,description:r.description,category:r.category,location:r.location,coordinates:r.coordinates,locationConfirmed:r.locationConfirmed===true,submittedAt:r.submittedAt},submitted:flowState.submitted,selectedReport:flowState.selectedReport};
  try { sessionStorage.setItem('fixmycity2-app-progress-v1',JSON.stringify(data)); } catch {}
  window.FMCFlow?.rememberRoute();
}
try {
  const saved=JSON.parse(sessionStorage.getItem('fixmycity2-app-progress-v1')||'null');
  if(saved && saved.report && typeof saved.report==='object') {
    for(const field of ['title','description','category','location','submittedAt']) if(typeof saved.report[field]==='string') flowState.report[field]=saved.report[field].slice(0,3000);
    const point=saved.report.coordinates;
    if(Number.isFinite(point?.lat)&&Number.isFinite(point?.lng)&&Math.abs(point.lat)<=90&&Math.abs(point.lng)<=180){
      flowState.report.coordinates={lat:point.lat,lng:point.lng};
      flowState.report.locationConfirmed=saved.report.locationConfirmed===true;
    }
    flowState.submitted=saved.submitted===true;
    if(typeof saved.selectedReport==='string') flowState.selectedReport=saved.selectedReport;
  }
} catch {}
addEventListener('pagehide', saveAppProgress);
addEventListener('visibilitychange',()=>{if(document.hidden)saveAppProgress();});
document.addEventListener('change',saveAppProgress);
if(navigator.permissions?.query){
  navigator.permissions.query({name:'camera'}).then(permission=>{
    const label=$('[data-account-permission="Camera"] small');
    const update=()=>{if(label)label.textContent=permission.state==='granted'?'Allowed':permission.state==='denied'?'Blocked':'Ask when used';};
    update();permission.addEventListener('change',update);
  }).catch(()=>{$('[data-account-permission="Camera"] small').textContent='Browser settings';});
}

// Use PostgreSQL records inside the existing mobile layouts when the local API is available.
let localCaseRows=null,localStandings=null;
const previewFeed=renderFeed,previewReportList=rrRenderList,previewLeaderboard=exRenderLeaderboard;
const localCaseVerified=r=>r.repair_state==='resident_verified'&&(!r.has_response||r.response_state==='response_complete');
const localCaseLabel=r=>localCaseVerified(r)?'Verified':r.response_state==='response_complete'?'Response complete':r.response_state==='proposed'?'Awaiting review':r.response_state.replaceAll('_',' ');
renderFeed=function(){
 if(!localCaseRows)return previewFeed();
 const cat={Roads:['road_damage','road_accident'],Lighting:['lighting'],Cleanliness:['cleanliness']};
 const rows=localCaseRows.filter(r=>!r.fixture&&(activeCategory==='All'||cat[activeCategory]?.includes(r.category)));
 $('#nearby-title').textContent='Recent local reports';
 $('#feed').innerHTML=rows.length?rows.slice(0,5).map(r=>`<article class="issue-card"><div class="issue-top"><span class="issue-avatar initial-avatar">AR</span><div><div class="person">${escape(r.resident)}</div><div class="meta">${escape(r.id)} · ${new Date(r.created_at).toLocaleDateString()}</div></div><span class="badge">${escape(localCaseLabel(r))}</span></div><h3 class="issue-title">${escape(r.title)}</h3><p class="local-case-summary">${escape(r.summary)}</p><div class="issue-footer"><span class="notified">${icon('shield')}Saved locally</span><a class="local-case-link" href="cases#${r.id}">View report ${icon('arrow')}</a></div></article>`).join(''):'<p class="local-case-summary">No saved reports in this category yet.</p>';
};
rrRenderList=function(){
 if(!localCaseRows)return previewReportList();
 const rows=localCaseRows.filter(r=>!r.fixture),verified=rows.filter(localCaseVerified).length;
 $('#rr-count-all').textContent=rows.length;$('#rr-count-open').textContent=rows.length-verified;$('#rr-count-verified').textContent=verified;
 const filtered=rows.filter(r=>(rrFilter==='all'||(rrFilter==='verified'?localCaseVerified(r):!localCaseVerified(r)))&&(!rrQuery||(r.title+' '+r.id).toLowerCase().includes(rrQuery))).sort((a,b)=>rrSort==='title'?a.title.localeCompare(b.title):rrSort==='oldest'?Date.parse(a.created_at)-Date.parse(b.created_at):Date.parse(b.created_at)-Date.parse(a.created_at));
 $('#rr-report-list').innerHTML=filtered.map(r=>`<a class="rr-report-row local-case-row" href="cases#${r.id}"><span class="local-case-symbol">${icon('document')}</span><span><strong>${escape(r.title)}</strong><small>${escape(r.id)}</small></span><span class="badge">${escape(localCaseLabel(r))}</span>${icon('chevron')}</a>`).join('')||'<div class="rr-empty">No saved reports match this filter.</div>';
};
exRenderLeaderboard=function(){
 if(localStandings){const me=exRanking.find(r=>r.you);if(me){me.points=localStandings.points;me.month=localStandings.contributions.reduce((sum,c)=>sum+c.points,0);}$('.leaderboard-summary p').innerHTML=`<b>${localStandings.verified}</b> verified<br>contributions`;}
 previewLeaderboard();
};
async function refreshLocalRecords(){
 if(!['localhost','127.0.0.1'].includes(location.hostname))return;
 try{const [reports,rewards]=await Promise.all([fetch('/api/local-reports'),fetch('/api/local-reports/leaderboard')]);if(!reports.ok||!rewards.ok)return;localCaseRows=await reports.json();localStandings=await rewards.json();renderFeed();rrRenderList();exRenderLeaderboard();const values=$$('.home-reward-copy strong');if(values[0])values[0].innerHTML=`${localStandings.points} <small>pts</small>`;if(values[1])values[1].innerHTML=`${localStandings.verified} <small>verified</small>`;$('.home-rewards')?.setAttribute('aria-label',`${localStandings.points} points and ${localStandings.verified} verified contributions`);}catch{}
}
void refreshLocalRecords();addEventListener('fixmycity:report-created',()=>void refreshLocalRecords());addEventListener('focus',()=>void refreshLocalRecords());
