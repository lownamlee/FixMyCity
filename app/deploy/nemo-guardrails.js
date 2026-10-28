// Adapter for the private NeMo Guardrails service in tools/nemo_guardrails_server.py.
// Once any NeMo setting is provided, missing configuration or errors block processing.
export async function checkGuardrail(env, phase, text) {
  const configured=Boolean(env.FMC_NEMO_URL || env.FMC_NEMO_TOKEN);
  if (!configured) return {enabled:false};
  if (!env.FMC_NEMO_URL || typeof env.FMC_NEMO_TOKEN !== 'string' || env.FMC_NEMO_TOKEN.length < 32 ||
      !['input','output'].includes(phase) || typeof text !== 'string' || text.length > 30000)
    throw Error('AI safety service is not available.');
  let url;
  try {
    url=new URL(env.FMC_NEMO_URL);
    if (url.protocol!=='http:' || !['localhost','127.0.0.1','[::1]'].includes(url.hostname) ||
        url.username || url.password || url.pathname!=='/' || url.search || url.hash) throw Error();
  } catch { throw Error('AI safety service is not available.'); }
  try {
    const response=await fetch(new URL('/v1/check',url),{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+env.FMC_NEMO_TOKEN},
      body:JSON.stringify({phase,text}),redirect:'error',signal:AbortSignal.timeout(30000),
    });
    if (!response.ok) throw Error();
    const raw=await response.text();
    if (raw.length>10000) throw Error();
    const result=JSON.parse(raw);
    if (result.allowed!==true || result.phase!==phase) throw Error();
    return {enabled:true};
  } catch { throw Error('The AI safety review could not approve this request.'); }
}
