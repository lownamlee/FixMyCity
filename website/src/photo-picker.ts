interface PhotoRecord {
  portal: HTMLDivElement;
  panel: HTMLElement;
  input: HTMLInputElement;
  shell: HTMLElement;
  overlays: HTMLElement;
  options: PhotoOptions;
  previousFocus: HTMLElement | null;
  shellInert: boolean;
  overlayInert: boolean;
  stream: MediaStream | null;
  cameraToken: number;
  mode: "choices" | "camera" | "error";
  onKey: (event: KeyboardEvent) => void;
  onExit: Cleanup;
  onVisibility: Cleanup;
}
(() => {
  "use strict";
  const base = new URL(".", (document.currentScript as HTMLScriptElement).src);
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = new URL("photo-picker.css", base).href;
  document.head.append(stylesheet);
  let current: PhotoRecord | null = null;
  const svg = (name: string) =>
    `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const galleryIcon =
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></svg>';
  function stopCamera(record: PhotoRecord) {
    record.cameraToken++;
    record.stream?.getTracks().forEach((track) => track.stop());
    record.stream = null;
    const video = record.portal.querySelector("video")!;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }
  function close(delivered = false) {
    const record = current;
    if (!record) return;
    current = null;
    stopCamera(record);
    document.removeEventListener("keydown", record.onKey, true);
    window.removeEventListener("pagehide", record.onExit);
    window.removeEventListener("hashchange", record.onExit);
    document.removeEventListener("visibilitychange", record.onVisibility);
    record.portal.remove();
    record.shell.inert = record.shellInert;
    record.overlays.inert = record.overlayInert;
    document.body.classList.remove("photo-picker-open");
    if (record.previousFocus?.isConnected)
      record.previousFocus.focus({ preventScroll: true });
    if (!delivered) record.options.onCancel?.();
  }
  function focusPanel(record: PhotoRecord) {
    record.portal
      .querySelector<HTMLElement>('[role="dialog"]')
      ?.focus({ preventScroll: true });
  }
  function choices(record: PhotoRecord) {
    stopCamera(record);
    record.mode = "choices";
    record.panel.className = "photo-source-sheet";
    record.panel.innerHTML = `<span class="photo-sheet-handle"></span><button class="photo-close icon-button" data-photo-action="close" aria-label="Close photo options">${svg("x")}</button><h2 id="photoPickerTitle">Add photo</h2><div class="photo-source-options"><button data-photo-action="gallery"><span class="photo-source-icon">${galleryIcon}</span><span>Choose from gallery</span>${svg("arrow")}</button><button data-photo-action="camera"><span class="photo-source-icon camera">${svg("camera")}</span><span>Use camera</span>${svg("arrow")}</button></div>`;
    focusPanel(record);
  }
  function accept(record: PhotoRecord, file: File | undefined) {
    if (!file || current !== record) return;
    if (!file.type.startsWith("image/")) {
      showError(record, "Choose an image file");
      return;
    }
    const callback = record.options.onPhoto;
    close(true);
    callback?.(file);
  }
  function chooseFile(record: PhotoRecord, capture = false) {
    if (record.mode === "camera") choices(record);
    const input = record.input;
    input.value = "";
    if (capture) input.setAttribute("capture", "environment");
    else input.removeAttribute("capture");
    input.click();
  }
  function showError(record: PhotoRecord, message: string) {
    stopCamera(record);
    record.mode = "error";
    record.panel.className = "photo-source-sheet";
    record.panel.innerHTML = `<span class="photo-sheet-handle"></span><button class="photo-close icon-button" data-photo-action="close" aria-label="Close photo options">${svg("x")}</button><div class="camera-error-icon">${svg("camera")}</div><h2 id="photoPickerTitle"></h2><div class="camera-error-actions"><button class="primary-button" data-photo-action="gallery">${galleryIcon}Choose from gallery</button><button class="secondary-button" data-photo-action="camera">Try camera again</button></div>`;
    record.panel.querySelector("h2")!.textContent = message;
    focusPanel(record);
  }
  async function camera(record: PhotoRecord) {
    if (!navigator.mediaDevices?.getUserMedia) {
      chooseFile(record, true);
      return;
    }
    stopCamera(record);
    record.mode = "camera";
    const token = record.cameraToken;
    record.panel.className = "photo-source-sheet camera-sheet";
    record.panel.innerHTML = `<button class="photo-close icon-button" data-photo-action="close" aria-label="Close camera">${svg("x")}</button><button class="camera-back icon-button" data-photo-action="back" aria-label="Back to photo options">${svg("arrow")}</button><h2 id="photoPickerTitle">Take a photo</h2><div class="camera-viewport"><video autoplay muted playsinline></video><span class="camera-guides"></span><span class="camera-loading" role="status">Allow camera access</span><span class="camera-flash"></span></div><div class="camera-controls"><button class="camera-gallery icon-button" data-photo-action="gallery" aria-label="Choose from gallery">${galleryIcon}</button><button class="camera-shutter" data-photo-action="capture" aria-label="Take photo" disabled><span></span></button><span class="camera-control-spacer"></span></div>`;
    focusPanel(record);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      if (current !== record || token !== record.cameraToken) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      record.stream = stream;
      const video = record.panel.querySelector("video")!;
      video.srcObject = stream;
      await video.play();
      if (current !== record || token !== record.cameraToken) return;
      const ready = () => {
        if (current !== record || !video.videoWidth) return;
        record.panel.querySelector(".camera-loading")?.remove();
        const capture =
          record.panel.querySelector<HTMLButtonElement>(".camera-shutter")!;
        if (capture) capture.disabled = false;
      };
      if (video.videoWidth) ready();
      else video.addEventListener("loadeddata", ready, { once: true });
    } catch (error) {
      if (current !== record || token !== record.cameraToken) return;
      showError(
        record,
        (error instanceof Error ? error.name : "") === "NotAllowedError"
          ? "Camera access denied"
          : (error instanceof Error ? error.name : "") === "NotFoundError"
            ? "No camera found"
            : "Camera unavailable",
      );
    }
  }
  function capture(record: PhotoRecord) {
    const video = record.panel.querySelector("video")!;
    if (!video?.videoWidth) return;
    record.panel.querySelector<HTMLButtonElement>(".camera-shutter")!.disabled =
      true;
    record.panel.querySelector(".camera-flash")!.classList.add("flash");
    const canvas = document.createElement("canvas");
    const scale = Math.min(
      1,
      1600 / Math.max(video.videoWidth, video.videoHeight),
    );
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas
      .getContext("2d")!
      .drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (current !== record) return;
        if (!blob) {
          showError(record, "Photo could not be captured");
          return;
        }
        accept(
          record,
          new File([blob], `fixmycity-${Date.now()}.jpg`, {
            type: "image/jpeg",
          }),
        );
      },
      "image/jpeg",
      0.88,
    );
  }
  function open(options: PhotoOptions = {}) {
    close();
    const portal = document.createElement("div");
    portal.className = "photo-source-overlay";
    portal.innerHTML = `<button class="photo-source-backdrop" aria-label="Close photo options" data-photo-action="close"></button><section class="photo-source-sheet" role="dialog" aria-modal="true" aria-labelledby="photoPickerTitle" tabindex="-1"></section><input type="file" accept="image/*" hidden>`;
    const shell = document.getElementById("appShell")!,
      overlays = document.getElementById("overlayRoot")!;
    const record: PhotoRecord = {
      portal,
      panel: portal.querySelector("section")!,
      input: portal.querySelector("input")!,
      shell,
      overlays,
      options,
      previousFocus:
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
      shellInert: shell.inert,
      overlayInert: overlays.inert,
      stream: null,
      cameraToken: 0,
      mode: "choices",
      onKey: () => {},
      onExit: () => {},
      onVisibility: () => {},
    };
    current = record;
    shell.inert = true;
    overlays.inert = true;
    document.body.classList.add("photo-picker-open");
    document.body.append(portal);
    record.input.addEventListener("change", () =>
      accept(record, record.input.files?.[0]),
    );
    portal.addEventListener("click", (event) => {
      const action = (
        event.target instanceof Element ? event.target : null
      )?.closest<HTMLElement>("[data-photo-action]")?.dataset.photoAction;
      if (action === "close") close();
      else if (action === "gallery") chooseFile(record);
      else if (action === "camera") camera(record);
      else if (action === "back") choices(record);
      else if (action === "capture") capture(record);
    });
    record.onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
      }
      if (event.key !== "Tab") return;
      event.stopImmediatePropagation();
      const items = [
        ...record.panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]),[tabindex="0"]',
        ),
      ].filter((node) => node.offsetParent !== null);
      const first = items[0],
        last = items.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === record.panel)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === record.panel)
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    record.onExit = () => close();
    record.onVisibility = () => {
      if (document.hidden && record.mode === "camera") choices(record);
    };
    document.addEventListener("keydown", record.onKey, true);
    window.addEventListener("pagehide", record.onExit);
    window.addEventListener("hashchange", record.onExit);
    document.addEventListener("visibilitychange", record.onVisibility);
    choices(record);
  }
  window.PhotoPicker = Object.freeze({ open, close });
})();
