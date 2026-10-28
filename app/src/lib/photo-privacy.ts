/** Detectors can miss small/occluded faces, so the user reviews the exact upload. */
export async function protectPhoto(canvas:HTMLCanvasElement):Promise<string>{
 const bitmap=await createImageBitmap(canvas),worker=new Worker(new URL('photo-privacy-worker.js',location.href));
 let boxes:Array<{originX:number;originY:number;width:number;height:number}>;
 try{boxes=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Photo protection took too long. Please try again.')),30000);worker.onerror=()=>{clearTimeout(timeout);reject(Error('Photo protection could not load.'));};worker.onmessage=e=>{clearTimeout(timeout);e.data.error?reject(Error(e.data.error)):resolve(e.data.boxes);};worker.postMessage({bitmap,base:new URL('./',location.href).href},[bitmap]);});}finally{worker.terminate();}
 const ctx=canvas.getContext('2d')!;ctx.fillStyle='#244260';
 for(const b of boxes){const px=b.width*.2,py=b.height*.25;ctx.fillRect(b.originX-px,b.originY-py,b.width+px*2,b.height+py*2);}
 return new Promise((resolve,reject)=>{
  const dialog=document.createElement('dialog');dialog.style.cssText='border:1px solid #dbe8fa;border-radius:22px;padding:22px;max-width:470px;width:calc(100% - 24px);color:#102442;box-sizing:border-box';
  const title=document.createElement('h2');title.textContent='Review photo privacy';title.style.marginTop='0';
  const help=document.createElement('p');help.textContent='Detected faces are covered. Tap any other faces, plates or personal details to cover them before uploading.';help.style.cssText='font:14px/1.5 Roboto,sans-serif';
  canvas.style.cssText='width:100%;max-height:45dvh;object-fit:contain;display:block;touch-action:manipulation;border-radius:12px;cursor:crosshair';
  canvas.onclick=e=>{const box=canvas.getBoundingClientRect(),ratio=Math.min(box.width/canvas.width,box.height/canvas.height),left=box.left+(box.width-canvas.width*ratio)/2,top=box.top+(box.height-canvas.height*ratio)/2,x=(e.clientX-left)/ratio,y=(e.clientY-top)/ratio,size=Math.max(36,canvas.width*.09);ctx.fillRect(x-size/2,y-size/2,size,size);};
  const confirm=document.createElement('button');confirm.textContent='Use this photo';confirm.className='fmc-button';confirm.style.cssText='display:block;width:100%;margin-top:18px;padding:14px;border:0;border-radius:28px;background:#096aff;color:white;font:600 16px Roboto,sans-serif';
  const cancel=document.createElement('button');cancel.textContent='Cancel';cancel.style.cssText='display:block;margin:14px auto 0;background:none;border:0;color:#50658a;padding:6px 24px';
  const dismiss=()=>{dialog.close();dialog.remove();};confirm.onclick=()=>{const safe=canvas.toDataURL('image/jpeg',.82);dismiss();resolve(safe);};cancel.onclick=()=>{dismiss();reject(Error('Photo upload cancelled.'));};dialog.addEventListener('cancel',e=>{e.preventDefault();cancel.click();});
  dialog.append(title,help,canvas,confirm,cancel);document.body.append(dialog);dialog.showModal();
 });
}
