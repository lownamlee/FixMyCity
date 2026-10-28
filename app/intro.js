"use strict";
(async () => {
    "use strict";
    if (window.FMCFlow?.ready) await window.FMCFlow.ready;
    const entryParams = new URLSearchParams(location.search);
    if (!entryParams.has("frame") && !entryParams.has("replay") &&
        window.FMCFlow?.shouldSkipIntro?.() && window.FMCFlow?.afterIntro) {
        window.FMCFlow.afterIntro();
        return;
    }
    // Hand off as soon as the skyline, caption, and final settling motion finish.
    const DURATION = 6400;
    const PLAYBACK_DURATION = 3260;
    const HOLD_FRAME = 3260;
    const $ = (id) => document.getElementById(id);
    const night = $("night");
    const arrival = $("arrival");
    const trail = $("arrival-trail");
    const art = $("art");
    const scene = $("scene");
    const lockup = $("lockup");
    const logo = $("logo-motion");
    const skyline = $("skyline");
    const traveler = $("traveler");
    const startDot = $("i-dot-start");
    const endDot = $("i-dot-end");
    const tagline = $("tagline");
    const halo = $("halo");
    const ripple = $("ripple");
    const rippleTwo = $("ripple-two");
    const closing = $("closing-wipe");
    const letters = Array.from(document.querySelectorAll(".letter"));
    const accents = Array.from(document.querySelectorAll(".accent"));
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const lineLength = skyline.getTotalLength();
    const clamp = (x) => Math.max(0, Math.min(1, x));
    const phase = (t, a, b) => clamp((t - a) / (b - a));
    const lerp = (a, b, x) => a + (b - a) * x;
    const out = (x) => 1 - Math.pow(1 - x, 3);
    const smooth = (x) => x * x * (3 - 2 * x);
    const opacity = (el, value) => {
        el.style.opacity = value.toFixed(4);
    };
    let radius = 1000;
    let centerX = innerWidth / 2;
    let centerY = innerHeight / 2;
    let time = 0;
    let origin = performance.now();
    let offset = 0;
    let playing = true;
    let frameId = 0;
    let resumeOnVisible = false;
    let completed = false;
    let completionTimer = 0;
    function layout() {
        const width = scene.clientWidth;
        const height = scene.clientHeight;
        const safe = getComputedStyle(scene);
        const inset = (side) => parseFloat(safe.getPropertyValue(`padding-${side}`)) || 0;
        const left = inset("left"), right = inset("right"), top = inset("top"), bottom = inset("bottom");
        const safeWidth = Math.max(1, width - left - right);
        const safeHeight = Math.max(1, height - top - bottom);
        centerX = left + safeWidth / 2;
        centerY = top + safeHeight / 2;
        // Mobile bounds include the full 620-unit rings and all outward-moving accents.
        const compact = width <= 600 || (width <= 960 && height <= 600);
        const view = compact
            ? { x: -80, y: -280, width: 1360, height: 1280 }
            : { x: 0, y: 0, width: 1200, height: 720 };
        const scale = Math.max(0, Math.min((safeWidth - 40) / view.width, (safeHeight - 48) / view.height, 0.75));
        art.setAttribute("viewBox", `${view.x} ${view.y} ${view.width} ${view.height}`);
        lockup.classList.toggle("compact", compact);
        lockup.style.width = `${Math.max(1, view.width * scale)}px`;
        lockup.style.left = `${centerX}px`;
        lockup.style.top = `${centerY}px`;
        [arrival, trail].forEach((element) => {
            element.style.left = `${centerX}px`;
            element.style.top = `${centerY}px`;
        });
        radius =
            Math.max(Math.hypot(centerX, centerY), Math.hypot(width - centerX, centerY), Math.hypot(centerX, height - centerY), Math.hypot(width - centerX, height - centerY)) + 3;
        const matrix = art.getScreenCTM();
        const point = matrix
            ? new DOMPoint(879.092, 341.061).matrixTransform(matrix)
            : { x: centerX, y: centerY };
        const sceneBounds = scene.getBoundingClientRect();
        const x = (point.x - sceneBounds.left) / (sceneBounds.width / width || 1);
        const y = (point.y - sceneBounds.top) / (sceneBounds.height / height || 1);
        const edge = Math.max(Math.hypot(x, y), Math.hypot(width - x, y), Math.hypot(x, height - y), Math.hypot(width - x, height - y)) + 4;
        closing.style.width = `${edge * 2}px`;
        closing.style.height = `${edge * 2}px`;
        closing.style.left = `${x}px`;
        closing.style.top = `${y}px`;
    }
    function render(t) {
        time = ((t % DURATION) + DURATION) % DURATION;
        t = time;
        const still = reducedMotion.matches;
        const wipe = still ? 1 : out(phase(t, 560, 1240));
        night.style.clipPath = `circle(${(radius * wipe).toFixed(2)}px at ${centerX}px ${centerY}px)`;
        // The arriving yellow point provides the seed for the city reveal.
        const fall = phase(t, 40, 610);
        const fallY = -(centerY + 28) * (1 - fall * fall);
        const bounce = t > 610 && t < 850 ? -Math.sin(phase(t, 610, 850) * Math.PI) * 13 : 0;
        const arrivalAlpha = phase(t, 0, 65) * (1 - phase(t, 850, 930));
        opacity(arrival, still ? 0 : arrivalAlpha);
        arrival.style.transform = `translate(-50%,-50%) translateY(${fallY + bounce}px)`;
        const stretch = 0.45 + Math.sin(fall * Math.PI) * 0.55;
        opacity(trail, still ? 0 : phase(t, 90, 230) * (1 - phase(t, 540, 760)) * 0.78);
        trail.style.transform = `translate(-50%,-100%) translateY(${fallY - 22}px) scaleY(${stretch})`;
        // A soft impact ring and civic symbols echo the reference's burst.
        const burst = out(phase(t, 780, 2900));
        halo.setAttribute("r", String(lerp(24, 420, out(phase(t, 780, 2180)))));
        opacity(halo, still ? 0 : phase(t, 780, 980) * (1 - phase(t, 1140, 2290)) * 0.17);
        ripple.setAttribute("r", String(lerp(20, 620, burst)));
        opacity(ripple, still ? 0 : phase(t, 870, 1040) * (1 - phase(t, 1480, 2920)) * 0.28);
        rippleTwo.setAttribute("r", String(lerp(30, 550, out(phase(t, 1010, 3100)))));
        opacity(rippleTwo, still ? 0 : phase(t, 1010, 1220) * (1 - phase(t, 1570, 3100)) * 0.22);
        accents.forEach((el) => {
            const delay = Number(el.dataset.delay);
            const p = out(phase(t, 920 + delay, 2970 + delay));
            const x = lerp(600, Number(el.dataset.x), 0.48 + p * 0.6);
            const y = lerp(360, Number(el.dataset.y), 0.48 + p * 0.6);
            const angle = Number(el.dataset.rotate) * (0.4 + p);
            el.setAttribute("transform", `translate(${x} ${y}) rotate(${angle}) scale(${0.65 + p * 0.42})`);
            opacity(el, still
                ? 0
                : phase(t, 920 + delay, 1120 + delay) *
                    (1 - phase(t, 1720 + delay, 3020 + delay)) *
                    0.63);
        });
        const sceneAlpha = still ? 1 : 1 - smooth(phase(t, 5310, 5800));
        const settle = still ? 1 : 1 + 0.018 * (1 - smooth(phase(t, 2400, 3260)));
        logo.setAttribute("transform", `translate(600 360) scale(${settle}) translate(-600 -360)`);
        opacity(logo, sceneAlpha);
        const draw = still ? 1 : smooth(phase(t, 1320, 2700));
        skyline.style.strokeDashoffset = (1 - draw).toFixed(5);
        letters.forEach((el, index) => {
            const enter = still
                ? 1
                : out(phase(t, 1450 + index * 67, 2040 + index * 67));
            el.setAttribute("transform", `translate(0 ${((1 - enter) * 35).toFixed(3)})`);
            opacity(el, enter);
        });
        opacity(startDot, still ? 1 : phase(t, 1290, 1390));
        opacity(endDot, still ? 1 : phase(t, 2620, 2720));
        // The same point travels to the first i, then traces the skyline to the second.
        if (t < 1320) {
            const p = smooth(phase(t, 920, 1320));
            const q = 1 - p;
            traveler.setAttribute("cx", String(q * q * 550 + 2 * q * p * 335 + p * p * 121.221));
            traveler.setAttribute("cy", String(q * q * 360 + 2 * q * p * 140 + p * p * 341.061));
            traveler.setAttribute("r", "17.792");
        }
        else {
            const point = skyline.getPointAtLength(draw * lineLength);
            traveler.setAttribute("cx", String(point.x));
            traveler.setAttribute("cy", String(point.y));
            const tipSize = 7.5 + 10.292 * (1 - phase(draw, 0, 0.13) + phase(draw, 0.9, 1));
            traveler.setAttribute("r", String(tipSize));
        }
        opacity(traveler, still ? 0 : phase(t, 900, 950) * (1 - phase(t, 2680, 2730)));
        const caption = still ? 1 : out(phase(t, 2660, 3160));
        opacity(tagline, caption);
        tagline.setAttribute("transform", `translate(0 ${(1 - caption) * 12})`);
        // The outgoing circle lands on the same blue as the next cycle's first frame.
        const close = still ? 0 : smooth(phase(t, 5260, 6170));
        closing.style.transform = `translate(-50%,-50%) scale(${close})`;
        $("scene").dataset.phase = still
            ? "reduced-motion"
            : t < 920
                ? "arrival"
                : t < 2700
                    ? "city-reveal"
                    : t < 5260
                        ? "logo-hold"
                        : "reset";
    }
    function finish() {
        if (completed)
            return;
        try { render(HOLD_FRAME); }
        catch { document.body.classList.add('intro-static'); }
        pause();
        completed = true;
        window.FMCFlow?.markIntroSeen?.();
        if (window.FMCFlow?.afterIntro) window.FMCFlow.afterIntro();
        else location.replace("welcome#welcome-1");
    }
    function frame(now) {
        if (!playing || document.hidden || reducedMotion.matches || completed)
            return;
        const elapsed = offset + now - origin;
        try { render(Math.min(elapsed, HOLD_FRAME)); }
        catch {
            document.body.classList.add('intro-static');
            clearTimeout(completionTimer);
            completionTimer = setTimeout(finish, 800);
            return;
        }
        if (elapsed >= PLAYBACK_DURATION) {
            finish();
            return;
        }
        frameId = requestAnimationFrame(frame);
    }
    function pause() {
        clearTimeout(completionTimer);
        completionTimer = 0;
        if (playing)
            offset = time;
        playing = false;
        cancelAnimationFrame(frameId);
    }
    function play() {
        if (completed || (playing && frameId))
            return;
        origin = performance.now();
        playing = true;
        if (!reducedMotion.matches) {
            completionTimer = setTimeout(finish, Math.max(800, PLAYBACK_DURATION - offset + 1500));
            frameId = requestAnimationFrame(frame);
        } else
            completionTimer = setTimeout(finish, 350);
    }
    function seek(milliseconds) {
        pause();
        offset = Number.isFinite(Number(milliseconds)) ? Number(milliseconds) : 0;
        render(offset);
    }
    // Optional console hooks for embedding or capturing a particular frame.
    window.FixMyCityIntro = Object.freeze({
        duration: PLAYBACK_DURATION,
        play,
        pause,
        seek,
        get time() {
            return time;
        },
        get completed() {
            return completed;
        },
    });
    const resize = () => {
        layout();
        render(time);
    };
    addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            resumeOnVisible = playing;
            pause();
        }
        else if (resumeOnVisible) {
            resumeOnVisible = false;
            play();
        }
    });
    reducedMotion.addEventListener("change", () => {
        cancelAnimationFrame(frameId);
        frameId = 0;
        render(time);
        clearTimeout(completionTimer);
        if (completed)
            return;
        if (reducedMotion.matches && playing)
            completionTimer = setTimeout(finish, 350);
        else if (playing) {
            origin = performance.now();
            offset = time;
            completionTimer = setTimeout(finish, Math.max(800, PLAYBACK_DURATION - offset + 1500));
            frameId = requestAnimationFrame(frame);
        }
    });
    layout();
    render(0);
    const previewTime = new URLSearchParams(location.search).get("frame");
    if (previewTime !== null && Number.isFinite(Number(previewTime)))
        seek(Number(previewTime));
    else if (!reducedMotion.matches) {
        completionTimer = setTimeout(finish, PLAYBACK_DURATION + 1500);
        frameId = requestAnimationFrame(frame);
    } else
        completionTimer = setTimeout(finish, 350);
})().catch(() => {
    // A mobile SVG/animation failure must not leave a first-time visitor stranded.
    document.body.classList.add('intro-static');
    setTimeout(() => {
        if (window.FMCFlow?.afterIntro) window.FMCFlow.afterIntro();
        else location.replace('welcome#welcome-1');
    }, 1200);
});

