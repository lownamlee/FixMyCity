const base=new URL('./',(document.currentScript as HTMLScriptElement).src);
async function call(path:string,data?:unknown,signal?:AbortSignal):Promise<VerificationState> {
  const response=await fetch(new URL('api/'+path,base),{method:data===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',keepalive:path==='logout',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal});
  let result;try{result=await response.json();}catch{throw Object.assign(new Error('The verification service did not return a valid response. Please try again.'),{status:response.status});}
  if(!response.ok)throw Object.assign(new Error(result.message||'The verification check could not be completed. Please try again.'),{status:response.status,code:result.error||result.code,retryAfter:Number(response.headers.get('Retry-After'))||0,result});
  return result;
}
window.FMCVerificationAPI=Object.freeze({session:(signal?:AbortSignal)=>call('session',undefined,signal),start:(signal?:AbortSignal)=>call('verification/start',{consent:true},signal),ic:(frames:VerificationFrame[],signal?:AbortSignal)=>call('verification/ic',{frames},signal),icFrame:(frames:VerificationFrame[],signal?:AbortSignal)=>call('verification/ic-frame',{frames},signal),face:(frames:VerificationFrame[],signal?:AbortSignal)=>call('verification/face',{frames},signal),faceActions:(proof:import('./lib/face-actions').FaceProof,signal?:AbortSignal)=>call('verification/face',{proof},signal),cancel:()=>call('logout',{})});
