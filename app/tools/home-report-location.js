// Use the shared venue for new reports, with the same geographic map as the Map tab.
window.FMCMapLocation.defaultReportLocation(rpGetReport());
const reportMapViews = new WeakMap();
function drawReportLocationMap(target, coordinates, onMove) {
  const previous = reportMapViews.get(target);
  if (previous) { previous.resize.disconnect(); previous.map.remove(); }
  target.replaceChildren();
  target.classList.add('report-geographic-map');
  target.setAttribute('aria-label','Map of the report location');
  if (!window.L) { target.textContent = 'Map unavailable'; return; }
  const d = window.FMCMapLocation.destination;
  const point = coordinates || {lat:d.lat,lng:d.lng};
  const editable = typeof onMove === 'function';
  const map = L.map(target,{
    zoomControl:editable,attributionControl:true,dragging:editable,touchZoom:editable,
    doubleClickZoom:editable,scrollWheelZoom:false,boxZoom:false,keyboard:editable,
    zoomAnimation:!matchMedia('(prefers-reduced-motion: reduce)').matches
  }).setView(point,16);
  map.attributionControl.setPrefix(false);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
  }).addTo(map);
  const marker = L.circleMarker(point,{radius:7,color:'#fff',weight:3,fillColor:'#006bff',fillOpacity:1}).addTo(map);
  if (editable) map.on('click',event=>{marker.setLatLng(event.latlng);onMove({lat:event.latlng.lat,lng:event.latlng.lng});});
  const resize = new ResizeObserver(()=>{if(target.getBoundingClientRect().width)map.invalidateSize({pan:false});});
  resize.observe(target);
  reportMapViews.set(target,{map,resize});
}
const originalReportRender = rpRenderReport;
rpRenderReport = function(){
  window.FMCMapLocation.defaultReportLocation(rpGetReport());
  originalReportRender();
  drawReportLocationMap($('#rp-location-map'),rpGetReport().coordinates);
};
const originalReviewRender = rpRenderReview;
rpRenderReview = function(){
  window.FMCMapLocation.defaultReportLocation(rpGetReport());
  originalReviewRender();
  drawReportLocationMap($('#rp-review-map'),rpGetReport().coordinates);
};
rpAdjustLocation = function(){
  const report=window.FMCMapLocation.defaultReportLocation(rpGetReport());
  const destination=window.FMCMapLocation.destination;
  let selected={...(report.coordinates||{lat:destination.lat,lng:destination.lng})};
  showSheet('Adjust report location',`<p>Tap the map to position your report pin, then confirm the place name.</p><div class="rp-pin-preview" id="rp-adjust-map"></div><p class="rp-geo-note" id="rp-location-coordinate-preview"></p><label for="rp-location-input">Place or address</label><input class="copy-preview-link" id="rp-location-input" value="${escape(report.location||'')}" maxlength="180"><button class="primary" id="rp-confirm-location">Confirm location${icon('check')}</button>`,'report-location');
  const showCoordinates=()=>{$('#rp-location-coordinate-preview').textContent=`${selected.lat.toFixed(7)}, ${selected.lng.toFixed(7)}`;};
  drawReportLocationMap($('#rp-adjust-map'),selected,point=>{selected=point;showCoordinates();});
  showCoordinates();
  $('#rp-confirm-location').addEventListener('click',()=>{
    if($('#rp-location-input').value.trim())report.coordinates={...selected};
  });
};
