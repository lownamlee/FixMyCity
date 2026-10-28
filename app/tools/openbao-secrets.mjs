// Server-side OpenBao KV v2 reader. Callers decide which configured secret is
// needed; credentials and responses must never be sent to the browser.
export async function readOpenBaoSecret({address, token, mount = 'secret', path, field = 'value', version}) {
  let base;
  try { base = new URL(address); } catch { throw Error('OpenBao address is invalid.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if ((base.protocol !== 'https:' && !(base.protocol === 'http:' && loopback)) || base.username || base.password || base.search || base.hash)
    throw Error('OpenBao requires an HTTPS endpoint or loopback.');
  const validPart = value => typeof value === 'string' && /^[A-Za-z0-9_.-]+$/.test(value) && value !== '.' && value !== '..';
  if (!validPart(mount) || !validPart(field) || typeof path !== 'string' || !path.split('/').every(validPart) ||
      typeof token !== 'string' || !token || token.length > 8192 || (version !== undefined && (!Number.isInteger(version) || version < 1)))
    throw Error('OpenBao configuration is invalid.');
  const prefix = base.pathname.replace(/\/$/, '');
  base.pathname = `${prefix}/v1/${mount}/data/${path.split('/').map(encodeURIComponent).join('/')}`;
  if (version !== undefined) base.searchParams.set('version', String(version));
  const response = await fetch(base, {headers:{'X-Vault-Token':token},redirect:'error',signal:AbortSignal.timeout(5000)});
  if (!response.ok) throw Error('OpenBao secret is unavailable.');
  const payload = await response.json();
  const value = payload?.data?.data?.[field];
  if (typeof value !== 'string' || !value || value.length > 65536) throw Error('OpenBao secret is unavailable.');
  return value;
}
