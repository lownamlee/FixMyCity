interface VerificationFrame {step:string;image:string;capturedAt:number;sample?:number;mediaTime?:number}
interface CameraSample {image:string;capturedAt:number;mediaTime:number}
interface ChallengeStep {step:string;instruction?:string}
interface VerificationState {
  verified?:boolean;icPassed?:boolean;icFrontPassed?:boolean;status?:string;
  cardChallenge?:ChallengeStep[];faceChallenge?:ChallengeStep[];expiresAt?:string;
  passed?:boolean;sidePassed?:boolean;decision?:string;message?:string;
  faceToken?:string;faceCheck?:string;faceMatched?:boolean;
}
interface VerificationAPI {
  session(signal?:AbortSignal):Promise<VerificationState>;
  start(signal?:AbortSignal):Promise<VerificationState>;
  ic(frames:VerificationFrame[],signal?:AbortSignal):Promise<VerificationState>;
  icFrame(frames:VerificationFrame[],signal?:AbortSignal):Promise<VerificationState>;
  face(frames:VerificationFrame[],signal?:AbortSignal):Promise<VerificationState>;
  faceActions(proof:import('./lib/face-actions').FaceProof,signal?:AbortSignal):Promise<VerificationState>;
  cancel():Promise<unknown>;
}
interface Window {
  FMCVerificationAPI:VerificationAPI;
  FMCCamera:{ready():boolean;require():boolean;capture(frame:Element|null,options?:{maxWidth?:number;quality?:number}):string|null;captureSample(options?:{maxWidth?:number;quality?:number}):CameraSample|null;subscribe(fn:(state:{ready:boolean})=>void):()=>void;stop():void};
  FMCFlow?:{ready:Promise<unknown>;getSession():VerificationState|null;refreshSession():Promise<VerificationState>;go(path:string):unknown;back(path:string):unknown};
}
