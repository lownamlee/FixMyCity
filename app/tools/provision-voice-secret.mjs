import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {VOICE_MODEL} from '../deploy/voice-config.js';

// Only the approved input file is read; credentials travel to Wrangler via stdin.
const [sourcePath,wranglerPath]=process.argv.slice(2);
if(!sourcePath||!wranglerPath)throw Error('Supply the approved credential file and Wrangler entry point.');
const matches=[...new Set((await readFile(sourcePath,'utf8')).match(/sk-[A-Za-z0-9_-]{20,}/g)||[])];
if(matches.length!==1)throw Error('The approved file must contain one API credential.');
const key=matches[0];
const response=await fetch('https://api.openai.com/v1/models',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error('Voice credential validation failed.');
const models=await response.json();
if(!models.data?.some(model=>model.id===VOICE_MODEL))throw Error('The configured voice model is unavailable for this credential.');
console.log('Voice credential and model validated.');
await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[wranglerPath,'secret','put','VOICE_OPENAI_API_KEY','--config','deploy/wrangler.jsonc'],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  let output='';
  child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});
  child.on('error',()=>reject(Error('Could not start Wrangler.')));
  child.on('exit',code=>{process.stdout.write(output.split(key).join('[REDACTED]'));code===0?resolve():reject(Error('Voice secret provisioning failed.'));});
  child.stdin.on('error',()=>{});child.stdin.end(key+'\n');
});
