import {VOICE_MODEL, VOICE_SECONDS, voiceSessionConfig} from './voice-config.js';
import {reportPreferences} from './report-data.js';

const encoder = new TextEncoder();
const unavailable = 'Voice is temporarily unavailable. Please try again.';
const reply = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {
  'Content-Type':'application/json', 'Cache-Control':'no-store, private',
  'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer',
  ...(status === 429 ? {'Retry-After':'60'} : {})
}});
class VoiceError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new VoiceError(status, message); };
const failure = error => reply({message:error instanceof VoiceError ? error.message : unavailable}, error instanceof VoiceError ? error.status : 503);
const randomToken = () => [...crypto.getRandomValues(new Uint8Array(24))].map(n=>n.toString(16).padStart(2,'0')).join('');
const validToken = token => typeof token === 'string' && /^[a-f0-9]{48}$/.test(token);
const limit = (value, fallback) => Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 1000 ? Number(value) : fallback;

async function readBody(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) fail(415,'Send a JSON request.');
  const reader = request.body?.getReader(); if (!reader) fail(400,'The request is empty.');
  let length=0; const parts=[];
  try { for (;;) { const {done,value}=await reader.read(); if(done)break; length+=value.length;
    if(length>65536){await reader.cancel();fail(413,'The voice request is too large.');} parts.push(value);
  }} finally { reader.releaseLock(); }
  const bytes=new Uint8Array(length); let offset=0;
  for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  try { const body=JSON.parse(new TextDecoder().decode(bytes)); if(!body||typeof body!=='object'||Array.isArray(body))throw Error(); return body; }
  catch { fail(400,'The voice request could not be read.'); }
}
function validateOffer(body) {
  if(typeof body.sdp!=='string'||!body.sdp.startsWith('v=0')||!body.sdp.includes('m=audio')||body.sdp.length>50000)fail(400,'The audio connection could not be prepared.');
  if(body.context!==undefined&&(typeof body.context!=='string'||body.context.length>2500))fail(400,'The draft is too long for voice context.');
  if(body.language!==undefined&&!['en','ms'].includes(body.language))fail(400,'Choose English or Malay for voice.');
}
async function clientKey(ip, secret) {
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const value='voice:'+new Date().toISOString().slice(0,10)+':'+ip;
  return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');
}

/** Public guest voice access is separate from identity verification. No receipt is issued. */
export async function handleVoiceRequest(request, env) {
  try {
    const url=new URL(request.url), action=url.pathname.split('/').pop();
    if(!['status','session','end'].includes(action))return reply({message:'Not found.'},404);
    if(request.method!==(action==='status'?'GET':'POST'))return reply({message:'Method not allowed.'},405);
    const ready=!!env.VOICE_OPENAI_API_KEY && !!env.VOICE_GATEWAY && !!env.VOICE_RATE_LIMIT && (env.IDENTITY_SESSION_SECRET?.length||0)>=32;
    if(action==='status')return reply({available:ready,model:VOICE_MODEL,maxSeconds:VOICE_SECONDS});
    if(request.headers.get('origin')!==url.origin||['cross-site','none'].includes(request.headers.get('sec-fetch-site')))fail(403,'Open voice from FixMyCity.');
    if(!ready)fail(503,unavailable);
    const body=await readBody(request);
    if(action==='session')validateOffer(body);
    else if(!validToken(body.token))fail(400,'The voice call could not be found.');
    const ip=request.headers.get('CF-Connecting-IP');
    if(!ip)fail(403,'Open voice from FixMyCity.');
    // Ending a call stays available even after the start limiter is exhausted.
    if(action==='session'){
      const rate=await env.VOICE_RATE_LIMIT.limit({key:'voice:'+ip});
      if(!rate.success)fail(429,'Too many voice requests. Please try again in a minute.');
    }
    const stub=env.VOICE_GATEWAY.get(env.VOICE_GATEWAY.idFromName('voice-global-v1'));
    return await stub.fetch(new Request('https://voice.internal/'+action,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(action==='session'?{sdp:body.sdp,context:body.context||'',language:body.language||'en',client:await clientKey(ip,env.IDENTITY_SESSION_SECRET)}:{token:body.token})}));
  } catch(error) { return failure(error); }
}

/** Persistent budgets and call leases survive Worker restarts; media never enters storage. */
export class VoiceGateway {
  constructor(ctx,env){this.ctx=ctx;this.env=env;}
  async mutate(fn) {
    return this.ctx.blockConcurrencyWhile(async()=>{
      const now=Date.now(),day=new Date(now).toISOString().slice(0,10);
      let state=await this.ctx.storage.get('voice');
      if(!state)state={day,daily:0,clients:{},starts:[],calls:{}};
      if(state.day!==day){state.day=day;state.daily=0;state.clients={};}
      state.starts=state.starts.filter(t=>now-t<60000);
      const value=fn(state,now);
      await this.ctx.storage.put('voice',state);
      const midnight=Date.parse(day+'T00:00:00Z')+86400000;
      const next=Math.min(midnight,...Object.values(state.calls).map(c=>c.expiresAt));
      await this.ctx.storage.setAlarm(Math.max(now+1000,next));
      return value;
    });
  }
  async hangup(token) {
    const call=await this.mutate((state,now)=>{
      const value=state.calls[token];
      if(!value)return null;
      if(!value.id){delete state.calls[token];return null;}
      value.expiresAt=now+15000;return {...value};
    });
    if(!call)return true;
    let ended=false;
    try {
      const response=await fetch('https://api.openai.com/v1/realtime/calls/'+call.id+'/hangup',{
        method:'POST',headers:{Authorization:'Bearer '+this.env.VOICE_OPENAI_API_KEY},signal:AbortSignal.timeout(5000)});
      ended=response.ok||response.status===404||response.status===410;
      await response.body?.cancel();
    } catch {}
    if(ended)await this.mutate(state=>{if(state.calls[token]?.id===call.id)delete state.calls[token];});
    // Failed hangups remain persisted and retry via the alarm, retaining their active slot.
    return ended;
  }
  async fetch(request) {
    try {
      const action=new URL(request.url).pathname,body=await readBody(request);
      if(action==='/end'){
        if(!validToken(body.token))fail(400,'The voice call could not be found.');
        const ended=await this.hangup(body.token);return reply({ended},ended?200:202);
      }
      if(action!=='/session')return reply({message:'Not found.'},404);
      validateOffer(body);
      if(!/^[a-f0-9]{64}$/.test(body.client||''))fail(400,'The voice request could not be prepared.');
      const token=randomToken();
      await this.mutate((state,now)=>{
        const client=state.clients[body.client]||{daily:0,starts:[]};
        client.starts=client.starts.filter(t=>now-t<60000);
        const calls=Object.values(state.calls);
        if(state.daily>=limit(this.env.VOICE_DAILY_CALL_LIMIT,60)||client.daily>=limit(this.env.VOICE_IP_DAILY_CALL_LIMIT,20))fail(429,'Voice has reached its daily limit. Please try again tomorrow.');
        if(state.starts.length>=6||client.starts.length>=3||calls.length>=6||calls.filter(c=>c.client===body.client).length>=2)fail(429,'Voice is busy. End the other call or try again shortly.');
        state.daily++;client.daily++;client.starts.push(now);state.starts.push(now);state.clients[body.client]=client;
        state.calls[token]={client:body.client,expiresAt:now+35000};
      });
      let providerId=null;
      try {
        const preferences=(this.env.FMC_DATABASE||this.env.FMC_DATABASE_JSON)?await reportPreferences(this.env):null;
        const form=new FormData();form.set('sdp',body.sdp);form.set('session',JSON.stringify(voiceSessionConfig(body.context||'',body.language||'en',preferences)));
        const upstream=await fetch('https://api.openai.com/v1/realtime/calls',{
          method:'POST',headers:{Authorization:'Bearer '+this.env.VOICE_OPENAI_API_KEY},body:form,signal:AbortSignal.timeout(25000)});
        if(!upstream.ok){await upstream.body?.cancel();fail(upstream.status===429?429:502,'The voice service could not connect. Please try again.');}
        const id=upstream.headers.get('location')?.split('/').pop();
        if(id&&/^rtc_[\w-]+$/.test(id))providerId=id;
        if(!providerId)fail(502,'The voice service returned an incomplete connection.');
        // Save the cleanup handle before reading the SDP body.
        const saved=await this.mutate((state,now)=>{
          if(!state.calls[token])return false;
          state.calls[token]={id:providerId,client:body.client,expiresAt:now+VOICE_SECONDS*1000};return true;
        });
        if(!saved)fail(502,'The voice connection expired. Please try again.');
        const sdp=await upstream.text();
        if(!sdp.startsWith('v=0')||sdp.length>65536)fail(502,'The voice service returned an incomplete connection.');
        return reply({sdp,token,maxSeconds:VOICE_SECONDS});
      } catch(error) {
        if(providerId){
          await this.mutate((state,now)=>{state.calls[token]={id:providerId,client:body.client,expiresAt:now};});
          await this.hangup(token);
        } else await this.mutate(state=>{delete state.calls[token];});
        throw error;
      }
    } catch(error) {return failure(error);}
  }
  async alarm() {
    const expired=await this.mutate((state,now)=>Object.entries(state.calls).filter(([,call])=>call.expiresAt<=now).map(([token])=>token));
    await Promise.all(expired.map(token=>this.hangup(token)));
  }
}
