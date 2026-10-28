import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import worker from '../deploy/worker.js';
import {pages} from '../deploy/pages.js';

const root = new URL('../', import.meta.url);
const origin = 'https://fixmycity.online';
const noAssets = { ASSETS: { fetch() { throw new Error('Unexpected asset lookup'); } } };

test('domain root serves the intro and preserves the query', async () => {
  const response = await worker.fetch(new Request(origin + '/?replay=1'), noAssets);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), pages['index.html']);
  assert.match(response.headers.get('Content-Type'),/text\/html/);
});

test('unrelated and lookalike domains stay outside this deployment', async () => {
  for (const url of ['https://lownamlee.com/fixmycity/', 'https://lownamlee.com/fixmycity2/', 'https://fixmycity.online.evil.example/', 'https://www.fixmycity.online/']) {
    const response = await worker.fetch(new Request(url), noAssets);
    assert.equal(response.status, 404, url);
  }
});

test('root and nested assets retain their paths; HEAD and query survive', async () => {
  for (const [path, expected] of [['/', '/index.html'], ['/scan-card', '/scan-card.html'], ['/assets/icons/icon-192.png?v=1', '/assets/icons/icon-192.png?v=1']]) {
    let actual;
    const response = await worker.fetch(new Request(origin + path, { method: 'HEAD' }), { ASSETS: { fetch(request) {
      const url = new URL(request.url); actual = url.pathname + url.search;
      assert.equal(request.method, 'HEAD'); return new Response(null);
    } } });
    assert.equal(actual, Object.hasOwn(pages,expected.slice(1))?undefined:expected); assert.equal(response.status, 200); assert.equal(await response.text(), '');
  }
});

test('non-read methods are rejected and missing assets remain 404', async () => {
  const blocked = await worker.fetch(new Request(origin + '/', { method: 'POST' }), noAssets);
  assert.equal(blocked.status, 405); assert.equal(blocked.headers.get('Allow'), 'GET, HEAD');
  const missing = await worker.fetch(new Request(origin + '/missing.js'), { ASSETS: { fetch() { return new Response('Not found', { status: 404 }); } } });
  assert.equal(missing.status, 404); assert.equal(await missing.text(), 'Not found');
});

test('manifest and service worker have correct MIME, cache and scope headers', async () => {
  const env = { ASSETS: { fetch() { return new Response('asset'); } } };
  const manifest = await worker.fetch(new Request(origin + '/manifest.webmanifest'), env);
  assert.match(manifest.headers.get('Content-Type'), /application\/manifest\+json/);
  assert.equal(manifest.headers.get('Cache-Control'), 'no-cache');
  const sw = await worker.fetch(new Request(origin + '/service-worker.js'), env);
  assert.match(sw.headers.get('Content-Type'), /javascript/);
  assert.equal(sw.headers.get('Service-Worker-Allowed'), '/');
  assert.match(sw.headers.get('Cache-Control'), /no-store/);
  assert.equal(sw.headers.get('X-Content-Type-Options'), 'nosniff');
});

test('manifest has unique identity, standalone mode, and valid actual icon dimensions', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('manifest.webmanifest', root), 'utf8'));
  assert.equal(manifest.id, '/'); assert.equal(manifest.scope, './');
  assert.equal(manifest.start_url, './'); assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const png = await fs.readFile(new URL(icon.src, root));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(icon.sizes, `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`);
  }
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192' && icon.purpose === 'any'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'any'));
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
});

async function loadSW({ online = true, networkStatus = 200, files = ['index.html', 'welcome.html', 'home.html', 'app-flow.js'], precache } = {}) {
  const handlers = new Map(), deleted = [], cacheAdds = [], cachePuts = [], cacheName = [];
  const cache = { async addAll(requests) { cacheAdds.push(...requests.map(r => r.url)); }, async put(key) { cachePuts.push(key); }, async match() { return new Response('offline saved'); } };
  const self = { registration: { scope: origin + '/' }, clients: { async claim() {} }, addEventListener(name, fn) { handlers.set(name, fn); } };
  const context = vm.createContext({ self, URL, Request, Response, Set, Error,
    importScripts() { self.FMC_PRECACHE = { version: 'test-v2', files, precache }; },
    caches: { async open(name) { cacheName.push(name); return cache; }, async keys() { return ['fixmycity-shell-original', 'fixmycity2-shell-%2F-old', 'fixmycity2-shell-%2F-test-v2', 'fixmycity2-shell-%2Ffixmycity2%2F-old']; }, async delete(name) { deleted.push(name); } },
    async fetch() { if (!online) throw new Error('offline'); return new Response('network', { status: networkStatus }); }
  });
  vm.runInContext(await fs.readFile(new URL('service-worker.js', root), 'utf8'), context);
  return { handlers, deleted, cacheAdds, cachePuts, cacheName };
}

test('offline installation precaches public stage pages only inside its scope', async () => {
  const sw = await loadSW(); let work;
  sw.handlers.get('install')({ waitUntil(promise) { work = promise; } }); await work;
  assert.equal(sw.cacheAdds.length, 4);
  assert.deepEqual(sw.cacheAdds, [origin+'/',origin+'/welcome',origin+'/home',origin+'/app-flow.js']);
  await assert.rejects(loadSW({ files: ['../fixmycity/index.html'] }), /Invalid relative/);
  await assert.rejects(loadSW({ files: ['https://example.com/data'] }), /outside this app/);
});

test('installation leaves heavy models and later-screen art for runtime requests',async()=>{
  const files=['index.html','welcome.html','assets/mediapipe/face_landmarker.task','assets/onboarding/report-1234567890abcdef.webp'];
  const sw=await loadSW({files,precache:['index.html','welcome.html']});let work;
  sw.handlers.get('install')({waitUntil(promise){work=promise;}});await work;
  assert.deepEqual(sw.cacheAdds,[origin+'/',origin+'/welcome']);
  let response;
  sw.handlers.get('fetch')({request:{method:'GET',url:origin+'/'+files[3]},respondWith(promise){response=promise;}});
  assert.equal(await (await response).text(),'offline saved','versioned artwork reuses its cached copy');
  await assert.rejects(loadSW({files,precache:['missing.png']}),/static allowlist/);
});

test('content-addressed welcome art is immutable while editable assets keep their shorter cache',async()=>{
  const env={ASSETS:{fetch(){return new Response('image');}}};
  const compressed=await worker.fetch(new Request(origin+'/assets/onboarding/city-1234567890abcdef.webp'),env);
  assert.equal(compressed.headers.get('Content-Type'),'image/webp');
  assert.match(compressed.headers.get('Cache-Control'),/max-age=31536000, immutable/);
  const editable=await worker.fetch(new Request(origin+'/assets/onboarding/progress-plate.png'),env);
  assert.equal(editable.headers.get('Cache-Control'),'public, max-age=3600');
});

test('activation deletes only this app scope old caches', async () => {
  const sw = await loadSW(); let work;
  sw.handlers.get('activate')({ waitUntil(promise) { work = promise; } }); await work;
  assert.deepEqual(sw.deleted, ['fixmycity2-shell-%2F-old']);
});

test('privacy is cached by its public clean URL for offline access', async () => {
  const sw=await loadSW({files:['privacy.html','privacy.css','privacy.js']});let work;
  sw.handlers.get('install')({waitUntil(promise){work=promise;}});await work;
  assert.deepEqual(sw.cacheAdds,[origin+'/privacy',origin+'/privacy.css',origin+'/privacy.js']);
});

test('offline navigations use their own cached page, while other apps and unknown requests are untouched', async () => {
  const sw = await loadSW({ online: false });
  for (const path of ['/home', '/welcome?slide=2', '/']) {
    let response;
    sw.handlers.get('fetch')({ request: { method: 'GET', url: origin + path, mode: 'navigate' }, respondWith(promise) { response = promise; } });
    assert.equal(await (await response).text(), 'offline saved');
  }
  for (const url of ['https://lownamlee.com/fixmycity/home.html', origin + '/api/private', origin + '/unknown.js', 'https://other.example/home.html']) {
    sw.handlers.get('fetch')({ request: { method: 'GET', url, mode: 'navigate' }, respondWith() { assert.fail('Unexpected interception: ' + url); } });
  }
});

test('network 404 is preserved; server failure falls back to the cached shell', async () => {
  for (const [status, expected] of [[404, 'network'], [503, 'offline saved']]) {
    const sw = await loadSW({ networkStatus: status }); let response;
    sw.handlers.get('fetch')({ request: { method: 'GET', url: origin + '/home', mode: 'navigate' }, respondWith(promise) { response = promise; } });
    assert.equal(await (await response).text(), expected);
  }
});

test('clean page routes resolve only known pages; legacy URLs redirect preserving query', async () => {
  for (const page of ['welcome','scan-card','scan-face','home']) {
    const response = await worker.fetch(new Request(origin + '/' + page + '?step=2'), noAssets);
    assert.equal(response.status,200); assert.equal(await response.text(),pages[page+'.html']);
    for (const legacy of [page+'.html',page+'/']) {
      const redirect=await worker.fetch(new Request(origin+'/'+legacy+'?step=2',{method:'HEAD'}),noAssets);
      assert.equal(redirect.status,308); assert.equal(redirect.headers.get('Location'),origin+'/'+page+'?step=2');
    }
  }
  const index=await worker.fetch(new Request(origin+'/index.html'),noAssets);
  assert.equal(index.headers.get('Location'),origin+'/');
});

test('production HTTP redirects before API handling; localhost HTTP stays usable', async () => {
  const response=await worker.fetch(new Request('http://fixmycity.online/api/session?x=1'),noAssets);
  assert.equal(response.status,308); assert.equal(response.headers.get('Location'),origin+'/api/session?x=1');
});

test('offline legacy navigations redirect to clean URLs without caching redirect responses', async () => {
  const sw=await loadSW({online:false}); let response;
  sw.handlers.get('fetch')({request:{method:'GET',url:origin+'/home.html?tab=profile',mode:'navigate'},respondWith(promise){response=promise;}});
  assert.equal((await response).status,308);
  assert.equal((await response).headers.get('Location'),origin+'/home?tab=profile');
  assert.equal(sw.cachePuts.length,0);
});

test('deployment has only the requested root custom domain and localhost previews work', async () => {
  const config = JSON.parse(await fs.readFile(new URL('deploy/wrangler.jsonc', root), 'utf8'));
  assert.deepEqual(config.routes, [{pattern:'fixmycity.online',custom_domain:true}]);
  assert.equal(config.workers_dev, false);
  for (const host of ['127.0.0.1:9187','localhost:9187']) {
    const response = await worker.fetch(new Request(`http://${host}/`), {ASSETS:{fetch(){return new Response('preview');}}});
    assert.equal(response.status, 200);
  }
});
