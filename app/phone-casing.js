(() => {
  'use strict';
  const frames = [];
  function frame(content, kind, status = true) {
    if (!content || content.closest('.app-phone-case')) return;
    const device = document.createElement('div');
    device.className = `app-phone-case app-phone-case-${kind}`;
    if (content.classList.contains('camera-app-content')) device.classList.add('camera-app-content');
    device.innerHTML = `<div class="app-phone-viewport"><div class="app-phone-canvas">
      <div class="app-phone-notch" aria-hidden="true"></div>
      ${status ? `<div class="app-phone-status" aria-hidden="true"><span>9:41</span><span class="app-phone-status-icons">
        <svg viewBox="0 0 19 14" fill="currentColor"><rect y="9" width="3" height="5" rx=".7"/><rect x="5" y="6" width="3" height="8" rx=".7"/><rect x="10" y="3" width="3" height="11" rx=".7"/><rect x="15" width="3" height="14" rx=".7"/></svg>
        <svg viewBox="0 0 20 15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M2 4.4a12.5 12.5 0 0 1 16 0M5 7.5a8 8 0 0 1 10 0M8 10.5a3.2 3.2 0 0 1 4 0"/><circle cx="10" cy="13" r=".7" fill="currentColor" stroke="none"/></svg>
        <svg viewBox="0 0 29 14" fill="none"><rect x=".7" y=".7" width="24" height="12.6" rx="3" stroke="currentColor" opacity=".65"/><rect x="2.5" y="2.5" width="20.5" height="9" rx="1.5" fill="currentColor"/><path d="M26.3 4.5v5a2.5 2.5 0 0 0 0-5" fill="currentColor" opacity=".6"/></svg>
      </span></div>` : ''}
    </div></div>`;
    content.before(device);
    const canvas = device.querySelector('.app-phone-canvas');
    canvas.append(content);
    frames.push({device, canvas});
    document.body.classList.add('phone-casing-page');
    return canvas;
  }
  const cardCanvas = frame(document.querySelector('.page-card > main.phone'), 'card', false);
  if (cardCanvas) {
    const checking = document.getElementById('verification-checking');
    if (checking) cardCanvas.append(checking);
  }
  frame(document.getElementById('scene'), 'intro');
  frame(document.querySelector('.policy-shell'), 'privacy');
  const faceChecking = document.getElementById('face-checking');
  const faceScreen = document.querySelector('.page-face #scan-screen .screen');
  if (faceChecking && faceScreen) faceScreen.append(faceChecking);
  if (!frames.length) return;
  function layout() {
    const mobile = innerWidth <= 520;
    const width = document.documentElement.clientWidth;
    const ratio = mobile ? width / 390 : Math.max(.22, Math.min(1, (innerWidth - 66) / 390, (innerHeight - 70) / 844));
    const height = mobile ? Math.max(innerHeight, 700 * ratio) : 844 * ratio;
    for (const {device, canvas} of frames) {
      device.style.width = `${390 * ratio}px`;
      device.style.height = `${height}px`;
      canvas.style.height = `${height / ratio}px`;
      canvas.style.transform = `scale(${ratio})`;
    }
  }
  addEventListener('resize', layout, {passive:true});
  layout();
})();
