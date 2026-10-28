import {FaceLandmarker,FilesetResolver} from '@mediapipe/tasks-vision';
let detector:FaceLandmarker|null=null;
self.onmessage=async(event:MessageEvent)=>{
 const data=event.data;
 try{
  if(data.type==='init'){
   const vision=await FilesetResolver.forVisionTasks(new URL('assets/mediapipe/wasm/',data.base).href);
   detector=await FaceLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:new URL('assets/mediapipe/face_landmarker.task',data.base).href,delegate:'CPU'},runningMode:'VIDEO',numFaces:2,outputFaceBlendshapes:true,minFaceDetectionConfidence:.5,minFacePresenceConfidence:.5,minTrackingConfidence:.5});
   self.postMessage({type:'ready'});
  }else if(data.type==='frame'&&detector){
   const result=detector.detectForVideo(data.bitmap,data.timestamp);
   const blend=result.faceBlendshapes[0]?.categories||[];
   self.postMessage({type:'result',id:data.id,at:data.at,mediaTime:data.mediaTime,width:data.bitmap.width,height:data.bitmap.height,faces:result.faceLandmarks,blinkLeft:blend.find(c=>c.categoryName==='eyeBlinkLeft')?.score??0,blinkRight:blend.find(c=>c.categoryName==='eyeBlinkRight')?.score??0});
  }
 }catch{self.postMessage({type:'error',message:'Face detection could not start. Try again with this page open.'});}
 finally{data.bitmap?.close();}
};
