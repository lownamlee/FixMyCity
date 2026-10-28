import {createHmac, randomUUID, timingSafeEqual} from 'node:crypto';

const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const sign = (content, secret) => createHmac('sha256', secret).update(content).digest('base64url');
const idPattern = /^[A-Za-z0-9:_-]{1,160}$/;

function secretValue(secret) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) throw Error('Identity receipt signing is not configured.');
  return secret;
}

/** Issue only after the application verifies both MyKad and live face checks. */
export async function issueIdentityReceipt({sessionId, secret, loadVerifiedSession, now = Date.now, ttlSeconds = 300}) {
  secretValue(secret);
  if (typeof sessionId !== 'string' || !idPattern.test(sessionId) || typeof loadVerifiedSession !== 'function')
    throw Error('A verified identity session is required.');
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 30 || ttlSeconds > 900) throw Error('Invalid receipt lifetime.');
  // The loader reads authenticated server-side state, never request-body claims.
  const session = await loadVerifiedSession(sessionId);
  if (!session || session.status !== 'verified' || session.cardVerified !== true || session.faceVerified !== true ||
      typeof session.subject !== 'string' || !idPattern.test(session.subject))
    throw Error('A verified identity session is required.');
  const issuedAt = Math.floor(now() / 1000);
  const claims = {iss:'fixmycity',aud:'verified-contribution',sub:session.subject,sid:sessionId,
    iat:issuedAt,exp:issuedAt+ttlSeconds,jti:randomUUID()};
  const content = `${b64({alg:'HS256',typ:'JWT'})}.${b64(claims)}`;
  return `${content}.${sign(content,secret)}`;
}

/** Validate signature, lifetime and live server session before awarding credit. */
export async function resolveIdentityReceipt({receipt, secret, loadVerifiedSession, now = Date.now}) {
  secretValue(secret);
  if (typeof receipt !== 'string' || receipt.length > 8192 || typeof loadVerifiedSession !== 'function')
    throw Error('A verified identity receipt is required.');
  const parts = receipt.split('.');
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw Error('Invalid identity receipt.');
  const content = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(sign(content, secret));
  const actual = Buffer.from(parts[2]);
  if (actual.length !== expected.length || !timingSafeEqual(expected, actual)) throw Error('Invalid identity receipt.');
  let header, claims;
  try { header=JSON.parse(Buffer.from(parts[0],'base64url')); claims=JSON.parse(Buffer.from(parts[1],'base64url')); }
  catch { throw Error('Invalid identity receipt.'); }
  const time = Math.floor(now()/1000);
  if (header.alg !== 'HS256' || header.typ !== 'JWT' || claims.iss !== 'fixmycity' || claims.aud !== 'verified-contribution' ||
      !Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) || claims.iat > time+5 || claims.exp <= time ||
      claims.exp-claims.iat > 900 || !idPattern.test(claims.sub || '') || !idPattern.test(claims.sid || ''))
    throw Error('Invalid identity receipt.');
  const session = await loadVerifiedSession(claims.sid);
  if (!session || session.status !== 'verified' || session.cardVerified !== true || session.faceVerified !== true || session.subject !== claims.sub)
    throw Error('Identity verification is no longer active.');
  return {subject:claims.sub, sessionId:claims.sid};
}
