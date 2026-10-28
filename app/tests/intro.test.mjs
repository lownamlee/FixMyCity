import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../intro.js', import.meta.url), 'utf8');
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

function harness({ reduced = false, skip = false, initError = false, sessionReady = Promise.resolve(), withFlow = true } = {}) {
  let now = 0, serial = 0, failDrawing = false;
  const timers = new Map(), frames = new Map(), elements = new Map(), documentEvents = new Map(), motionEvents = new Map();
  const handoffs = [], replacements = [];
  let seen = 0;
  const element = id => {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, {
        id, style: {}, dataset: { delay: '0', x: '300', y: '200', rotate: '12' }, attributes: {},
        clientWidth: 390, clientHeight: 844,
        classList: { add: name => classes.add(name), contains: name => classes.has(name), toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); } },
        setAttribute(name, value) { this.attributes[name] = value; },
        getScreenCTM: () => null,
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
        getTotalLength() { if (initError) throw new Error('SVG geometry unavailable'); return 1000; },
        getPointAtLength(distance) { if (failDrawing) throw new Error('SVG drawing failed'); return { x: distance, y: 300 }; },
      });
    }
    return elements.get(id);
  };
  const document = {
    hidden: false, body: element('body'),
    getElementById: element,
    querySelectorAll: selector => selector === '.letter' ? Array.from({ length: 9 }, (_, i) => element('letter-' + i)) : [element('accent-1')],
    addEventListener(name, fn) { const list = documentEvents.get(name) || []; list.push(fn); documentEvents.set(name, list); },
  };
  const motion = { matches: reduced, addEventListener(name, fn) { const list = motionEvents.get(name) || []; list.push(fn); motionEvents.set(name, list); } };
  const context = {
    document, location: { search: '', replace: path => replacements.push({ path, at: now }) },
    URLSearchParams, innerWidth: 390, innerHeight: 844,
    performance: { now: () => now },
    getComputedStyle: () => ({ getPropertyValue: () => '0' }),
    matchMedia: () => motion, addEventListener() {},
    setTimeout(fn, delay) { const id = ++serial; timers.set(id, { at: now + delay, fn }); return id; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame(fn) { const id = ++serial; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id),
  };
  context.window = context;
  if (withFlow) context.FMCFlow = {
    ready: sessionReady, shouldSkipIntro: () => skip,
    markIntroSeen: () => { seen++; },
    afterIntro: () => { handoffs.push({ at: now }); },
  };
  vm.runInNewContext(source, context, { filename: 'intro.js' });
  function advanceTo(target) {
    assert.ok(target >= now, 'test clock must move forwards');
    for (;;) {
      const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [id, timer] = next;
      now = timer.at; timers.delete(id); timer.fn();
    }
    now = target;
  }
  return {
    context, document, element, handoffs, replacements, timers, frames,
    get seen() { return seen; },
    advanceTo,
    frameAt(target) { advanceTo(target); const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now)); },
    hide(value) { document.hidden = value; for (const fn of documentEvents.get('visibilitychange') || []) fn(); },
    reduce(value) { motion.matches = value; for (const fn of motionEvents.get('change') || []) fn(); },
    breakDrawing() { failDrawing = true; },
  };
}

test('normal reveal hands off at 3260 ms without an additional logo hold', async () => {
  const app = harness(); await flush();
  for (const at of [0, 800, 1600, 2700, 3160, 3259]) app.frameAt(at);
  assert.deepEqual(app.handoffs, [], 'welcome must wait for the full reveal');
  assert.equal(app.element('skyline').style.strokeDashoffset, '0.00000');
  assert.equal(app.element('tagline').style.opacity, '1.0000');
  app.frameAt(3260);
  assert.deepEqual(app.handoffs, [{ at: 3260 }]);
  assert.equal(app.seen, 1);
  assert.equal(app.context.FixMyCityIntro.completed, true);
  app.frameAt(6400); app.advanceTo(10_000);
  assert.equal(app.handoffs.length, 1, 'the watchdog must not navigate a second time');
});

test('reduced-motion visitors progress quickly without waiting for animation frames', async () => {
  const app = harness({ reduced: true }); await flush();
  assert.equal(app.frames.size, 0);
  assert.equal(app.element('tagline').style.opacity, '1.0000');
  app.advanceTo(349); assert.equal(app.handoffs.length, 0);
  app.advanceTo(350);
  assert.deepEqual(app.handoffs, [{ at: 350 }]);
  assert.equal(app.context.FixMyCityIntro.completed, true);
});

test('enabling reduced motion during the reveal cancels movement and still advances', async () => {
  const app = harness(); await flush(); app.frameAt(900);
  app.reduce(true);
  assert.equal(app.frames.size, 0);
  app.advanceTo(1250);
  assert.deepEqual(app.handoffs, [{ at: 1250 }]);
  assert.equal(app.element('scene').dataset.phase, 'reduced-motion');
});

test('SVG initialization failure falls back to welcome instead of stranding the visitor', async () => {
  const app = harness({ initError: true }); await flush();
  assert.equal(app.document.body.classList.contains('intro-static'), true);
  app.advanceTo(1200);
  assert.deepEqual(app.handoffs, [{ at: 1200 }]);
  app.advanceTo(10_000); assert.equal(app.handoffs.length, 1);
});

test('an SVG error during playback falls back and hands off once', async () => {
  const app = harness(); await flush(); app.frameAt(900);
  app.breakDrawing(); app.frameAt(1400);
  assert.equal(app.document.body.classList.contains('intro-static'), true);
  app.advanceTo(2199); assert.equal(app.handoffs.length, 0);
  app.advanceTo(2200);
  assert.deepEqual(app.handoffs, [{ at: 2200 }]);
  assert.equal(app.context.FixMyCityIntro.completed, true);
  app.advanceTo(10_000); assert.equal(app.handoffs.length, 1);
});

test('a stopped animation-frame scheduler cannot leave the intro open indefinitely', async () => {
  const app = harness(); await flush();
  // Simulate a rendering engine that never delivers the requested frame callback.
  app.advanceTo(5000);
  assert.equal(app.handoffs.length, 1);
  assert.ok(app.handoffs[0].at < 5000);
  assert.equal(app.context.FixMyCityIntro.completed, true);
});

test('hidden time does not consume the reveal and visible playback resumes where it paused', async () => {
  const app = harness(); await flush(); app.frameAt(1000);
  app.hide(true);
  assert.equal(app.frames.size, 0); assert.equal(app.timers.size, 0);
  app.advanceTo(20_000);
  assert.equal(app.handoffs.length, 0);
  assert.equal(app.context.FixMyCityIntro.time, 1000);
  app.hide(false); app.frameAt(22_259);
  assert.equal(app.handoffs.length, 0);
  app.frameAt(22_260);
  assert.deepEqual(app.handoffs, [{ at: 22_260 }]);
});

test('session validation finishes before the reveal starts, and returning users skip it', async () => {
  let confirm;
  const sessionReady = new Promise(resolve => { confirm = resolve; });
  const app = harness({ sessionReady, skip: true }); await flush();
  app.advanceTo(10_000);
  assert.equal(app.frames.size, 0); assert.equal(app.timers.size, 0); assert.equal(app.handoffs.length, 0);
  confirm(); await flush();
  assert.deepEqual(app.handoffs, [{ at: 10_000 }]);
  assert.equal(app.frames.size, 0);
});

test('standalone intro fallback uses the clean welcome URL', async () => {
  const app = harness({ withFlow: false, reduced: true }); await flush();
  app.advanceTo(350);
  assert.deepEqual(app.replacements, [{ path: 'welcome#welcome-1', at: 350 }]);
});
