import http from 'node:http';
import {Readable} from 'node:stream';
import {readFile,stat} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import worker from '../deploy/worker.js';
import {createLocalIdentityRuntime} from './local-identity-runtime.mjs';
import {createLocalVoiceAPI} from './local-voice-api.mjs';
import {createLocalReportAI} from '../deploy/report-ai.js';
import {Pool} from 'pg';
import {ReportStore,createReportAPI} from './report-store.mjs';
import {createLocalVision} from './local-vision.mjs';
import {databaseConfig} from './database-config.mjs';
import {planResponse,sendDispatch} from './response-integrations.mjs';
import {readOpenBaoSecret} from './openbao-secrets.mjs';
const root=fileURLToPath(new URL('../deploy/dist/',import.meta.url));
export function createPreviewServer(identity=createLocalIdentityRuntime(),voiceKey='',store=null,vision=null,adminKey=''){
const voice=createLocalVoiceAPI(voiceKey,{configuration:store?async()=>({...(await store.config()),knowledge:(await store.knowledge()).filter(k=>k.approved)}):null});
const reportAI=createLocalReportAI(voiceKey,{protect:vision?.process,configuration:store?async()=>({...(await store.config()),knowledge:(await store.knowledge()).filter(k=>k.approved)}):null});
const reports=store?createReportAPI(store,{adminKey}):async()=>new Response(JSON.stringify({message:'Report storage is not connected.',available:false}),{status:503,headers:{'Content-Type':'application/json'}});
const env={...identity,ASSETS:{async fetch(request){
  const url=new URL(request.url);let path;
  try {path=resolve(root,'.'+decodeURIComponent(url.pathname));} catch {return new Response('Bad request',{status:400});}
  if(!path.startsWith(resolve(root)+sep))return new Response('Not found',{status:404});
  try{if(!(await stat(path)).isFile())return new Response('Not found',{status:404});return new Response(await readFile(path));}
  catch{return new Response('Not found',{status:404});}
}}};
const server=http.createServer(async(req,res)=>{
  try {
    // Bind loopback and reject arbitrary Host headers/DNS rebinding.
    if(!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host||'')){res.writeHead(403);res.end('Forbidden');return;}
    const url=new URL(req.url,`http://${req.headers.host}`);
    if(url.host!==req.headers.host){res.writeHead(403);res.end('Forbidden');return;}
    const body=['GET','HEAD'].includes(req.method)?undefined:Readable.toWeb(req);
    const request=new Request(url,{method:req.method,headers:req.headers,...(body?{body,duplex:'half'}:{})});
    const response=url.pathname.startsWith('/api/voice/')?await voice.handle(request):url.pathname==='/api/ai/vision-status'?new Response(JSON.stringify(vision?.status()||{available:false}),{headers:{'Content-Type':'application/json'}}):url.pathname.startsWith('/api/ai/')?await reportAI(request):url.pathname.startsWith('/api/local-reports')||url.pathname.startsWith('/api/local-admin')?await reports(request):await worker.fetch(request,env);
    // Each refresh shows the latest local build, including existing PWA clients.
    const responseHeaders=new Headers(response.headers);responseHeaders.set('Cache-Control','no-store');
    const outgoingHeaders=Object.fromEntries(responseHeaders);
    if(responseHeaders.getSetCookie().length)outgoingHeaders['set-cookie']=responseHeaders.getSetCookie();
    res.writeHead(response.status,outgoingHeaders);
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end('Preview error');}
});
server.on('close',()=>{void voice.close();vision?.close();});
return server;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const port=Number(process.env.PORT||9187),keyFile=process.env.FMC_OPENAI_KEY_FILE;
  let apiKey='';
  if(keyFile){
    apiKey=(await readFile(keyFile,'utf8')).match(/sk-[A-Za-z0-9_-]+/)?.[0]||'';
    if(apiKey.length<40)throw Error('The approved key file does not contain a usable credential.');
  }
  if(process.env.FMC_OPENBAO_OPENAI_PATH){
    if(keyFile)throw Error('Configure only one verification credential source.');
    apiKey=await readOpenBaoSecret({address:process.env.FMC_OPENBAO_ADDR,token:process.env.FMC_OPENBAO_TOKEN,
      mount:process.env.FMC_OPENBAO_MOUNT||'secret',path:process.env.FMC_OPENBAO_OPENAI_PATH,field:'api_key'});
    if(apiKey.length<40)throw Error('The verification credential is invalid.');
  }
  let voiceKey='';
  if(process.env.FMC_VOICE_KEY_FILE){
    voiceKey=(await readFile(process.env.FMC_VOICE_KEY_FILE,'utf8')).match(/sk-[A-Za-z0-9_-]+/)?.[0]||'';
    if(voiceKey.length<40)throw Error('The approved voice key file does not contain a usable credential.');
  }
  if(process.env.FMC_OPENBAO_VOICE_PATH){
    if(process.env.FMC_VOICE_KEY_FILE)throw Error('Configure only one voice credential source.');
    voiceKey=await readOpenBaoSecret({address:process.env.FMC_OPENBAO_ADDR,token:process.env.FMC_OPENBAO_TOKEN,
      mount:process.env.FMC_OPENBAO_MOUNT||'secret',path:process.env.FMC_OPENBAO_VOICE_PATH,field:'api_key'});
    if(voiceKey.length<40)throw Error('The voice credential is invalid.');
  }
  let store=null,adminKey='';const vision=createLocalVision();
  try {
    const connection=await databaseConfig();adminKey=connection.adminKey;
    const pool=new Pool(connection.config);
    pool.on('error',()=>console.error('Local report database connection interrupted.'));
    store=new ReportStore(pool,vision.process,{database:connection.mode,planRoute:planResponse,dispatch:sendDispatch});
    if(connection.mode==='local'){await store.initialize(fileURLToPath(new URL('./report-schema.sql',import.meta.url)));}
    else await pool.query('SELECT 1 FROM fmc_reports LIMIT 1');
  } catch { if(store)await store.pool.end();store=null;console.log('Report storage unavailable. Check the private database configuration; no fallback database was selected.'); }
  createPreviewServer(createLocalIdentityRuntime(apiKey),voiceKey,store,vision,adminKey).listen(port,'127.0.0.1',()=>{
    console.log(`FixMyCity preview: http://127.0.0.1:${port}/`);
    console.log(apiKey?'Local verification API enabled; photos are sent only after camera consent.':'Verification requires a configured credential.');
    console.log(voiceKey?'Live AI voice enabled; audio starts when English or Malay is selected.':'Live AI voice is not configured.');
    console.log(store?'Supabase report storage connected. Admin requires localhost and the private access key.':'Report database not connected.');
  });
}

