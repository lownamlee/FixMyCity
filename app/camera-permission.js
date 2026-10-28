(() => {
  'use strict';
  const video = document.querySelector('[data-camera-video]');
  const gate = document.getElementById('camera-permission');
  const title = document.getElementById('camera-permission-title');
  const message = document.getElementById('camera-permission-message');
  const button = document.getElementById('camera-enable');
  const settings = document.getElementById('camera-settings-help');
  const facingMode = document.body.dataset.cameraFacing || 'user';
  const listeners = new Set();
  let stream = null, status = 'idle', permission = null, generation = 0, requesting = false;
  const ready = () => status === 'ready' && !document.hidden && !!stream?.getVideoTracks().some(track => track.readyState === 'live');
  function snapshot() { return Object.freeze({ready:ready(),status}); }
  function notify() { for(const fn of listeners) fn(snapshot()); }
  function stopTracks() {
    const old = stream; stream = null;
    if(video) video.srcObject = null;
    old?.getTracks().forEach(track => track.stop());
  }
  function show(kind, heading, text) {
    status = kind;
    document.body.classList.add('camera-blocked');
    gate.hidden = false;
    title.textContent = heading; message.textContent = text;
    button.disabled = requesting;
    button.textContent = requesting ? 'Opening camera…' : kind === 'idle' ? 'Enable camera' : 'Try again';
    settings.hidden = !['denied','revoked','paused'].includes(kind);
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    notify();
  }
  function block(kind = 'paused', heading = 'Camera access required', text = 'Enable the camera before continuing with this scan.') {
    generation++; requesting = false; stopTracks(); show(kind,heading,text);
  }
  function requireCamera() {
    if(ready()) return true;
    if(status === 'ready') block('revoked','Camera disconnected','Your camera stopped. Check the camera permission in your browser settings, then try again.');
    else { document.body.classList.add('camera-blocked'); gate.hidden=false; title.focus({preventScroll:true}); }
    return false;
  }
  async function request(explicit = false) {
    if(requesting || ready() || document.hidden) return ready();
    if(!explicit && permission?.state !== 'granted') return false;
    if(!window.isSecureContext) { block('insecure','A secure connection is required','Open FixMyCity using HTTPS, then enable the camera. Camera access is unavailable on this connection.'); return false; }
    if(!navigator.mediaDevices?.getUserMedia) { block('unsupported','Camera access is unavailable','Open this page in a current Safari, Chrome, or Edge browser with camera support.'); return false; }
    const token = ++generation;
    requesting = true; show('requesting','Allow camera access','Choose Allow in the browser’s camera permission prompt to continue.');
    try {
      const next = await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facingMode},width:{ideal:1280},height:{ideal:960}}});
      if(token !== generation || document.hidden) { next.getTracks().forEach(track=>track.stop()); return false; }
      if(!next.getVideoTracks().some(track=>track.readyState==='live')) { next.getTracks().forEach(track=>track.stop()); throw Object.assign(new Error('No live camera track'),{name:'NotReadableError'}); }
      stream=next;
      for(const track of next.getVideoTracks()) track.addEventListener('ended',()=>{if(stream===next)block('revoked','Camera disconnected','Your camera stopped. Allow camera access in your browser settings, then try again.');});
      video.srcObject=next; video.muted=true; video.playsInline=true;
      await video.play();
      if(token !== generation || document.hidden) { if(stream===next)stopTracks(); else next.getTracks().forEach(track=>track.stop()); return false; }
      requesting=false;status='ready';gate.hidden=true;document.body.classList.remove('camera-blocked');notify();return true;
    } catch(error) {
      if(token !== generation) return false;
      requesting=false;stopTracks();
      const errors={
        NotAllowedError:['denied','Camera permission needed','Camera access was not allowed. Enable Camera in your browser’s settings for this site, then return here and try again.'],
        PermissionDeniedError:['denied','Camera permission needed','Enable Camera in your browser’s settings for this site, then try again.'],
        NotFoundError:['missing','No camera found','Connect or enable a camera on this device, then try again.'],
        DevicesNotFoundError:['missing','No camera found','Connect or enable a camera on this device, then try again.'],
        NotReadableError:['busy','Camera is unavailable','Another app may be using the camera. Close it, check your device’s camera privacy settings, then try again.'],
        TrackStartError:['busy','Camera is unavailable','Close other apps using the camera and check your device’s camera privacy settings.'],
        SecurityError:['denied','Camera access is blocked','Allow Camera for this site in your browser settings, then try again.'],
        OverconstrainedError:['missing','Camera could not start','This camera cannot provide the requested video. Try another camera or browser.']
      };
      show(...(errors[error.name]||['error','Camera could not start','Check your camera and browser permission, then try again.']));return false;
    }
  }
  async function checkPermission() {
    if(document.hidden) return;
    if(!window.isSecureContext) { block('insecure','A secure connection is required','Open FixMyCity using HTTPS, then enable the camera.'); return; }
    try {
      if(!permission && navigator.permissions?.query) {
        permission=await navigator.permissions.query({name:'camera'});
        permission.addEventListener('change',()=>{
          if(permission.state==='granted') { if(!document.hidden) request(false); }
          else block(permission.state==='denied'?'denied':'revoked','Camera permission needed','Enable Camera for this site in your browser settings before continuing.');
        });
      }
      if(permission?.state==='granted') await request(false);
      else if(permission?.state==='denied') block('denied','Camera permission needed','Enable Camera for this site in your browser settings, then return here and try again.');
      // Unsupported Permissions API: keep the explicit Enable/Try again action.
    } catch { /* Safari may not support querying camera permission. */ }
  }
  function capture(frameElement, options = {}) {
    if(!requireCamera() || !video.videoWidth || !video.videoHeight) return null;
    let x=0,y=0,w=video.videoWidth,h=video.videoHeight;
    if(frameElement) {
      const bounds=video.getBoundingClientRect(),frame=frameElement.getBoundingClientRect();
      const scale=Math.max(bounds.width/w,bounds.height/h);
      x=Math.max(0,(frame.left-bounds.left+(w*scale-bounds.width)/2)/scale);
      y=Math.max(0,(frame.top-bounds.top+(h*scale-bounds.height)/2)/scale);
      w=Math.min(w-x,frame.width/scale);h=Math.min(h-y,frame.height/scale);
    }
    if(w<=0||h<=0)return null;
    const maxWidth=Math.max(320,Math.min(1280,options.maxWidth||1200));
    const canvas=document.createElement('canvas'),scale=Math.min(1,maxWidth/w);
    canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);
    canvas.getContext('2d').drawImage(video,x,y,w,h,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',Math.max(.5,Math.min(.92,options.quality||.88)));
  }
  function captureSample(options) {
    if(!ready() || video.paused || video.ended || video.readyState < 2) return null;
    const mediaTime=video.currentTime, capturedAt=Date.now();
    const image=capture(null,options);
    return image ? {image,mediaTime,capturedAt} : null;
  }
  window.FMCCamera=Object.freeze({ready,require:requireCamera,request:()=>request(true),capture,captureSample,subscribe(fn){listeners.add(fn);fn(snapshot());return()=>listeners.delete(fn);},stop:()=>block()});
  button.addEventListener('click',()=>request(true));
  document.getElementById('camera-permission-back').addEventListener('click',()=>{
    const target=facingMode==='environment'?'welcome#welcome-3':'scan-card#review';
    if(window.FMCFlow)window.FMCFlow.back(target);else location.assign(target);
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)block('paused','Camera paused','Your camera is paused while this page is hidden. Return here to continue.');else checkPermission();});
  addEventListener('pagehide',()=>block('paused','Camera paused','Enable the camera to continue.'));
  addEventListener('pageshow',event=>{if(event.persisted)checkPermission();});
  show('idle','Enable your camera',facingMode==='environment'?'Camera access is required to photograph the front and back of your MyKad.':'Camera access is required to continue with the face scan.');
  checkPermission();
})();
