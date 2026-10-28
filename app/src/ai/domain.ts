import {AUTHORITIES,KNOWLEDGE_VERSION} from './knowledge';
export const CATEGORIES=['road_accident','road_damage','lighting','cleanliness','drainage','flood','fire','crime','fallen_tree','other'] as const;
export type Category=typeof CATEGORIES[number];
export type Truth='yes'|'no'|'unknown';
export interface IncidentFacts {
 language:'en'|'ms'|'mixed';category:Category;title:string;summaryEn:string;summaryMs:string;
 activeIncident:Truth;injuryReported:Truth;injuredCount:number|null;immediateDanger:Truth;
 locationText:string;accessPoint:string;hazard:Category|null;unknownFields:string[];
 nextQuestionEn:string;nextQuestionMs:string;evidenceSummary:string;
 privacyUncertain:boolean;privacyRegions:Array<{imageIndex:number;kind:'face'|'plate'|'private_text';x:number;y:number;width:number;height:number}>;
}
export interface LocationClaim {text:string;lat:number|null;lng:number|null;confirmed:boolean;accessPoint:string}
export interface HazardRecord {id:string;category:Category;location:string;lat:number;lng:number;status:'open'|'repaired';assetId?:string;updatedAt:string;demo?:boolean}
export function cleanText(value:unknown,max=1000):string{return typeof value==='string'?value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').slice(0,max).trim():'';}
export function maskIdentifiers(text:string):string{return text.replace(/\b\d{6}[- ]?\d{2}[- ]?\d{4}\b/g,'[identity number removed]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email removed]').replace(/(?:\+?60|0)1\d[-\s]?\d{3,4}[-\s]?\d{4}\b/g,'[phone removed]');}
export function locationClaim(value:any):LocationClaim {
 const valid=Number.isFinite(value?.lat)&&Number.isFinite(value?.lng)&&Math.abs(value.lat)<=90&&Math.abs(value.lng)<=180;
 return{text:cleanText(value?.text,180),lat:valid?value.lat:null,lng:valid?value.lng:null,confirmed:valid&&value?.confirmed===true,accessPoint:cleanText(value?.accessPoint,120)};
}
export function emergencyRequired(f:IncidentFacts){return f.activeIncident!=='no'&&(f.injuryReported==='yes'||(f.injuredCount??0)>0||f.immediateDanger==='yes'||f.category==='fire');}
export function candidateAuthorities(f:IncidentFacts,location:LocationClaim){
 const ids=new Set<string>();
 if(emergencyRequired(f))ids.add('999');
 if(f.injuryReported==='yes'||(f.injuredCount??0)>0)ids.add('kkm');
 if(f.category==='road_accident'||f.category==='crime')ids.add('pdrm');
 if(f.category==='fire')ids.add('bomba');
 if(f.category==='flood')ids.add('apm');
 if(f.category==='road_damage'||f.hazard==='road_damage')ids.add('myjalan');
 if(/\b(kuala lumpur|klcc|kl)\b/i.test(location.text||f.locationText)&&!['crime'].includes(f.category))ids.add('dbkl');
 if(f.category==='lighting'&&!/sabah|sarawak|kuching|kota kinabalu|labuan/i.test(location.text||f.locationText))ids.add('tnb');
 return AUTHORITIES.filter(a=>ids.has(a.id)).map(a=>({...a,status:'suggested_requires_review' as const}));
}
function distance(a:LocationClaim,b:HazardRecord){const rad=Math.PI/180,dl=(b.lat-a.lat!)*rad,dg=(b.lng-a.lng!)*rad;return 6371000*2*Math.asin(Math.sqrt(Math.sin(dl/2)**2+Math.cos(a.lat!*rad)*Math.cos(b.lat*rad)*Math.sin(dg/2)**2));}
/** Candidate retrieval only. No universal distance is considered proof of a duplicate. */
export function relatedHazards(f:IncidentFacts,location:LocationClaim,records:HazardRecord[]=[]){
 if(!location.confirmed||location.lat===null||location.lng===null)return [];
 const category=f.hazard||f.category;
 return records.filter(r=>r.category===category&&distance(location,r)<=250).map(r=>({id:r.id,location:r.location,distanceMetres:Math.round(distance(location,r)),demo:!!r.demo,
   relationship:r.status==='repaired'?'possible_recurrence':f.category==='road_accident'||emergencyRequired(f)?'related_hazard_new_response':'possible_same_hazard',
   requiresReview:true,preserveOriginal:true,reason:r.status==='repaired'?'Check whether damage returned after the previous repair.':'Nearby compatible hazard; confirm the exact asset, lane and event.'}));
}
export function responseProposal(f:IncidentFacts,location:LocationClaim){
 const urgent=emergencyRequired(f),response=urgent||['road_accident','crime'].includes(f.category);
 const tasks=[];
 if(response)tasks.push({type:'incident_response',title:f.category==='road_accident'?'Accident response':'Incident response',status:'proposed'});
 if(f.hazard||!response)tasks.push({type:'hazard_repair',title:'Inspect and resolve '+(f.hazard||f.category).replaceAll('_',' '),status:'open_for_review'});
 return {status:'proposed',requiresOfficerApproval:true,dispatchAcknowledged:false,
 personnel:response?[{role:'Dispatcher-selected response team',count:null}]:[{role:'Asset inspection / repair team',count:null}],
 vehicle:{capability:f.injuryReported==='yes'?'Medical response capability, for dispatcher review':response?'Incident-response capability':'Inspection / maintenance capability',assignedId:null},
 accessPoint:location.accessPoint||f.accessPoint||null,route:{status:'needs_routing_provider',geometry:null,etaSeconds:null},tasks,
 missingInputs:['Approved agency response protocol','Current personnel and vehicle availability',...(!location.confirmed?['Confirmed exact location']:[]),'Authorised agency acknowledgement'],
 rationale:'Suggested capabilities only. The authorised agency determines personnel counts, vehicle allocation and route.'};
}
export function buildAssessment(facts:IncidentFacts,originalText:string,location:LocationClaim,records:HazardRecord[]=[]){
 const emergency=emergencyRequired(facts);
 return {version:KNOWLEDGE_VERSION,mode:'ai_draft',originalText,sourceLanguage:facts.language,facts,
 location:{...location,text:location.text||facts.locationText,accessPoint:location.accessPoint||facts.accessPoint},
 emergency:{required:emergency,phone:'999',message:emergency?'Call 999 now, or ask someone nearby to call. You can continue the report when safe.':null},
 authorities:candidateAuthorities(facts,location),related:relatedHazards(facts,location,records),proposal:responseProposal(facts,location),
 publicSummary:maskIdentifiers(facts.summaryEn),privacy:{status:'review_required',publishAllowed:false,regions:facts.privacyRegions,uncertain:facts.privacyUncertain},
 contribution:{status:'pending_review',pointsAwarded:0,reason:'Credit requires reviewed added value; repeated submissions and injury counts do not earn extra points.'}};
}
export const DEMO_HAZARDS:HazardRecord[]=[{id:'FMC-042',category:'road_damage',location:'Jalan Ampang, Kuala Lumpur',lat:3.1593,lng:101.7114,status:'open',updatedAt:'2026-10-28T02:00:00Z',demo:true}];
