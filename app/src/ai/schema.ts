import {CATEGORIES} from './domain';
const str={type:'string',maxLength:2000};
const truth={type:'string',enum:['yes','no','unknown']};
const object=(properties:Record<string,unknown>)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export const INCIDENT_SCHEMA=object({
 language:{type:'string',enum:['en','ms','mixed']},category:{type:'string',enum:CATEGORIES},title:{type:'string',maxLength:120},summaryEn:str,summaryMs:str,
 activeIncident:truth,injuryReported:truth,injuredCount:{type:['integer','null'],minimum:0,maximum:1000},immediateDanger:truth,
 locationText:{type:'string',maxLength:180},accessPoint:{type:'string',maxLength:120},hazard:{type:['string','null'],enum:[...CATEGORIES,null]},
 unknownFields:{type:'array',items:{type:'string',maxLength:120},maxItems:12},nextQuestionEn:str,nextQuestionMs:str,evidenceSummary:str,privacyUncertain:{type:'boolean'},
 privacyRegions:{type:'array',maxItems:60,items:object({imageIndex:{type:'integer',minimum:0,maximum:2},kind:{type:'string',enum:['face','plate','private_text']},x:{type:'number',minimum:0,maximum:1},y:{type:'number',minimum:0,maximum:1},width:{type:'number',minimum:0,maximum:1},height:{type:'number',minimum:0,maximum:1}})}
});
export const REPAIR_SCHEMA=object({comparison:{type:'string',enum:['appears_repaired','still_damaged','inconclusive']},sameScene:{type:'string',enum:['likely','unlikely','uncertain']},visibleChanges:str,limitations:{type:'array',items:str,maxItems:8},nextStep:str});
/** Validate upstream output too: transport/schema failures cannot become an accepted draft. */
export function matchesSchema(value:any,schema:any):boolean {
 if(value===null)return Array.isArray(schema.type)&&schema.type.includes('null');
 if(schema.enum&&!schema.enum.includes(value))return false;
 const type=Array.isArray(schema.type)?schema.type.find((t:string)=>t!=='null'):schema.type;
 if(type==='object')return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===schema.required.length&&schema.required.every((k:string)=>Object.hasOwn(value,k)&&matchesSchema(value[k],schema.properties[k]));
 if(type==='array')return Array.isArray(value)&&value.length<=schema.maxItems&&value.every(v=>matchesSchema(v,schema.items));
 if(type==='integer'||type==='number')return typeof value==='number'&&Number.isFinite(value)&&(type!=='integer'||Number.isInteger(value))&&value>=schema.minimum&&value<=schema.maximum;
 if(type==='string')return typeof value==='string'&&value.length<=(schema.maxLength||Infinity);
 return type==='boolean'&&typeof value==='boolean';
}
