import {Pool,type PoolClient} from 'pg';
import {readFile} from 'node:fs/promises';
import {randomUUID,timingSafeEqual,createHmac,randomBytes} from 'node:crypto';
import {buildAssessment,locationClaim,relatedHazards,type IncidentFacts,type HazardRecord} from '../ai/domain';
import {INCIDENT_SCHEMA,REPAIR_SCHEMA,matchesSchema} from '../ai/schema';
export class StoreError extends Error{constructor(public status:number,message:string){super(message);}}
const requireValue=(condition:unknown,message:string,status=400)=>{if(!condition)throw new StoreError(status,message);};
const text=(value:unknown,max=8000)=>typeof value==='string'?value.trim().slice(0,max):'';
const uuid=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
function photos(value:unknown){requireValue(Array.isArray(value)&&value.length<=3,'Use up to three photos.');return(value as unknown[]).map(v=>{requireValue(typeof v==='string'&&v.length<=1700000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(v),'Photo format or size is invalid.');return v as string;});}
const event=(c:PoolClient,id:string,action:string,details:unknown={})=>c.query('INSERT INTO fmc_report_events(report_id,event,details) VALUES($1,$2,$3)',[id,action,JSON.stringify(details)]);
export class ReportStore {
 constructor(readonly pool:Pool,readonly protect?:(image:string,masks?:unknown[])=>Promise<any>,readonly options:{database?:string;ownerKey?:string;verifiedResident?:string;planRoute?:(input:any)=>Promise<any>;dispatch?:(input:any)=>Promise<string>}={}){}
 async protectPhotos(values:string[],regions:any[]=[]){if(!values.length)return[];requireValue(this.protect,'Photo protection is unavailable. No unprotected photo was saved.',503);const result=[];for(const [index,image]of values.entries())result.push(await this.protect!(image,regions.filter(r=>r.imageIndex===index)));return result;}
 async initialize(schemaPath:string){await this.pool.query(await readFile(schemaPath,'utf8'));}
 async transaction<T>(fn:(client:PoolClient)=>Promise<T>){const c=await this.pool.connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}}
 async seed(){
  const facts:IncidentFacts={language:'en',category:'road_damage',title:'Pothole on Jalan Ampang',summaryEn:'Pothole near the main gate on Jalan Ampang, Kuala Lumpur.',summaryMs:'Lubang jalan berhampiran pintu utama di Jalan Ampang, Kuala Lumpur.',activeIncident:'no',injuryReported:'no',injuredCount:0,immediateDanger:'unknown',locationText:'Jalan Ampang, Kuala Lumpur',accessPoint:'Main gate',hazard:null,unknownFields:[],nextQuestionEn:'Please confirm the location.',nextQuestionMs:'Sila sahkan lokasi.',evidenceSummary:'Prepared demo hazard record.',privacyUncertain:true,privacyRegions:[]};
  const a=buildAssessment(facts,facts.summaryEn,locationClaim({text:facts.locationText,lat:3.1593,lng:101.7114,confirmed:true,accessPoint:'Main gate'}));
  await this.transaction(async c=>{await c.query("INSERT INTO fmc_reports(id,draft_key,status,assessment,fixture) VALUES('FMC-042',$1,'submitted',$2,true) ON CONFLICT(id) DO NOTHING",['00000000-0000-4000-8000-000000000042',JSON.stringify(a)]);await c.query("INSERT INTO fmc_repairs(report_id) VALUES('FMC-042') ON CONFLICT DO NOTHING");});
 }
 async hazards():Promise<HazardRecord[]>{const {rows}=await this.pool.query("SELECT r.id,r.assessment,r.fixture,p.state,r.updated_at FROM fmc_reports r JOIN fmc_repairs p ON p.report_id=r.id WHERE r.status='submitted' ORDER BY r.updated_at DESC LIMIT 500");return rows.map(r=>({id:r.id,category:r.assessment.facts.hazard||r.assessment.facts.category,location:r.assessment.location.text,lat:r.assessment.location.lat,lng:r.assessment.location.lng,status:r.state==='resident_verified'?'repaired' as const:'open' as const,demo:r.fixture,updatedAt:r.updated_at.toISOString()})).filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lng));}
 async saveDraft(body:any){
  requireValue(uuid(body.draftId),'A valid draft ID is required.');requireValue(matchesSchema(body.facts,INCIDENT_SCHEMA),'Complete the incident facts first.');
  requireValue(typeof body.transcript==='string'&&body.transcript.length<=8000,'Invalid transcript.');const attached=photos(body.photos||[]);
  const a=buildAssessment(body.facts,text(body.transcript),locationClaim(body.location),await this.hazards());
  const protectedImages=await this.protectPhotos(attached,a.facts.privacyRegions),safePhotos=protectedImages.map(r=>r.safeImage),diagnostics=protectedImages.map(r=>r.diagnostics);
  return this.transaction(async c=>{
   const old=(await c.query('SELECT * FROM fmc_reports WHERE draft_key=$1 FOR UPDATE',[body.draftId])).rows[0];
   if(this.options.ownerKey&&old)requireValue(old.owner_key===this.options.ownerKey,'Draft not found.',404);
   if(old?.status==='submitted')return {id:old.id,status:old.status,assessment:old.assessment,safePhotos:old.photos};
   const row=old?(await c.query('UPDATE fmc_reports SET assessment=$2,photos=$3,photo_diagnostics=$4,updated_at=now() WHERE id=$1 RETURNING id,status',[old.id,JSON.stringify(a),JSON.stringify(safePhotos),JSON.stringify(diagnostics)])).rows[0]:(await c.query('INSERT INTO fmc_reports(draft_key,assessment,photos,photo_diagnostics,resident) VALUES($1,$2,$3,$4,'Resident') ON CONFLICT(draft_key) DO NOTHING RETURNING id,status',[body.draftId,JSON.stringify(a),JSON.stringify(safePhotos),JSON.stringify(diagnostics)])).rows[0];
   requireValue(row,'Draft is being saved; retry.',409);if(this.options.ownerKey&&!old)await c.query('UPDATE fmc_reports SET owner_key=$2 WHERE id=$1',[row.id,this.options.ownerKey]);return {...row,assessment:a,safePhotos};
  });
 }
 async submit(body:any){
  requireValue(uuid(body.draftId),'A valid draft ID is required.');
  const provided=body.privacyReviewed===true?photos(body.protectedPhotos||[]):[];const safeReviewed=(await this.protectPhotos(provided)).map(r=>r.safeImage);
  return this.transaction(async c=>{
   const r=(await c.query('SELECT * FROM fmc_reports WHERE draft_key=$1 FOR UPDATE',[body.draftId])).rows[0];requireValue(r,'Save the report draft first.',404);
   if(this.options.ownerKey)requireValue(r.owner_key===this.options.ownerKey,'Draft not found.',404);
   if(r.status==='submitted')return{id:r.id,status:r.status,localOnly:true,dispatchAcknowledged:!!r.dispatch_receipt};
   requireValue(r.assessment.facts.title&&r.assessment.originalText,'Describe the incident first.');
   const link=text(body.linkedHazard,30);if(link){const candidate=r.assessment.related?.find((v:any)=>v.id===link);requireValue(candidate,'Review a suggested hazard before linking it.');requireValue(link!==r.id,'A report cannot link to itself.');await c.query('UPDATE fmc_reports SET linked_hazard=$2,link_kind=$3 WHERE id=$1',[r.id,link,candidate.relationship]);}
   let protectedImages:string[]=[];if(body.privacyReviewed===true){requireValue(provided.length===r.photos.length,'Review every protected photo before sharing.');protectedImages=safeReviewed;}
   await c.query("UPDATE fmc_reports SET status='submitted',proposal=$2,protected_photos=$3,privacy_reviewed=$4,updated_at=now() WHERE id=$1",[r.id,JSON.stringify(r.assessment.proposal),JSON.stringify(protectedImages),body.privacyReviewed===true]);
   if(r.assessment.proposal.tasks.some((t:any)=>t.type==='hazard_repair')&&!link)await c.query('INSERT INTO fmc_repairs(report_id) VALUES($1) ON CONFLICT DO NOTHING',[r.id]);
   await event(c,r.id,'Report created',{source:'FixMyCity AI / citizen app',linkedHazard:link||null,authorityNotified:false});
   return{id:r.id,status:'submitted',localOnly:true,dispatchAcknowledged:false};
  });
 }
 async list(){return(await this.pool.query(`
  WITH RECURSIVE chain(source,id,depth) AS (
   SELECT id,id,0 FROM fmc_reports WHERE status='submitted'
   UNION ALL
   SELECT c.source,COALESCE(r.linked_hazard,l.target_id),c.depth+1
   FROM chain c JOIN fmc_reports r ON r.id=c.id
   LEFT JOIN fmc_case_links l ON l.source_id=r.id AND l.kind='duplicate' AND l.active
   WHERE c.depth<30 AND COALESCE(r.linked_hazard,l.target_id) IS NOT NULL
  ), roots AS (SELECT DISTINCT ON(source) source,id FROM chain ORDER BY source,depth DESC)
  SELECT r.id,r.status,r.assessment->'facts'->>'title' AS title,r.assessment->'facts'->>'summaryEn' AS summary,
  r.assessment->'facts'->>'category' AS category,p.state AS repair_state,
  (r.assessment->'proposal'->'tasks' @> '[{"type":"incident_response"}]'::jsonb) AS has_response,
  r.resident,r.response_state,r.linked_hazard,r.created_at,r.fixture,
  (r.owner_key=$1 AND r.owner_key IS NOT NULL) AS mine
  FROM fmc_reports r JOIN roots ON roots.source=r.id LEFT JOIN fmc_repairs p ON p.report_id=roots.id
  ORDER BY r.created_at DESC LIMIT 100`,[this.options.ownerKey||null])).rows;}

 async repairTarget(c:Pool|PoolClient,id:string){
  const seen=new Set<string>();let current=id;
  for(let depth=0;depth<30;depth++){requireValue(!seen.has(current),'Case grouping would create a cycle.',409);seen.add(current);const row=(await c.query("SELECT r.linked_hazard,(SELECT target_id FROM fmc_case_links WHERE source_id=r.id AND kind='duplicate' AND active LIMIT 1) AS duplicate_of FROM fmc_reports r WHERE r.id=$1",[current])).rows[0];const next=row?.linked_hazard||row?.duplicate_of;if(!next)return current;current=next;}throw new StoreError(409,'Case group is too deep.');
 }
 async get(id:string,admin=false){
  const r=(await this.pool.query('SELECT * FROM fmc_reports WHERE id=$1',[id])).rows[0];requireValue(r,'Report not found.',404);
  if(this.options.ownerKey)requireValue(r.status==='submitted'||r.owner_key===this.options.ownerKey,'Report not found.',404);
  const repairTarget=await this.repairTarget(this.pool,id);
  const [history,telemetry,repair]=await Promise.all([this.pool.query('SELECT event,details,created_at FROM fmc_report_events WHERE report_id=$1 ORDER BY id',[id]),this.pool.query('SELECT sequence,lat,lng,sampled_at,mode FROM fmc_telemetry WHERE report_id=$1 ORDER BY sequence DESC LIMIT 1',[id]),this.pool.query('SELECT * FROM fmc_repairs WHERE report_id=$1',[repairTarget])]);
  const links=(await this.pool.query('SELECT * FROM fmc_case_links WHERE source_id=$1 OR target_id=$1 ORDER BY id DESC',[id])).rows;
  if(!admin)delete r.photo_diagnostics;else {const config=await this.config();r.photo_diagnostics=r.photo_diagnostics.map((d:any)=>{const {embedding,...publicDiagnostics}=d;return {...publicDiagnostics,threshold:config.settings.classificationThreshold,configVersion:config.version,classificationReview:!d.classification?.length?'No CLIP score — review the intake classification':d.classification[0].score>=config.settings.classificationThreshold?'Above review threshold — confirm the label':'Low score — manual classification required'};});}
  const position=telemetry.rows[0];return{...r,links,repairTarget,events:history.rows,repair:repair.rows[0]||null,tracking:{mode:r.tracking_mode,position:['response_complete'].includes(r.response_state)?null:position||null,stale:!position||Date.now()-new Date(position.sampled_at).getTime()>30000,live:position?.mode==='live'&&!(['response_complete'].includes(r.response_state))}};
 }
 async action(id:string,action:string,body:any){
  let safeRepair:any[]=[];if(action==='complete-repair'){const before=photos([body.before])[0],after=photos([body.after])[0];requireValue(before!==after,'Use distinct before and after photos.');safeRepair=await this.protectPhotos([before,after]);}
  return this.transaction(async c=>{
   await c.query("SELECT pg_advisory_xact_lock(hashtext(current_schema()||':fmc-case-actions'))");
   const r=(await c.query('SELECT * FROM fmc_reports WHERE id=$1 FOR UPDATE',[id])).rows[0];requireValue(r?.status==='submitted','Submit the report first.',409);
   if(action==='confirm-location'){
    requireValue(!r.dispatch_receipt,'An assigned response location requires agency review.',409);const loc=locationClaim(body.location);requireValue(loc.confirmed&&loc.text,'Confirm valid coordinates and a place name.');const assessment=buildAssessment(r.assessment.facts,r.assessment.originalText,loc,await this.hazards());await c.query("UPDATE fmc_reports SET assessment=$2,approved_version=NULL,response_state='proposed',updated_at=now() WHERE id=$1",[id,JSON.stringify(assessment)]);await event(c,id,'Location confirmed in local review');
   }else if(action==='plan'){
    requireValue(r.assessment.location.confirmed,'Confirm the report coordinates before preparing a route.',409);
    requireValue(['proposed','approved'].includes(r.response_state),'An acknowledged assignment cannot be edited.',409);
    requireValue(Number.isInteger(body.count)&&body.count>=1&&body.count<=20,'Choose a team size between 1 and 20.');
    const entrance=text(body.entrance,120),vehicle=text(body.vehicle,40),capability=text(body.capability,60);
    requireValue(entrance&&/^[a-zA-Z0-9_-]{1,40}$/.test(vehicle)&&capability,'Specify the access point, vehicle and capability.');
    const start=body.vehicleLocation;requireValue(start&&Number.isFinite(start.lat)&&Math.abs(start.lat)<=90&&Number.isFinite(start.lng)&&Math.abs(start.lng)<=180,'Provide valid vehicle coordinates.');
    requireValue(this.options.planRoute,'Configure the response planner and routing service first.',503);
    const lat=r.assessment.location.lat,lng=r.assessment.location.lng;
    let result:any;try{result=await this.options.planRoute!({incidents:[{id,location:{lat,lng},requiredCapabilities:[capability]}],vehicles:[{id:vehicle,location:start,capabilities:[capability]}]});}catch{throw new StoreError(503,'Response planning is unavailable. Check the routing service.');}
    const route=result?.proposals?.find((p:any)=>p.incidentId===id&&p.vehicleId===vehicle);
    requireValue(route&&route.geometry?.type==='LineString'&&Array.isArray(route.geometry.coordinates)&&route.geometry.coordinates.length>=2&&route.geometry.coordinates.length<=10000&&route.geometry.coordinates.every((p:any)=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90)&&Number.isFinite(route.durationSeconds)&&Number.isFinite(route.distanceMetres),'No eligible route was found.',409);
    const plan={...r.proposal,personnel:[{role:'Response team',count:body.count}],vehicle:{capability,assignedId:vehicle},accessPoint:entrance,mode:'authority_review',route:{status:'proposed',geometry:route.geometry.coordinates,etaSeconds:route.durationSeconds,distanceMetres:route.distanceMetres}};
    await c.query("UPDATE fmc_reports SET proposal=$2,proposal_version=proposal_version+1,approved_version=NULL,response_state='proposed',updated_at=now() WHERE id=$1",[id,JSON.stringify(plan)]);await event(c,id,'Response proposal prepared / revised',{priorApprovalInvalidated:true});
   }else if(action==='approve'){
    requireValue(r.proposal.mode==='authority_review'&&r.proposal_version===body.version&&r.response_state==='proposed','Review the latest proposal before approval.',409);
    await c.query("UPDATE fmc_reports SET approved_version=proposal_version,response_state='approved',updated_at=now() WHERE id=$1",[id]);await event(c,id,'Officer approved response proposal',{version:body.version});
   }else if(action==='dispatch'){
    if(r.dispatch_receipt)return {id,receipt:r.dispatch_receipt};
    requireValue(r.response_state==='approved'&&r.approved_version===r.proposal_version&&body.version===r.proposal_version,'Current officer approval is required.',409);
    requireValue(this.options.dispatch,'Configure an authority dispatch connection first.',503);let receipt:string;try{receipt=await this.options.dispatch!({id,version:r.proposal_version,proposal:r.proposal});}catch{throw new StoreError(503,'The authority dispatch connection could not acknowledge the assignment.');}await c.query("UPDATE fmc_reports SET response_state='dispatch_acknowledged',dispatch_receipt=$2,tracking_mode='none',updated_at=now() WHERE id=$1",[id,receipt]);await event(c,id,'Dispatch acknowledged by authority',{receipt});
   }else if(action==='telemetry'){
    requireValue(['dispatch_acknowledged','en_route'].includes(r.response_state),'No active assignment.',409);
    const t=body.position,now=Date.now();requireValue(t&&Number.isFinite(t.lat)&&Number.isFinite(t.lng)&&Math.abs(t.lat)<=90&&Math.abs(t.lng)<=180&&Number.isFinite(t.at)&&now-t.at<=30000&&t.at<=now+5000&&Number.isInteger(t.sequence)&&t.sequence>0,'Invalid or stale position.');
    const prev=(await c.query('SELECT * FROM fmc_telemetry WHERE report_id=$1 ORDER BY sequence DESC LIMIT 1',[id])).rows[0];if(prev){const elapsed=(t.at-new Date(prev.sampled_at).getTime())/1000;requireValue(t.sequence>prev.sequence&&elapsed>0&&Math.hypot((t.lat-prev.lat)*111000,(t.lng-prev.lng)*111000)/elapsed<=60,'Position is out of order or implausible.',409);}
    await c.query("INSERT INTO fmc_telemetry(report_id,sequence,lat,lng,sampled_at,mode) VALUES($1,$2,$3,$4,$5,'live')",[id,t.sequence,t.lat,t.lng,new Date(t.at)]);await c.query("UPDATE fmc_reports SET response_state='en_route',tracking_mode='live',updated_at=now() WHERE id=$1",[id]);
   }else if(action==='complete-response'){
    if(r.response_state==='response_complete')return{id,status:r.response_state};requireValue(['dispatch_acknowledged','en_route'].includes(r.response_state),'No acknowledged response.',409);
    await c.query("UPDATE fmc_reports SET response_state='response_complete',updated_at=now() WHERE id=$1",[id]);await event(c,id,'Response complete; linked repair stays open');
   }else if(action==='complete-repair'){
    const before=safeRepair[0].safeImage,after=safeRepair[1].safeImage;
    const target=await this.repairTarget(c,id),p=(await c.query('SELECT * FROM fmc_repairs WHERE report_id=$1 FOR UPDATE',[target])).rows[0];requireValue(p,'No linked repair task.',409);requireValue(p.state!=='resident_verified','This repair is already reviewed.',409);
    requireValue(matchesSchema(body.comparison,REPAIR_SCHEMA),'Compare the repair photos first.');requireValue(text(body.note,1000),'Add the authority completion note.');
    await c.query("UPDATE fmc_repairs SET state='authority_completed',before_photo=$2,after_photo=$3,comparison=$4,authority_note=$5,completed_at=now() WHERE report_id=$1",[target,before,after,JSON.stringify(body.comparison),text(body.note,1000)]);await event(c,id,'Authority repair completion recorded',{repair:target});
   }else if(action==='review-repair'){
    if(this.options.ownerKey)requireValue(r.owner_key===this.options.ownerKey,'Only the report owner can confirm this repair.',403);
    requireValue(body.confirmed===true,'Confirm the reviewed repair.');const target=await this.repairTarget(c,id),p=(await c.query('SELECT * FROM fmc_repairs WHERE report_id=$1 FOR UPDATE',[target])).rows[0];requireValue(p&&['authority_completed','resident_verified'].includes(p.state),'Authority completion and evidence are required.',409);
    let credited=false;
    // Only the server may supply an identity that has passed verification.
    if(this.options.verifiedResident){const credit=await c.query("INSERT INTO fmc_contributions(report_id,resident,kind,points) VALUES($1,$2,'repair_review',15) ON CONFLICT DO NOTHING RETURNING id",[target,this.options.verifiedResident]);credited=!!credit.rowCount;}
    await c.query("UPDATE fmc_repairs SET state='resident_verified',reviewed_at=COALESCE(reviewed_at,now()) WHERE report_id=$1",[target]);
    await event(c,id,'Resident confirmed repair',{repair:target,recognitionCredited:credited});return{id,credited,points:credited?15:0,recognitionAvailable:!!this.options.verifiedResident};
   }else if(action==='link-case'){
    const target=text(body.target,30),reason=text(body.reason,1000),kind=body.kind;requireValue(['duplicate','related_hazard','recurrence'].includes(kind)&&target!==id&&reason.length>=8,'Choose a different case and provide the reason.');
    const other=(await c.query('SELECT * FROM fmc_reports WHERE id=$1',[target])).rows[0];requireValue(other?.status==='submitted','Target case not found.',404);
    if(kind==='duplicate'){
     requireValue(r.assessment.facts.category!=='road_accident'&&r.assessment.facts.injuryReported!=='yes'&&(r.assessment.facts.injuredCount??0)===0,'New injuries and accidents cannot be merged away. Use a related-hazard link.',409);
     requireValue(!(await c.query("SELECT 1 FROM fmc_case_links WHERE source_id=$1 AND kind='duplicate' AND active",[id])).rowCount,'Undo the current duplicate group before choosing another.',409);
     requireValue(await this.repairTarget(c,target)!==id,'Case grouping would create a cycle.',409);
     const sourceRepair=(await c.query('SELECT state FROM fmc_repairs WHERE report_id=$1',[id])).rows[0];requireValue(!sourceRepair||sourceRepair.state==='open','Reviewed repair evidence must remain separate.',409);
     requireValue(!r.dispatch_receipt,'An assigned response must remain separate.',409);
     requireValue(other.assessment.facts.category===r.assessment.facts.category,'Different issue types must stay separate.',409);
     const repair=(await c.query('SELECT state FROM fmc_repairs WHERE report_id=$1',[target])).rows[0];requireValue(repair?.state!=='resident_verified','A repaired hazard needs a recurrence review, not a duplicate merge.',409);
    }
    const compatible=relatedHazards(r.assessment.facts,r.assessment.location,[{id:target,category:other.assessment.facts.category,location:other.assessment.location.text,lat:other.assessment.location.lat,lng:other.assessment.location.lng,status:'open',updatedAt:other.updated_at.toISOString()}]);
    requireValue(compatible.length,'Confirm nearby matching locations and issue types before linking.');
    await c.query('INSERT INTO fmc_case_links(source_id,target_id,kind,reason) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[id,target,kind,reason]);await event(c,id,'Case link approved',{target,kind,reason,sourcePreserved:true});
   }else if(action==='undo-link'){
    const updated=await c.query('UPDATE fmc_case_links SET active=false,reversed_at=now() WHERE id=$1 AND source_id=$2 AND active RETURNING id',[body.linkId,id]);requireValue(updated.rowCount,'Active link not found.',404);await event(c,id,'Case link reversed',{linkId:body.linkId});
   }else throw new StoreError(400,'Unknown action.');
   return{id,updated:true,localOnly:true};
  });
 }
 async leaderboard(){
  const resident=this.options.verifiedResident;
  if(!resident)return{mode:'verified',resident:null,points:0,verified:0,basePoints:0,baseVerified:0,contributions:[],rows:[],recognitionAvailable:false};
  const {rows}=await this.pool.query('SELECT report_id,kind,points,created_at FROM fmc_contributions WHERE resident=$1 ORDER BY created_at DESC',[resident]);
  const points=rows.reduce((sum:number,r:any)=>sum+r.points,0);
  return{mode:'verified',resident,points,verified:rows.length,basePoints:0,baseVerified:0,contributions:rows,rows:points?[{name:resident,points,you:true}]:[],recognitionAvailable:true};
 }
 async candidates(id:string){
  const source=(await this.pool.query('SELECT * FROM fmc_reports WHERE id=$1',[id])).rows[0];requireValue(source,'Report not found.',404);
  const candidates=relatedHazards(source.assessment.facts,source.assessment.location,await this.hazards()).filter(r=>r.id!==id);
  for(const candidate of candidates as any[]){const other=(await this.pool.query('SELECT assessment,photo_diagnostics,created_at FROM fmc_reports WHERE id=$1',[candidate.id])).rows[0];const x=source.photo_diagnostics?.[0],y=other.photo_diagnostics?.[0];candidate.visualSimilarity=x?.embedding?.length===y?.embedding?.length&&x?.embedding?.length?Math.max(-1,Math.min(1,x.embedding.reduce((sum:number,v:number,i:number)=>sum+v*y.embedding[i],0))):null;candidate.sameProtectedImage=!!x?.safeImageHash&&x.safeImageHash===y?.safeImageHash;candidate.hoursApart=Math.round(Math.abs(new Date(source.created_at).getTime()-new Date(other.created_at).getTime())/3600000);const words=(s:string)=>new Set(s.toLowerCase().match(/[a-z]{3,}/g)||[]),a=words(source.assessment.facts.summaryEn),b=words(other.assessment.facts.summaryEn);candidate.textOverlap=[...a].filter(w=>b.has(w)).length/Math.max(1,new Set([...a,...b]).size);candidate.warning=candidate.sameProtectedImage?'Repeated image: review contribution value; do not automatically award credit.':'Similarity is a review signal, not proof of a duplicate.';}
  const config=await this.config();return candidates.map((c:any)=>({...c,similarityThreshold:config.settings.duplicateSimilarity,visualMatchCandidate:c.visualSimilarity!==null&&c.visualSimilarity>=config.settings.duplicateSimilarity,configVersion:config.version}));
 }
 async config(){return(await this.pool.query("SELECT version,settings,updated_at FROM fmc_agent_config WHERE id='intake'")).rows[0]||{version:1,settings:{tone:'concise',language:'adaptive',classificationThreshold:.35,duplicateSimilarity:.92}};}
 async updateConfig(body:any){requireValue(['concise','supportive','step_by_step'].includes(body.tone)&&['adaptive','en','ms'].includes(body.language),'Choose a supported tone and language.');requireValue(Number.isFinite(body.classificationThreshold)&&body.classificationThreshold>=.1&&body.classificationThreshold<=.9&&Number.isFinite(body.duplicateSimilarity)&&body.duplicateSimilarity>=.7&&body.duplicateSimilarity<=.99,'Keep thresholds within the supported range.');return(await this.pool.query("INSERT INTO fmc_agent_config(id,settings) VALUES('intake',$1) ON CONFLICT(id) DO UPDATE SET settings=$1,version=fmc_agent_config.version+1,updated_at=now() RETURNING version,settings,updated_at",[JSON.stringify(body)])).rows[0];}
 async knowledge(){return(await this.pool.query('SELECT * FROM fmc_reviewed_knowledge ORDER BY id DESC LIMIT 100')).rows;}
 async addKnowledge(body:any){requireValue(text(body.question,300)&&text(body.answer,2000)&&['Kuala Lumpur','Malaysia','Test campus'].includes(body.scope),'Enter a question, reviewed answer and supported scope.');return(await this.pool.query('INSERT INTO fmc_reviewed_knowledge(report_id,question,answer,scope,approved) VALUES($1,$2,$3,$4,$5) RETURNING *',[body.reportId||null,text(body.question,300),text(body.answer,2000),body.scope,body.approved===true])).rows[0];}
}
export function createReportAPI(baseStore:ReportStore,options:{adminKey?:string}={}){const sessions=new Map<string,number>();let failedKeys:number[]=[];const cookieKey=options.adminKey&&options.adminKey.length>=32?options.adminKey:randomBytes(32).toString('hex');return async(request:Request)=>{
 let store=baseStore,citizenCookie='';
 const url=new URL(request.url),json=(data:unknown,status=200)=>{const response=new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store, private'}});if(citizenCookie)response.headers.append('Set-Cookie',citizenCookie);return response;};
 if(!['localhost','127.0.0.1'].includes(url.hostname))return json({message:'Local preview only.'},403);
 if(request.method==='POST'&&(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site'))return json({message:'Open this action from the local app.'},403);
 const admin=url.pathname.startsWith('/api/local-admin');
 if(admin&&url.pathname==='/api/local-admin/session'&&request.method==='POST'){
  if(!options.adminKey||options.adminKey.length<32)return json({message:'Configure the private admin access key on this laptop first.'},503);
  failedKeys=failedKeys.filter(t=>Date.now()-t<60000);if(failedKeys.length>=5)return json({message:'Wait a minute before trying the admin key again.'},429);
  let supplied='';try{const reader=request.body?.getReader();if(!reader)throw Error();let size=0,body='';const decoder=new TextDecoder();try{for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>2048){await reader.cancel();return json({message:'Invalid key.'},400);}body+=decoder.decode(chunk.value,{stream:true});}body+=decoder.decode();}finally{reader.releaseLock();}supplied=String(JSON.parse(body).key||'');}catch{}
  const expected=Buffer.from(options.adminKey),provided=Buffer.from(supplied);
  if(provided.length!==expected.length||!timingSafeEqual(provided,expected)){failedKeys.push(Date.now());return json({message:'Enter the admin access key from this laptop.'},401);}
  for(const [key,expires]of sessions)if(expires<Date.now())sessions.delete(key);
  if(sessions.size>=20)return json({message:'Too many local officer sessions.'},429);
  const token=randomUUID();sessions.set(token,Date.now()+8*3600000);const response=json({role:'local_test_officer',productionAuth:false});response.headers.set('Set-Cookie',`fmc_local_officer=${token}; HttpOnly; SameSite=Strict; Path=/api/local-admin; Max-Age=28800`);return response;
 }
 if(admin){const token=request.headers.get('cookie')?.match(/(?:^|;\s*)fmc_local_officer=([^;]+)/)?.[1];if(!token||(sessions.get(token)||0)<Date.now())return json({message:'Enter the local test officer workspace first.'},401);url.pathname=url.pathname.replace('/api/local-admin','/api/local-reports');}
 if(!admin){
  const sign=(id:string)=>createHmac('sha256',cookieKey).update('citizen:'+id).digest('hex');
  const match=request.headers.get('cookie')?.match(/(?:^|;\s*)fmc_local_citizen=([a-f0-9-]{36})\.([a-f0-9]{64})/i);
  let id:string|undefined;
  if(match){const given=Buffer.from(match[2],'hex'),expected=Buffer.from(sign(match[1]),'hex');if(given.length===expected.length&&timingSafeEqual(given,expected))id=match[1];}
  if(!id){id=randomUUID();citizenCookie=`fmc_local_citizen=${id}.${sign(id)}; HttpOnly; SameSite=Strict; Path=/api/local-reports; Max-Age=34560000`;}
  store=new ReportStore(baseStore.pool,baseStore.protect,{...baseStore.options,ownerKey:id,verifiedResident:undefined});
 }
 try{
  if(request.method==='GET'){
   if(url.pathname==='/api/local-reports/status'){await store.pool.query('SELECT 1');return json({available:true,database:store.options.database==='supabase'?'Supabase':'PostgreSQL',localOnly:store.options.database!=='supabase'});}
   if(url.pathname==='/api/local-reports')return json(await store.list());
   if(url.pathname==='/api/local-reports/leaderboard')return json(await store.leaderboard());
   if(admin&&url.pathname==='/api/local-reports/config')return json(await store.config());
   if(admin&&url.pathname==='/api/local-reports/knowledge')return json(await store.knowledge());
   const candidates=url.pathname.match(/^\/api\/local-reports\/(FMC-\d{3,10})\/candidates$/);if(admin&&candidates)return json(await store.candidates(candidates[1]));
   const match=url.pathname.match(/^\/api\/local-reports\/(FMC-\d{3,10})$/);if(match){const record=await store.get(match[1],admin);if(admin)return json(record);const own=!!store.options.ownerKey&&record.owner_key===store.options.ownerKey;const clean={...record,mine:own};delete clean.owner_key;delete clean.draft_key;delete clean.photo_diagnostics;if(!own){clean.photos=clean.privacy_reviewed?clean.protected_photos:[];clean.assessment={...clean.assessment,originalText:'',originalLocationText:undefined};clean.events=clean.events.map((e:any)=>({event:e.event,created_at:e.created_at,details:{}}));clean.tracking={mode:'private',position:null,stale:true,live:false};}return json(clean);}
  }
  if(request.method!=='POST')return json({message:'Not found.'},404);
  requireValue(/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''),'Send JSON.',415);
  const reader=request.body?.getReader();requireValue(reader,'Send report details.');let size=0;const chunks:Uint8Array[]=[];for(;;){const next=await reader!.read();if(next.done)break;size+=next.value.length;if(size>11000000){await reader!.cancel();throw new StoreError(413,'Report images are too large.');}chunks.push(next.value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}let body:any;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new StoreError(400,'Invalid report data.');}requireValue(body&&typeof body==='object'&&!Array.isArray(body),'Invalid report data.');
  if(url.pathname==='/api/local-reports/draft')return json(await store.saveDraft(body));
  if(url.pathname==='/api/local-reports/submit')return json(await store.submit(body));
  if(admin&&url.pathname==='/api/local-reports/config')return json(await store.updateConfig(body));
  if(admin&&url.pathname==='/api/local-reports/knowledge')return json(await store.addKnowledge(body));
  const match=url.pathname.match(/^\/api\/local-reports\/(FMC-\d{3,10})\/([a-z-]+)$/);if(match){if(!admin&&match[2]!=='review-repair')return json({message:'A local officer session is required.'},403);return json(await store.action(match[1],match[2],body));}
  return json({message:'Not found.'},404);
 }catch(error){return json({message:error instanceof StoreError?error.message:'The local report could not be saved. Your draft remains available.'},error instanceof StoreError?error.status:503);}
};}
