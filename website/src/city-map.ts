type MapEngine = typeof import("maplibre-gl");
interface MapRecord {
  container: HTMLElement;
  layer: HTMLDivElement;
  notice: HTMLDivElement;
  fallback: HTMLElement | null;
  fallbackInert: boolean;
  reports: MapReport[];
  options: MapOptions;
  map: import("maplibre-gl").Map | null;
  gl: MapEngine | null;
  ready: boolean;
  destroyed: boolean;
  markers: {
    instance: import("maplibre-gl").Marker;
    button: HTMLButtonElement;
  }[];
  selected: string | null;
  resolve: (ready: boolean) => void;
  timeout?: number;
  selectionTimer?: number;
  observer?: ResizeObserver;
}
(() => {
  "use strict";
  const base = new URL(".", (document.currentScript as HTMLScriptElement).src);
  const instances = new Set<MapRecord>();
  const mounted = new WeakMap<HTMLElement, MapRecord>();
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const bounds: [Point, Point] = [
    [101.686, 3.139],
    [101.724, 3.171],
  ];
  const center: Point = [101.705, 3.155];
  const styles = {
    roads: {
      color: "#e9994f",
      path: '<path d="m7 3-3 18M17 3l3 18M12 4v3m0 4v3m0 4v2"/>',
    },
    lighting: {
      color: "#9575cf",
      path: '<path d="M9 18h6m-5 3h4M8 13a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2Z"/>',
    },
    drains: {
      color: "#4a9fc8",
      path: '<path d="M3 9h18M5 13h14M7 17h10M8 3v3m8-3v3M12 12v9"/>',
    },
    waste: {
      color: "#59a687",
      path: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
    },
  };
  const statuses = {
    review: "Under review",
    progress: "In progress",
    resolved: "Resolved",
  };
  let library: Promise<MapEngine> | null;

  function stylesheet(path: string) {
    const href = new URL(path, base).href;
    if (
      [
        ...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
      ].some((link) => link.href === href)
    )
      return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.append(link);
  }
  stylesheet("assets/vendor/maplibre-gl-6.12.0.css");
  stylesheet("city-map.css");

  function engine() {
    if (!library)
      library = (
        import(
          new URL("assets/vendor/maplibre-6.12.0/maplibre-gl.mjs", base).href
        ) as Promise<MapEngine>
      )
        .then((gl) => {
          gl.setWorkerUrl(
            new URL(
              "assets/vendor/maplibre-6.12.0/maplibre-gl-worker.mjs",
              base,
            ).href,
          );
          return gl;
        })
        .catch((error) => {
          library = null;
          throw error;
        });
    return library;
  }
  function reduced(record: MapRecord) {
    return (
      media.matches ||
      Boolean(
        typeof record.options.reduced === "function"
          ? record.options.reduced()
          : record.options.reduced,
      )
    );
  }
  function validLngLat(value: unknown): value is Point {
    return (
      Array.isArray(value) &&
      value.length >= 2 &&
      Number.isFinite(value[0]) &&
      Number.isFinite(value[1]) &&
      Math.abs(value[0]) <= 180 &&
      Math.abs(value[1]) <= 90
    );
  }
  function toPoint(lngLat: unknown): Point | null {
    if (!validLngLat(lngLat)) return null;
    return [
      ((lngLat[0] - bounds[0][0]) / (bounds[1][0] - bounds[0][0])) * 100,
      ((bounds[1][1] - lngLat[1]) / (bounds[1][1] - bounds[0][1])) * 100,
    ];
  }
  function toLngLat(point: unknown): Point | null {
    if (
      !Array.isArray(point) ||
      !Number.isFinite(point[0]) ||
      !Number.isFinite(point[1])
    )
      return null;
    const lngLat: Point = [
      bounds[0][0] + (point[0] / 100) * (bounds[1][0] - bounds[0][0]),
      bounds[1][1] - (point[1] / 100) * (bounds[1][1] - bounds[0][1]),
    ];
    return validLngLat(lngLat) ? lngLat : null;
  }
  // Real coordinates are authoritative. Percentages support the original illustrated map.
  function coordinates(report: MapReport): Point {
    return validLngLat(report.lngLat)
      ? [...report.lngLat]
      : toLngLat(report.point) || [...center];
  }
  function select(record: MapRecord, report: MapReport) {
    if (!record.ready || record.destroyed || !record.map) return;
    clearTimeout(record.selectionTimer);
    record.selected = String(report.id);
    record.markers.forEach(({ button }) => {
      const selected = button.dataset.cityReport === record.selected;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    const duration = reduced(record) ? 0 : 520;
    record.map!.flyTo({
      center: coordinates(report),
      zoom: Math.max(14.4, record.map!.getZoom()),
      duration,
      essential: false,
    });
    record.selectionTimer = setTimeout(() => {
      if (!record.destroyed && record.selected === String(report.id))
        record.options.onReport?.(report.id);
    }, duration + 20);
  }
  function markers(record: MapRecord) {
    record.markers.forEach((marker) => marker.instance.remove());
    record.markers = [];
    if (!record.map || !record.gl || !record.ready) return;
    if (!record.reports.some((report) => String(report.id) === record.selected))
      record.selected = null;
    record.reports.forEach((report, index) => {
      if (!report || report.id == null) return;
      const category = styles[report.category] || styles.roads;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "city-report-marker";
      button.dataset.cityReport = String(report.id);
      button.dataset.status = statuses[report.status]
        ? report.status
        : "review";
      button.style.setProperty("--marker-color", category.color);
      button.setAttribute(
        "aria-label",
        `${report.title || "Report"} — ${statuses[report.status] || "Under review"}`,
      );
      button.setAttribute(
        "aria-pressed",
        String(record.selected === String(report.id)),
      );
      button.classList.toggle(
        "is-selected",
        record.selected === String(report.id),
      );
      button.innerHTML = `<span class="city-marker-face"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${category.path}</svg><span class="city-marker-status" aria-hidden="true"></span></span>`;
      const tooltip = document.createElement("span");
      tooltip.className = "city-marker-tooltip";
      tooltip.textContent = report.title || "View report";
      button.append(tooltip);
      if (!reduced(record) && !record.options.onPick) {
        button.classList.add("is-revealing");
        const batchSize = Math.max(2, Math.ceil(record.reports.length / 5));
        button.style.setProperty(
          "--marker-reveal-delay",
          `${Math.floor(index / batchSize) * 400}ms`,
        );
        button
          .querySelector(".city-marker-face")!
          .addEventListener(
            "animationend",
            () => button.classList.remove("is-revealing"),
            { once: true },
          );
      }
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!record.options.onPick) select(record, report);
      });
      const instance = new record.gl!.Marker({
        element: button,
        anchor: "center",
      })
        .setLngLat(coordinates(report))
        .addTo(record.map!);
      record.markers.push({ instance, button });
    });
  }
  function fit(record: MapRecord, duration = 0) {
    const reports = record.reports.filter(
      (report) => report && report.id != null,
    );
    const located = reports.filter((report) => validLngLat(report.lngLat));
    const motionDuration = reduced(record) ? 0 : duration;
    if (record.options.onPick && located.length) {
      const draft =
        located.find((report) => report.id === "draft-location") || located[0];
      record.map!.easeTo({
        center: coordinates(draft),
        zoom: 16,
        duration: motionDuration,
      });
      return;
    }
    let extent = bounds;
    if (located.length) {
      const points = reports.map(coordinates);
      extent = [
        [
          Math.min(...points.map((point) => point[0])),
          Math.min(...points.map((point) => point[1])),
        ],
        [
          Math.max(...points.map((point) => point[0])),
          Math.max(...points.map((point) => point[1])),
        ],
      ];
    }
    record.map!.fitBounds(extent, {
      padding: record.options.interactive === false ? 28 : 42,
      maxZoom: 14.2,
      duration: motionDuration,
    });
  }
  function destroy(record: MapRecord) {
    if (record.destroyed) return;
    record.destroyed = true;
    clearTimeout(record.timeout);
    clearTimeout(record.selectionTimer);
    record.observer?.disconnect();
    record.markers.forEach((marker) => marker.instance.remove());
    record.map?.remove();
    record.map = null;
    record.layer.remove();
    record.notice.remove();
    record.container.classList.remove("city-map-host", "city-map-ready");
    record.container.removeAttribute("data-city-map");
    record.container.parentElement?.classList.remove("has-city-map");
    if (record.fallback) {
      record.fallback.inert = record.fallbackInert;
    }
    record.resolve(false);
    mounted.delete(record.container);
    instances.delete(record);
  }
  function failed(record: MapRecord) {
    if (record.destroyed || record.ready) return;
    clearTimeout(record.timeout);
    record.map?.remove();
    record.map = null;
    record.layer.hidden = true;
    record.notice.textContent = "Illustrated map · live map unavailable";
    record.container.dataset.cityMap = "fallback";
    record.resolve(false);
  }
  function mount(
    target: string | HTMLElement | null,
    reports: MapReport[] = [],
    options: MapOptions = {},
  ): MapHandle | null {
    const container =
      typeof target === "string"
        ? document.querySelector<HTMLElement>(target)
        : target;
    if (!(container instanceof HTMLElement)) return null;
    if (mounted.has(container)) destroy(mounted.get(container)!);
    const layer = document.createElement("div");
    layer.className = "city-live-map";
    const notice = document.createElement("div");
    notice.className = "city-map-notice";
    notice.textContent = "Loading city map";
    notice.setAttribute("role", "status");
    const fallback = container.querySelector<HTMLElement>(".map-world");
    const record: MapRecord = {
      container,
      layer,
      notice,
      fallback,
      fallbackInert: fallback?.inert || false,
      reports: Array.isArray(reports) ? reports : [],
      options,
      map: null,
      gl: null,
      ready: false,
      destroyed: false,
      markers: [],
      selected: null,
      resolve: () => {},
    };
    const ready = new Promise<boolean>((resolve) => {
      record.resolve = resolve;
    });
    container.classList.add("city-map-host");
    container.dataset.cityMap = "loading";
    container.append(layer, notice);
    mounted.set(container, record);
    instances.add(record);
    // Keep legacy illustration-drag listeners from moving underneath the live map.
    [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
      "wheel",
    ].forEach((name) =>
      layer.addEventListener(name, (event) => event.stopPropagation(), {
        passive: true,
      }),
    );
    record.timeout = setTimeout(() => failed(record), 20000);
    engine()
      .then((gl) => {
        if (
          record.destroyed ||
          !container.isConnected ||
          container.dataset.cityMap === "fallback"
        )
          return;
        record.gl = gl;
        const initialCenter = validLngLat(options.center)
          ? options.center
          : center;
        const initialZoom =
          typeof options.zoom === "number" && Number.isFinite(options.zoom)
            ? Math.max(1, Math.min(18, options.zoom))
            : 16;
        record.map = new gl.Map({
          container: layer,
          style: "https://tiles.openfreemap.org/styles/positron",
          center: initialCenter,
          zoom: validLngLat(options.center) ? initialZoom : 13.2,
          minZoom: 1,
          maxZoom: 18,
          pitch: 0,
          bearing: 0,
          interactive: options.interactive !== false,
          attributionControl: false,
          renderWorldCopies: false,
          canvasContextAttributes: { antialias: true },
        });
        record.map!.addControl(
          new gl.AttributionControl({ compact: true }),
          "bottom-left",
        );
        record
          .map!.getCanvas()
          .setAttribute(
            "aria-label",
            "Report map. Use arrow keys to pan and plus or minus to zoom.",
          );
        if (options.interactive === false)
          record.map!.getCanvas().tabIndex = -1;
        if (!validLngLat(options.center)) fit(record);
        record.map!.on("error", () => {
          /* The illustration remains available if initial map loading times out. */
        });
        record.map!.once("load", () => {
          if (record.destroyed) return;
          clearTimeout(record.timeout);
          record.ready = true;
          container.dataset.cityMap = "ready";
          container.classList.add("city-map-ready");
          container.parentElement?.classList.add("has-city-map");
          if (fallback) fallback.inert = true;
          notice.hidden = true;
          markers(record);
          record.resolve(true);
        });
        if (typeof options.onPick === "function") {
          record
            .map!.getCanvas()
            .setAttribute(
              "aria-label",
              "Choose a report location. Pan with arrow keys and press Enter to place the pin at the center.",
            );
          const pick = (lngLat: { lng: number; lat: number }) => {
            if (!record.ready || record.destroyed || !record.map) return;
            const actual: Point = [lngLat.lng, lngLat.lat];
            const point = toPoint(actual);
            if (!point) return;
            record.reports = [
              {
                ...record.reports[0],
                category: record.reports[0]?.category || "roads",
                status: record.reports[0]?.status || "review",
                id: "draft-location",
                title: "Report location",
                point,
                lngLat: actual,
              },
            ];
            record.selected = "draft-location";
            markers(record);
            options.onPick?.(point, [...actual]);
          };
          record.map!.on("click", (event) => pick(event.lngLat));
          record.map!.getCanvas().addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              pick(record.map!.getCenter());
            }
          });
        }
        record.observer = new ResizeObserver(() => {
          if (!record.destroyed) record.map?.resize();
        });
        record.observer.observe(container);
      })
      .catch(() => failed(record));
    return Object.freeze({
      ready,
      destroy: () => destroy(record),
      setReports: (next: MapReport[]) => {
        record.reports = Array.isArray(next) ? next : [];
        markers(record);
        if (record.ready && record.options.onPick) fit(record, 450);
        return record.ready;
      },
    });
  }
  function active() {
    const ready = [...instances].filter(
      (record) =>
        record.ready &&
        !record.destroyed &&
        record.map &&
        record.container.isConnected,
    );
    return (
      ready.find((record) => record.options.interactive !== false) ||
      ready.at(-1)
    );
  }
  function zoom(delta: number) {
    const record = active();
    if (!record || !Number.isFinite(Number(delta))) return false;
    record.map!.easeTo({
      zoom: Math.max(1, Math.min(18, record.map!.getZoom() + Number(delta))),
      duration: reduced(record) ? 0 : 280,
    });
    return true;
  }
  function recenter() {
    const record = active();
    if (!record) return false;
    record.selected = null;
    clearTimeout(record.selectionTimer);
    record.markers.forEach(({ button }) => {
      button.classList.remove("is-selected");
      button.setAttribute("aria-pressed", "false");
    });
    fit(record, 650);
    return true;
  }
  function setReports(reports: MapReport[]) {
    let handled = false;
    instances.forEach((record) => {
      record.reports = Array.isArray(reports) ? reports : [];
      markers(record);
      if (record.ready && record.options.onPick) fit(record, 450);
      if (record.ready && !record.destroyed && record.map) handled = true;
    });
    return handled;
  }
  window.CityMap = Object.freeze({
    mount,
    destroyAll: () => [...instances].forEach(destroy),
    zoom,
    recenter,
    setReports,
    pointFromLngLat: toPoint,
    lngLatFromPoint: toLngLat,
    toPoint,
    toLngLat,
  });
})();
