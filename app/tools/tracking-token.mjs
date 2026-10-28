import {createHmac, randomUUID} from 'node:crypto';

const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');

/**
 * Mint a short-lived private-channel token after the caller authorizes access
 * to the case. This module never accepts an authorization result from a client.
 * The signing key must match the configured Supabase JWT verifier.
 */
export async function issueTrackingToken({caseId, subject, signingKey, authorize, ttlSeconds = 300, now = Date.now}) {
  if (typeof caseId !== 'string' || !/^FMC-\d{3,10}$/.test(caseId)) throw new TypeError('Invalid case identifier.');
  if (typeof subject !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(subject))
    throw new TypeError('An authenticated user identifier is required.');
  if (typeof signingKey !== 'string' || Buffer.byteLength(signingKey) < 32 || typeof authorize !== 'function')
    throw Error('Tracking authorization is not configured.');
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > 900) throw new TypeError('Invalid token lifetime.');
  const access = await authorize({caseId, subject});
  if (access !== true && access?.read !== true) throw Error('Access to this case is not authorized.');
  const issuedAt = Math.floor(now() / 1000);
  const claims = {sub:subject, role:'authenticated', aud:'authenticated', iat:issuedAt, exp:issuedAt+ttlSeconds,
    jti:randomUUID(), purpose:'case_tracking', case_topic:`case:${caseId}:tracking`,
    tracking_publish:typeof access === 'object' && access?.publish === true};
  const unsigned = `${encode({alg:'HS256',typ:'JWT'})}.${encode(claims)}`;
  const signature = createHmac('sha256', signingKey).update(unsigned).digest('base64url');
  return {token:`${unsigned}.${signature}`, expiresAt:new Date(claims.exp*1000).toISOString(), topic:claims.case_topic};
}
