// Keycloak verifies identity; Open Policy Agent decides whether the verified
// subject may act on a case. Unavailable or malformed services fail closed.
const keySets = new Map();
const MAX_TOKEN_BYTES = 16384;
const KEY_TTL_MS = 300000;

function decode(part) {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw Error('Invalid token');
  const base64 = part.replaceAll('-', '+').replaceAll('_', '/');
  const raw = atob(base64 + '='.repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}
function object(part) {
  const value = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(decode(part)));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid token');
  return value;
}
function trustedEndpoint(input) {
  const url = new URL(input);
  if (url.username || url.password || url.hash || (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))))
    throw Error('Invalid identity service URL');
  return url.href;
}
async function getKeys(url, force = false) {
  const cached = keySets.get(url);
  if (!force && cached && cached.expires > Date.now()) return cached.keys;
  const response = await fetch(url, {headers:{Accept:'application/json'}, signal:AbortSignal.timeout(5000)});
  if (!response.ok) throw Error('Identity keys unavailable');
  const raw = await response.text();
  if (raw.length > 200000) throw Error('Invalid key set');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.keys) || data.keys.length > 100) throw Error('Invalid key set');
  const keys = data.keys.filter(key => key && key.kty === 'RSA' && key.kid &&
    (!key.use || key.use === 'sig') && (!key.alg || key.alg === 'RS256'));
  if (!keys.length) throw Error('No signing keys');
  if (keySets.size >= 16 && !keySets.has(url)) keySets.delete(keySets.keys().next().value);
  keySets.set(url, {keys, expires:Date.now() + KEY_TTL_MS});
  return keys;
}
function rolesFrom(claims, client) {
  const roles = [...(claims.realm_access?.roles || []), ...(claims.resource_access?.[client]?.roles || [])];
  return [...new Set(roles.filter(role => typeof role === 'string' && /^[\w.-]{1,80}$/.test(role)))];
}
async function identity(token, env) {
  if (token.length > MAX_TOKEN_BYTES) throw Error('Invalid token');
  const parts = token.split('.');
  if (parts.length !== 3) throw Error('Invalid token');
  const header = object(parts[0]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw Error('Invalid token');
  const issuer = trustedEndpoint(env.KEYCLOAK_ISSUER);
  const keysUrl = trustedEndpoint(env.KEYCLOAK_JWKS_URL || issuer.replace(/\/$/, '') + '/protocol/openid-connect/certs');
  let key = (await getKeys(keysUrl)).find(item => item.kid === header.kid);
  if (!key) key = (await getKeys(keysUrl, true)).find(item => item.kid === header.kid);
  if (!key) throw Error('Invalid token');
  const verifyKey = await crypto.subtle.importKey('jwk', key, {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}, false, ['verify']);
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', verifyKey, decode(parts[2]), new TextEncoder().encode(parts[0]+'.'+parts[1])))
    throw Error('Invalid token');
  const claims = object(parts[1]);
  const now = Math.floor(Date.now()/1000);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== env.KEYCLOAK_ISSUER || !audience.includes(env.KEYCLOAK_AUDIENCE) ||
      typeof claims.exp !== 'number' || claims.exp <= now ||
      (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || claims.nbf > now)) ||
      typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255)
    throw Error('Invalid token');
  return {
    id: claims.sub,
    roles: rolesFrom(claims, env.KEYCLOAK_CLIENT_ID || env.KEYCLOAK_AUDIENCE),
    jurisdictions: Array.isArray(claims.jurisdictions) ? claims.jurisdictions.filter(x => typeof x === 'string' && x.length <= 100) : [],
  };
}

/**
 * Returns {subject} on allow, otherwise {response}. The resource argument must
 * come from trusted server-side case storage, never directly from the request.
 * Configure KEYCLOAK_ISSUER, KEYCLOAK_AUDIENCE, OPA_DECISION_URL, and optionally
 * KEYCLOAK_JWKS_URL and KEYCLOAK_CLIENT_ID via private runtime configuration.
 */
export async function authorizeCase(request, env, action, resource) {
  const headers = {'Cache-Control':'no-store','Content-Type':'application/json'};
  if (!env.KEYCLOAK_ISSUER || !env.KEYCLOAK_AUDIENCE || !env.OPA_DECISION_URL)
    return {response:new Response(JSON.stringify({error:'authorization_unavailable'}),{status:503,headers})};
  const match = /^Bearer ([A-Za-z0-9._-]+)$/.exec(request.headers.get('Authorization') || '');
  if (!match) return {response:new Response(JSON.stringify({error:'authentication_required'}),{status:401,headers:{...headers,'WWW-Authenticate':'Bearer'}})};
  let subject;
  try { subject = await identity(match[1], env); }
  catch { return {response:new Response(JSON.stringify({error:'authentication_failed'}),{status:401,headers:{...headers,'WWW-Authenticate':'Bearer'}})}; }
  try {
    const response = await fetch(trustedEndpoint(env.OPA_DECISION_URL), {
      method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({input:{subject,action,resource}}), signal:AbortSignal.timeout(5000),
    });
    if (!response.ok) throw Error('Policy service unavailable');
    const raw = await response.text();
    if (raw.length > 20000) throw Error('Invalid policy response');
    const decision = JSON.parse(raw);
    if (decision.result !== true) return {response:new Response(JSON.stringify({error:'forbidden'}),{status:403,headers})};
    return {subject};
  } catch { return {response:new Response(JSON.stringify({error:'authorization_unavailable'}),{status:503,headers})}; }
}
