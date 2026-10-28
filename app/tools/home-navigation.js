let currentPage='home';
function fillPageHeaders(){
  const status=$('.hero .status').outerHTML,skyline=$('.hero .skyline').outerHTML;
  $$('.page-header-slot').forEach(slot=>{const kind=slot.dataset.kind,title=slot.dataset.title,sky=skyline.replaceAll('id="sky"',`id="sky-${kind}"`).replaceAll('url(#sky)',`url(#sky-${kind})`);let actions='';
    if(kind==='map')actions=`<button class="emergency" data-open="emergency">${icon('phone')}Emergency</button>`;
    else if(kind==='profile')actions=`<button class="profile-settings" data-action="profile-settings" aria-label="Profile settings">${icon('settings')}</button>`;
    else actions=`<div class="account-actions"><button class="notification" aria-label="Notifications" data-open="notifications">${icon('bell')}</button><button class="profile-button" aria-label="Open Aina's profile" data-open="profile"><img class="avatar" src="${assets.avatar}" alt="Aina"></button></div>`;
    slot.innerHTML=`<header class="section-hero ${kind}-hero">${status}${sky}<div class="section-topbar"><h1 class="section-title">${title}</h1>${actions}</div>${kind==='community'?`<div class="location-row"><button class="location-button" data-open="location"><span class="community-area-label">${escape($('#area-label').textContent)}</span>${icon('down','chevron')}</button></div>`:''}${kind==='map'?`<label class="map-search-wrap">${icon('search')}<span class="sr-only">Search places or reports</span><input id="map-search" type="search" placeholder="Search places or reports" autocomplete="off" spellcheck="false"></label>`:''}</header>`;
  });
}
const pagePositions=new Map();
function appRoute(){const [page,query='']=location.hash.slice(1).split('?');return{page:page||'home',report:new URLSearchParams(query).get('report')};}
function pageHash(page){return '#'+page+(['report-detail','verify'].includes(page)?'?report='+encodeURIComponent(flowState.selectedReport||'road'):'');}
function navigate(page,push=true){
  if(!$$('[data-page]').some(el=>el.dataset.page===page))page='home';
  const modalState=!!history.state?.fmcModal;
  if(!$('#modal').hidden)closeSheet(true);
  const old=$(`[data-page="${currentPage}"]`);
  if(old)pagePositions.set(currentPage,old.scrollTop);
  const sourcePage=document.activeElement?.closest('[data-page]');
  const moveFocus=sourcePage&&sourcePage.dataset.page!==page;
  const previousPage=currentPage;currentPage=page;
  $$('[data-page]').forEach(el=>{const active=el.dataset.page===page;el.hidden=!active;el.inert=!active;el.setAttribute('aria-hidden',String(!active));});
  $$('.bottom-nav [data-nav]').forEach(button=>{if(button.dataset.nav===page)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
  $('.canvas').classList.toggle('sub-screen',!['home','map','community','profile'].includes(page));
  const target=pageHash(page);
  if(push&&location.hash!==target)history[modalState?'replaceState':'pushState']({fmc:true,page,previous:previousPage},'',target);
  else if(modalState)history.replaceState({fmc:true,page,previous:history.state?.previous},'',target);
  if(typeof pageHooks[page]==='function')pageHooks[page]();
  const active=$(`[data-page="${page}"]`);if(active)active.scrollTop=push&&previousPage!==page?0:(pagePositions.get(page)||0);
  document.title=page.replaceAll('-',' ').replace(/\b\w/g,c=>c.toUpperCase())+' · FixMyCity';
  $('#live-status').textContent=page.charAt(0).toUpperCase()+page.slice(1)+' page';
  if(moveFocus){const heading=$(`[data-page="${page}"] h1`);if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}}
  saveAppProgress();
}
function restoreAppRoute(){
  if(history.state?.fmcModal){const record=fmcModalRecords.get(history.state.fmcModal);if(record){nativeShowSheet(record.title,'',record.type);$('#sheet-content').replaceChildren(...record.nodes);return;}}
  if(!$('#modal').hidden)closeSheet(true);
  const route=appRoute();if(route.report&&rrReport(route.report))flowState.selectedReport=route.report;
  navigate(route.page,false);
}
function initializeMainPages(){
  fillPageHeaders();
  $$('[data-asset]').forEach(img=>{if(assets[img.dataset.asset])img.src=assets[img.dataset.asset];});
  initMapPage();initCommunityPage();initProfilePage();
  initializeExpandedPages();
  $$('.bottom-nav [data-nav]').forEach(button=>button.addEventListener('click',()=>{navigate(button.dataset.nav);if(button.dataset.nav==='home')$('#page-scroll').scrollTo({top:0,behavior:'instant'});}));
  addEventListener('popstate',restoreAppRoute);
  addEventListener('hashchange',restoreAppRoute);
  restoreAppRoute();
}
