import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function databaseConfig(){
 const dir=join(process.env.LOCALAPPDATA,'FixMyCity');
 // Once cloud storage is selected, never fall back to a stale local database.
 const mode=process.env.FMC_DATABASE_MODE||'supabase';
 const file=process.env.FMC_DATABASE_CONFIG||join(dir,mode==='local'?'local-postgres.json':'supabase-postgres.json');
 const config=JSON.parse(await readFile(file,'utf8'));
 return {mode,config:{...config,max:3,connectionTimeoutMillis:15000,idleTimeoutMillis:15000},adminKey:(await readFile(join(dir,'admin-access.key'),'utf8')).trim()};
}
