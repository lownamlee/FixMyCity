import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function locationApi(){const window={};vm.runInNewContext(read('map-location.js'),{window});return window.FMCMapLocation;}
test('a new report uses the supplied UNITEN point without claiming location confirmation',()=>{
  const api=locationApi(),report={location:''};api.defaultReportLocation(report);
  assert.equal(report.location,'Dewan Seri Sarjana, UNITEN');
  assert.equal(report.coordinates.lat,2.9680752);assert.equal(report.coordinates.lng,101.727679);
  assert.equal(report.locationConfirmed,false);
});
test('default coordinates survive restoring a venue-only draft, while chosen points are retained',()=>{
  const api=locationApi(),restored={location:'Dewan Seri Sarjana, UNITEN'};api.defaultReportLocation(restored);
  assert.equal(restored.coordinates.lat,2.9680752);
  const selected={location:'My chosen place',coordinates:{lat:3.1,lng:101.6},locationConfirmed:true};
  api.defaultReportLocation(selected);assert.deepEqual(selected,{location:'My chosen place',coordinates:{lat:3.1,lng:101.6},locationConfirmed:true});
});
function setup({available=true}={}){
  const nodes=new Map(),observers=[],views=[],requests=[],events=[];
  function node(id){if(!nodes.has(id))nodes.set(id,{hidden:id==='#page-map',dataset:{},listeners:{},setAttribute(){},addEventListener(type,callback){this.listeners[type]=callback;},focus(){}});return nodes.get(id);}
  const categories=['All','Roads','Lighting','Cleanliness'].map(value=>Object.assign(node(value),{dataset:{mapCategory:value}}));
  function layer(){return {addTo(){return this;},on(){return this;},getElement(){return node('marker');},clearLayers(){},remove(){},bindTooltip(){return this;}};}
  let zoom=16;
  const map={...layer(),setView(point,nextZoom){views.push([...point]);zoom=nextZoom;events.push('map-ready');return this;},getZoom:()=>zoom,getMinZoom:()=>3,getMaxZoom:()=>19,invalidateSize(){},zoomIn(){zoom++;},zoomOut(){zoom--;},attributionControl:{setPrefix(){}}};
  const geolocation=available?{getCurrentPosition(ok,fail,options){events.push('location-request');requests.push({ok,fail,options});}}:undefined;
  const window={};
  const context={window,navigator:{geolocation},L:{map:()=>map,tileLayer:layer,layerGroup:layer,circle:layer,circleMarker:layer,marker:layer,divIcon:options=>options,latLng:()=>({distanceTo:point=>point.lat===50?100000:100})},
    $:node,$$:selector=>selector.includes('data-map-category')?categories:[],following:new Set(),icon:()=>'',assets:{},showSheet(){},toast(){},
    matchMedia:()=>({matches:false}),addEventListener(){},MutationObserver:class{constructor(callback){observers.push(callback);}observe(){}},ResizeObserver:class{observe(){}}};
  window.L=context.L;vm.createContext(context);vm.runInContext(read('map-location.js'),context);vm.runInContext(read('tools/home-map.js')+'\ninitMapPage();',context);
  function enter(){node('#page-map').hidden=false;observers[0]();}
  return {window,node,categories,views,requests,events,enter,leave(){node('#page-map').hidden=true;observers[0]();}};
}
test('opening the map renders the fixed venue and reports before location resolves',()=>{
  const p=setup();assert.equal(p.requests.length,0);p.enter();
  assert.deepEqual(p.events,['map-ready','location-request']);
  assert.deepEqual(p.views[0],[2.9680752,101.727679]);
  assert.match(p.node('#map-report-preview').innerHTML,/Dewan Seri Sarjana/);
  assert.equal(p.node('#map-report-preview').hidden,false);
});
test('denying location keeps the map, filters and sample reports usable',()=>{
  const p=setup();p.enter();p.requests[0].fail({code:1});
  assert.match(p.node('#map-location-status').textContent,/still explore/);
  assert.equal(p.node('#map-report-preview').hidden,false);
  p.categories[1].listeners.click();assert.match(p.node('#map-count').textContent,/2 sample reports/);
  assert.equal(p.views.length,1);
});
test('granting a distant location never recentres or changes the destination',()=>{
  const p=setup();p.enter();p.requests[0].ok({coords:{latitude:50,longitude:10,accuracy:15}});
  assert.equal(p.views.length,1);assert.equal(p.window.FMCMapLocation.destination.lat,2.9680752);
  assert.match(p.node('#map-location-status').textContent,/stays on UNITEN/);
  p.node('#map-recenter').listeners.click();assert.deepEqual(p.views[1],[2.9680752,101.727679]);
});
test('missing geolocation and timeouts leave map content available',()=>{
  const p=setup({available:false});p.enter();assert.match(p.node('#map-location-status').textContent,/unavailable/);
  assert.equal(p.node('#map-report-preview').hidden,false);
  const q=setup();q.enter();q.requests[0].fail({code:3});assert.match(q.node('#map-location-status').textContent,/timed out/);
  assert.equal(q.node('#map-report-preview').hidden,false);assert.equal(q.requests[0].options.timeout,10000);
});
test('returning to the map does not repeatedly prompt after denial',()=>{
  const p=setup();p.enter();p.requests[0].fail({code:1});p.leave();p.enter();
  assert.equal(p.requests.length,1);
  p.node('#map-request-location').listeners.click();assert.equal(p.requests.length,2);
});
test('no-match searches keep the map available and clear search restores reports',()=>{
  const p=setup();p.enter();p.node('#map-search').listeners.input({target:{value:'no such incident'}});
  assert.equal(p.node('#map-empty').hidden,false);assert.equal(p.views.length,1);
  p.node('#map-clear-search').listeners.click();assert.equal(p.node('#map-empty').hidden,true);
  assert.match(p.node('#map-count').textContent,/6 sample reports/);
});
