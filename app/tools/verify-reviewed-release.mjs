import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,relative,isAbsolute,sep} from 'node:path';

// Verify a signed manifest before inspecting its files. Activation remains an
// explicit operator action; this tool does not replace any running model.
const [manifestPath, signaturePath, publicKeyPath] = process.argv.slice(2);
if (!manifestPath || !signaturePath || !publicKeyPath) throw Error('Usage: node verify-reviewed-release.mjs <manifest> <signature> <public-key>');
const signedManifest = await realpath(manifestPath);
const base = await realpath(resolve(signedManifest, '..'));
await new Promise((resolvePromise, reject) => {
  const child = spawn('cosign', ['verify-blob', '--key', publicKeyPath, '--signature', signaturePath, signedManifest],
    {stdio:['ignore','ignore','pipe'],windowsHide:true});
  let errors=''; child.stderr.on('data', chunk => { if(errors.length<2000) errors+=chunk.toString().slice(0,2000-errors.length); });
  child.on('error', () => reject(Error('Cosign is unavailable.')));
  child.on('close', code => code === 0 ? resolvePromise() : reject(Error('Signature verification failed. '+errors)));
});
const manifest = JSON.parse(await readFile(signedManifest, 'utf8'));
if (!manifest || typeof manifest.version !== 'string' || !Array.isArray(manifest.artifacts) || !manifest.artifacts.length || manifest.artifacts.length > 100)
  throw Error('Invalid signed release manifest.');
for (const item of manifest.artifacts) {
  if (!item || typeof item.path !== 'string' || isAbsolute(item.path) || !/^[a-f0-9]{64}$/.test(item.sha256)) throw Error('Invalid artifact entry.');
  const file = await realpath(resolve(base, item.path));
  const pathWithin = relative(base, file);
  if (!pathWithin || pathWithin === '..' || pathWithin.startsWith('..'+sep) || isAbsolute(pathWithin)) throw Error('Artifact escapes release directory.');
  const digest = createHash('sha256').update(await readFile(file)).digest('hex');
  if (digest !== item.sha256) throw Error('Artifact hash mismatch: '+item.path);
}
console.log(JSON.stringify({version:manifest.version,verifiedArtifacts:manifest.artifacts.length}));
