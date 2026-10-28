import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';

// Read only the explicitly supplied file. Never log or persist the key.
const sourcePath=process.argv[2];
if(!sourcePath) throw new Error('Supply the approved local key file path.');
const source=await readFile(sourcePath,'utf8');
const matches=[...new Set(source.match(/sk-[A-Za-z0-9_-]{20,}/g)||[])];
if(matches.length!==1) throw new Error('Expected exactly one API key in the supplied file.');
const key=matches[0];
const headers={Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
const modelsResponse=await fetch('https://api.openai.com/v1/models',{headers,signal:AbortSignal.timeout(30000)});
const models=await modelsResponse.json();
const available=modelsResponse.ok && models.data?.some(m=>m.id==='gpt-6-luna');
console.log(JSON.stringify({modelsStatus:modelsResponse.status,lunaAvailable:!!available}));
if(!modelsResponse.ok) throw new Error('API credential validation failed; key was not printed.');
const check=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers,body:JSON.stringify({model:'gpt-6-luna',reasoning:{effort:'high'},service_tier:'priority',store:false,input:'Reply with only READY.',max_output_tokens:256}),signal:AbortSignal.timeout(60000)});
const result=await check.json();
console.log(JSON.stringify({testStatus:check.status,status:result.status,model:result.model,serviceTier:result.service_tier,errorCode:result.error?.code,errorType:result.error?.type,text:check.ok?result.output?.filter(o=>o.type==='message').flatMap(o=>o.content?.filter(c=>c.type==='output_text').map(c=>c.text)||[]):undefined}));
if(!check.ok) throw new Error('Requested model configuration failed; no alternate model was used.');
await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['C:/Users/Burger/Desktop/FixMyCity/fixmycity/node_modules/wrangler/bin/wrangler.js','secret','put','OPENAI_API_KEY','--config','deploy/wrangler.jsonc'],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  const safe=chunk=>process.stdout.write(chunk.toString().split(key).join('[REDACTED]'));
  child.stdout.on('data',safe);child.stderr.on('data',safe);
  child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Secret provisioning failed.')));
  child.stdin.end(key+'\n');
});
