(() => {
  'use strict';
  const base = new URL('./', document.currentScript.src);
  const key = 'fixmycity2-onboarding-v1';
  const activityKey = 'fixmycity2-last-active';
  const introKey = 'fixmycity2-intro-seen';
  const returnKey = 'fixmycity2-return-route';
  const guestKey = 'fixmycity2-guest-mode-v1';
  const pages = new Set(['', 'welcome', 'scan-card', 'scan-face', 'home']);
  const pageName = path => { const name = path.replace(/\/$/, '').split('/').pop().replace(/\.html$/, ''); return name === 'index' ? '' : name; };
  const file = pageName(location.pathname);
  // Public onboarding can paint while the server checks the next permitted route.
  // Hiding the whole document here replaced the phone with a full-screen flash.
  const publicOnboarding = file === '' || file === 'welcome';
  const read = (store, name) => { try { return store.getItem(name); } catch { return null; } };
  const write = (store, name, value) => { try { store.setItem(name, value); } catch {} };
  const remove = (store, name) => { try { store.removeItem(name); } catch {} };
  function readProgress(store) {
    try {
      const saved = JSON.parse(read(store, key) || 'null');
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return null;
      // Welcome is a UI preference. Never restore local IC/face flags as verification.
      return { welcome: saved.welcome === true };
    } catch { return null; }
  }
  let state = readProgress(localStorage) || readProgress(sessionStorage) || {};
  // Explicitly skipping onboarding grants UI access, never an identity receipt.
  let guest = read(localStorage, guestKey) === '1' || read(sessionStorage, guestKey) === '1';
  let session = null, loggingOut = false, pendingSession = null, pendingLogout = null, readyResolved = false;
  let gate = null, gateRequest = null;
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  function saveProgress(value) { write(localStorage, key, value); write(sessionStorage, key, value); }
  // Discard legacy demo completion flags without retaining identity media or server receipts.
  saveProgress(JSON.stringify({ welcome: !!state.welcome }));
  const last = Number(read(sessionStorage, activityKey));
  const age = Date.now() - last;
  const skipIntro = read(sessionStorage, introKey) === '1' && last > 0 && age >= 0 && age < 300000;
  if (!publicOnboarding) document.documentElement.style.visibility = 'hidden';

  function safeTarget(path) {
    const url = new URL(path, base);
    const raw = url.pathname.slice(base.pathname.length).replace(/\/$/, '').replace(/\.html$/, '');
    const relative = raw === 'index' ? '' : raw;
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || !pages.has(relative)) throw new Error('Unknown app page');
    url.pathname = base.pathname + relative;
    return url;
  }
  function touch() { if (!loggingOut) write(sessionStorage, activityKey, String(Date.now())); }
  function announce(name, detail) { window.dispatchEvent(new CustomEvent(name, { detail })); }
  function clearGate(reveal = true) {
    gateRequest = null;
    gate?.remove(); gate = null;
    if (reveal) document.documentElement.style.visibility = '';
  }
  function showGate(title, message, retry, retryLabel = 'Try again', dismiss = null) {
    document.documentElement.style.visibility = 'hidden';
    gateRequest = { title, message, retry, retryLabel, dismiss };
    function renderGate() {
      if (!gateRequest || !document.body) return;
      const request = gateRequest;
      if (!document.getElementById('fmc-session-style')) {
        const style = document.createElement('style'); style.id = 'fmc-session-style';
        style.textContent = '.fmc-session-gate{visibility:visible;position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:32px;box-sizing:border-box;background:#f6f9ff;color:#101b35;text-align:center;font-family:Inter,Arial,sans-serif}.fmc-session-gate h1{font-size:26px;line-height:1.2;letter-spacing:-.5px;margin:0;max-width:440px}.fmc-session-gate p{font-size:16px;line-height:1.55;color:#526887;max-width:440px;margin:0}.fmc-session-gate button{font:600 16px Inter,Arial,sans-serif;border:0;border-radius:14px;padding:14px 28px;background:#0064ff;color:#fff;cursor:pointer;min-width:180px}.fmc-session-gate button:focus-visible{outline:3px solid #ffbf00;outline-offset:3px}.fmc-session-gate .fmc-session-cancel{color:#0053cf;background:#e5efff}.fmc-session-gate[aria-busy=true]:before{content:"";width:38px;height:38px;border:4px solid #deebff;border-top-color:#0064ff;border-radius:50%;animation:fmc-session-spin .8s linear infinite}@keyframes fmc-session-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.fmc-session-gate[aria-busy=true]:before{animation:none}}';
        document.head.appendChild(style);
      }
      gate?.remove();
      gate = document.createElement('section'); gate.id = 'fmc-session-gate'; gate.className = 'fmc-session-gate';
      gate.setAttribute('role', 'dialog'); gate.setAttribute('aria-modal', 'true'); gate.setAttribute('aria-labelledby', 'fmc-session-title'); gate.setAttribute('aria-busy', String(!request.retry));
      const heading = document.createElement('h1'); heading.id = 'fmc-session-title'; heading.textContent = request.title;
      const text = document.createElement('p'); text.textContent = request.message;
      gate.append(heading, text);
      if (request.retry) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = request.retryLabel;
        button.addEventListener('click', request.retry); gate.append(button);
      }
      if (request.dismiss) {
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'fmc-session-cancel'; cancel.textContent = 'Back to app';
        cancel.addEventListener('click', request.dismiss); gate.append(cancel);
      }
      document.body.appendChild(gate);
    }
    if (document.body) renderGate();
    else document.addEventListener('DOMContentLoaded', renderGate, { once: true });
  }
  function normalizeSession(data) {
    if (!data || typeof data.verified !== 'boolean' || typeof data.icPassed !== 'boolean' || (data.verified && !data.icPassed)) throw new Error('The session response could not be confirmed.');
    const result = { verified: data.verified, icPassed: data.icPassed, status: typeof data.status === 'string' ? data.status : data.verified ? 'verified' : data.icPassed ? 'face' : 'new' };
    if (typeof data.icFrontPassed === 'boolean') result.icFrontPassed = data.icFrontPassed;
    if (typeof data.faceToken === 'string') result.faceToken = data.faceToken;
    if (typeof data.faceCheck === 'string') result.faceCheck = data.faceCheck;
    if (typeof data.faceMatched === 'boolean') result.faceMatched = data.faceMatched;
    for (const name of ['cardChallenge', 'faceChallenge']) {
      if (Array.isArray(data[name])) result[name] = Object.freeze(data[name].filter(step => step && typeof step.step === 'string' && typeof step.instruction === 'string').map(step => Object.freeze({ step: step.step, instruction: step.instruction })));
    }
    if (typeof data.expiresAt === 'string') result.expiresAt = data.expiresAt;
    return Object.freeze(result);
  }
  function getSession() { return session; }
  function navigate(url, replace = false) { touch(); if (replace) location.replace(url.href); else location.assign(url.href); }
  function nextStage() {
    if (session?.verified || guest) return 'home#home';
    if (session?.icPassed) return 'scan-face';
    if (!state.welcome) return 'welcome';
    return 'scan-card';
  }
  function guardPage() {
    if (!session || loggingOut) return false;
    if ((session.verified || guest) && file !== 'home') {
      document.documentElement.style.visibility = 'hidden';
      clearGate(false); navigate(safeTarget('home#home'), true); return true;
    }
    if (file === 'home' && !session.verified && !guest || file === 'scan-face' && !session.icPassed || file === 'scan-card' && !state.welcome && !session.icPassed) {
      if (file === 'home') rememberRoute();
      clearGate(false); navigate(safeTarget('./'), true); return true;
    }
    clearGate();
    return false;
  }
  async function requestJSON(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(new URL(path, base), { credentials: 'same-origin', cache: 'no-store', ...options, signal: controller.signal });
      if (!response.ok) throw new Error('The identity service could not be reached.');
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  function refreshSession() {
    if (pendingSession) return pendingSession;
    pendingSession = (async () => {
      const confirmed = normalizeSession(await requestJSON('api/session'));
      session = confirmed;
      if (!readyResolved) { readyResolved = true; resolveReady(confirmed); }
      announce('fixmycity:session-state', confirmed);
      guardPage();
      return confirmed;
    })().finally(() => { pendingSession = null; });
    return pendingSession;
  }
  async function checkSession() {
    if (loggingOut) return;
    if (!publicOnboarding) showGate('Checking your session', 'Please wait while we confirm your access.');
    try { await refreshSession(); }
    catch {
      // Do not unlock Home from a cached/local completion flag while offline.
      session = null;
      showGate('Reconnect to continue', 'Connect to the internet so FixMyCity can confirm your verification session. Your camera and identity photos are not stored on this device.', () => { void checkSession(); });
      announce('fixmycity:session-unavailable', { verified: false });
    }
  }
  function complete(stage) {
    if (stage !== 'welcome') return false;
    state.welcome = true;
    saveProgress(JSON.stringify({ welcome: true })); touch();
    return true;
  }
  async function skipVerification() {
    await ready;
    if (!session || loggingOut) return;
    complete('welcome');
    guest = !session.verified;
    if (guest) {
      write(localStorage, guestKey, '1');
      write(sessionStorage, guestKey, '1');
    }
    navigate(safeTarget('home#home'));
  }
  async function go(path, options = {}) {
    const url = safeTarget(path);
    await ready;
    // A failed later revalidation must not reuse the once-resolved ready promise.
    if (!session || loggingOut) return;
    const target = pageName(url.pathname);
    if ((session.verified || guest) && target !== 'home') {
      navigate(safeTarget('home#home'), !!options.replace); return;
    }
    if (target === 'home' && !session?.verified && !guest || target === 'scan-face' && !session?.icPassed) {
      navigate(safeTarget(nextStage()), !!options.replace); return;
    }
    navigate(url, !!options.replace);
  }
  function back(fallback = './') {
    let internal = false;
    try { const ref = new URL(document.referrer); internal = ref.origin === base.origin && ref.pathname.startsWith(base.pathname); } catch {}
    if (history.length > 1 && (history.state?.fmc2 || history.state?.fmc || internal)) history.back();
    else void go(fallback, { replace: true });
  }
  function markIntroSeen() { write(sessionStorage, introKey, '1'); touch(); }
  async function afterIntro() { await ready; markIntroSeen(); await go(nextStage(), { replace: true }); }
  function rememberRoute() { if (!loggingOut && pageName(location.pathname) === 'home') write(sessionStorage, returnKey, 'home' + location.hash); }
  function clearLocalSession() {
    state = {}; guest = false; saveProgress('{}');
    for (const store of [localStorage, sessionStorage]) for (const name of [guestKey, introKey, activityKey, returnKey, 'fixmycity2-app-progress-v1', 'fixmycity2-identity-consent-v1', 'fixmycity2-identity-consent-v2']) remove(store, name);
  }
  function logout() {
    if (pendingLogout) return pendingLogout;
    loggingOut = true;
    showGate('Signing out', 'Please wait while your verification session is closed.');
    announce('fixmycity:logout-state', { pending: true });
    pendingLogout = (async () => {
      try {
        const result = await requestJSON('api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        if (result?.loggedOut !== true || result?.verified !== false) throw new Error('Sign out was not confirmed.');
        clearLocalSession();
        session = Object.freeze({ verified: false, icPassed: false, status: 'new' });
        announce('fixmycity:logout-state', { pending: false, loggedOut: true });
        location.replace(safeTarget('./?replay=1').href);
        return { loggedOut: true };
      } catch {
        loggingOut = false;
        showGate('Couldn’t confirm sign out', 'Your session may still be active. Connect to the internet and try again to finish signing out.', () => { void logout(); }, 'Retry sign out', () => clearGate());
        announce('fixmycity:logout-state', { pending: false, loggedOut: false });
        return { loggedOut: false };
      } finally { pendingLogout = null; }
    })();
    return pendingLogout;
  }
  window.FMCFlow = Object.freeze({ ready, getSession, refreshSession, go, back, complete, skipVerification, isGuest: () => guest, afterIntro, markIntroSeen, shouldSkipIntro: () => !loggingOut && !!session && (session.verified || guest || skipIntro), rememberRoute, restart: logout, logout, isLoggingOut: () => loggingOut });
  if (file === 'home') rememberRoute();
  addEventListener('pageshow', event => { if (event.persisted && !loggingOut) void checkSession(); });
  addEventListener('pagehide', () => { rememberRoute(); touch(); });
  addEventListener('visibilitychange', () => { if (document.hidden) { rememberRoute(); touch(); } });
  addEventListener('hashchange', rememberRoute);
  void checkSession();
})();

