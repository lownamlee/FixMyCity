// Sample only the raw video element; never capture page UI or an uploaded image.
// Timing and distinct bytes catch frozen capture, not sophisticated video replay.
function cancelled(){return Object.assign(new Error('Capture cancelled.'),{name:'AbortError'});}
function captureError(message:string){return Object.assign(new Error(message),{code:'capture_incomplete'});}
function wait(ms:number,signal:AbortSignal):Promise<void>{
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(cancelled());return;}
    const abort=()=>{clearTimeout(timer);reject(cancelled());};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
    signal.addEventListener('abort',abort,{once:true});
  });
}
export async function captureCardSequence(camera:Pick<Window['FMCCamera'],'ready'|'captureSample'>,step:'front'|'back',signal:AbortSignal,onSample?:(count:number)=>void):Promise<VerificationFrame[]>{
  const frames:VerificationFrame[]=[];
  for(let sample=0;sample<3;sample++){
    if(sample)await wait(450,signal);
    if(signal.aborted)throw cancelled();
    if(!camera.ready())throw captureError('Camera paused. Keep your MyKad in view and try again.');
    const current=camera.captureSample({maxWidth:1280,quality:.85});
    if(!current || !Number.isFinite(current.mediaTime) || !Number.isFinite(current.capturedAt))throw captureError('Camera is starting. Hold your MyKad steady.');
    if(current.image.length>2800000)throw captureError('Move to a simpler background and keep the card in the frame.');
    const previous=frames[frames.length-1];
    if(previous){
      const elapsed=current.capturedAt-previous.capturedAt,videoElapsed=current.mediaTime-previous.mediaTime!;
      if(elapsed<200 || elapsed>2500 || videoElapsed<.15 || videoElapsed>3 || Math.abs(videoElapsed-elapsed/1000)>.75 || frames.some(frame=>frame.image===current.image))throw captureError('Camera paused. Keep your MyKad in view and try again.');
    }
    frames.push({...current,step,sample});
    onSample?.(sample+1);
  }
  return frames;
}
