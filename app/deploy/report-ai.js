import {analyzeReport,knowledge,REPORT_MODEL,ReportAIError,buildAssessment,locationClaim,cleanText,INCIDENT_SCHEMA,matchesSchema} from './report-engine.js';
import {reportPreferences} from './report-data.js';
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff',...(status===429?{'Retry-After':'60'}:{})}});
const failure=error=>reply({message:error instanceof ReportAIError?error.message:'AI review is unavailable. Your draft has not been submitted.'},error instanceof ReportAIError?error.status:503);
function localIncidentService(){
 const address=process.env.FMC_AI_SERVICE_URL,token=process.env.FMC_AI_SERVICE_TOKEN;
 if(!address||!token||token.length<32)return null;
 try{const url=new URL(address);if(url.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)return null;return{url,token};}catch{return null;}
}
async function serviceRequest(service,path,body){
 const response=await fetch(new URL(path,service.url),{method:body?'POST':'GET',headers:{Authorization:'Bearer '+service.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000),redirect:'error'});
 if(!response.ok)throw new ReportAIError(503,'The selected AI service is unavailable. Your draft is still available.');
 return response.json();
}
async function localServiceStatus(service){
 if(!service)return false;
 try{const status=await serviceRequest(service,'/health');return status?.ready===true&&status?.gemini_configured===true;}catch{return false;}
}
async function analyzeWithService(service,body){
 const text=cleanText(body.transcript,8000);if(!text)throw new ReportAIError(400,'Describe the incident before using this AI service.');
 const claim=locationClaim(body.location),language=body.language==='ms'?'ms':'en';
 const location=claim.confirmed?{latitude:claim.lat,longitude:claim.lng,confirmed:true}:null;
 const result=await serviceRequest(service,'/v1/triage',{text,locale:language,location,allow_external_processing:true});
 const a=result?.assessment,categories=new Set(['road_accident','road_damage','lighting','cleanliness','drainage','flood','fire','crime','fallen_tree','other']);
 if(!a||typeof a!=='object')throw new ReportAIError(502,'The AI review was incomplete. Please try again.');
 const truth=value=>['yes','no','unknown'].includes(value)?value:'unknown';
 const facts={language,category:categories.has(a.category)?a.category:'other',title:a.title,summaryEn:a.summary_en,summaryMs:a.summary_ms,
  activeIncident:truth(a.active_incident),injuryReported:truth(a.injury_reported),injuredCount:Number.isInteger(a.injured_count)?a.injured_count:null,immediateDanger:a.urgency==='emergency'?'yes':truth(a.immediate_danger),
  locationText:claim.text,accessPoint:claim.accessPoint,hazard:categories.has(a.hazard)?a.hazard:null,unknownFields:a.missing,nextQuestionEn:a.question_en,nextQuestionMs:a.question_ms,
  evidenceSummary:'',privacyUncertain:true,privacyRegions:[]};
 if(!matchesSchema(facts,INCIDENT_SCHEMA))throw new ReportAIError(502,'The AI review was incomplete. Please try again.');
 return buildAssessment(facts,text,claim);
}
async function readBody(request){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))throw new ReportAIError(415,'Send JSON.');
 const reader=request.body?.getReader();if(!reader)throw new ReportAIError(400,'Send a report draft.');
 let size=0;const parts=[];try{for(;;){const{done,value}=await reader.read();if(done)break;size+=value.length;if(size>5200000){await reader.cancel();throw new ReportAIError(413,'The report photos are too large.');}parts.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new ReportAIError(400,'The report could not be read.');}
}
export function createLocalReportAI(key='',{fetchAPI=fetch,now=Date.now,protect=null,configuration=null}={}){
 let day='',count=0,active=0,starts=[];
 return async request=>{
  const url=new URL(request.url);
  if(!['127.0.0.1','localhost'].includes(url.hostname))return reply({message:'Not found.'},404);
  if(request.method==='GET'&&url.pathname==='/api/ai/knowledge')return reply(knowledge());
  if(request.method==='GET'&&url.pathname==='/api/ai/status'){const service=localIncidentService(),serviceReady=await localServiceStatus(service);return reply({available:!!key||serviceReady,model:REPORT_MODEL,incidentServiceAvailable:serviceReady});}
  if(url.pathname!=='/api/ai/analyze')return reply({message:'Not found.'},404);
  if(request.method!=='POST')return reply({message:'Method not allowed.'},405);
  if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return reply({message:'Open AI review from FixMyCity.'},403);
  try{
   const body=await readBody(request),today=new Date(now()).toISOString().slice(0,10);if(day!==today){day=today;count=0;}
   starts=starts.filter(t=>now()-t<60000);
   if(active>=2||starts.length>=20||(body.mode!=='voice_draft'&&count>=60))throw new ReportAIError(429,'AI review is busy. Please try again shortly.');
   starts.push(now());if(body.mode!=='voice_draft')count++;active++;
   try{if(body.photos?.length){if(!protect)throw new ReportAIError(503,'Photo protection is not configured. No photo was sent for AI review.');body.photos=await Promise.all(body.photos.map(async image=>(await protect(image)).safeImage));}
    if(body.allowExternalProcessing===true&&(!body.mode||body.mode==='intake')&&!body.photos?.length){const service=localIncidentService();if(!service||!await localServiceStatus(service))throw new ReportAIError(503,'The selected AI service is not configured or available.');return reply(await analyzeWithService(service,body));}
    const preferences=configuration?await configuration():undefined;return reply(await analyzeReport(body,key,fetchAPI,preferences));}finally{active--;}
  }catch(error){return failure(error);}
 };
}
export async function handleReportAI(request,env){
 const url=new URL(request.url),ready=!!env.REPORT_AI&&!!env.VOICE_OPENAI_API_KEY&&!!env.VOICE_RATE_LIMIT&&(env.IDENTITY_SESSION_SECRET?.length||0)>=32;
 if(request.method==='GET'&&url.pathname==='/api/ai/knowledge')return reply(knowledge());
 if(request.method==='GET'&&url.pathname==='/api/ai/status')return reply({available:ready,model:REPORT_MODEL});
 if(url.pathname!=='/api/ai/analyze')return reply({message:'Not found.'},404);
 if(request.method!=='POST')return reply({message:'Method not allowed.'},405);
 if(request.headers.get('origin')!==url.origin||['cross-site','none'].includes(request.headers.get('sec-fetch-site')))return reply({message:'Open AI review from FixMyCity.'},403);
 if(!ready)return reply({message:'AI report review is not configured.'},503);
 const ip=request.headers.get('CF-Connecting-IP');if(!ip)return reply({message:'Open AI review from FixMyCity.'},403);
 if(!(await env.VOICE_RATE_LIMIT.limit({key:'report-ai:'+ip})).success)return reply({message:'Too many AI reviews. Please wait a minute.'},429);
 try{
  const body=await readBody(request),enc=new TextEncoder();
  if(body.photos?.length&&body.photoProtection!=='browser_faces_v1')throw new ReportAIError(400,'Review the photo privacy preview before AI review.');
  const key=await crypto.subtle.importKey('raw',enc.encode(env.IDENTITY_SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const client=[...new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode('report-ai:'+new Date().toISOString().slice(0,10)+':'+ip)))].map(n=>n.toString(16).padStart(2,'0')).join('');
  return env.REPORT_AI.get(env.REPORT_AI.idFromName('report-ai-v1')).fetch(new Request('https://report-ai.internal/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client,body})}));
 }catch(error){return failure(error);}
}
/** Stores counters only, never reports, photos, names, coordinates or transcript text. */
export class ReportAI {
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 async fetch(request){
  try{
   const {client,body}=await readBody(request);if(!/^[a-f0-9]{64}$/.test(client||''))throw new ReportAIError(403,'Invalid request.');
   if(body?.photos?.length&&body.photoProtection!=='browser_faces_v1')throw new ReportAIError(400,'Review the photo privacy preview before AI review.');
   await this.ctx.blockConcurrencyWhile(async()=>{
    const day=new Date().toISOString().slice(0,10),now=Date.now();let s=await this.ctx.storage.get('budget');if(!s||s.day!==day)s={day,count:0,clients:{},starts:[]};
    s.starts=s.starts.filter(t=>now-t<60000);const used=s.clients[client]||0;
    if(s.starts.length>=30||(body?.mode!=='voice_draft'&&(s.count>=120||used>=20)))throw new ReportAIError(429,'AI review has reached its current limit. Please try later.');
    s.starts.push(now);if(body?.mode!=='voice_draft'){s.count++;s.clients[client]=used+1;}
    await this.ctx.storage.put('budget',s);await this.ctx.storage.setAlarm(Date.parse(day+'T00:00:00Z')+86400000);
   });
   const preferences=(this.env.FMC_DATABASE||this.env.FMC_DATABASE_JSON)?await reportPreferences(this.env):undefined;
   return reply(await analyzeReport(body,this.env.VOICE_OPENAI_API_KEY,fetch,preferences));
  }catch(error){return failure(error);}
 }
 async alarm(){await this.ctx.storage.delete('budget');}
}
