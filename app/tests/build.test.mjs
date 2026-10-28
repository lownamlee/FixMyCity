import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat,readdir} from 'node:fs/promises';
import {pages} from '../deploy/pages.js';
const root=new URL('../',import.meta.url);
test('every entry page has shared flow, installation metadata, and nonselectable app stylesheet',async()=>{
  for(const page of ['index','welcome','scan-card','scan-face','home']){
    const html=pages[page+'.html'];
    for(const file of ['app-flow.js','pwa.js','manifest.webmanifest','app.css'])assert.ok(html.includes(`"${file}"`),page+' missing '+file);
    assert.ok(!html.includes('C:/Users/')&&!html.includes('C:\\Users\\'));
    assert.equal(new Set([...html.matchAll(/\bid="([^"\s]+)"/g)].map(x=>x[1])).size,[...html.matchAll(/\bid="([^"\s]+)"/g)].length,page+' duplicate ID');
  }
});
test('precache entries all exist and include every runtime stage and asset',async()=>{
  const text=await readFile(new URL('precache-manifest.js',root),'utf8');
  const manifest=JSON.parse(text.replace(/^self.FMC_PRECACHE\s*=\s*/,'').replace(/;\s*$/,''));
  assert.ok(/^[a-f0-9]{16}$/.test(manifest.version));
  assert.equal(new Set(manifest.files).size,manifest.files.length);
  for(const file of manifest.files){
    assert.ok(!file.startsWith('/')&&!file.includes('..')&&!file.includes('deploy/'));
    if(Object.hasOwn(pages,file)){assert.match(pages[file],/^\s*<!doctype html>/i);continue;}
    assert.ok((await stat(new URL(file,root))).size>0);
    assert.deepEqual(await readFile(new URL(file,root)),await readFile(new URL('deploy/dist/'+file,root)));
  }
});
test('home integration preserves existing app initialization and hooks real installation/logout',async()=>{
  const code=await readFile(new URL('home-app.js',root),'utf8');
  for(const name of ['initMapPage','initCommunityPage','initProfilePage','initializeExpandedPages','restoreAppRoute'])assert.ok(code.includes('function '+name+'('),name+' missing');
  assert.ok(code.includes("if(action==='install')installApp()"));
  assert.ok(code.includes("if(action==='signout'){window.FMCFlow.logout();}"));
  assert.ok(code.includes("removeEventListener('click',nativeCloseSheet)"));
  assert.ok(code.includes('replaceChildren(...record.nodes)'));
  assert.ok(!code.includes('fixmycity-home-drafts-v1'));
});

test('intro retains its full layout stylesheet alongside its noscript fallback',async()=>{
  const html=pages['index.html'];
  const css=await readFile(new URL('index.css',root),'utf8');
  assert.match(html,/<link rel="stylesheet" href="index\.css">/);
  assert.match(html,/<noscript><style>/);
  for(const selector of ['.scene','.night','.lockup','.art','.skyline','.closing-wipe','.intro-static'])assert.ok(css.includes(selector),selector+' missing from intro layout');
  assert.match(css,/height:100dvh/);
  assert.ok(css.length>2500,'noscript styles replaced the main stylesheet');
});

test('Roboto is bundled for every page and included in the offline package',async()=>{
  const css=await readFile(new URL('app.css',root),'utf8');
  const precache=await readFile(new URL('precache-manifest.js',root),'utf8');
  assert.match(css,/body \*\s*\{font-family:Roboto,Arial,sans-serif!important/);
  for(const file of ['roboto-latin.woff2','roboto-latin-ext.woff2']){
    assert.ok(css.includes('assets/fonts/'+file));
    assert.ok(precache.includes('assets/fonts/'+file));
    const bytes=await readFile(new URL('assets/fonts/'+file,root));
    assert.equal(bytes.subarray(0,4).toString(),'wOF2');
  }
});

test('welcome artwork and first-install package stay within their mobile transfer budgets',async()=>{
  const html=pages['welcome.html'];
  const artwork=[...new Set([...html.matchAll(/assets\/onboarding\/[a-z-]+-[a-f0-9]{16}\.webp/g)].map(match=>match[0]))];
  assert.equal(artwork.length,6);
  let imageBytes=0;
  for(const file of artwork){const bytes=await readFile(new URL(file,root));imageBytes+=bytes.length;assert.equal(bytes.subarray(8,12).toString(),'WEBP');}
  assert.ok(imageBytes<400_000,`Welcome image payload grew to ${imageBytes} bytes`);
  const text=await readFile(new URL('precache-manifest.js',root),'utf8');
  const manifest=JSON.parse(text.replace(/^self.FMC_PRECACHE\s*=\s*/,'').replace(/;\s*$/,''));
  assert.ok(manifest.precache.every(path=>manifest.files.includes(path)));
  let entryBytes=0;
  for(const file of manifest.precache)entryBytes+=Object.hasOwn(pages,file)?Buffer.byteLength(pages[file]):(await stat(new URL(file,root))).size;
  assert.ok(entryBytes<500_000,`First install grew to ${entryBytes} bytes`);
  assert.ok(!manifest.precache.some(path=>path.includes('mediapipe')||/\.png$/.test(path)&&!path.startsWith('assets/icons/')));
});

test('source and build contain no static HTML files',async()=>{
  async function check(directory){
    for(const entry of await readdir(directory,{withFileTypes:true})){
      if(['node_modules','.git'].includes(entry.name))continue;
      const path=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
      if(entry.isDirectory())await check(path);
      else assert.ok(!/\.html?$/i.test(entry.name),path.pathname);
    }
  }
  await check(root);
});
