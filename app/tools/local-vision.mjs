import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
export function createLocalVision(){
 let ready=false,closed=false;const pending=new Map(),cache=new Map();
 const child=spawn(fileURLToPath(new URL('../.ml-venv/Scripts/python.exe',import.meta.url)),[fileURLToPath(new URL('./vision_worker.py',import.meta.url))],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,HF_HUB_DISABLE_SYMLINKS_WARNING:'1',TOKENIZERS_PARALLELISM:'false'}});
 child.stderr.on('data',()=>{}); // Model-download noise only; never log image payloads.
 createInterface({input:child.stdout}).on('line',line=>{let result;try{result=JSON.parse(line);}catch{return;}if(result.ready){ready=true;console.log('Local MTCNN privacy + CLIP classification ready.');return;}const entry=pending.get(result.id);if(!entry)return;pending.delete(result.id);clearTimeout(entry.timer);result.error?entry.reject(Error(result.error)):entry.resolve(result);});
 const fail=()=>{closed=true;ready=false;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Photo protection is unavailable. No unprotected photo was accepted.'));}pending.clear();};
 child.on('error',fail);child.on('exit',fail);
 return {
  status:()=>({available:ready,loading:!ready&&!closed,faceModel:'MTCNN',classifier:'CLIP ViT-B/32'}),
  async process(image,masks=[]){
   if(!ready)throw Error('Photo protection is still starting. Please try again shortly.');
   if(typeof image!=='string'||image.length>1700000)throw Error('Use a photo smaller than 1.2 MB.');
   const key=createHash('sha256').update(image).update(JSON.stringify(masks)).digest('hex');const cached=cache.get(key);if(cached&&Date.now()-cached.at<300000)return cached.result;
   if(pending.size>=3)throw Error('Photo protection is busy. Try again shortly.');
   const id=randomUUID();const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('Photo protection timed out. No unprotected copy was saved.'));},90000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,image,masks})+'\n');});
   if(cache.size>=8)cache.delete(cache.keys().next().value);cache.set(key,{at:Date.now(),result});return result;
  },
  close(){child.kill();fail();cache.clear();}
 };
}
