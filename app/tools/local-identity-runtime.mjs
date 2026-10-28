// Loopback development adapter. Restarting clears sessions and local counters.
// Identity media is held only in memory and deleted by the real Worker's alarms.
import {randomBytes} from 'node:crypto';
import {IdentitySession,VerificationBudget} from '../deploy/identity-api.js';
class MemoryStorage {
  values=new Map();timer=null;onAlarm=async()=>{};
  async get(key){return Array.isArray(key)?new Map(key.filter(k=>this.values.has(k)).map(k=>[k,structuredClone(this.values.get(k))])):structuredClone(this.values.get(key));}
  async put(key,value){if(typeof key==='object'){for(const [k,v] of Object.entries(key))await this.put(k,v);return;}this.values.set(key,structuredClone(value));}
  async deleteAll(){this.values.clear();}
  async deleteAlarm(){clearTimeout(this.timer);this.timer=null;}
  async setAlarm(at){await this.deleteAlarm();this.timer=setTimeout(()=>this.onAlarm().catch(()=>this.deleteAll()),Math.max(0,at-Date.now()));this.timer.unref();}
}
function namespace(Class,env){
  const objects=new Map();
  return {idFromName:id=>id,get(id){
    if(!objects.has(id)){
      for(const [key,record] of objects)if(!record.storage.values.size && !record.storage.timer)objects.delete(key);
      if(objects.size>=256)throw Error('Local session capacity reached.');
      const storage=new MemoryStorage();let tail=Promise.resolve();
      const instance=new Class({storage,blockConcurrencyWhile(fn){const next=tail.then(fn);tail=next.catch(()=>{});return next;}},env);
      storage.onAlarm=()=>instance.alarm();objects.set(id,{storage,instance});
    }
    return objects.get(id).instance;
  }};
}
export function createLocalIdentityRuntime(apiKey=''){
  let windowStart=0,requests=0;
  const env={OPENAI_API_KEY:apiKey,IDENTITY_SESSION_SECRET:randomBytes(32).toString('hex'),
    IDENTITY_DAILY_START_LIMIT:'200',IDENTITY_DAILY_MODEL_LIMIT:'100',
    IDENTITY_RATE_LIMIT:{async limit(){const now=Date.now();if(now-windowStart>=60000){windowStart=now;requests=0;}return {success:++requests<=12};}}};
  env.IDENTITY_SESSIONS=namespace(IdentitySession,env);
  env.VERIFICATION_BUDGET=namespace(VerificationBudget,env);
  return env;
}
