import {Pool} from 'pg';
import {ReportStore,StoreError} from './report-store.js';
import {authorizeCase} from './access-control.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
const encoder=new TextEncoder();
async function device(request,secret){
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
 const sign=async id=>Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode('report-device:'+id))),b=>b.toString(16).padStart(2,'0')).join('');
 const value=request.headers.get('cookie')?.match(/(?:^|;\s*)fmc_report_device=([a-f0-9-]{36})\.([a-f0-9]{64})/)||[];
 if(value[1]&&await crypto.subtle.verify('HMAC',key,Uint8Array.from(value[2].match(/../g),b=>parseInt(b,16)),encoder.encode('report-device:'+value[1])))return {id:value[1],cookie:null};
 const id=crypto.randomUUID();return{id,cookie:`fmc_report_device=${id}.${await sign(id)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=34560000`};
}
async function bodyOf(request){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))throw new StoreError(415,'Send JSON.');
 const reader=request.body?.getReader();if(!reader)throw new StoreError(400,'Send report details.');let size=0;const parts=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>11000000){await reader.cancel();throw new StoreError(413,'Report photos are too large.');}parts.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new StoreError(400,'Invalid report data.');}
}
export function publicRecord(record,owner){
 const own=record.owner_key===owner;
 const clean={...record,mine:own};delete clean.draft_key;delete clean.owner_key;delete clean.photo_diagnostics;
 if(!own){clean.photos=clean.privacy_reviewed?clean.protected_photos:[];clean.assessment={...clean.assessment,originalText:'',originalLocationText:undefined};clean.events=clean.events.map(e=>({event:e.event,created_at:e.created_at,details:{}}));clean.tracking={mode:'private',position:null,stale:true,live:false};}
 if(clean.repair?.comparison){clean.repair={...clean.repair,comparison:{visibleChanges:clean.repair.comparison.visibleChanges}};}
 return clean;
}
export async function withReportStore(env,fn){
 // Hyperdrive verifies the Supabase CA and hostname at the origin. Keep the
 // raw TLS configuration only for Node-based local tests, never disable TLS.
 const config=env.FMC_DATABASE?.connectionString?{connectionString:env.FMC_DATABASE.connectionString}:JSON.parse(env.FMC_DATABASE_JSON||'null');if(!config)throw new StoreError(503,'Report storage is not configured.');
 const pool=new Pool({...config,max:2,connectionTimeoutMillis:15000,idleTimeoutMillis:1000});
 try{return await fn(pool);}finally{await pool.end();}
}
export async function reportPreferences(env){return withReportStore(env,async pool=>{const s=new ReportStore(pool);return{...(await s.config()),knowledge:(await s.knowledge()).filter(k=>k.approved)};});}
export async function handleReportData(request,env){
 const url=new URL(request.url),path=url.pathname.replace(/^\/api\/local-reports/,'/api/reports');
 if(url.hostname!=='fixmycity.online')return json({message:'Not found.'},404);
 if(!['GET','POST'].includes(request.method))return json({message:'Method not allowed.'},405);
 if(request.method==='POST'&&(request.headers.get('origin')!==url.origin||['cross-site','none'].includes(request.headers.get('sec-fetch-site'))))return json({message:'Open this action from FixMyCity.'},403);
 if((!env.FMC_DATABASE&&!env.FMC_DATABASE_JSON)||(env.IDENTITY_SESSION_SECRET?.length||0)<32)return json({message:'Report storage is not configured.',available:false},503);
 const ip=request.headers.get('CF-Connecting-IP');if(!ip||!env.REPORT_RATE_LIMIT||!(await env.REPORT_RATE_LIMIT.limit({key:(request.method==='POST'?'write:':'read:')+ip})).success)return json({message:'Please wait a moment before trying again.'},429);
 try{
  const authorizationConfigured=Boolean(env.KEYCLOAK_ISSUER||env.KEYCLOAK_AUDIENCE||env.OPA_DECISION_URL||env.KEYCLOAK_JWKS_URL||env.KEYCLOAK_CLIENT_ID);
  const protectedRequest=request.method==='POST'||(/^\/api\/reports\/FMC-\d{3,10}$/.test(path)&&request.headers.has('Authorization'));
  let account=await device(request,env.IDENTITY_SESSION_SECRET);
  if(authorizationConfigured){
   if(protectedRequest){
    const auth=await authorizeCase(request,env,'case.create',{});
    if(auth.response)return auth.response;
    account={id:auth.subject.id,cookie:null};
   }else account={id:'anonymous:'+crypto.randomUUID(),cookie:null};
  }
  const result=await withReportStore(env,async pool=>{
   let body=request.method==='POST'?await bodyOf(request):null;
   const store=new ReportStore(pool,async image=>{
    if(body?.photoProtection!=='browser_faces_v1')throw new StoreError(400,'Prepare the photo privacy preview before uploading.');
    return{safeImage:image,diagnostics:{model:'MediaPipe on-device face protection',source:'browser',facesBlurred:null,classification:[],embedding:[],safeImageHash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(image))),b=>b.toString(16).padStart(2,'0')).join(''),scoreMeaning:'Photo classification is supplied by the intake model. No CLIP confidence score was generated.'}};
   },{database:'supabase',ownerKey:account.id});
   if(request.method==='GET'){
    if(path==='/api/reports/status'){await pool.query('SELECT 1');return json({available:true,database:'Supabase',localOnly:false});}
    if(path==='/api/reports')return json(await store.list());
    if(path==='/api/reports/leaderboard')return json(await store.leaderboard());
    const match=path.match(/^\/api\/reports\/(FMC-\d{3,10})$/);if(match){const record=await store.get(match[1]);if(authorizationConfigured&&protectedRequest){const auth=await authorizeCase(request,env,'case.read',{id:match[1],owner:record.owner_key});if(auth.response)return auth.response;}return json(publicRecord(record,account.id));}
   }else{
    if(!body||typeof body!=='object'||Array.isArray(body))throw new StoreError(400,'Invalid report data.');
    if(path==='/api/reports/draft'||path==='/api/reports/submit'){
     if(authorizationConfigured&&typeof body.draftId==='string'&&/^[a-f0-9-]{36}$/i.test(body.draftId)){
      const existing=(await pool.query('SELECT id,owner_key FROM fmc_reports WHERE draft_key=$1',[body.draftId])).rows[0];
      if(existing){const auth=await authorizeCase(request,env,path.endsWith('/draft')?'case.write':'case.submit',{id:existing.id,owner:existing.owner_key});if(auth.response)return auth.response;}
     }
     return path.endsWith('/draft')?json(await store.saveDraft(body)):json({...await store.submit(body),localOnly:false});
    }
    const match=path.match(/^\/api\/reports\/(FMC-\d{3,10})\/review-repair$/);if(match){const owner=(await pool.query('SELECT owner_key FROM fmc_reports WHERE id=$1',[match[1]])).rows[0];if(owner?.owner_key!==account.id)throw new StoreError(403,'Open the repair check from your own report.');if(authorizationConfigured){const auth=await authorizeCase(request,env,'case.confirm_repair',{id:match[1],owner:owner.owner_key});if(auth.response)return auth.response;}return json(await store.action(match[1],'review-repair',body));}
   }
   return json({message:'Not found.'},404);
  });
  if(account.cookie)result.headers.append('Set-Cookie',account.cookie);return result;
 }catch(error){return json({message:error instanceof StoreError?error.message:'Report storage is temporarily unavailable. Your draft is still here.'},error instanceof StoreError?error.status:503);}
}
