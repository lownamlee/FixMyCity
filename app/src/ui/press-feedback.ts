/** Shared press controller, adapted from CTF/Study/Play/src/press-feedback.ts. */
export function setupPressFeedback(root:Document,selector:string):()=>void {
  type Button=HTMLButtonElement|HTMLAnchorElement;
  interface Press {button:Button;bounds:DOMRect;ink:HTMLSpanElement|null;timer?:ReturnType<typeof setTimeout>;pointerId?:number;pointerType?:string;key?:string;x:number;y:number}
  let active:Press|null=null;
  let released:{button:Button;pointerId:number;inside:boolean;activated:boolean}|null=null;
  let releaseTimer:ReturnType<typeof setTimeout>|undefined,lastPointerType='';
  const motion=matchMedia('(prefers-reduced-motion: reduce)'),listeners=new AbortController();
  function eligible(event:Event):Button|null {
    const button=event.target instanceof Element?event.target.closest<Button>(selector):null;
    if(!button||!button.matches('button,a')||button.matches(':disabled,[aria-disabled="true"]')||button.closest('[inert]'))return null;
    const b=button.getBoundingClientRect();return b.width>=96&&b.width>=b.height*1.8?button:null;
  }
  function clearRelease(){clearTimeout(releaseTimer);released=null;}
  function remember(press:Press,inside:boolean,activated=false){if(press.pointerId===undefined)return;clearRelease();released={button:press.button,pointerId:press.pointerId,inside,activated};releaseTimer=setTimeout(clearRelease,800);}
  function fade(ink:HTMLSpanElement){
    if(!ink.isConnected||motion.matches){ink.remove();return;}
    const style=getComputedStyle(ink);let scale=0;try{scale=new DOMMatrixReadOnly(style.transform).a;}catch{}
    ink.style.setProperty('--release-transform',style.transform==='none'?'scale(0)':style.transform);
    ink.style.setProperty('--release-scale',String(scale+.2));ink.style.setProperty('--release-opacity',style.opacity);ink.dataset.releasing='';
    ink.addEventListener('animationend',()=>ink.remove(),{once:true});setTimeout(()=>ink.remove(),240);
  }
  function release(){
    const press=active;if(!press)return;active=null;clearTimeout(press.timer);press.button.removeAttribute('data-fmc-pressed');
    if(press.ink)fade(press.ink);
    if(press.pointerId!==undefined&&press.button.hasPointerCapture?.(press.pointerId))press.button.releasePointerCapture(press.pointerId);
  }
  function cancel(){if(active)remember(active,false);release();}
  function begin(button:Button,x:number,y:number,identity:Partial<Press>){
    cancel();clearRelease();const bounds=button.getBoundingClientRect();
    const press:Press={button,bounds,ink:null,x,y,...identity};active=press;
    if(getComputedStyle(button).position==='static')button.style.position='relative';
    button.classList.add('fmc-press-target');button.setAttribute('data-fmc-pressed','');
    if(motion.matches)return;
    const originX=(x-bounds.left)/bounds.width,originY=(y-bounds.top)/bounds.height;
    press.timer=setTimeout(()=>{
      if(active!==press||!button.isConnected)return;
      // Normalize to unscaled CSS pixels (welcome/face layouts use a scaled phone canvas).
      const w=button.offsetWidth,h=button.offsetHeight,lx=Math.max(0,Math.min(w,originX*w)),ly=Math.max(0,Math.min(h,originY*h));
      const size=Math.hypot(Math.max(lx,w-lx),Math.max(ly,h-ly))*2;
      const ink=root.createElement('span');ink.className='fmc-press-ripple';ink.setAttribute('aria-hidden','true');
      const rgb=(getComputedStyle(button).color.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
      ink.style.setProperty('--ink-color',rgb.length===3&&rgb.reduce((a,b)=>a+b,0)>600?'rgba(255,255,255,.24)':'rgba(0,70,170,.17)');
      ink.style.width=ink.style.height=size+'px';ink.style.left=(lx-size/2)+'px';ink.style.top=(ly-size/2)+'px';button.appendChild(ink);press.ink=ink;
    },200);
  }
  const passive={passive:true,signal:listeners.signal},capture={...passive,capture:true};
  root.addEventListener('pointerdown',event=>{
    if(event.isPrimary)lastPointerType=event.pointerType;
    if(!event.isPrimary||event.button!==0)return;clearRelease();const button=eligible(event);if(!button)return;
    begin(button,event.clientX,event.clientY,{pointerId:event.pointerId,pointerType:event.pointerType});
    try{button.setPointerCapture(event.pointerId);}catch{}
  },passive);
  root.addEventListener('pointermove',event=>{
    if(!active||active.pointerId!==event.pointerId)return;const b=active.bounds;
    if((event.pointerType==='mouse'&&event.buttons===0)||Math.hypot(event.clientX-active.x,event.clientY-active.y)>10||event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)cancel();
  },passive);
  root.addEventListener('pointerup',event=>{
    if(!active||active.pointerId!==event.pointerId)return;const p=active,b=p.bounds;
    const inside=event.clientX>=b.left&&event.clientX<=b.right&&event.clientY>=b.top&&event.clientY<=b.bottom;
    const activate=inside&&p.button.isConnected&&!p.button.matches(':disabled,[aria-disabled="true"]')&&(p.pointerType==='touch'||p.pointerType==='pen');
    remember(p,inside,activate);release();if(activate)p.button.click();
  },capture);
  for(const type of ['pointercancel','lostpointercapture'] as const)root.addEventListener(type,event=>{if(active?.pointerId===event.pointerId)cancel();},capture);
  root.addEventListener('keydown',event=>{if(event.repeat||![' ','Enter'].includes(event.key))return;const button=eligible(event);if(!button)return;const b=button.getBoundingClientRect();begin(button,b.left+b.width/2,b.top+b.height/2,{key:event.key});},{capture:true,signal:listeners.signal});
  root.addEventListener('keyup',event=>{if(active?.key===event.key)release();},{capture:true,signal:listeners.signal});
  root.addEventListener('focusout',event=>{if(active?.key&&event.target===active.button)cancel();},{signal:listeners.signal});
  root.addEventListener('click',event=>{
    const button=eligible(event),r=released;
    if(event.isTrusted&&r&&(('pointerId' in event&&event.pointerId===r.pointerId)||(event.detail!==0&&r.button===button))){clearRelease();if(r.activated||!r.inside){event.preventDefault();event.stopImmediatePropagation();}}
  },{capture:true,signal:listeners.signal});
  root.addEventListener('contextmenu',event=>{if(['touch','pen'].includes(lastPointerType)&&eligible(event))event.preventDefault();},{signal:listeners.signal});
  root.addEventListener('dragstart',event=>{event.preventDefault();cancel();},{capture:true,signal:listeners.signal});
  root.addEventListener('visibilitychange',()=>{if(root.hidden)cancel();},{signal:listeners.signal});
  window.addEventListener('blur',cancel,{signal:listeners.signal});window.addEventListener('pagehide',cancel,{signal:listeners.signal});
  motion.addEventListener('change',cancel,{signal:listeners.signal});
  const observer=new MutationObserver(()=>{if(active&&(!active.button.isConnected||active.button.matches(':disabled,[aria-disabled="true"]')))cancel();});
  observer.observe(root.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','aria-disabled']});
  return()=>{cancel();clearRelease();observer.disconnect();listeners.abort();};
}
