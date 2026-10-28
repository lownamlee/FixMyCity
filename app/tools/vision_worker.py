"""Local privacy/classification worker adapted from the supplied FixMyCity Colab.
JSON-lines stdin/stdout only. Raw images are decoded in memory, never written.
MTCNN is used for detection only, never identity recognition.
"""
import base64, io, json, math, sys, time, hashlib, os
from PIL import Image, ImageFilter, ImageOps, ImageDraw
import numpy as np
import torch
from transformers import CLIPProcessor, CLIPModel
from facenet_pytorch import MTCNN

Image.MAX_IMAGE_PIXELS = 40000000
torch.set_num_threads(4)
MODEL = 'openai/clip-vit-base-patch32'
# Safetensors conversion by HF's SFconvertbot in the upstream model repository.
MODEL_REVISION = 'c237dc49a33fc61debc9276459120b7eac67e7ef'
LABELS = [
 ('a photo of a pothole or damaged road surface','Pothole','road_damage'),
 ('a photo of garbage or litter dumped on the street','Garbage dump','cleanliness'),
 ('a photo of a broken or non-working street light','Streetlight','lighting'),
 ('a photo of a blocked drain or clogged sewer','Blocked drain','drainage'),
 ('a photo of a flooded street with standing water','Flooding','flood'),
 ('a photo of a fallen tree blocking the road','Fallen tree','fallen_tree'),
 ('a photo of graffiti or vandalism on a wall','Graffiti','other'),
 ('a photo of a damaged footpath or broken pavement','Broken footpath','road_damage'),
 ('a photo of a road accident involving vehicles','Road accident','road_accident'),
 ('a photo of a person\'s face or a selfie','Portrait','other'),
 ('a photo of an indoor room or object','Indoor scene','other'),
 ('a photo of a clean, normal street with no problems','No visible issue','other'),
]
processor=CLIPProcessor.from_pretrained(MODEL,use_fast=False)
model=CLIPModel.from_pretrained(MODEL,revision=MODEL_REVISION,use_safetensors=True).eval()
detector=MTCNN(keep_all=True,device='cpu',thresholds=[.5,.6,.6])
privacy_detector=None
if os.environ.get('FMC_PRIVACY_OCR')=='1':
 from privacy_detectors import PrivacyDetector
 privacy_detector=PrivacyDetector()
with torch.inference_mode():
 text_vectors=model.get_text_features(**processor(text=[x[0] for x in LABELS],return_tensors='pt',padding=True))
 text_vectors=text_vectors/text_vectors.norm(dim=-1,keepdim=True)

def process(payload):
 started=time.monotonic()
 source=payload.get('image','')
 if not isinstance(source,str) or len(source)>1700000 or ';base64,' not in source: raise ValueError('invalid_image')
 raw=base64.b64decode(source.split(';base64,',1)[1],validate=True)
 image=ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert('RGB')
 del raw,source
 if image.width*image.height>40000000: raise ValueError('image_too_large')
 image.thumbnail((1200,1200))
 # Detect before classification so no unprotected image reaches an image model or DB.
 boxes,probs=detector.detect(image)
 safe=image.copy();regions=[]
 if boxes is not None:
  for box,p in zip(boxes,probs):
   if not math.isfinite(float(p)) or p<.70: continue
   x1,y1,x2,y2=map(float,box);w=x2-x1;h=y2-y1
   x1=max(0,int(x1-.35*w));y1=max(0,int(y1-.35*h));x2=min(image.width,int(x2+.35*w));y2=min(image.height,int(y2+.35*h))
   if x2<=x1 or y2<=y1:continue
   crop=safe.crop((x1,y1,x2,y2));crop=crop.resize((max(1,crop.width//30),max(1,crop.height//30))).resize(crop.size,Image.Resampling.NEAREST)
   crop=crop.filter(ImageFilter.GaussianBlur(max(18,max(x2-x1,y2-y1)//3)));safe.paste(crop,(x1,y1))
   regions.append({'kind':'face','x':x1/image.width,'y':y1/image.height,'width':(x2-x1)/image.width,'height':(y2-y1)/image.height,'confidence':round(float(p),5)})
 if privacy_detector is not None:
  # Automatic detections are advisory and never replace a human privacy review.
  detected=privacy_detector.regions(image)
  for r in detected:
   x,y,w,h=(r[k] for k in ('x','y','width','height'))
   ImageDraw.Draw(safe).rectangle((int(x*safe.width),int(y*safe.height),int((x+w)*safe.width),int((y+h)*safe.height)),fill='#253b59')
  regions.extend(detected)
 del image
 # Explicit reviewed boxes (faces/plates/text) are covered, never used as instructions.
 draw=ImageDraw.Draw(safe)
 for r in payload.get('masks',[])[:60]:
  vals=[r.get(k) for k in ['x','y','width','height']]
  if not all(isinstance(v,(int,float)) and math.isfinite(v) and 0<=v<=1 for v in vals):continue
  x,y,w,h=vals;draw.rectangle((max(0,x-.015)*safe.width,max(0,y-.015)*safe.height,min(1,x+w+.015)*safe.width,min(1,y+h+.015)*safe.height),fill='#253b59')
 with torch.inference_mode():
  vector=model.get_image_features(**processor(images=safe,return_tensors='pt'));vector=vector/vector.norm(dim=-1,keepdim=True)
  logits=model.logit_scale.exp()*vector@text_vectors.T;probs=logits.softmax(dim=-1)[0];scores,indices=probs.topk(3)
 classification=[{'label':LABELS[int(i)][1],'category':LABELS[int(i)][2],'score':round(float(p),5)} for p,i in zip(scores,indices)]
 output=io.BytesIO();safe.save(output,'JPEG',quality=88)
 return {'safeImage':'data:image/jpeg;base64,'+base64.b64encode(output.getvalue()).decode(),
  'diagnostics':{'model':MODEL,'revision':getattr(model.config,'_commit_hash',None),'faceModel':'MTCNN','facesBlurred':sum(r['kind']=='face' for r in regions),'textDetector':'Presidio + Tesseract' if privacy_detector is not None else 'manual review required','regions':regions,'classification':classification,'scoreMeaning':'Relative CLIP prompt-set score, not calibrated accuracy','reviewRequired':True,'embedding':vector[0].tolist(),'safeImageHash':hashlib.sha256(output.getvalue()).hexdigest(),'metadataRemoved':True,'durationMs':round((time.monotonic()-started)*1000)}}

print(json.dumps({'ready':True,'model':MODEL}),flush=True)
for line in sys.stdin:
 try:
  request=json.loads(line);result=process(request)
  print(json.dumps({'id':request.get('id'),**result},separators=(',',':')),flush=True)
 except Exception:
  print(json.dumps({'id':request.get('id') if 'request' in locals() else None,'error':'Photo protection failed. Choose another image; no unprotected copy was saved.'}),flush=True)
