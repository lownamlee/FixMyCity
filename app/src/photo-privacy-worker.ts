import {FaceDetector,FilesetResolver} from '@mediapipe/tasks-vision';
let detector:FaceDetector|null=null;
self.onmessage=async(event:MessageEvent)=>{const {bitmap,base}=event.data;try{
 if(!detector){const vision=await FilesetResolver.forVisionTasks(new URL('assets/mediapipe/wasm/',base).href);detector=await FaceDetector.createFromOptions(vision,{baseOptions:{modelAssetPath:new URL('assets/mediapipe/face_detector.tflite',base).href,delegate:'CPU'},runningMode:'IMAGE',minDetectionConfidence:.35});}
 const results=detector.detect(bitmap);self.postMessage({boxes:results.detections.map(d=>d.boundingBox).filter(Boolean)});
}catch{self.postMessage({error:'Photo privacy detection is unavailable. Please try again before uploading.'});}finally{bitmap.close();}};
