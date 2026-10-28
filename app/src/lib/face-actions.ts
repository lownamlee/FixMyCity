/** Movement UX only: these browser measurements do not prove identity or resist replay. */
export type FaceAction='look_left'|'look_right'|'blink';
export interface FaceSample {at:number;mediaTime:number;faceCount:number;inFrame:boolean;yaw:number;blinkLeft:number;blinkRight:number}
export interface FaceProof {version:1;challengeToken:string;samples:FaceSample[]}
export class FaceActions {
  position=0; complete=false; samples:FaceSample[]=[]; hint='Find your face in the circle';
  private last:FaceSample|null=null;private stableAt=0;private neutralAt=0;private armed=false;private eyes=0;private closedAt=0;
  constructor(readonly actions:FaceAction[]){}
  reset(){this.position=0;this.complete=false;this.samples=[];this.last=null;this.resetStep();}
  private resetStep(){this.stableAt=0;this.neutralAt=0;this.armed=false;this.eyes=0;this.closedAt=0;}
  update(s:FaceSample){
    if(this.complete)return;
    if(!validSample(s))return;
    if(this.last&&(s.at<=this.last.at||s.mediaTime<=this.last.mediaTime)){this.hint='Keep the camera running';return;}
    if(this.last&&(s.at-this.last.at>1200||s.mediaTime-this.last.mediaTime>1.5))this.reset();
    this.last=s;this.samples.push(s);
    if(this.samples.length>450||s.at-this.samples[0].at>60000){this.reset();this.last=s;this.samples.push(s);}
    if(s.faceCount!==1||!s.inFrame){this.resetStep();this.hint=s.faceCount>1?'Only one face in the frame, please':s.faceCount===0?'Looking for your face…':'Move your face into the circle';return;}
    const step=this.actions[this.position],open=s.blinkLeft<.35&&s.blinkRight<.35;
    if(!this.armed){
      this.hint='Look straight ahead for a moment';
      if(Math.abs(s.yaw)<.13&&open){if(!this.neutralAt)this.neutralAt=s.at;if(s.at-this.neutralAt>=200){this.armed=true;this.eyes=1;}}
      else this.neutralAt=0;
      return;
    }
    if(step==='blink'){
      this.hint=this.eyes===2?'Open your eyes':'Blink once';
      if(Math.abs(s.yaw)>.22){this.eyes=0;this.closedAt=0;this.hint='Look straight ahead, then blink';return;}
      if(open){if(this.eyes===2&&s.at-this.closedAt>=60&&s.at-this.closedAt<2500)this.advance();else this.eyes=1;}
      else if(s.blinkLeft>.5&&s.blinkRight>.5&&this.eyes===1){this.eyes=2;this.closedAt=s.at;}
      else if(this.eyes===2&&s.at-this.closedAt>=2500){this.eyes=0;this.hint='Open your eyes, then blink again';}
    }else{
      const target=step==='look_left'?s.yaw>.17:s.yaw<-.17;
      this.hint=target?'That’s it — hold briefly':step==='look_left'?'Turn your head to your left':'Turn your head to your right';
      if(target){if(!this.stableAt)this.stableAt=s.at;if(s.at-this.stableAt>=300)this.advance();}else this.stableAt=0;
    }
  }
  private advance(){this.position++;this.resetStep();this.complete=this.position===this.actions.length;this.hint=this.complete?'All movements complete':'Great — look straight ahead';}
}
export function validSample(s:FaceSample){return !!s&&[s.at,s.mediaTime,s.yaw,s.blinkLeft,s.blinkRight].every(Number.isFinite)&&s.at>0&&s.mediaTime>=0&&Number.isInteger(s.faceCount)&&s.faceCount>=0&&s.faceCount<=2&&typeof s.inFrame==='boolean'&&Math.abs(s.yaw)<=2&&s.blinkLeft>=0&&s.blinkLeft<=1&&s.blinkRight>=0&&s.blinkRight<=1;}
export function validateFaceProof(proof:FaceProof,actions:FaceAction[],token:string,now:number){
  if(!proof||proof.version!==1||!token||proof.challengeToken!==token||!Array.isArray(proof.samples)||proof.samples.length<10||proof.samples.length>450)return false;
  if(actions.length!==3||actions[2]!=='blink'||new Set(actions).size!==3||!actions.includes('look_left')||!actions.includes('look_right'))return false;
  const trace=new FaceActions(actions);let previous:FaceSample|undefined;
  for(const s of proof.samples){
    if(!validSample(s)||s.at>now+1500||now-s.at>65000)return false;
    if(previous){const gap=s.at-previous.at,media=s.mediaTime-previous.mediaTime;if(gap<35||gap>1200||media<.025||media>1.5||Math.abs(media-gap/1000)>.5)return false;}
    if(trace.complete)return false;
    trace.update(s);previous=s;
  }
  return trace.complete&&!!previous&&now-previous.at<10000;
}
