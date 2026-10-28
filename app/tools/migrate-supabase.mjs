// One-time, transactional copy into an empty FixMyCity Supabase schema.
// Credentials and backup files stay outside the web/build directories.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {Pool} from 'pg';
const directory=join(process.env.LOCALAPPDATA,'FixMyCity');
const tables=['fmc_reports','fmc_report_events','fmc_telemetry','fmc_repairs','fmc_contributions','fmc_case_links','fmc_agent_config','fmc_reviewed_knowledge'];
const sequences=['fmc_report_number','fmc_report_events_id_seq','fmc_contributions_id_seq','fmc_case_links_id_seq','fmc_reviewed_knowledge_id_seq'];
const source=new Pool(JSON.parse(await readFile(join(directory,'local-postgres.json'),'utf8')));
const target=new Pool({...JSON.parse(await readFile(join(directory,'supabase-postgres.json'),'utf8')),max:2,connectionTimeoutMillis:15000});
const local=await source.connect(),remote=await target.connect();
const snapshot={createdAt:new Date().toISOString(),tables:{},sequences:{}};
const report=[];
const quote=name=>'"'+name.replaceAll('"','""')+'"';
async function fingerprint(client,table,columns){return(await client.query(`SELECT count(*)::int count,md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) digest FROM (SELECT ${columns.map(quote).join(',')} FROM ${quote(table)}) t`)).rows[0];}
try{
 await local.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
 await local.query('LOCK TABLE '+tables.map(quote).join(',')+' IN SHARE MODE');
 await remote.query('BEGIN');
 // Supabase defaults extra_float_digits to 0. Match PostgreSQL's round-trip
 // representation so coordinate hashes compare values, not display rounding.
 await remote.query('SET LOCAL extra_float_digits=1');
 for(const table of tables){
  if((await remote.query(`SELECT 1 FROM ${quote(table)} LIMIT 1`)).rowCount)throw Error('Target already contains data; refusing to overwrite '+table);
  const columns=(await local.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position',['public',table])).rows.map(r=>r.column_name);
  const rows=(await local.query(`SELECT row_to_json(t)::text value FROM ${quote(table)} t`)).rows.map(r=>JSON.parse(r.value));
  snapshot.tables[table]={columns,rows};
  for(const row of rows){
   const values=columns.map(column=>table==='fmc_reports'&&column==='linked_hazard'?null:row[column]);
   await remote.query(`INSERT INTO ${quote(table)} (${columns.map(quote).join(',')}) VALUES (${columns.map((_,i)=>'$'+(i+1)).join(',')})`,values.map(v=>v!==null&&typeof v==='object'?JSON.stringify(v):v));
  }
  if(table==='fmc_reports')for(const row of rows)if(row.linked_hazard)await remote.query('UPDATE fmc_reports SET linked_hazard=$2 WHERE id=$1',[row.id,row.linked_hazard]);
  const before=await fingerprint(local,table,columns),after=await fingerprint(remote,table,columns);
  if(before.count!==after.count||before.digest!==after.digest){
   const actual=(await remote.query(`SELECT row_to_json(t)::text value FROM (SELECT ${columns.map(quote).join(',')} FROM ${quote(table)}) t`)).rows.map(r=>JSON.parse(r.value));
   const expected=rows.map(r=>JSON.stringify(r)).sort(),received=actual.map(r=>JSON.stringify(r)).sort();
   console.log(JSON.stringify({table,before,after,exactJsonRows:JSON.stringify(expected)===JSON.stringify(received)}));
   throw Error('Verification mismatch in '+table);
  }
  report.push({table,...after,matched:true});
 }
 for(const name of sequences){const row=(await local.query(`SELECT last_value::text,is_called FROM ${quote(name)}`)).rows[0];snapshot.sequences[name]=row;await remote.query('SELECT setval($1::regclass,$2::bigint,$3::boolean)',[name,row.last_value,row.is_called]);}
 const backup=join(directory,'backups','supabase-'+Date.now());await mkdir(backup,{recursive:true});
 await writeFile(join(backup,'snapshot.json'),JSON.stringify(snapshot));
 await writeFile(join(backup,'verification.json'),JSON.stringify({project:'nspssnntytrqrmibhyda',tables:report},null,2));
 await remote.query('COMMIT');await local.query('COMMIT');
 console.log(JSON.stringify({imported:true,backup,tables:report},null,2));
}catch(error){await remote.query('ROLLBACK');await local.query('ROLLBACK');throw error;}
finally{local.release();remote.release();await Promise.all([source.end(),target.end()]);}
