import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const planner=fileURLToPath(new URL('./response_planner.py',import.meta.url));

// Planning is advisory: the resulting proposal must still be approved by an officer.
export async function planResponse(input){
  if(!process.env.FMC_OSRM_URL)throw new Error('Road routing is not configured.');
  return new Promise((resolve,reject)=>{
    const child=spawn(process.env.FMC_PLANNER_PYTHON||'python',[planner],{stdio:['pipe','pipe','pipe'],windowsHide:true,env:{...process.env,OSRM_URL:process.env.FMC_OSRM_URL}});
    let output='',errors='',settled=false;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
    const timer=setTimeout(()=>{child.kill();finish(new Error('Response planning timed out.'));},30000);
    child.on('error',()=>finish(new Error('Response planning is unavailable.')));
    child.stdout.on('data',chunk=>{output+=chunk.toString();if(output.length>2000000){child.kill();finish(new Error('Response plan exceeds the size limit.'));}});
    child.stderr.on('data',chunk=>{errors+=chunk.toString().slice(0,1000);});
    child.on('close',code=>{if(code!==0)return finish(new Error('Response planning failed. Check the routing and planner configuration.'));try{const result=JSON.parse(output);if(!Array.isArray(result.proposals)||!Array.isArray(result.unassigned))throw Error();finish(null,result);}catch{finish(new Error('Response planner returned an invalid result.'));}});
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(input));
  });
}

// The receiving agency must support the supplied idempotency key for retries.
export async function sendDispatch({id,version,proposal}){
  const endpoint=process.env.FMC_DISPATCH_URL,token=process.env.FMC_DISPATCH_TOKEN;
  if(!endpoint||!token)throw new Error('An authority dispatch connection is not configured.');
  let url;try{url=new URL(endpoint);}catch{throw new Error('The authority dispatch URL is invalid.');}
  if(url.protocol!=='https:'||url.username||url.password||url.hash)throw new Error('The authority dispatch URL must use HTTPS.');
  const response=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,'Idempotency-Key':`${id}:${version}`},body:JSON.stringify({caseId:id,version,proposal})});
  if(!response.ok)throw new Error('The authority dispatch connection did not acknowledge the assignment.');
  const body=await response.json();
  if(typeof body.receipt!=='string'||body.receipt.length<1||body.receipt.length>200)throw new Error('The authority dispatch acknowledgement is invalid.');
  return body.receipt;
}
