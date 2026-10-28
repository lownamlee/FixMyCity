/**
 * Server-only storage adapter for private case evidence.
 *
 * Required server environment:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
 * Optional bucket overrides:
 *   SUPABASE_EVIDENCE_ORIGINALS_BUCKET (default: case-evidence-originals)
 *   SUPABASE_EVIDENCE_REDACTED_BUCKET (default: case-evidence-redacted)
 *
 * Keep this module out of browser bundles. The privileged key must never use a
 * NEXT_PUBLIC_ (or equivalent public) environment variable. Callers must
 * authorize the current actor for the case before invoking any method here.
 */

const DEFAULT_MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
const DEFAULT_MAX_REDACTED_BYTES = 20 * 1024 * 1024;
const DEFAULT_SIGNED_URL_TTL_SECONDS = 5 * 60;
const MAX_SIGNED_URL_TTL_SECONDS = 15 * 60;
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export class EvidenceStorageError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'EvidenceStorageError';
    this.code = code;
  }
}

function requiredEnv(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) throw new EvidenceStorageError('STORAGE_NOT_CONFIGURED', 'Evidence storage is not configured.');
  return value;
}

function getConfig() {
  const baseUrl = requiredEnv('SUPABASE_URL').replace(/\/+$/, '');
  const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SECRET_KEY);
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new EvidenceStorageError('STORAGE_NOT_CONFIGURED', 'Evidence storage is not configured.');
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new EvidenceStorageError('STORAGE_NOT_CONFIGURED', 'Evidence storage is not configured.');
  }
  return {
    baseUrl,
    serviceKey,
    originalsBucket: requiredEnv('SUPABASE_EVIDENCE_ORIGINALS_BUCKET', 'case-evidence-originals'),
    redactedBucket: requiredEnv('SUPABASE_EVIDENCE_REDACTED_BUCKET', 'case-evidence-redacted'),
  };
}

function assertCaseId(caseId) {
  if (typeof caseId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(caseId)) {
    throw new EvidenceStorageError('INVALID_CASE_ID', 'A valid case ID is required.');
  }
  return caseId.toLowerCase();
}

function assertOpaqueId(id, label) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) {
    throw new EvidenceStorageError('INVALID_PATH', `A valid ${label} is required.`);
  }
  return id;
}

function validateFile(file, maxBytes) {
  if (!file || !(Buffer.isBuffer(file.bytes) || file.bytes instanceof Uint8Array)) {
    throw new EvidenceStorageError('INVALID_FILE', 'Evidence must be supplied as bytes.');
  }
  const bytes = Buffer.from(file.bytes);
  const contentType = typeof file.contentType === 'string' ? file.contentType.split(';', 1)[0].trim().toLowerCase() : '';
  if (bytes.length === 0 || bytes.length > maxBytes) {
    throw new EvidenceStorageError('FILE_SIZE_NOT_ALLOWED', 'Evidence file size is outside the allowed range.');
  }
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new EvidenceStorageError('FILE_TYPE_NOT_ALLOWED', 'Evidence file type is not supported.');
  }
  return { bytes, contentType };
}

function storagePath(caseId, artifactId, contentType) {
  const extension = ({
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  })[contentType];
  return `${caseId}/${artifactId}.${extension}`;
}

function encodedPath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

async function storageRequest(path, { method = 'GET', body, contentType, upsert = false } = {}) {
  const { baseUrl, serviceKey } = getConfig();
  let response;
  try {
    response = await fetch(`${baseUrl}/storage/v1${path}`, {
      method,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        ...(contentType ? { 'Content-Type': contentType } : {}),
        ...(method === 'POST' && body instanceof Buffer ? { 'x-upsert': String(upsert) } : {}),
      },
      ...(body === undefined ? {} : { body }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (cause) {
    throw new EvidenceStorageError('STORAGE_UNAVAILABLE', 'Evidence storage is temporarily unavailable.', { cause });
  }

  if (!response.ok) {
    // Do not expose upstream response bodies, paths, tokens, or credentials.
    const code = response.status === 404 ? 'EVIDENCE_NOT_FOUND' : 'STORAGE_REQUEST_FAILED';
    throw new EvidenceStorageError(code, code === 'EVIDENCE_NOT_FOUND' ? 'Evidence was not found.' : 'Evidence storage request failed.');
  }
  try {
    return response.status === 204 ? null : await response.json();
  } catch (cause) {
    throw new EvidenceStorageError('STORAGE_INVALID_RESPONSE', 'Evidence storage returned an invalid response.', { cause });
  }
}

async function upload(bucket, path, bytes, contentType) {
  await storageRequest(`/object/${encodeURIComponent(bucket)}/${encodedPath(path)}`, {
    method: 'POST', body: bytes, contentType, upsert: false,
  });
  return { bucket, path };
}

async function createSignedReadUrl(bucket, path, expiresIn = DEFAULT_SIGNED_URL_TTL_SECONDS) {
  const ttl = Number(expiresIn);
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > MAX_SIGNED_URL_TTL_SECONDS) {
    throw new EvidenceStorageError('INVALID_EXPIRY', `Signed URL expiry must be between 1 and ${MAX_SIGNED_URL_TTL_SECONDS} seconds.`);
  }
  const result = await storageRequest(`/object/sign/${encodeURIComponent(bucket)}/${encodedPath(path)}`, {
    method: 'POST',
    body: JSON.stringify({ expiresIn: ttl }),
    contentType: 'application/json',
  });
  const signedPath = result?.signedURL || result?.signedUrl;
  if (typeof signedPath !== 'string' || !signedPath.startsWith('/')) {
    throw new EvidenceStorageError('STORAGE_INVALID_RESPONSE', 'Evidence storage returned an invalid signed URL.');
  }
  const { baseUrl } = getConfig();
  const url = new URL(signedPath, `${baseUrl}/storage/v1/`);
  if (url.origin !== new URL(baseUrl).origin) {
    throw new EvidenceStorageError('STORAGE_INVALID_RESPONSE', 'Evidence storage returned an invalid signed URL.');
  }
  return url.toString();
}

/** Upload an immutable original into the originals-only private bucket. */
export async function storeOriginalEvidence({ caseId, evidenceId, bytes, contentType }) {
  const safeCaseId = assertCaseId(caseId);
  const safeEvidenceId = assertOpaqueId(evidenceId, 'evidence ID');
  const maxBytes = Number(process.env.EVIDENCE_ORIGINAL_MAX_BYTES) || DEFAULT_MAX_ORIGINAL_BYTES;
  const file = validateFile({ bytes, contentType }, maxBytes);
  const bucket = requiredEnv('SUPABASE_EVIDENCE_ORIGINALS_BUCKET', 'case-evidence-originals');
  const path = storagePath(safeCaseId, `original-${safeEvidenceId}`, file.contentType);
  return upload(bucket, path, file.bytes, file.contentType);
}

/** Upload a redacted derivative into the distinct redacted-only private bucket. */
export async function storeRedactedEvidence({ caseId, derivativeId, bytes, contentType }) {
  const safeCaseId = assertCaseId(caseId);
  const safeDerivativeId = assertOpaqueId(derivativeId, 'derivative ID');
  const maxBytes = Number(process.env.EVIDENCE_REDACTED_MAX_BYTES) || DEFAULT_MAX_REDACTED_BYTES;
  const file = validateFile({ bytes, contentType }, maxBytes);
  const bucket = requiredEnv('SUPABASE_EVIDENCE_REDACTED_BUCKET', 'case-evidence-redacted');
  const path = storagePath(safeCaseId, `redacted-${safeDerivativeId}`, file.contentType);
  return upload(bucket, path, file.bytes, file.contentType);
}

/**
 * Issue a short-lived read URL. Artifact IDs are validated and paths are
 * reconstructed here; callers cannot supply a bucket or arbitrary object path.
 */
export async function createEvidenceReadUrl({ caseId, artifactId, kind, extension, expiresIn = DEFAULT_SIGNED_URL_TTL_SECONDS }) {
  const safeCaseId = assertCaseId(caseId);
  const safeArtifactId = assertOpaqueId(artifactId, 'artifact ID');
  if (kind !== 'original' && kind !== 'redacted') {
    throw new EvidenceStorageError('INVALID_EVIDENCE_KIND', 'Evidence kind must be original or redacted.');
  }
  const bucket = kind === 'original'
    ? requiredEnv('SUPABASE_EVIDENCE_ORIGINALS_BUCKET', 'case-evidence-originals')
    : requiredEnv('SUPABASE_EVIDENCE_REDACTED_BUCKET', 'case-evidence-redacted');
  // Require extension from storage metadata so this API never guesses a path.
  const safeExtension = assertOpaqueId(extension, 'file extension');
  if (!['jpg', 'png', 'webp', 'pdf'].includes(safeExtension)) {
    throw new EvidenceStorageError('INVALID_PATH', 'Evidence file extension is not supported.');
  }
  const prefix = kind === 'original' ? 'original-' : 'redacted-';
  return createSignedReadUrl(bucket, `${safeCaseId}/${prefix}${safeArtifactId}.${safeExtension}`, expiresIn);
}
