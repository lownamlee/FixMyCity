import type {Assessment,ReportContext} from './report-ai';
import {preparePhoto} from './report-ai';
declare global{interface Window{FMCLocalDraft?:{draftId:string;latestId:string;completed:boolean;saving:Promise<any>}}}
const state=window.FMCLocalDraft||(window.FMCLocalDraft={draftId:crypto.randomUUID(),latestId:'',completed:false,saving:Promise.resolve()});
export async function localRequest(path:string,body?:unknown,admin=false){if(body&&typeof body==='object')body={...body,photoProtection:'browser_faces_v1'};const response=await fetch((admin?'/api/local-admin':'/api/local-reports')+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw Error(result.message||'The report could not be saved.');return result;}
export function saveIncident(a:Assessment,context?:ReportContext){
 if(state.completed)newIncident();
 const ownId=state.draftId;
 const task=state.saving.catch(()=>{}).then(async()=>{const photos=await Promise.all((context?.photos||[]).slice(0,3).map(preparePhoto));const result=await localRequest('/draft',{draftId:ownId,facts:a.facts,transcript:a.originalText,location:a.location,photos});if(ownId===state.draftId)state.latestId=result.id;return result;});state.saving=task;return task;
}
export async function submitIncident(options:{linkedHazard?:string;privacyReviewed?:boolean;protectedPhotos?:string[]}={}){const ownId=state.draftId;await state.saving;if(state.draftId!==ownId)throw Error('The report changed before submission. Review the current draft.');const result=await localRequest('/submit',{draftId:ownId,...options});if(state.draftId===ownId){state.latestId=result.id;state.completed=true;}window.dispatchEvent(new CustomEvent('fixmycity:report-created',{detail:result}));return result;}
export function newIncident(){state.draftId=crypto.randomUUID();state.latestId='';state.completed=false;}
export function currentReportId(){return state.latestId;}
