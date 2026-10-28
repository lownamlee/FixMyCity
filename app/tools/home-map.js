function initMapPage(){
  const mapPage=$('#page-map'),destination=window.FMCMapLocation.destination;
  const center=[destination.lat,destination.lng];
  // Clearly marked preview data, positioned around the shared venue, never server reports.
  const mapReports=[
    {id:'uniten-road',category:'Roads',title:'Pothole near Dewan Seri Sarjana',status:'In progress',color:'orange',lat:2.96655,lng:101.72815,image:assets.pothole},
    {id:'uniten-light',category:'Lighting',title:'Streetlight near the campus entrance',status:'Reported',color:'blue',lat:2.97005,lng:101.72625,image:assets.lighting},
    {id:'uniten-walk-light',category:'Lighting',title:'Flickering light on the campus walkway',status:'In progress',color:'amber',lat:2.9701,lng:101.72975,image:assets.lighting},
    {id:'uniten-repaired-light',category:'Lighting',title:'Repaired light near the hall',status:'Verified',color:'green',lat:2.9680,lng:101.73065,image:assets.after},
    {id:'uniten-clean',category:'Cleanliness',title:'Litter near the campus car park',status:'Reported',color:'blue',lat:2.96585,lng:101.7266,image:assets.cleanliness},
    {id:'uniten-walkway',category:'Roads',title:'Uneven walkway near the hall',status:'Reported',color:'blue',lat:2.9681,lng:101.72485,image:assets.pothole}
  ];
  let map=null,tiles=null,markers=null,density=null,userDot=null;
  let category='All',query='',selected=mapReports[0].id,densityVisible=false,permissionRequested=false;
  const translate=text=>window.FMCLanguage?.t(text)||text;
  const paths={Roads:'<path d="m13 24-7 11h25l-7-11-6 6-5-6Z" fill="white"/><path d="m13 16-3 8m13-8 3 8" stroke="white" stroke-width="2" stroke-linecap="round"/>',Lighting:'<path d="M16 35V16h10m-10 2-4-3m11 0 4 1v4h-5v-4M12 36h9" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',Cleanliness:'<path d="M12 20h15l-2 16H14l-2-16Zm-2-3h19M16 14h7M17 24v8m5-8v8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',Verified:'<path d="m10 25 6 6 13-14" stroke="white" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'};
  function pin(r){return `<span class="map-report-pin" data-color="${r.color}" aria-pressed="${r.id===selected}"><svg viewBox="0 0 40 54" aria-hidden="true"><circle cx="20" cy="49" r="4" fill="currentColor" stroke="white" stroke-width="2"/><path d="M20 2C9 2 2 10 2 20c0 10 8 15 18 24 10-9 18-14 18-24C38 10 31 2 20 2Z" fill="currentColor" stroke="white" stroke-width="2.8"/>${paths[r.status==='Verified'?'Verified':r.category]}</svg></span>`;}
  function filtered(){return mapReports.filter(r=>(category==='All'||r.category===category)&&(!query||(r.title+' '+translate(r.title)+' '+r.category+' '+translate(r.category)+' '+r.status+' '+translate(r.status)+' Dewan Seri Sarjana Universiti Tenaga Nasional UNITEN').toLowerCase().includes(query)));}
  function preview(){
    const r=mapReports.find(r=>r.id===selected);if(!r)return;
    const isFollowing=following.has(r.id),distance=Math.round(L.latLng(center).distanceTo([r.lat,r.lng])/10)*10;
    $('#map-report-preview').innerHTML=`<div class="map-preview-main"><img class="map-preview-image" src="${r.image}" alt="${r.title}"><div class="map-preview-info"><span class="map-preview-status ${r.status==='Verified'?'is-verified':r.status==='Reported'?'is-reported':''}">${r.status}</span><h2 class="map-preview-title">${r.title}</h2><div class="map-preview-distance">${icon('pin')}<span>${distance} m <span>from Dewan Seri Sarjana</span></span></div><div class="map-preview-notified">${icon('map')}<span>Sample report · UNITEN</span></div></div></div><div class="map-preview-actions"><button class="map-view-report" id="map-view-report">View report ${icon('arrow')}</button><button class="map-follow-report" id="map-follow-report" aria-pressed="${isFollowing}">${icon(isFollowing?'check':'bell')} ${isFollowing?'Following':'Follow'}</button></div>`;
  }
  function render(){
    const visible=filtered();
    if(!visible.some(r=>r.id===selected))selected=visible[0]?.id||'';
    $('#map-count').textContent=`${visible.length} ${translate(visible.length===1?'sample report':'sample reports')}`;
    $('#map-report-preview').hidden=!visible.length;$('#map-empty').hidden=!!visible.length;
    if(visible.length)preview();
    if(!map)return;
    markers.clearLayers();density.clearLayers();
    for(const r of visible){
      const label=`${translate(r.title)}, ${translate(r.status)}`;
      const marker=L.marker([r.lat,r.lng],{icon:L.divIcon({className:'fmc-map-marker',html:pin(r),iconSize:[40,54],iconAnchor:[20,49]}),title:label,keyboard:true,riseOnHover:true,zIndexOffset:r.id===selected?500:0}).addTo(markers);
      marker.getElement().setAttribute('aria-label',label);
      marker.getElement().setAttribute('aria-pressed',String(r.id===selected));
      marker.on('click',()=>{selected=r.id;render();});
      L.circle([r.lat,r.lng],{radius:100,stroke:false,fillColor:r.status==='Verified'?'#18b578':'#ff9b19',fillOpacity:.2,interactive:false}).addTo(density);
    }
  }
  function zoomLabel(){if(!map)return;$('#map-zoom-label').textContent=map.getZoom();$('#map-zoom-out').disabled=map.getZoom()<=map.getMinZoom();$('#map-zoom-in').disabled=map.getZoom()>=map.getMaxZoom();}
  function startMap(){
    if(map)return;
    if(!window.L){$('#map-network-note').hidden=false;return;}
    map=L.map('map-live',{zoomControl:false,minZoom:3,maxZoom:19,scrollWheelZoom:true,zoomAnimation:!matchMedia('(prefers-reduced-motion: reduce)').matches}).setView(center,destination.zoom);
    map.attributionControl.setPrefix(false);
    tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'});
    let loaded=0,failed=0;
    tiles.on('loading',()=>{loaded=0;failed=0;});
    tiles.on('tileload',()=>{loaded++;$('#map-network-note').hidden=true;});
    tiles.on('tileerror',()=>{failed++;});
    tiles.on('load',()=>{$('#map-network-note').hidden=!(failed>0&&loaded===0);});
    tiles.addTo(map);
    density=L.layerGroup();markers=L.layerGroup().addTo(map);
    L.circleMarker(center,{radius:6,color:'#fff',weight:3,fillColor:'#0b63ef',fillOpacity:1}).addTo(map).bindTooltip('Dewan Seri Sarjana<br><small>UNITEN</small>',{permanent:true,direction:'top',offset:[0,-8],className:'map-venue-label'});
    map.on('zoomend',zoomLabel);zoomLabel();render();
  }
  const locationRequest=window.FMCMapLocation.createLocationRequest({
    geolocation:navigator.geolocation,
    onChange(state){
      const copy={pending:'Requesting location… The UNITEN map is ready.',granted:'Location enabled. The map stays on UNITEN.',denied:'Location is off. You can still explore UNITEN.',timeout:'Location timed out. You can still explore UNITEN.',unavailable:'Location is unavailable. You can still explore UNITEN.'};
      $('#map-location-status').textContent=copy[state]||'The map stays on UNITEN.';
      $('#map-request-location').disabled=state==='pending'||state==='granted';
      $('#map-request-location').textContent=state==='granted'?'Location enabled':state==='pending'?'Requesting location…':'Enable location';
    },
    onPosition(position){
      if(!map)return;
      // A granted location can add a dot nearby; it never recentres the map or loads remote-area tiles.
      if(L.latLng(center).distanceTo(position)>5000)return;
      if(userDot)userDot.remove();
      userDot=L.circleMarker(position,{radius:7,color:'#fff',weight:3,fillColor:'#007bff',fillOpacity:1}).addTo(map).bindTooltip(translate('Your location'));
    }
  });
  function activate(){
    if(mapPage.hidden)return;
    startMap();map?.invalidateSize({pan:false});
    if(!permissionRequested){permissionRequested=true;locationRequest.request();}
  }
  $$('#page-map [data-map-category]').forEach(button=>button.addEventListener('click',()=>{category=button.dataset.mapCategory;$$('#page-map [data-map-category]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));render();}));
  $('#map-search')?.addEventListener('input',event=>{query=event.target.value.trim().toLowerCase();render();});
  $('#map-clear-search').addEventListener('click',()=>{category='All';query='';$('#map-search').value='';$$('#page-map [data-map-category]').forEach(item=>item.setAttribute('aria-pressed',String(item.dataset.mapCategory==='All')));render();});
  $('#map-report-preview').addEventListener('click',event=>{
    if(event.target.closest('#map-view-report')){
      const r=mapReports.find(r=>r.id===selected);if(!r)return;
      showSheet('Sample report',`<img class="map-detail-image" src="${r.image}" alt="${r.title}"><span class="map-detail-status">${r.status}</span><h3>${r.title}</h3><p>Dewan Seri Sarjana · UNITEN</p><p>Example report for the interactive demo. This is not a submitted incident.</p>`,'map-report');
    }
    if(event.target.closest('#map-follow-report')){if(following.has(selected))following.delete(selected);else following.add(selected);preview();$('#map-follow-report').focus();toast(following.has(selected)?'Following this report in this preview.':'You are no longer following this report.');}
  });
  $('#map-layers').addEventListener('click',()=>{const panel=$('#map-layer-panel');panel.hidden=!panel.hidden;$('#map-layers').setAttribute('aria-expanded',String(!panel.hidden));});
  $$('#page-map [data-map-style]').forEach(button=>button.addEventListener('click',()=>{densityVisible=button.dataset.mapStyle==='density';if(map){if(densityVisible)density.addTo(map);else density.remove();}$$('#page-map [data-map-style]').forEach(item=>{item.setAttribute('aria-pressed',String(item===button));$('span',item).textContent=item===button?'✓':'';});}));
  $('#map-recenter').addEventListener('click',()=>{map?.setView(center,destination.zoom);toast('Map centred on Dewan Seri Sarjana, UNITEN.');});
  $('#map-zoom-in').addEventListener('click',()=>map?.zoomIn());$('#map-zoom-out').addEventListener('click',()=>map?.zoomOut());
  $('#map-request-location').addEventListener('click',()=>locationRequest.request());
  $('#map-retry-tiles').addEventListener('click',()=>{if(tiles)tiles.redraw();else startMap();});
  mapPage.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('#map-layer-panel').hidden){$('#map-layer-panel').hidden=true;$('#map-layers').setAttribute('aria-expanded','false');$('#map-layers').focus();}});
  new MutationObserver(activate).observe(mapPage,{attributes:true,attributeFilter:['hidden']});
  new ResizeObserver(()=>{if(map&&!mapPage.hidden)map.invalidateSize({pan:false});}).observe($('#map-stage'));
  addEventListener('fixmycity:languagechange',render);
  activate();
}
