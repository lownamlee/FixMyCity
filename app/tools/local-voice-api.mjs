import {randomBytes} from 'node:crypto';
import {VOICE_MODEL, VOICE_SECONDS, voiceSessionConfig} from '../deploy/voice-config.js';
import {elevenLabsConfig,issueElevenLabsSession} from './elevenlabs-voice.mjs';
export {VOICE_MODEL, VOICE_SECONDS, VOICE_INSTRUCTIONS, voiceSessionConfig} from '../deploy/voice-config.js';
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function readBody(request) {
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))throw {status:415,message:'Send a JSON request.'};
  const reader=request.body?.getReader();if(!reader)throw {status:400,message:'The request is empty.'};
  let bytes=0;const parts=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>65536){await reader.cancel();throw {status:413,message:'The voice request is too large.'};}parts.push(value);}}finally{reader.releaseLock();}
  try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw {status:400,message:'The voice request could not be read.'};}
}
/** Loopback-only voice gateway. No key, raw provider error, audio or transcript is logged or stored. */
export function createLocalVoiceAPI(key='',{fetchAPI=fetch,now=Date.now,maxSeconds=VOICE_SECONDS,configuration=null}={}) {
  const calls=new Map();let starts=[],day='',daily=0,pending=0;
  async function hangup(token) {
    const call=calls.get(token);if(!call)return;
    calls.delete(token);clearTimeout(call.timer);
    try{await fetchAPI(`https://api.openai.com/v1/realtime/calls/${call.id}/hangup`,{method:'POST',headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(5000)});}catch{}
  }
  async function handle(request) {
    const url=new URL(request.url);
    if(!['127.0.0.1','localhost'].includes(url.hostname))return reply({message:'Not found.'},404);
    if(request.method==='GET'&&url.pathname==='/api/voice/status')return reply({available:!!key,model:VOICE_MODEL,maxSeconds,elevenLabsConfigured:!!elevenLabsConfig()});
    if(request.method!=='POST')return reply({message:'Method not allowed.'},405);
    if(request.headers.get('origin')!==url.origin||['cross-site','none'].includes(request.headers.get('sec-fetch-site')))return reply({message:'Open voice from FixMyCity.'},403);
    if(!['/api/voice/session','/api/voice/end','/api/voice/elevenlabs/session'].includes(url.pathname))return reply({message:'Not found.'},404);
    try {
      const body=await readBody(request);
      if(url.pathname==='/api/voice/end') {if(typeof body?.token==='string')await hangup(body.token);return reply({ended:true});}
      if(url.pathname==='/api/voice/elevenlabs/session') {
        const config=elevenLabsConfig();if(!config)return reply({message:'ElevenLabs is not configured.'},503);
        if(body?.consent!==true)return reply({message:'Consent is required to start a voice conversation.'},400);
        const today=new Date(now()).toISOString().slice(0,10);if(day!==today){day=today;daily=0;}
        starts=starts.filter(t=>now()-t<60000);
        if(starts.length>=6||daily>=60||pending>=2)return reply({message:'Voice is busy. Please try again shortly.'},429);
        starts.push(now());daily++;pending++;
        try{return reply(await issueElevenLabsSession(config,{fetchAPI}));}finally{pending--;}
      }
      if(!key)return reply({message:'Live voice is not configured on this preview server.'},503);
      if(typeof body?.sdp!=='string'||!body.sdp.startsWith('v=0')||!body.sdp.includes('m=audio')||body.sdp.length>50000)return reply({message:'The audio connection could not be prepared.'},400);
      if(body.context!==undefined&&(typeof body.context!=='string'||body.context.length>2500))return reply({message:'The draft is too long for voice context.'},400);
      if(body.language!==undefined&&!['en','ms'].includes(body.language))return reply({message:'Choose English or Malay for voice.'},400);
      const today=new Date(now()).toISOString().slice(0,10);if(day!==today){day=today;daily=0;}
      starts=starts.filter(t=>now()-t<60000);
      if(starts.length>=6||daily>=60||calls.size+pending>=2)return reply({message:'Voice is busy. End the other call or try again shortly.'},429);
      starts.push(now());daily++;pending++;
      try{
        const form=new FormData();form.set('sdp',body.sdp);form.set('session',JSON.stringify(voiceSessionConfig(body.context||'',body.language||'en',configuration?await configuration():null)));
        const upstream=await fetchAPI('https://api.openai.com/v1/realtime/calls',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form,signal:AbortSignal.timeout(25000)});
        if(!upstream.ok){await upstream.body?.cancel();return reply({message:upstream.status===429?'Voice is temporarily at capacity. Please try again shortly.':'The voice service could not connect. Please try again.'},upstream.status===429?429:502);}
        const sdp=await upstream.text(),id=upstream.headers.get('location')?.split('/').pop();
        if(!sdp.startsWith('v=0')||!id||!/^rtc_[\w-]+$/.test(id))return reply({message:'The voice service returned an incomplete connection.'},502);
        const token=randomBytes(24).toString('hex');
        const timer=setTimeout(()=>void hangup(token),maxSeconds*1000);timer.unref?.();calls.set(token,{id,timer});
        return reply({sdp,token,maxSeconds});
      }finally{pending--;}
    } catch(error) {return reply({message:error?.status?error.message:'The voice connection timed out. Please try again.'},error?.status||502);}
  }
  return {handle,close:()=>Promise.all([...calls.keys()].map(hangup))};
}

