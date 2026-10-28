/** Local scenario state machine. Does not authenticate officers or dispatch real resources. */
export class DemoWorkflow {
 readonly mode='demo';readonly incidentId='FMC-043';readonly hazardId='FMC-042';
 version=1;approvedVersion:number|null=null;response='proposed';repair='open';points=105;verifiedContributions=7;
 plan={roles:[{role:'Test responder',count:2}],vehicle:'DEMO-01',entrance:'Main gate',template:'DEMO-RIDER-01 — synthetic, not an operational protocol'};
 history:Array<{at:string;action:string;version:number}>=[];
 private receipts=new Map<string,string>();private credits=new Set<string>();
 position:{lat:number;lng:number;at:number;sequence:number}|null=null;
 private record(action:string){this.history.push({at:new Date().toISOString(),action,version:this.version});}
 revise(entrance:string){if(!['proposed','approved'].includes(this.response))throw Error('Do not edit an acknowledged assignment.');this.plan.entrance=entrance;this.version++;this.approvedVersion=null;this.response='proposed';this.record('proposal revised; prior approval invalidated');}
 approve(version:number){if(version!==this.version||this.response!=='proposed')throw Error('Review the current proposal version.');this.approvedVersion=version;this.response='approved';this.record('test officer approved');}
 acknowledge(key:string,version:number){
  if(this.receipts.has(key))return this.receipts.get(key)!;
  if(this.response!=='approved'||this.approvedVersion!==version||version!==this.version)throw Error('Current officer approval is required.');
  this.response='dispatch_acknowledged';const id='DEMO-ACK-'+this.version;this.receipts.set(key,id);this.record('simulated dispatch acknowledgement');return id;
 }
 telemetry(update:{lat:number;lng:number;at:number;sequence:number},now=Date.now()){
  if(!['dispatch_acknowledged','en_route'].includes(this.response))return false;
  if(!Number.isFinite(update.lat)||!Number.isFinite(update.lng)||Math.abs(update.lat)>90||Math.abs(update.lng)>180||!Number.isFinite(update.at)||update.at>now+5000||now-update.at>30000||!Number.isInteger(update.sequence)||update.sequence<0)return false;
  if(this.position&&(update.sequence<=this.position.sequence||update.at<=this.position.at))return false;
  if(this.position){const metres=Math.hypot((update.lat-this.position.lat)*111000,(update.lng-this.position.lng)*111000);if(metres/Math.max(.001,(update.at-this.position.at)/1000)>60)return false;}
  this.position={...update};this.response='en_route';return true;
 }
 tracking(now=Date.now()){return{mode:'replay',position:this.position,stale:!this.position||now-this.position.at>30000,status:this.response};}
 completeResponse(){if(!['en_route','dispatch_acknowledged'].includes(this.response))throw Error('No acknowledged response.');this.response='response_complete';this.position=null;this.record('test response completed; repair stays open');}
 authorityRepairComplete(){if(this.repair==='resident_verified')return;this.repair='authority_completed';this.record('test authority repair completion recorded');}
 confirmRepair(reviewed:boolean,contributionKey='FMC-042:Aina:repair-check'){
  if(this.credits.has(contributionKey))return false;
  if(this.repair!=='authority_completed'||!reviewed)throw Error('An authority completion record and reviewed resident check are required.');
  if(this.credits.has(contributionKey))return false;this.credits.add(contributionKey);this.repair='resident_verified';this.points+=15;this.verifiedContributions++;this.record('one reviewed contribution credited');return true;
 }
}
