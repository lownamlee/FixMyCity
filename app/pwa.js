"use strict";
(() => {
    "use strict";
    const base = new URL("./", document.currentScript.src);
    const display = matchMedia("(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)");
    const listeners = new Set();
    let deferredPrompt = null, installedEvent = false, prompting = false;
    let workerState = "idle", updateAvailable = false, lastOutcome = null;
    function installed() {
        return installedEvent || display.matches || navigator.standalone === true;
    }
    function getState() {
        return Object.freeze({
            installed: installed(),
            canPrompt: !!deferredPrompt && !installed(),
            prompting,
            secure: window.isSecureContext,
            serviceWorker: workerState,
            updateAvailable,
            lastOutcome,
        });
    }
    function notify() {
        const state = getState();
        document.documentElement.dataset.pwaWorker = state.serviceWorker;
        document.documentElement.dataset.pwaInstalled = String(state.installed);
        document.documentElement.dataset.pwaInstallable = String(state.canPrompt);
        for (const listener of listeners) {
            try {
                listener(state);
            }
            catch (error) {
                console.error("Install UI update failed", error);
            }
        }
        window.dispatchEvent(new CustomEvent("fixmycity:pwa-state", { detail: state }));
    }
    function subscribe(listener) {
        listeners.add(listener);
        listener(getState());
        return () => listeners.delete(listener);
    }
    function instructions() {
        const ua = navigator.userAgent;
        const ios = /iPad|iPhone|iPod/.test(ua) ||
            (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        let platform = "browser", title = "Install FixMyCity", steps;
        if (!window.isSecureContext) {
            steps = [
                "Open https://fixmycity.online/ in your browser.",
                "Choose Install app in Settings.",
            ];
        }
        else if (ios) {
            platform = "ios";
            steps = [
                "Open this page in Safari and tap Share.",
                "Choose Add to Home Screen.",
                "Enable Open as Web App if shown, then tap Add.",
            ];
        }
        else if (/Macintosh/.test(ua) &&
            /Safari/.test(ua) &&
            !/Chrome|Chromium|Edg/.test(ua)) {
            platform = "mac-safari";
            steps = [
                "In Safari, open the Share menu.",
                "Choose Add to Dock, then Add.",
            ];
        }
        else if (/Android/.test(ua)) {
            platform = "android";
            steps = [
                "Open the browser menu.",
                "Choose Install app or Add to Home screen.",
                "Confirm Add or Install.",
            ];
        }
        else if (/Edg\//.test(ua)) {
            platform = "edge";
            steps = [
                "Open the browser menu, then Apps.",
                "Choose Install this site as an app.",
                "Confirm Install.",
            ];
        }
        else if (/Chrome|Chromium/.test(ua)) {
            platform = "chrome";
            steps = [
                "Use the install icon in the address bar, if shown.",
                "Or open the browser menu, then Cast, save and share.",
                "Choose Install page as app, then Install.",
            ];
        }
        else {
            steps = [
                "Open this page in Chrome or Edge on your computer, or Safari on iPhone.",
                "Use the browser’s Install app or Add to Home Screen action.",
            ];
        }
        const detail = Object.freeze({ platform, title, steps });
        window.dispatchEvent(new CustomEvent("fixmycity:install-instructions", { detail }));
        return { status: "instructions", ...detail };
    }
    async function install() {
        if (installed())
            return { status: "installed" };
        if (prompting)
            return { status: "prompting" };
        if (!deferredPrompt)
            return instructions();
        const event = deferredPrompt;
        deferredPrompt = null;
        prompting = true;
        let nativePrompt;
        try {
            // Invoke inside the original button gesture; do not await other work first.
            nativePrompt = event.prompt();
            notify();
            const result = await nativePrompt;
            const choice = result?.outcome ? result : await event.userChoice;
            lastOutcome = choice?.outcome || "dismissed";
            return { status: lastOutcome, platform: choice?.platform || "" };
        }
        catch (error) {
            lastOutcome = "error";
            instructions();
            return {
                status: "error",
                message: error instanceof Error ? error.message : "Installation failed",
            };
        }
        finally {
            prompting = false;
            notify();
        }
    }
    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredPrompt = event;
        lastOutcome = null;
        notify();
    });
    window.addEventListener("appinstalled", () => {
        installedEvent = true;
        deferredPrompt = null;
        lastOutcome = "installed";
        notify();
    });
    if (display.addEventListener)
        display.addEventListener("change", notify);
    else
        display.addListener?.(notify);
    async function register() {
        if (!window.isSecureContext || !("serviceWorker" in navigator)) {
            workerState = "unsupported";
            notify();
            return;
        }
        workerState = "registering";
        notify();
        try {
            const registration = await navigator.serviceWorker.register(new URL("service-worker.js", base), {
                scope: base.pathname,
                updateViaCache: "none",
            });
            updateAvailable = !!registration.waiting;
            registration.addEventListener("updatefound", () => {
                const worker = registration.installing;
                worker?.addEventListener("statechange", () => {
                    if (worker.state === "installed" &&
                        navigator.serviceWorker.controller) {
                        updateAvailable = true;
                        notify();
                    }
                });
            });
            await navigator.serviceWorker.ready;
            workerState = "ready";
            notify();
        }
        catch (error) {
            workerState = "error";
            console.warn("FixMyCity 2 offline support could not start:", error);
            notify();
        }
    }
    window.FixMyCityPWA = Object.freeze({ getState, install, subscribe });
    if (document.readyState === "complete")
        register();
    else
        window.addEventListener("load", register, { once: true });
})();
