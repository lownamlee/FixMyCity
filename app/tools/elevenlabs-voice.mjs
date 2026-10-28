/** Private ElevenLabs agent session issuer. The API key never leaves the server. */
export function elevenLabsConfig(env=process.env) {
  const key=env.FMC_ELEVENLABS_API_KEY || '';
  const agentId=env.FMC_ELEVENLABS_AGENT_ID || '';
  return key.length>=20 && /^agent_[A-Za-z0-9_-]{8,128}$/.test(agentId) ? {key,agentId} : null;
}

export async function issueElevenLabsSession(config,{fetchAPI=fetch}={}) {
  if(!config) throw new Error('ElevenLabs is not configured');
  const endpoint=new URL('https://api.elevenlabs.io/v1/convai/conversation/get-signed-url');
  endpoint.searchParams.set('agent_id',config.agentId);
  // ElevenLabs documents this option as making the conversation signature single-use.
  endpoint.searchParams.set('include_conversation_id','true');
  const response=await fetchAPI(endpoint,{headers:{'xi-api-key':config.key,Accept:'application/json'},signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!response.ok){await response.body?.cancel();throw new Error('ElevenLabs could not start a conversation');}
  const result=await response.json();
  let url;
  try{url=new URL(result.signed_url);}catch{throw new Error('ElevenLabs returned an invalid session');}
  if(url.protocol!=='wss:'||url.hostname!=='api.elevenlabs.io'||url.pathname!=='/v1/convai/conversation'||url.username||url.password||!url.searchParams.has('conversation_signature'))throw new Error('ElevenLabs returned an invalid session');
  return {signedUrl:url.href,conversationId:typeof result.conversation_id==='string'?result.conversation_id:null};
}
