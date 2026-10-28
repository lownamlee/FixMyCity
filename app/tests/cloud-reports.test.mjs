import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import worker from '../deploy/worker.js';
import {handleReportData,publicRecord} from '../deploy/report-data.js';
const origin='https://fixmycity.online';
const request=(path,body,cookie='',headers={})=>new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1',Cookie:cookie,...headers},body:body===undefined?undefined:JSON.stringify(body)});
test('public worker never serves admin pages, scripts or administrative APIs',async()=>{
 for(const path of ['/admin','/admin/','/authority','/authority.html','/authority.js','/authority.css','/api/local-admin/session','/%61dmin','/%61uthority.html','/api/%6cocal-admin/config']){
  const r=await worker.fetch(request(path),{ASSETS:{fetch(){assert.fail('Admin asset was requested');}}});assert.equal(r.status,404,path);
 }
});
test('cloud reports fail closed for missing configuration, cross-site writes and rate limits',async()=>{
 assert.equal((await handleReportData(request('/api/reports/status'),{})).status,503);
 assert.equal((await handleReportData(request('/api/reports/draft',{},'',{Origin:'https://evil.example'}),{})).status,403);
 const env={FMC_DATABASE_JSON:'{}',IDENTITY_SESSION_SECRET:'a'.repeat(32),REPORT_RATE_LIMIT:{limit:async()=>({success:false})}};
 assert.equal((await handleReportData(request('/api/reports/status'),env)).status,429);
});
test('community records exclude private originals, internal scores and ownership credentials',()=>{
 const r={owner_key:'owner',draft_key:'private',photos:['private-photo'],protected_photos:['masked'],photo_diagnostics:[{score:.9}],privacy_reviewed:false,assessment:{originalText:'private statement'},events:[{event:'Submitted',details:{private:true}}],repair:{comparison:{confidence:.8,visibleChanges:'New asphalt'}}};
 const safe=publicRecord(r,'other');assert.deepEqual(safe.photos,[]);assert.equal(safe.owner_key,undefined);assert.equal(safe.draft_key,undefined);assert.equal(safe.photo_diagnostics,undefined);assert.equal(safe.assessment.originalText,'');assert.deepEqual(safe.events[0].details,{});assert.deepEqual(safe.repair.comparison,{visibleChanges:'New asphalt'});
 assert.deepEqual(publicRecord({...r,privacy_reviewed:true},'other').photos,['masked']);assert.deepEqual(publicRecord(r,'owner').photos,['private-photo']);
});
test('online report handler persists drafts, verifies device ownership and exposes submitted cases without a local admin session',async t=>{
 let config;try{config=JSON.parse(await readFile(join(process.env.LOCALAPPDATA,'FixMyCity/local-postgres.json'),'utf8'));}catch{t.skip('Local test PostgreSQL unavailable');return;}
 const base=new Pool(config),schema='fmc_cloud_test_'+randomUUID().replaceAll('-','');await base.query('CREATE SCHEMA '+schema);
 const pool=new Pool({...config,options:'-c search_path='+schema});
 t.after(async()=>{await pool.end();await base.query('DROP SCHEMA '+schema+' CASCADE');await base.end();});
 await pool.query(await readFile(new URL('../tools/report-schema.sql',import.meta.url),'utf8'));
 const env={FMC_DATABASE_JSON:JSON.stringify({...config,options:'-c search_path='+schema}),IDENTITY_SESSION_SECRET:'test-session-secret-'+randomUUID(),REPORT_RATE_LIMIT:{limit:async()=>({success:true})}};
 const status=await handleReportData(request('/api/reports/status'),env);assert.equal(status.status,200);const cookie=status.headers.get('set-cookie').split(';')[0];assert.match(status.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
 const facts={language:'en',category:'road_damage',title:'Synthetic pothole',summaryEn:'A pothole in the test lane.',summaryMs:'Lubang di lorong ujian.',activeIncident:'no',injuryReported:'no',injuredCount:0,immediateDanger:'unknown',locationText:'Test campus',accessPoint:'Main gate',hazard:null,unknownFields:[],nextQuestionEn:'Confirm the details?',nextQuestionMs:'Sahkan butiran?',evidenceSummary:'Synthetic test.',privacyUncertain:true,privacyRegions:[]};
 const body={draftId:randomUUID(),facts,transcript:'Synthetic test pothole',location:{text:'Test campus',lat:3.1593,lng:101.7114,confirmed:true},photos:[]};
 const draft=await handleReportData(request('/api/reports/draft',body,cookie),env);assert.equal(draft.status,200);const saved=await draft.json();
 assert.equal((await handleReportData(request('/api/reports/'+saved.id),env)).status,404);
 assert.equal((await handleReportData(request('/api/reports/draft',body),env)).status,404);
 assert.equal((await handleReportData(request('/api/reports/submit',{draftId:body.draftId}),env)).status,404);
 const submitted=await handleReportData(request('/api/reports/submit',{draftId:body.draftId},cookie),env);assert.equal(submitted.status,200);assert.equal((await submitted.json()).localOnly,false);
 const publicView=await handleReportData(request('/api/reports/'+saved.id),env);assert.equal(publicView.status,200);assert.equal((await publicView.json()).draft_key,undefined);
 assert.equal((await handleReportData(request('/api/reports/'+saved.id+'/review-repair',{confirmed:true}),env)).status,403);
 const replayCookie=cookie.slice(0,-1)+(cookie.endsWith('0')?'1':'0');assert.equal((await handleReportData(request('/api/reports/submit',{draftId:body.draftId},replayCookie),env)).status,404);
 assert.equal((await handleReportData(request('/api/reports/'+saved.id+'/plan',{count:2},cookie),env)).status,404);
 const list=await(await handleReportData(request('/api/local-reports'),env)).json();assert.equal(list.length,1);
});
