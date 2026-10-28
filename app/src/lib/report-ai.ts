import type {buildAssessment,LocationClaim} from '../ai/domain';
import {protectPhoto} from './photo-privacy';
export type Assessment=ReturnType<typeof buildAssessment>;
export interface ReportContext {transcript:string;location:LocationClaim;photos:string[];assessment?:Assessment}
declare global {interface Window {FMCReportBridge?:{context:()=>ReportContext;apply:(assessment:Assessment)=>void;review:()=>void;chat:(text:string)=>void};}}
export async function reviewReport(body:unknown,signal?:AbortSignal):Promise<Assessment>{
 if(body&&typeof body==='object')body={...body,photoProtection:'browser_faces_v1'};
 const response=await fetch('/api/ai/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
 const result=await response.json();if(!response.ok)throw Error(result.message||'AI review is unavailable. Your draft is still here.');return result;
}
/** Decode into a bounded fresh JPEG; no EXIF or GPS metadata is forwarded. */
const prepared=new Map<string,Promise<string>>();let photoQueue=Promise.resolve();
export function preparePhoto(url:string):Promise<string>{
 const previous=prepared.get(url);if(previous)return previous;
 const task=photoQueue.then(()=>decodePhoto(url));photoQueue=task.then(()=>{},()=>{});prepared.set(url,task);task.catch(()=>prepared.delete(url));if(prepared.size>8)prepared.delete(prepared.keys().next().value!);return task;
}
async function decodePhoto(url:string):Promise<string>{
 const image=new Image();image.src=url;await image.decode();
 if(!image.naturalWidth||image.naturalWidth*image.naturalHeight>40000000)throw Error('Use a photo under 40 megapixels.');
 const scale=Math.min(1,1200/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');
 canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);
 return protectPhoto(canvas);
}
export async function protectedPhoto(data:string,regions:Assessment['facts']['privacyRegions'],index:number):Promise<string>{
 const image=new Image();image.src=data;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
 const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);ctx.fillStyle='#152840';
 for(const r of regions.filter(r=>r.imageIndex===index)){const pad=.015;ctx.fillRect(Math.max(0,r.x-pad)*canvas.width,Math.max(0,r.y-pad)*canvas.height,(r.width+2*pad)*canvas.width,(r.height+2*pad)*canvas.height);}
 return canvas.toDataURL('image/jpeg',.88);
}
