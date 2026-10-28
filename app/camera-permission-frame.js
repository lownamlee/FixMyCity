(() => {
  'use strict';
  const gate = document.getElementById('camera-permission');
  if (!gate || gate.closest('.permission-device')) return;

  // Presentation only: preserve the existing permission controls and listeners.
  const device = document.createElement('div');
  device.className = 'permission-device';
  device.innerHTML = `<div class="permission-viewport"><div class="permission-canvas">
    <div class="permission-notch" aria-hidden="true"></div>
    <div class="permission-status" aria-hidden="true">
      <span class="permission-time">9:41</span>
      <span class="permission-status-icons">
        <svg width="19" height="14" viewBox="0 0 19 14" fill="currentColor"><rect x="0" y="9" width="3" height="5" rx=".7"/><rect x="5" y="6" width="3" height="8" rx=".7"/><rect x="10" y="3" width="3" height="11" rx=".7"/><rect x="15" y="0" width="3" height="14" rx=".7"/></svg>
        <svg width="19" height="14" viewBox="0 0 20 15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M2 4.4a12.5 12.5 0 0 1 16 0M5 7.5a8 8 0 0 1 10 0M8 10.5a3.2 3.2 0 0 1 4 0"/><circle cx="10" cy="13" r=".7" fill="currentColor" stroke="none"/></svg>
        <svg width="26" height="13" viewBox="0 0 29 14" fill="none"><rect x=".7" y=".7" width="24" height="12.6" rx="3" stroke="currentColor" opacity=".65"/><rect x="2.5" y="2.5" width="20.5" height="9" rx="1.5" fill="currentColor"/><path d="M26.3 4.5v5a2.5 2.5 0 0 0 0-5" fill="currentColor" opacity=".6"/></svg>
      </span>
    </div>
  </div></div>`;
  gate.before(device);
  const canvas = device.querySelector('.permission-canvas');
  canvas.append(gate);

  function layout() {
    const mobile = innerWidth <= 520;
    if (mobile) {
      const width = document.documentElement.clientWidth;
      const ratio = width / 390;
      const height = Math.max(innerHeight, 700 * ratio);
      device.style.width = `${width}px`;
      device.style.height = `${height}px`;
      canvas.style.height = `${height / ratio}px`;
      canvas.style.transform = `scale(${ratio})`;
    } else {
      // Keep these dimensions identical to welcome.js's single-phone layout.
      const ratio = Math.max(.22, Math.min(1, (innerWidth - 66) / 390, (innerHeight - 70) / 844));
      device.style.width = `${390 * ratio}px`;
      device.style.height = `${844 * ratio}px`;
      canvas.style.height = '844px';
      canvas.style.transform = `scale(${ratio})`;
    }
  }
  addEventListener('resize', layout, {passive:true});
  layout();
})();
