(() => {
  "use strict";
  const $ = <T extends HTMLElement = HTMLElement>(
    s: string,
    root: ParentNode = document,
  ) => root.querySelector<T>(s)!;
  const $$ = <T extends HTMLElement = HTMLElement>(
    s: string,
    root: ParentNode = document,
  ) => [...root.querySelectorAll<T>(s)];
  const h = (value: unknown) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]!,
    );
  const icon = (name: string, cls = "") =>
    `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const photos = {
    roads: "assets/issues/pothole.webp",
    lighting: "assets/issues/streetlight.webp",
    drains: "assets/issues/drain.webp",
    waste: "assets/issues/litter.webp",
  };
  const categories = {
    roads: { name: "Roads", icon: "road", color: "#f29954" },
    lighting: { name: "Lighting", icon: "light", color: "#8f78dc" },
    drains: { name: "Drains", icon: "drain", color: "#4da8d7" },
    waste: { name: "Waste", icon: "bin", color: "#62a480" },
  };
  const statusNames = {
    review: "Under review",
    progress: "In progress",
    resolved: "Resolved",
  };
  const seed: CityReport[] = [
    {
      id: "FMC-1048",
      title: "Pothole near the crossing",
      category: "roads",
      place: "Jalan Sultan Ismail",
      area: "Bukit Bintang",
      description:
        "A deep pothole sits just before the pedestrian crossing. Motorcycles are swerving into the next lane to avoid it.",
      status: "progress",
      priority: "high",
      support: 28,
      own: true,
      point: [43, 47],
      date: "27 Oct",
      time: "09:24",
    },
    {
      id: "FMC-1047",
      title: "Blocked roadside drain",
      category: "drains",
      place: "Jalan Raja Chulan",
      area: "Bukit Bintang",
      description:
        "The roadside drain is blocked. Rainwater is pooling along the pedestrian route and spilling onto the road.",
      status: "review",
      priority: "high",
      support: 12,
      own: true,
      point: [65, 65],
      date: "27 Oct",
      time: "08:42",
    },
    {
      id: "FMC-1046",
      title: "Streetlights not working",
      category: "lighting",
      place: "Jalan Raja Muda Musa",
      area: "Kampung Baru",
      description:
        "Several streetlights along the walkway are not working. The route needs lighting for people walking home at night.",
      status: "progress",
      priority: "medium",
      support: 8,
      own: false,
      point: [57, 30],
      date: "26 Oct",
      time: "19:16",
    },
    {
      id: "FMC-1045",
      title: "Rubbish blocking the walkway",
      category: "waste",
      place: "Jalan Alor",
      area: "Bukit Bintang",
      description:
        "Bags of rubbish have been left beside the walkway. The pile is getting larger and obstructs part of the pedestrian route.",
      status: "review",
      priority: "medium",
      support: 16,
      own: false,
      point: [77, 76],
      date: "26 Oct",
      time: "14:08",
    },
    {
      id: "FMC-1044",
      title: "Road surface repaired",
      category: "roads",
      place: "Jalan Ampang",
      area: "KLCC",
      description:
        "The damaged road surface has been repaired and the lane is open again.",
      status: "resolved",
      priority: "medium",
      support: 34,
      own: true,
      point: [82, 37],
      date: "25 Oct",
      time: "10:30",
    },
    {
      id: "FMC-1043",
      title: "Drain cleared",
      category: "drains",
      place: "Jalan Tuanku Abdul Rahman",
      area: "Chow Kit",
      description:
        "The blocked drain has been cleared and water is flowing freely along the street.",
      status: "resolved",
      priority: "low",
      support: 11,
      own: false,
      point: [20, 26],
      date: "25 Oct",
      time: "11:45",
    },
    {
      id: "FMC-1042",
      title: "Waste awaiting collection",
      category: "waste",
      place: "Jalan Petaling",
      area: "Chinatown",
      description:
        "Waste beside the shopfronts is narrowing the walkway. A collection has been scheduled.",
      status: "progress",
      priority: "medium",
      support: 6,
      own: false,
      point: [25, 76],
      date: "24 Oct",
      time: "16:12",
    },
    {
      id: "FMC-1041",
      title: "Streetlights repaired",
      category: "lighting",
      place: "Persiaran KLCC",
      area: "KLCC",
      description:
        "The streetlights have been restored along the pedestrian path.",
      status: "resolved",
      priority: "low",
      support: 22,
      own: false,
      point: [87, 49],
      date: "24 Oct",
      time: "18:40",
    },
  ];
  const storageKey = "fixmycity-preview-v1",
    uiStorageKey = "fixmycity-ui-v1",
    draftStorageKey = "fixmycity-draft-v1";
  const introSeenKey = "fixmycity-intro-seen",
    activityKey = "fixmycity-last-active";
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  const textValue = (value: unknown, fallback = "") =>
    typeof value === "string" ? value : fallback;
  const oneOf = <T extends string | null>(
    value: unknown,
    choices: readonly T[],
    fallback: T,
  ): T => (choices.includes(value as T) ? (value as T) : fallback);
  const validPoint = (value: unknown): value is Point =>
    Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
  const validLngLat = (value: unknown): value is Point =>
    validPoint(value) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
  const locationPoint = (lngLat: Point): Point =>
    window.CityMap?.toPoint(lngLat) || [
      ((lngLat[0] - 101.686) / 0.038) * 100,
      ((3.171 - lngLat[1]) / 0.032) * 100,
    ];
  const coordinateLabel = (lngLat: Point) =>
    `${lngLat[1].toFixed(6)}, ${lngLat[0].toFixed(6)}`;
  function readStored(key: string): Record<string, unknown> {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "{}");
      return isRecord(value) ? value : {};
    } catch {
      return {};
    }
  }
  function restoreDraft(value: unknown): ReportDraft | null {
    if (
      !isRecord(value) ||
      ![1, 2, 3].includes(Number(value.step)) ||
      !isCategory(value.category)
    )
      return null;
    const description = textValue(value.description),
      texts = isRecord(value.texts) ? value.texts : {};
    return {
      step: value.step === 3 ? 3 : 1,
      description,
      category: value.category,
      location: textValue(value.location, "Jalan Sultan Ismail, Kuala Lumpur"),
      photo: textValue(value.photo),
      point: validPoint(value.point)
        ? value.point
        : validLngLat(value.lngLat)
          ? locationPoint(value.lngLat)
          : [47, 49],
      ...(validLngLat(value.lngLat) ? { lngLat: value.lngLat } : {}),
      priority: oneOf(value.priority, ["high", "medium", "low"], "medium"),
      language: oneOf(value.language, ["en", "bm"], "en"),
      title: textValue(value.title),
      texts: { en: textValue(texts.en, description), bm: textValue(texts.bm) },
      progress: 0,
      pickerOpen: value.step === 1 && value.pickerOpen === true,
    };
  }
  function isCategory(value: unknown): value is Category {
    return typeof value === "string" && Object.hasOwn(categories, value);
  }
  function isStatus(value: unknown): value is ReportStatus {
    return typeof value === "string" && Object.hasOwn(statusNames, value);
  }
  function restoreReport(value: unknown): CityReport | null {
    if (
      !isRecord(value) ||
      typeof value.id !== "string" ||
      typeof value.title !== "string" ||
      !isCategory(value.category) ||
      !isStatus(value.status) ||
      !validPoint(value.point)
    )
      return null;
    return {
      id: value.id,
      title: value.title,
      category: value.category,
      status: value.status,
      point: value.point,
      place: textValue(value.place),
      area: textValue(value.area),
      description: textValue(value.description),
      descriptionBm: textValue(value.descriptionBm),
      date: textValue(value.date),
      time: textValue(value.time),
      priority: oneOf(value.priority, ["high", "medium", "low"], "medium"),
      support:
        typeof value.support === "number" && Number.isFinite(value.support)
          ? Math.max(0, value.support)
          : 0,
      own: value.own === true,
      local: value.local === true,
      ...(value.photo !== undefined ? { photo: textValue(value.photo) } : {}),
      ...(validLngLat(value.lngLat) ? { lngLat: value.lngLat } : {}),
    };
  }
  const saved = readStored(storageKey),
    savedUi = readStored(uiStorageKey),
    savedDraft = restoreDraft(readStored(draftStorageKey));
  const restoredReports = Array.isArray(saved.reports)
    ? saved.reports.map(restoreReport)
    : [];
  let reports: CityReport[] =
    restoredReports.length &&
    restoredReports.every((r): r is CityReport => r !== null)
      ? restoredReports
      : seed.map((r) => ({ ...r }));
  let following = new Set(
    Array.isArray(saved.following)
      ? saved.following.filter((id) => typeof id === "string")
      : ["FMC-1046", "FMC-1045"],
  );
  let motion = saved.motion !== false;
  const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)");
  const state: AppState = {
    view: oneOf(savedUi.view, ["home", "map", "reports", "council"], "home"),
    category: oneOf(
      savedUi.category,
      ["all", ...(Object.keys(categories) as Category[])],
      "all",
    ),
    status: oneOf(
      savedUi.status,
      ["all", ...(Object.keys(statusNames) as ReportStatus[])],
      "all",
    ),
    query: textValue(savedUi.query),
    reportTab: oneOf(savedUi.reportTab, ["mine", "following"], "mine"),
    councilMode: oneOf(savedUi.councilMode, ["queue", "board"], "queue"),
    homeText: textValue(savedUi.homeText),
    homeCategory: oneOf(
      savedUi.homeCategory,
      Object.keys(categories) as Category[],
      null,
    ),
    story: 0,
    mapZoom: 1,
    mapX: 0,
    mapY: 0,
  };
  let storyTimer: number | undefined,
    storyCleanup: Cleanup | null | undefined = null,
    toastTimer: number | undefined,
    overlaySerial = 0,
    restoreFocus: HTMLElement | null = null,
    draft: ReportDraft | null = null,
    flowToken = 0,
    lastCreated: CityReport | null = null;
  let introFinished = false,
    pickerMap: MapHandle | null | undefined = null,
    introTimer: number | undefined,
    introHideTimer: number | undefined,
    persistenceTimer: number | undefined,
    afterIntro: Cleanup | null = null,
    lastActivity = Date.now(),
    lastActivityWrite = 0,
    locationRequest = 0,
    locationBusyCleanup: Cleanup | null = null;
  const root = $("#view");
  const overlayRoot = $("#overlayRoot");
  const shell = $("#appShell");
  const reduced = () => !motion || prefersReduced.matches;
  document.body.classList.toggle("reduce-motion", !motion);
  function persist() {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ reports, following: [...following], motion }),
      );
    } catch {
      toast("Saved for this visit");
    }
  }
  function persistUi() {
    const {
      view,
      category,
      status,
      query,
      reportTab,
      councilMode,
      homeText,
      homeCategory,
    } = state;
    try {
      localStorage.setItem(
        uiStorageKey,
        JSON.stringify({
          view,
          category,
          status,
          query,
          reportTab,
          councilMode,
          homeText,
          homeCategory,
        }),
      );
    } catch {}
  }
  function clearSavedDraft() {
    try {
      localStorage.removeItem(draftStorageKey);
    } catch {}
  }
  function persistDraft() {
    if (!draft) return;
    if (draft.step === 4) {
      clearSavedDraft();
      return;
    }
    saveDraftFields();
    try {
      localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    } catch {}
  }
  function schedulePersistence() {
    clearTimeout(persistenceTimer);
    persistenceTimer = setTimeout(() => {
      persistUi();
      persistDraft();
    }, 200);
  }
  function flushPersistence() {
    clearTimeout(persistenceTimer);
    persistUi();
    persistDraft();
    persist();
    writeActivity();
  }
  function writeActivity() {
    try {
      sessionStorage.setItem(introSeenKey, "1");
      sessionStorage.setItem(activityKey, String(lastActivity));
    } catch {}
    lastActivityWrite = Date.now();
  }
  function recordActivity() {
    lastActivity = Date.now();
    if (lastActivity - lastActivityWrite >= 10000) writeActivity();
  }
  function photo(r: CityReport) {
    return r.photo !== undefined ? r.photo : photos[r.category];
  }
  function status(r: CityReport) {
    return `<span class="status status-${r.status}"><i></i>${statusNames[r.status]}</span>`;
  }
  function priority(r: CityReport) {
    return `<span class="priority priority-${r.priority}"><i></i>${r.priority[0].toUpperCase() + r.priority.slice(1)}</span>`;
  }
  function filtered(list = reports) {
    return list.filter(
      (r) =>
        (state.category === "all" || r.category === state.category) &&
        (state.status === "all" || r.status === state.status) &&
        (!state.query ||
          `${r.title} ${r.place} ${r.area} ${r.id}`
            .toLowerCase()
            .includes(state.query.toLowerCase())),
    );
  }
  function categoryButtons(action = "category", selected = state.category) {
    return (
      `<button class="filter-chip ${selected === "all" ? "selected" : ""}" data-action="${action}" data-category="all">All</button>` +
      Object.entries(categories)
        .map(
          ([key, c]) =>
            `<button class="filter-chip ${selected === key ? "selected" : ""}" data-action="${action}" data-category="${key}">${icon(c.icon)}${c.name}</button>`,
        )
        .join("")
    );
  }
  function smallPhoto(r: CityReport, cls = "") {
    return photo(r)
      ? `<img class="${cls}" src="${h(photo(r))}" alt="${h(r.title)}" loading="lazy">`
      : `<span class="photo-placeholder ${cls}">${icon(categories[r.category].icon)}</span>`;
  }
  function toast(message: string) {
    clearTimeout(toastTimer);
    $("#toast").innerHTML =
      `<span class="toast-check">${icon("check")}</span><span>${h(message)}</span><button class="icon-button" data-action="dismiss-toast" aria-label="Dismiss">${icon("x")}</button>`;
    $("#toast").classList.add("visible");
    toastTimer = setTimeout(
      () => $("#toast").classList.remove("visible"),
      3600,
    );
  }
  function currentRoute(): {
    view: View;
    reportId: string | null;
    valid: boolean;
  } {
    const hash = location.hash.slice(1),
      views: View[] = ["home", "map", "reports", "council"];
    const detail =
      hash.match(/^(home|map|reports|council)\/report\/(.+)$/) ||
      hash.match(/^(report)\/(.+)$/);
    if (detail) {
      let id = detail[2];
      try {
        id = decodeURIComponent(id);
      } catch {}
      return {
        view: detail[1] === "report" ? "map" : (detail[1] as View),
        reportId: id,
        valid: true,
      };
    }
    return {
      view: hash ? oneOf(hash, views, "home") : state.view,
      reportId: null,
      valid: !hash || views.includes(hash as View),
    };
  }
  function reportRoute(id: string, view = state.view) {
    return `#${view}/report/${encodeURIComponent(id)}`;
  }
  function recordReportRoute(id: string) {
    const route = currentRoute();
    if (route.view === state.view && route.reportId === id) return;
    const target = reportRoute(id);
    if (route.reportId) history.replaceState(history.state, "", target);
    else
      history.pushState({ fixmycityModalParent: `#${state.view}` }, "", target);
  }
  function dismissOverlay() {
    const route = currentRoute();
    closeOverlay();
    if (!route.reportId) return;
    const parent = `#${route.view}`;
    if (history.state?.fixmycityModalParent === parent) history.back();
    else {
      history.replaceState(null, "", parent);
      readHash();
    }
  }
  function navigate(
    view: string,
    opts: { category?: Category | "all"; status?: ReportStatus | "all" } = {},
  ) {
    if (!["home", "map", "reports", "council"].includes(view)) view = "home";
    state.view = oneOf(view, ["home", "map", "reports", "council"], "home");
    state.category = opts.category || "all";
    state.status = opts.status || "all";
    state.query = "";
    if (location.hash !== `#${view}`) history.pushState(null, "", `#${view}`);
    closeNav();
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function render() {
    persistUi();
    clearInterval(storyTimer);
    storyCleanup?.();
    storyCleanup = null;
    window.CityMap?.destroyAll();
    $("#viewTitle").textContent = {
      home: "Overview",
      map: "City map",
      reports: "My reports",
      council: "Council workspace",
    }[state.view];
    $$(".nav-item[data-view],.mobile-bottom [data-view]").forEach((e) => {
      e.classList.toggle("active", e.dataset.view === state.view);
      e.setAttribute(
        "aria-current",
        e.dataset.view === state.view ? "page" : "false",
      );
    });
    $("#reportCount").textContent = String(reports.filter((r) => r.own).length);
    root.className = `view-content view-${state.view}`;
    root.innerHTML =
      state.view === "home"
        ? homeView()
        : state.view === "map"
          ? mapView()
          : state.view === "reports"
            ? reportsView()
            : councilView();
    animateNumbers();
    bindMap();
    mountMaps();
    bindTilt();
    bindStoryGestures();
    startStoryRotation();
    if (state.view === "map" && matchMedia("(min-width:761px)").matches)
      $<HTMLInputElement>("#mapSearch")?.focus({ preventScroll: true });
  }
  function homeView() {
    const open = reports.filter((r) => r.status !== "resolved").length,
      progress = reports.filter((r) => r.status === "progress").length,
      resolvedCount = reports.filter((r) => r.status === "resolved").length;
    return `<section class="welcome-grid">
      <div class="welcome-copy"><h2 class="hero-heading"><span class="word" style="--n:0">Report</span> <span class="word" style="--n:1">a</span><br><span class="word blue" style="--n:2">city</span> <span class="word blue" style="--n:3">issue.</span><span class="heading-dot"></span></h2>
      <div class="quick-composer"><div class="quick-inner"><textarea id="quickDescription" rows="2" aria-label="Describe the issue" placeholder="Describe the issue…">${h(state.homeText)}</textarea><div class="quick-tools"><button class="soft-button" data-action="quick-photo">${icon("camera")}<span>Photo</span></button><button class="quick-location" data-action="quick-location">${icon("pin")}<span>Add location</span></button><button class="send-circle" data-action="start-report" aria-label="Start your report">${icon("arrow")}</button></div></div></div>
      <div class="quick-categories">${Object.entries(categories)
        .map(
          ([key, c]) =>
            `<button data-action="quick-category" data-category="${key}" class="quick-chip ${state.homeCategory === key ? "selected" : ""}" style="--category-color:${c.color}">${icon(c.icon)}${c.name}</button>`,
        )
        .join("")}</div></div>
      <div class="story-column"><div class="story-stage" id="storyStage"><div class="deck-back back-two"></div><div class="deck-back back-one"></div>${storyCard(state.story)}</div><div class="story-footer"><div class="story-dots">${[0, 1, 2, 3].map((i) => `<button data-action="story" data-index="${i}" class="${state.story === i ? "active" : ""}" aria-label="Show report ${i + 1}"></button>`).join("")}</div></div></div>
      </section>
      <section class="pulse-strip" aria-label="Neighborhood activity">
        <button class="pulse-item" data-action="pulse" data-status="all"><span class="pulse-icon blue-bg">${icon("pin")}</span><span class="pulse-number" data-count="${reports.length}">${reports.length}</span><span class="pulse-label">Around you</span><svg class="sparkline" viewBox="0 0 100 32" aria-hidden="true"><path d="M1 25 12 22 23 24 34 14 45 18 56 9 67 12 78 4 89 8 99 2"/></svg></button>
        <button class="pulse-item" data-action="pulse" data-status="progress"><span class="pulse-icon amber-bg">${icon("wrench")}</span><span class="pulse-number" data-count="${progress}">${progress}</span><span class="pulse-label">In progress</span><div class="mini-bars"><i></i><i></i><i></i><i></i><i></i></div></button>
        <button class="pulse-item" data-action="pulse" data-status="resolved"><span class="pulse-icon green-bg">${icon("check")}</span><span class="pulse-number" data-count="${resolvedCount}">${resolvedCount}</span><span class="pulse-label">Resolved</span><span class="mini-ring" style="--progress:${(resolvedCount / reports.length) * 100}%">${icon("leaf")}</span></button>
      </section>
      <section class="nearby-section"><div class="section-heading"><h2>Nearby reports</h2><button class="text-button" data-view="map">Explore map ${icon("arrow")}</button></div><div class="nearby-grid"><div class="home-map panel">${mapMarkup("home")}<div class="map-floating-label">${icon("pin")}Kuala Lumpur</div><button class="map-expand" data-view="map" aria-label="Open full city map">${icon("arrow")}</button></div><div class="nearby-list panel">${reports
        .filter((r) => r.status !== "resolved")
        .slice(0, 3)
        .map(
          (r) =>
            `<button class="nearby-row" data-report="${r.id}">${smallPhoto(r)}<span class="nearby-text"><strong>${h(r.title)}</strong><span>${h(r.place)}</span>${status(r)}</span>${icon("arrow", "row-arrow")}</button>`,
        )
        .join(
          "",
        )}<button class="nearby-all" data-view="map">See all ${open} open reports ${icon("arrow")}</button></div></div></section>`;
  }
  function storyCard(index: number) {
    const r = reports[index] || reports[0];
    return `<article class="story-card" data-story="${index}"><button class="story-open" data-report="${r.id}" aria-label="View ${h(r.title)}">${smallPhoto(r)}<span class="story-shade"></span><span class="story-top">${status(r)}</span><span class="story-glass"><span class="story-category">${icon(categories[r.category].icon)}</span><span><strong>${h(r.title)}</strong><span>${icon("pin")}${h(r.area)}</span></span>${icon("arrow")}</span></button><button class="story-heart ${following.has(r.id) ? "following" : ""}" data-action="follow" data-id="${r.id}" aria-label="${following.has(r.id) ? "Unfollow" : "Follow"} this report">${icon("heart")}</button></article>`;
  }
  function setStory(index: number, direction = "left") {
    if (state.view !== "home") return;
    state.story = index;
    const stage = $("#storyStage");
    if (!stage) return;
    stage.dataset.swipeDirection = direction;
    startStoryRotation();
    $$(".story-card", stage).forEach((card) => {
      card.classList.add("card-out");
      setTimeout(() => card.remove(), 450);
    });
    stage.insertAdjacentHTML("beforeend", storyCard(index));
    $$(".story-dots button").forEach((b, i) =>
      b.classList.toggle("active", i === index),
    );
    bindTilt();
  }
  function mapMarkup(kind = "full") {
    const list = kind === "home" ? reports : filtered();
    return `<div class="map-viewport ${kind === "full" ? "interactive-map" : ""}" data-map="${kind}"><div class="map-world" style="--zoom:${kind === "home" ? 1 : state.mapZoom};--pan-x:${state.mapX}px;--pan-y:${state.mapY}px"><img class="map-art" src="assets/city-map.svg" alt="Illustrated map of central Kuala Lumpur" draggable="false"><div class="map-user" style="left:49%;top:54%"><i></i><span></span></div>${list.map((r, i) => `<button class="map-pin pin-${r.status}" style="left:${r.point[0]}%;top:${r.point[1]}%;--delay:${i * 0.12}s" data-report="${r.id}" aria-label="${h(r.title)}, ${statusNames[r.status]}">${icon(r.status === "resolved" ? "check" : categories[r.category].icon)}<span class="pin-tooltip">${h(r.title)}</span></button>`).join("")}</div></div>`;
  }
  function mapView() {
    const list = filtered();
    return `<div class="page-heading"><h2>City map</h2><button class="primary-button" data-action="new-report">${icon("plus")}Report an issue</button></div><div class="map-toolbar"><label class="search-field">${icon("search")}<input id="mapSearch" placeholder="Search a street or report" value="${h(state.query)}" aria-label="Search reports"></label><div class="filter-row">${categoryButtons()}</div></div><div class="city-map-layout"><section class="full-map panel" id="fullMap">${mapMarkup()}<div class="map-legend"><span><i class="legend-review"></i>Under review</span><span><i class="legend-progress"></i>In progress</span><span><i class="legend-resolved"></i>Resolved</span></div><div class="map-controls"><button data-action="zoom-in" aria-label="Zoom in">${icon("plus")}</button><button data-action="zoom-out" aria-label="Zoom out">${icon("minus")}</button><button data-action="recenter" aria-label="Recenter map">${icon("target")}</button></div><span class="map-count">${list.length} reports</span></section><section class="map-results panel"><div class="map-results-header"><h3>Nearby</h3><select id="mapStatus" aria-label="Filter reports by status"><option value="all">All statuses</option>${Object.entries(
      statusNames,
    )
      .map(
        ([key, label]) =>
          `<option value="${key}" ${state.status === key ? "selected" : ""}>${label}</option>`,
      )
      .join(
        "",
      )}</select></div><div id="mapResultList">${mapList(list)}</div></section></div>`;
  }
  function mapList(list: CityReport[]) {
    return list.length
      ? list
          .map(
            (r) =>
              `<button class="map-result" data-report="${r.id}">${smallPhoto(r)}<span><strong>${h(r.title)}</strong><span class="location-line">${h(r.place)}</span>${status(r)}</span></button>`,
          )
          .join("")
      : `<div class="empty-state">${icon("search")}<h3>No reports here</h3><button class="text-button" data-action="clear-filters">Clear filters ${icon("arrow")}</button></div>`;
  }
  function reportCard(r: CityReport) {
    return `<article class="report-card"><button class="report-photo" data-report="${r.id}">${smallPhoto(r)}<span class="report-photo-status">${status(r)}</span></button><button class="card-follow ${following.has(r.id) ? "following" : ""}" data-action="follow" data-id="${r.id}" aria-label="${following.has(r.id) ? "Unfollow" : "Follow"} report">${icon("heart")}</button><div class="report-card-body"><button class="report-title" data-report="${r.id}">${h(r.title)}</button><span class="location-line">${icon("pin")}${h(r.place)}</span><div class="report-card-footer"><span>${icon(categories[r.category].icon)}${categories[r.category].name}</span><span class="support-count">${icon("user")}${r.support + (following.has(r.id) ? 1 : 0)}</span><span>${h(r.date)}</span></div></div></article>`;
  }
  function reportsView() {
    const own = reports.filter((r) => r.own),
      followed = reports.filter((r) => following.has(r.id));
    const list = filtered(state.reportTab === "mine" ? own : followed);
    return `<div class="page-heading"><h2>My reports</h2><button class="primary-button" data-action="new-report">${icon("plus")}New report</button></div><div class="reports-toolbar"><div class="tabs"><button data-action="report-tab" data-tab="mine" class="${state.reportTab === "mine" ? "active" : ""}">My reports <span>${own.length}</span></button><button data-action="report-tab" data-tab="following" class="${state.reportTab === "following" ? "active" : ""}">Following <span>${followed.length}</span></button></div><div class="filter-row status-filters">${[["all", "All"], ...Object.entries(statusNames)].map(([key, label]) => `<button class="filter-chip ${state.status === key ? "selected" : ""}" data-action="status-filter" data-status="${key}">${label}</button>`).join("")}</div></div><div class="reports-grid">${list.length ? list.map(reportCard).join("") : `<div class="empty-state empty-wide">${icon("reports")}<h3>${state.reportTab === "following" ? "No followed reports" : "No reports yet"}</h3><button class="primary-button" data-action="${state.reportTab === "following" ? "explore-map" : "new-report"}">${state.reportTab === "following" ? "Explore map" : "Create a report"} ${icon("arrow")}</button></div>`}</div>`;
  }
  function councilView() {
    const counts = {
      review: reports.filter((r) => r.status === "review").length,
      progress: reports.filter((r) => r.status === "progress").length,
      resolved: reports.filter((r) => r.status === "resolved").length,
    };
    return `<div class="page-heading council-heading"><h2>City operations</h2><div class="heading-actions"><span class="authority-badge">${icon("grid")}DBKL</span><button class="secondary-button" data-action="export">${icon("download")}Export</button></div></div><div class="council-metrics">${[
      ["review", "To review", "reports"],
      ["progress", "In progress", "wrench"],
      ["resolved", "Resolved", "check"],
    ]
      .map(
        ([key, label, ic]) =>
          `<button class="council-metric ${key}" data-action="status-filter" data-status="${state.status === key ? "all" : key}"><span>${icon(ic)}${label}</span><strong data-count="${counts[key as ReportStatus]}">${counts[key as ReportStatus]}</strong><div class="metric-track"><i style="width:${(counts[key as ReportStatus] / reports.length) * 100}%"></i></div></button>`,
      )
      .join("")}</div><div class="council-toolbar"><div class="tabs">${[
      ["queue", "list", "Priority queue"],
      ["board", "board", "Board"],
    ]
      .map(
        ([key, ic, label]) =>
          `<button class="${state.councilMode === key ? "active" : ""}" data-action="council-mode" data-mode="${key}">${icon(ic)}${label}</button>`,
      )
      .join(
        "",
      )}</div><div class="filter-row">${categoryButtons()}</div></div>${state.councilMode === "board" ? councilBoard() : councilQueue()}`;
  }
  function councilQueue() {
    const list = filtered().sort(
      (a, b) =>
        ({ high: 0, medium: 1, low: 2 })[a.priority] -
        { high: 0, medium: 1, low: 2 }[b.priority],
    );
    return `<div class="queue-panel panel"><div class="queue-row queue-head"><span>Report</span><span>Priority</span><span>Status</span><span>Reported</span><span></span></div>${list.map((r) => `<button class="queue-row" data-report="${r.id}"><span class="queue-case">${smallPhoto(r)}<span><strong>${h(r.title)}</strong><span>${h(r.place)}</span></span></span><span>${priority(r)}</span><span>${status(r)}</span><span class="queue-date">${h(r.date)}</span>${icon("arrow")}</button>`).join("") || `<div class="empty-state">${icon("check")}<h3>All clear.</h3><button class="text-button" data-action="clear-filters">Show all reports</button></div>`}</div>`;
  }
  function councilBoard() {
    return `<div class="kanban">${Object.entries(statusNames)
      .map(([key, label]) => {
        const list = filtered().filter((r) => r.status === key);
        return `<section class="kanban-column" data-drop-status="${key}"><div class="kanban-heading"><h3><i class="dot-${key}"></i>${label}</h3><span>${list.length}</span></div><div class="kanban-cards">${list.map((r) => `<article class="kanban-card" draggable="true" data-drag-id="${r.id}"><button data-report="${r.id}"><span class="kanban-card-top">${priority(r)}<span>${h(r.id)}</span></span><strong>${h(r.title)}</strong><span class="location-line">${icon("pin")}${h(r.place)}</span>${smallPhoto(r)}<span class="kanban-card-bottom">${icon(categories[r.category].icon)}${categories[r.category].name}<span>${r.support} following</span></span></button></article>`).join("")}<div class="drop-hint">Drop report here</div></div></section>`;
      })
      .join("")}</div>`;
  }
  function openOverlay(content: string, type = "modal") {
    pickerMap?.destroy();
    pickerMap = null;
    overlaySerial++;
    if (!document.body.classList.contains("overlay-open"))
      restoreFocus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    shell.inert = true;
    overlayRoot.innerHTML = `<div class="overlay overlay-${type}"><button class="overlay-backdrop" data-action="close-overlay" aria-label="Close dialog"></button><section class="${type}-panel" role="dialog" aria-modal="true" aria-labelledby="dialogTitle" tabindex="-1"><button class="dialog-close icon-button" data-action="close-overlay" aria-label="Close">${icon("x")}</button>${content}</section></div>`;
    document.body.classList.add("overlay-open");
    requestAnimationFrame(() =>
      $("." + type + "-panel", overlayRoot)?.focus({ preventScroll: true }),
    );
  }
  function closeOverlay(discardDraft = true) {
    cancelLocationRequest();
    pickerMap?.destroy();
    pickerMap = null;
    flowToken++;
    if (draft) {
      if (discardDraft) clearSavedDraft();
      else persistDraft();
    }
    draft = null;
    const old = overlayRoot.firstElementChild;
    if (old) {
      old.classList.add("leaving");
      setTimeout(() => old.remove(), 220);
    }
    document.body.classList.remove("overlay-open");
    shell.inert = document.body.classList.contains("intro-active");
    if (restoreFocus?.isConnected) restoreFocus.focus({ preventScroll: true });
  }
  function openReport(id: string, options: { route?: boolean } = {}) {
    const r = reports.find((r) => r.id === id);
    if (!r) return;
    if (options.route !== false) recordReportRoute(id);
    const steps = ["Submitted", "Under review", "Work scheduled", "Resolved"];
    const active = { review: 1, progress: 2, resolved: 3 }[r.status];
    openOverlay(
      `<div class="detail-photo">${smallPhoto(r)}<span>${status(r)}</span></div><div class="detail-content"><div class="detail-id">${h(r.id)}<span>${h(r.date)}${r.time ? " · " + h(r.time) : ""}</span></div><h2 id="dialogTitle">${h(r.title)}</h2><div class="detail-location">${icon("pin")}${h(r.place)}${r.area ? ", " + h(r.area) : ""}</div><div class="detail-tags"><span class="category-tag">${icon(categories[r.category].icon)}${categories[r.category].name}</span>${priority(r)}</div><p class="detail-description">${h(r.description)}</p><div class="authority-row"><span class="authority-icon">${icon("grid")}</span><span><strong>DBKL</strong><span>Dewan Bandaraya Kuala Lumpur</span></span>${icon("check", "verified")}</div><div class="detail-section"><h3>Report status</h3><ol class="timeline">${steps.map((step, i) => `<li class="${i <= active ? "done" : ""} ${i === active ? "current" : ""}"><span class="timeline-dot">${i < active || r.status === "resolved" ? icon("check") : "<i></i>"}</span><span><strong>${step}</strong>${i === active ? `<span>${r.status === "resolved" ? "This report is marked as resolved." : r.status === "progress" ? "Work is in progress." : "Awaiting review."}</span>` : ""}</span></li>`).join("")}</ol></div>${
        state.view === "council"
          ? `<div class="status-editor"><label for="caseStatus">Update status</label><select id="caseStatus" data-id="${r.id}">${Object.entries(
              statusNames,
            )
              .map(
                ([key, label]) =>
                  `<option value="${key}" ${r.status === key ? "selected" : ""}>${label}</option>`,
              )
              .join("")}</select></div>`
          : ""
      }<div class="detail-actions"><button class="primary-button ${following.has(id) ? "is-following" : ""}" data-action="follow-detail" data-id="${id}">${icon(following.has(id) ? "check" : "heart")}${following.has(id) ? "Following updates" : "Follow updates"}</button><button class="secondary-button square" data-action="share" data-id="${id}" aria-label="Copy report link">${icon("share")}</button></div></div>`,
      "drawer",
    );
  }
  function newDraft(options: Partial<ReportDraft> = {}) {
    draft = {
      step: 1,
      description: options.description || state.homeText || "",
      category: options.category || state.homeCategory || "roads",
      location:
        options.location ||
        (validLngLat(options.lngLat)
          ? coordinateLabel(options.lngLat)
          : "Jalan Sultan Ismail, Kuala Lumpur"),
      photo: options.photo || "",
      point: validPoint(options.point)
        ? options.point
        : validLngLat(options.lngLat)
          ? locationPoint(options.lngLat)
          : [47, 49],
      ...(validLngLat(options.lngLat) ? { lngLat: options.lngLat } : {}),
      priority: "medium",
      language: "en",
      title: "",
      texts: { en: "", bm: "" },
      progress: 0,
    };
    flowToken++;
    renderWizard();
  }
  function renderWizard() {
    if (!draft) return;
    const d = draft;
    let html = "";
    if (d.step === 1)
      html = `<div class="wizard-heading"><span class="step-indicator"><i class="active"></i><i></i><i></i></span><h2 id="dialogTitle">New report</h2></div><div class="wizard-body"><button class="photo-drop ${d.photo ? "has-photo" : ""}" data-action="draft-photo">${d.photo ? `<img src="${h(d.photo)}" alt="Your report photo"><span class="change-photo">${icon("camera")}Change photo</span>` : `<span class="upload-camera">${icon("camera")}</span><strong>Add a photo</strong><span class="upload-plus">${icon("plus")}</span>`}</button>${!d.photo ? `<button class="example-link" data-action="example-photo">Use an example photo ${icon("arrow")}</button>` : ""}<div class="wizard-categories">${Object.entries(
        categories,
      )
        .map(
          ([key, c]) =>
            `<button class="${d.category === key ? "selected" : ""}" data-action="draft-category" data-category="${key}">${icon(c.icon)}${c.name}</button>`,
        )
        .join(
          "",
        )}</div><textarea id="draftDescription" class="form-textarea" placeholder="Describe the problem" aria-label="Describe the issue">${h(d.description)}</textarea><label class="location-input"><button data-action="manual-location" aria-label="Choose location on map" title="Choose location on map">${icon("pin")}</button><input id="draftLocation" value="${h(d.location)}" aria-label="Issue location"><button data-action="draft-location" aria-label="Use my current location" title="Use my current location">${icon("target")}</button></label></div><div class="wizard-footer"><button class="text-button" data-action="close-overlay">Cancel</button><button class="primary-button" data-action="analyze">Continue ${icon("arrow")}</button></div>`;
    if (d.step === 2)
      html = `<div class="analysis-view"><div class="analysis-orbit"><i></i><i></i><span>${icon("spark")}</span></div><h2 id="dialogTitle">Preparing report</h2><div class="scan-preview">${d.photo ? `<img src="${h(d.photo)}" alt="Report photo being reviewed">` : `<div class="scan-placeholder">${icon(categories[d.category].icon)}</div>`}<span class="scan-line"></span><i class="scan-corner tl"></i><i class="scan-corner tr"></i><i class="scan-corner bl"></i><i class="scan-corner br"></i></div><div class="analysis-steps"><span class="analysis-check">${icon("check")}Identifying the issue</span><span class="analysis-check">${icon("check")}Finding the right team</span><span class="analysis-check">${icon("check")}Preparing your report</span></div><div class="analysis-progress"><i></i></div></div>`;
    if (d.step === 3) {
      const duplicate = reports.find(
        (r) =>
          r.category === d.category &&
          r.status !== "resolved" &&
          Math.hypot(r.point[0] - d.point[0], r.point[1] - d.point[1]) < 15,
      );
      html = `<div class="wizard-heading"><span class="step-indicator"><i class="done"></i><i class="done"></i><i class="active"></i></span><h2 id="dialogTitle">Review report</h2></div><div class="wizard-body review-body"><div class="review-summary">${d.photo ? `<img src="${h(d.photo)}" alt="Report photo">` : `<span class="review-category-icon">${icon(categories[d.category].icon)}</span>`}<div><input id="reviewTitle" value="${h(d.title)}" aria-label="Report title"><span>${icon("pin")}${h(d.location)}</span></div></div><div class="review-toolbar"><span class="category-tag">${icon(categories[d.category].icon)}${categories[d.category].name}</span><div class="language-switch"><button class="${d.language === "en" ? "active" : ""}" data-action="report-language" data-lang="en">EN</button><button class="${d.language === "bm" ? "active" : ""}" data-action="report-language" data-lang="bm">BM</button></div></div><textarea id="reviewDescription" class="review-description" aria-label="Report description">${h(d.texts[d.language])}</textarea><div class="review-routing"><span class="authority-icon">${icon("grid")}</span><strong>DBKL</strong><select id="draftPriority" aria-label="Report priority"><option value="high" ${d.priority === "high" ? "selected" : ""}>High priority</option><option value="medium" ${d.priority === "medium" ? "selected" : ""}>Medium priority</option><option value="low" ${d.priority === "low" ? "selected" : ""}>Low priority</option></select></div>${duplicate ? `<div class="duplicate-hint"><span>${icon("reports")}</span><div><strong>A similar report is nearby</strong><span>${h(duplicate.title)}</span></div><button class="text-button" data-action="follow-duplicate" data-id="${duplicate.id}">Follow ${icon("arrow")}</button></div>` : ""}</div><div class="wizard-footer"><button class="text-button" data-action="draft-back">${icon("arrow", "flipped")}Back</button><button class="primary-button" data-action="submit-report">Add report ${icon("arrow")}</button></div>`;
    }
    if (d.step === 4)
      html = `<div class="success-view"><div class="confetti">${Array.from({ length: 24 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--r:${i * 71}deg;--delay:${(i % 6) * 0.07}s;--color:${["#2582f6", "#ffc83d", "#6ac49a", "#a89be9"][i % 4]}"></i>`).join("")}</div><div class="success-check"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="36"/><path d="m24 40 11 11 22-23"/></svg></div><h2 id="dialogTitle">Report added</h2><p>${h(lastCreated!.id)}</p><button class="primary-button" data-action="view-created">View report ${icon("arrow")}</button><button class="text-button" data-action="close-overlay">Done</button></div>`;
    const keep = draft;
    openOverlay(html, "modal");
    draft = keep;
    draft.pickerOpen = false;
    $(".modal-panel")?.classList.add("wizard-modal");
    persistDraft();
  }
  function saveDraftFields() {
    if (!draft) return;
    const desc = $<HTMLTextAreaElement>("#draftDescription"),
      loc = $<HTMLInputElement>("#draftLocation"),
      picked = $<HTMLInputElement>("#pickedAddress");
    if (desc) draft.description = desc.value;
    if (loc) draft.location = loc.value;
    if (picked) draft.location = picked.value;
    const title = $<HTMLInputElement>("#reviewTitle"),
      text = $<HTMLTextAreaElement>("#reviewDescription"),
      priority = $<HTMLSelectElement>("#draftPriority");
    if (title) draft.title = title.value;
    if (text) draft.texts[draft.language] = text.value;
    if (priority)
      draft.priority = oneOf(
        priority.value,
        ["high", "medium", "low"],
        "medium",
      );
  }
  function analyze() {
    if (!draft) return;
    saveDraftFields();
    if (!draft.photo && !draft.description.trim()) {
      toast("Add a photo or tell us what you spotted");
      $<HTMLTextAreaElement>("#draftDescription")?.focus();
      return;
    }
    const terms = draft.description.toLowerCase();
    if (/drain|flood|longkang/.test(terms)) draft.category = "drains";
    else if (/light|lamp|gelap/.test(terms)) draft.category = "lighting";
    else if (/rubbish|waste|dump|sampah/.test(terms)) draft.category = "waste";
    else if (/pothole|road|jalan/.test(terms)) draft.category = "roads";
    draft.step = 2;
    renderWizard();
    const token = ++flowToken;
    setTimeout(
      () => {
        if (token !== flowToken || !draft) return;
        const c = draft.category;
        draft.title = {
          roads: "Damaged road surface",
          lighting: "Streetlight needs attention",
          drains: "Blocked roadside drain",
          waste: "Waste needs clearing",
        }[c];
        draft.priority = ["roads", "drains"].includes(c) ? "high" : "medium";
        draft.texts.en =
          draft.description.trim() ||
          {
            roads: "A damaged section of road needs inspection and repair.",
            lighting:
              "Street lighting at this location needs inspection and repair.",
            drains: "A blocked drain at this location needs to be cleared.",
            waste: "Rubbish at this location needs to be collected.",
          }[c];
        draft.texts.bm = {
          roads:
            "Permukaan jalan rosak di lokasi ini. Mohon pemeriksaan dan kerja pembaikan untuk keselamatan pengguna jalan raya.",
          lighting:
            "Lampu jalan di lokasi ini memerlukan pemeriksaan dan pembaikan demi keselamatan orang ramai.",
          drains:
            "Longkang di lokasi ini tersumbat. Mohon kerja pembersihan bagi mengelakkan air bertakung dan banjir.",
          waste:
            "Sampah terkumpul di lokasi ini. Mohon kutipan dan pembersihan kawasan.",
        }[c];
        draft.step = 3;
        renderWizard();
      },
      reduced() ? 500 : 2600,
    );
  }
  function submitReport() {
    if (!draft) return;
    saveDraftFields();
    if (!draft.title.trim()) {
      toast("Give your report a title");
      return;
    }
    draft.priority = oneOf(
      $<HTMLSelectElement>("#draftPriority")?.value,
      ["high", "medium", "low"],
      draft.priority,
    );
    const next = 1049 + reports.filter((r) => r.local).length;
    lastCreated = {
      id: `FMC-${next}`,
      title: draft.title,
      description: draft.texts.en,
      descriptionBm: draft.texts.bm,
      category: draft.category,
      place: draft.location.replace(/,\s*Kuala Lumpur$/i, ""),
      area: validLngLat(draft.lngLat) ? "" : "Kuala Lumpur",
      photo: draft.photo,
      status: "review",
      priority: draft.priority,
      point: draft.point,
      ...(validLngLat(draft.lngLat) ? { lngLat: draft.lngLat } : {}),
      date: "Just now",
      time: "",
      support: 0,
      own: true,
      local: true,
    };
    reports.unshift(lastCreated);
    following.add(lastCreated!.id);
    persist();
    state.homeText = "";
    state.homeCategory = null;
    draft.step = 4;
    renderWizard();
    render();
  }
  function showNotifications() {
    openOverlay(
      `<div class="simple-dialog"><h2 id="dialogTitle">Notifications</h2><div class="notification-list">${reports
        .filter((r) => r.own || following.has(r.id))
        .slice(0, 4)
        .map(
          (r) =>
            `<button data-report="${r.id}"><span class="notification-icon ${r.status}">${icon(r.status === "resolved" ? "check" : r.status === "progress" ? "wrench" : "reports")}</span><span><strong>${r.status === "resolved" ? "Report resolved" : r.status === "progress" ? "Work in progress" : "Report under review"}</strong><span>${h(r.title)}</span></span>${icon("arrow")}</button>`,
        )
        .join("")}</div></div>`,
    );
    $(".notification-button i")?.classList.add("read");
  }
  function showAbout() {
    openOverlay(
      `<div class="simple-dialog about-dialog"><img class="about-logo" src="assets/brand-wordmark.svg" alt="FixMyCity"><h2 id="dialogTitle">About FixMyCity</h2><p>This is the FixMyCity UI preview. Cases, marker locations and progress are illustrative. New reports stay in this browser and are not sent to a council.</p><div class="about-features"><span>${icon("camera")}Report</span><span>${icon("pin")}Locate</span><span>${icon("check")}Track</span></div><details class="photo-credits"><summary>Photo credits</summary><p><a href="https://commons.wikimedia.org/wiki/File:Blocked_Drain_-_geograph.org.uk_-_288442.jpg" target="_blank" rel="noopener">Blocked Drain — Hugh Venables</a>, <a href="https://creativecommons.org/licenses/by-sa/2.0/" target="_blank" rel="noopener">CC BY-SA 2.0</a>. Resized and converted to WebP.</p><p>Other imagery: public-domain and Unsplash photographs. Images illustrate example cases and are not evidence of current conditions in Kuala Lumpur.</p></details></div>`,
    );
  }
  function showSettings() {
    openOverlay(
      `<div class="simple-dialog"><h2 id="dialogTitle">Settings</h2><div class="settings-list"><button data-action="install-app"><span>${icon("download")}<span class="install-label">${window.FixMyCityPWA?.getState().installed ? "App installed" : "Install app"}</span></span>${icon("arrow")}</button><button data-action="toggle-motion"><span>${icon("spark")}Motion</span><span class="toggle ${motion ? "on" : ""}" role="switch" aria-checked="${motion}" aria-label="Animations"><i></i></span></button><button data-action="replay-intro"><span>${icon("arrow")}Replay intro</span>${icon("arrow")}</button><button data-action="reset-preview"><span>${icon("reports")}Reset preview</span>${icon("arrow")}</button></div></div>`,
    );
  }
  function showNeighborhood() {
    openOverlay(
      `<div class="simple-dialog"><h2 id="dialogTitle">Choose a neighborhood</h2><div class="neighborhood-options">${["All neighborhoods", "Bukit Bintang", "Chow Kit", "Kampung Baru", "KLCC", "Chinatown"].map((area, i) => `<button data-action="choose-area" data-area="${i ? area : ""}">${icon("pin")}<span>${area}</span>${icon("arrow")}</button>`).join("")}</div></div>`,
    );
  }
  function showLocationPicker() {
    if (!draft) return;
    saveDraftFields();
    const d = draft;
    openOverlay(
      `<div class="simple-dialog location-dialog"><h2 id="dialogTitle">Set report location</h2><div class="pick-map" id="pickMap"><div class="map-world"><img src="assets/city-map.svg" alt="Illustrated neighborhood map"><span class="pick-pin" style="left:${d.point[0]}%;top:${d.point[1]}%">${icon("pin")}</span></div></div><label class="location-input">${icon("pin")}<input id="pickedAddress" aria-label="Street address or coordinates" value="${h(d.location)}"><button data-action="draft-location" aria-label="Use my current location" title="Use my current location">${icon("target")}</button></label><button class="primary-button full-width" data-action="confirm-location">Use this location ${icon("check")}</button></div>`,
    );
    draft = d;
    draft.pickerOpen = true;
    persistDraft();
    pickerMap = window.CityMap?.mount(
      $("#pickMap"),
      [
        {
          id: "draft-location",
          title: "Report location",
          status: "review",
          category: d.category,
          point: d.point,
          lngLat: d.lngLat,
        },
      ],
      {
        reduced,
        onPick: (point, lngLat) => {
          if (draft) {
            cancelLocationRequest();
            draft.point = point;
            if (validLngLat(lngLat)) {
              draft.lngLat = lngLat;
              draft.location = coordinateLabel(lngLat);
              $<HTMLInputElement>("#pickedAddress").value = draft.location;
            }
            persistDraft();
          }
        },
      },
    );
  }
  function cancelLocationRequest() {
    locationRequest++;
    locationBusyCleanup?.();
    locationBusyCleanup = null;
  }
  function requestDraftLocation() {
    if (!draft) newDraft();
    cancelLocationRequest();
    showLocationPicker();
    const targetDraft = draft,
      request = locationRequest,
      button = $<HTMLButtonElement>(
        '[data-action="draft-location"]',
        overlayRoot,
      );
    let animation: Animation | null | undefined = null;
    if (button) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.setAttribute("aria-label", "Finding your current location");
      button.title = "Finding your current location";
      if (!reduced())
        animation = $(".icon", button)?.animate?.(
          [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
          { duration: 1000, iterations: Infinity },
        );
    }
    const cleanup = () => {
      animation?.cancel();
      if (button) {
        button.disabled = false;
        button.removeAttribute("aria-busy");
        button.setAttribute("aria-label", "Use my current location");
        button.title = "Use my current location";
      }
    };
    locationBusyCleanup = cleanup;
    const current = () => draft === targetDraft && request === locationRequest;
    const finish = () => {
      cleanup();
      if (locationBusyCleanup === cleanup) locationBusyCleanup = null;
    };
    const fail = (error?: GeolocationPositionError) => {
      finish();
      if (!current()) return;
      toast(
        error?.code === 1
          ? "Location access was denied. Choose a point on the map or enter an address."
          : error?.code === 3
            ? "Location request timed out. Choose a point on the map or enter an address."
            : "Your location is unavailable. Choose a point on the map or enter an address.",
      );
    };
    if (!navigator.geolocation) {
      fail();
      return;
    }
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          finish();
          if (!current() || !draft) return;
          const lngLat = [position.coords.longitude, position.coords.latitude];
          if (!validLngLat(lngLat)) {
            fail();
            return;
          }
          draft.lngLat = lngLat;
          draft.point = locationPoint(lngLat);
          draft.location = coordinateLabel(lngLat);
          const address = $<HTMLInputElement>("#pickedAddress");
          if (address) address.value = draft.location;
          persistDraft();
          pickerMap?.setReports([
            {
              id: "draft-location",
              title: "Report location",
              status: "review",
              category: draft.category,
              point: draft.point,
              lngLat,
            },
          ]);
          toast("Current location added");
        },
        fail,
        { enableHighAccuracy: true, maximumAge: 60000, timeout: 12000 },
      );
    } catch {
      fail();
    }
  }
  function follow(id: string, refresh = true) {
    if (following.has(id)) following.delete(id);
    else following.add(id);
    persist();
    if (refresh) render();
    toast(following.has(id) ? "Following this report" : "Unfollowed report");
  }
  function updateStatus(id: string, value: unknown) {
    const r = reports.find((r) => r.id === id);
    if (!r || !isStatus(value)) return;
    r.status = value;
    persist();
    render();
    toast(
      value === "resolved" ? "Report marked as resolved" : "Status updated",
    );
  }
  function exportReports() {
    const cell = (x: unknown) =>
      '"' +
      String(x ?? "")
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const csv = [
      ["Report", "Issue", "Location", "Category", "Priority", "Status"],
      ...filtered().map((r) => [
        r.id,
        r.title,
        r.place,
        categories[r.category].name,
        r.priority,
        statusNames[r.status],
      ]),
    ]
      .map((row) => row.map(cell).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "fixmycity-reports.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast("Report list exported");
  }
  function closeNav() {
    document.body.classList.remove("nav-open");
  }
  function setMapTransform() {
    const world = $(".interactive-map .map-world");
    if (world) {
      world.style.setProperty("--zoom", String(state.mapZoom));
      world.style.setProperty("--pan-x", state.mapX + "px");
      world.style.setProperty("--pan-y", state.mapY + "px");
    }
  }
  function bindMap() {
    const map = $(".interactive-map");
    if (!map) return;
    let drag: { x: number; y: number; px: number; py: number } | null = null;
    map.addEventListener("pointerdown", (e) => {
      if (
        (e.target instanceof Element ? e.target : null)?.closest<HTMLElement>(
          "button",
        )
      )
        return;
      drag = { x: e.clientX, y: e.clientY, px: state.mapX, py: state.mapY };
      map.setPointerCapture(e.pointerId);
      map.classList.add("dragging");
    });
    map.addEventListener("pointermove", (e) => {
      if (!drag) return;
      state.mapX = Math.max(-250, Math.min(250, drag.px + e.clientX - drag.x));
      state.mapY = Math.max(-180, Math.min(180, drag.py + e.clientY - drag.y));
      setMapTransform();
    });
    const end = () => {
      drag = null;
      map.classList.remove("dragging");
    };
    map.addEventListener("pointerup", end);
    map.addEventListener("pointercancel", end);
  }
  function mountMaps() {
    if (!window.CityMap) return;
    $$("[data-map]", root).forEach((map) =>
      window.CityMap.mount(
        map,
        map.dataset.map === "home" ? reports : filtered(),
        {
          interactive: map.dataset.map === "full",
          reduced,
          onReport: openReport,
        },
      ),
    );
  }
  function refreshMap() {
    persistUi();
    const list = filtered(),
      map = $("#fullMap");
    if (!map) return;
    $("#mapResultList").innerHTML = mapList(list);
    $(".map-count", map).textContent = list.length + " reports";
    $$('.map-toolbar [data-action="category"]').forEach((button) =>
      button.classList.toggle(
        "selected",
        button.dataset.category === state.category,
      ),
    );
    const temporary = document.createElement("div");
    temporary.innerHTML = mapMarkup();
    const world = $(".map-world", map);
    if (world) world.innerHTML = $(".map-world", temporary).innerHTML;
    window.CityMap?.setReports(list);
  }
  function startStoryRotation() {
    clearInterval(storyTimer);
    if (state.view === "home" && !reduced())
      storyTimer = setInterval(() => {
        if (!document.hidden && !overlayRoot.children.length)
          setStory((state.story + 1) % 4);
      }, 6500);
  }
  function bindStoryGestures() {
    const stage = $("#storyStage");
    if (!stage) return;
    storyCleanup = window.StoryGestures?.bind(stage, {
      reduced,
      onSwipe: (direction) =>
        setStory((state.story + (direction === "left" ? 1 : 3)) % 4, direction),
    });
    stage.addEventListener("pointerdown", () => clearInterval(storyTimer), {
      passive: true,
    });
    stage.addEventListener("pointerup", startStoryRotation, { passive: true });
    stage.addEventListener("pointercancel", startStoryRotation, {
      passive: true,
    });
  }
  function chooseReportPhoto() {
    saveDraftFields();
    if (window.PhotoPicker)
      window.PhotoPicker.open({ onPhoto: acceptReportPhoto });
    else $<HTMLInputElement>("#photoInput").click();
  }
  async function acceptReportPhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Choose an image file");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast("Choose an image smaller than 12 MB");
      return;
    }
    try {
      const data = await readPhoto(file);
      if (!draft) newDraft({ photo: data });
      else {
        saveDraftFields();
        draft.photo = data;
        renderWizard();
      }
    } catch {
      toast("This photo could not be opened");
    }
  }
  function bindTilt() {
    $$(".story-card").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        if (reduced() || e.pointerType === "touch") return;
        const r = card.getBoundingClientRect();
        card.style.setProperty(
          "--tilt-x",
          ((e.clientY - r.top) / r.height - 0.5) * -5 + "deg",
        );
        card.style.setProperty(
          "--tilt-y",
          ((e.clientX - r.left) / r.width - 0.5) * 5 + "deg",
        );
      });
      card.addEventListener("pointerleave", () => {
        card.style.setProperty("--tilt-x", "0deg");
        card.style.setProperty("--tilt-y", "0deg");
      });
    });
  }
  function animateNumbers() {
    if (reduced()) return;
    $$("[data-count]", root).forEach((el) => {
      const value = Number(el.dataset.count),
        start = performance.now();
      const frame = (t: number) => {
        if (!el.isConnected) return;
        const p = Math.min(1, (t - start) / 850);
        el.textContent = String(Math.round(value * (1 - (1 - p) ** 3)));
        if (p < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }
  document.addEventListener("click", async (event) => {
    const viewButton = (
      event.target instanceof Element ? event.target : null
    )?.closest<HTMLElement>("[data-view]");
    if (viewButton) {
      navigate(viewButton.dataset.view || "home");
      return;
    }
    const reportButton = (
      event.target instanceof Element ? event.target : null
    )?.closest<HTMLElement>("[data-report]");
    if (reportButton) {
      openReport(reportButton.dataset.report || "");
      return;
    }
    const el = (
      event.target instanceof Element ? event.target : null
    )?.closest<HTMLElement>("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    if (
      [
        "example-photo",
        "draft-category",
        "draft-back",
        "confirm-location",
        "report-language",
      ].includes(action || "") &&
      !draft
    )
      return;
    if (action === "new-report" || action === "start-report") {
      newDraft();
    } else if (action === "quick-photo") {
      chooseReportPhoto();
    } else if (action === "quick-location") {
      newDraft();
      requestDraftLocation();
    } else if (action === "quick-category") {
      state.homeCategory = oneOf(
        el.dataset.category,
        ["roads", "lighting", "drains", "waste"],
        "roads",
      );
      persistUi();
      $$(".quick-chip").forEach((b) =>
        b.classList.toggle("selected", b === el),
      );
      setStory(
        (Object.keys(categories) as Category[]).indexOf(
          oneOf(
            el.dataset.category,
            ["roads", "lighting", "drains", "waste"],
            "roads",
          ),
        ),
      );
      $<HTMLTextAreaElement>("#quickDescription")?.focus();
    } else if (action === "story") setStory(Number(el.dataset.index));
    else if (action === "pulse")
      navigate("map", {
        status: oneOf<ReportStatus | "all">(
          el.dataset.status,
          ["all", "review", "progress", "resolved"],
          "all",
        ),
      });
    else if (action === "category") {
      state.category = oneOf(
        el.dataset.category,
        ["all", "roads", "lighting", "drains", "waste"],
        "roads",
      );
      if (state.view === "map") refreshMap();
      else render();
    } else if (action === "status-filter") {
      state.status = oneOf(
        el.dataset.status,
        ["all", "review", "progress", "resolved"],
        "all",
      );
      render();
    } else if (action === "clear-filters") {
      state.query = "";
      state.category = "all";
      state.status = "all";
      render();
    } else if (action === "report-tab") {
      state.reportTab = oneOf(el.dataset.tab, ["mine", "following"], "mine");
      state.status = "all";
      render();
    } else if (action === "council-mode") {
      state.councilMode = oneOf(el.dataset.mode, ["queue", "board"], "queue");
      render();
    } else if (action === "follow") follow(el.dataset.id || "");
    else if (action === "follow-detail") {
      follow(el.dataset.id || "");
      openReport(el.dataset.id || "");
    } else if (action === "share") {
      try {
        await navigator.clipboard.writeText(
          location.href.split("#")[0] + reportRoute(el.dataset.id || ""),
        );
        toast("Report link copied");
      } catch {
        toast("Copy the link from your address bar");
      }
    } else if (action === "explore-map") {
      closeOverlay();
      navigate("map");
    } else if (action === "close-overlay") dismissOverlay();
    else if (action === "notifications") showNotifications();
    else if (action === "settings") showSettings();
    else if (action === "about") showAbout();
    else if (action === "neighborhood") showNeighborhood();
    else if (action === "choose-area") {
      closeOverlay();
      navigate("map");
      state.query = el.dataset.area || "";
      render();
    } else if (action === "open-nav") document.body.classList.add("nav-open");
    else if (action === "close-nav") closeNav();
    else if (action === "dismiss-toast")
      $("#toast").classList.remove("visible");
    else if (action === "zoom-in") {
      if (window.CityMap?.zoom(1)) return;
      state.mapZoom = Math.min(2.3, state.mapZoom + 0.25);
      setMapTransform();
    } else if (action === "zoom-out") {
      if (window.CityMap?.zoom(-1)) return;
      state.mapZoom = Math.max(1, state.mapZoom - 0.25);
      setMapTransform();
    } else if (action === "recenter") {
      if (window.CityMap?.recenter()) return;
      state.mapZoom = 1.25;
      state.mapX = 0;
      state.mapY = 0;
      setMapTransform();
      toast("Centered on your neighborhood");
    } else if (action === "draft-photo") {
      chooseReportPhoto();
    } else if (action === "example-photo" && draft) {
      saveDraftFields();
      draft.photo = photos[draft.category];
      renderWizard();
    } else if (action === "draft-category" && draft) {
      saveDraftFields();
      const previous = photos[draft.category];
      draft.category = oneOf(
        el.dataset.category,
        ["roads", "lighting", "drains", "waste"],
        "roads",
      );
      if (draft.photo === previous) draft.photo = photos[draft.category];
      renderWizard();
    } else if (action === "analyze") analyze();
    else if (action === "draft-back" && draft) {
      saveDraftFields();
      draft.step = 1;
      renderWizard();
    } else if (action === "draft-location") requestDraftLocation();
    else if (action === "manual-location") {
      cancelLocationRequest();
      showLocationPicker();
    } else if (action === "confirm-location" && draft) {
      cancelLocationRequest();
      draft.location = $<HTMLInputElement>("#pickedAddress").value;
      draft.step = 1;
      renderWizard();
    } else if (action === "report-language" && draft) {
      saveDraftFields();
      draft.language = oneOf(el.dataset.lang, ["en", "bm"], "en");
      renderWizard();
    } else if (action === "follow-duplicate") {
      const id = el.dataset.id || "";
      following.add(id);
      persist();
      closeOverlay();
      render();
      openReport(id);
      toast("Following the existing report");
    } else if (action === "submit-report") submitReport();
    else if (action === "view-created") {
      const id = lastCreated!.id;
      closeOverlay();
      navigate("reports");
      openReport(id);
    } else if (action === "export") exportReports();
    else if (action === "toggle-motion") {
      motion = !motion;
      document.body.classList.toggle("reduce-motion", !motion);
      persist();
      showSettings();
      render();
    } else if (action === "replay-intro") {
      closeOverlay();
      startIntro(true);
    } else if (action === "install-app") {
      const result = await window.FixMyCityPWA?.install();
      if (result?.status === "installed") toast("FixMyCity is installed");
    } else if (action === "reset-preview") {
      reports = seed.map((r) => ({ ...r }));
      following = new Set(["FMC-1046", "FMC-1045"]);
      persist();
      closeOverlay();
      navigate("home");
      toast("Preview reset");
    }
  });
  document.addEventListener("input", (event) => {
    const el = event.target;
    if (!(
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ))
      return;
    if (el.id === "quickDescription") state.homeText = el.value;
    if (el.id === "mapSearch") {
      state.query = el.value;
      refreshMap();
    }
    if (draft) saveDraftFields();
    schedulePersistence();
  });
  document.addEventListener("change", (event) => {
    const el = event.target;
    if (!(
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ))
      return;
    if (el.id === "mapStatus") {
      state.status = oneOf(
        el.value,
        ["all", "review", "progress", "resolved"],
        "all",
      );
      refreshMap();
    }
    if (el.id === "caseStatus") {
      const id = el.dataset.id || "";
      updateStatus(id, el.value);
      openReport(id);
    }
    if (draft) persistDraft();
  });
  document.addEventListener("click", (event) => {
    const map = (
      event.target instanceof Element ? event.target : null
    )?.closest<HTMLElement>("#pickMap");
    if (
      map &&
      draft &&
      !(
        event.target instanceof Element ? event.target : null
      )?.closest<HTMLElement>(".city-live-map")
    ) {
      const r = map.getBoundingClientRect();
      draft.point = [
        Math.round(((event.clientX - r.left) / r.width) * 100),
        Math.round(((event.clientY - r.top) / r.height) * 100),
      ];
      cancelLocationRequest();
      const lngLat = window.CityMap?.toLngLat(draft.point);
      if (validLngLat(lngLat)) {
        draft.lngLat = lngLat;
        draft.location = coordinateLabel(lngLat);
        $<HTMLInputElement>("#pickedAddress").value = draft.location;
      } else delete draft.lngLat;
      const pin = $(".pick-pin", map);
      pin.style.left = draft.point[0] + "%";
      pin.style.top = draft.point[1] + "%";
      persistDraft();
    }
  });
  $<HTMLInputElement>("#photoInput").addEventListener("change", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    acceptReportPhoto(file);
  });
  function readPhoto(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas
          .getContext("2d")!
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject();
      };
      img.src = url;
    });
  }
  document.addEventListener("dragover", (event) => {
    const drop = (
      event.target instanceof Element ? event.target : null
    )?.closest<HTMLElement>(".photo-drop,[data-drop-status]");
    if (drop) {
      event.preventDefault();
      drop.classList.add("drag-over");
    }
  });
  document.addEventListener("dragleave", (event) =>
    (event.target instanceof Element ? event.target : null)
      ?.closest<HTMLElement>(".photo-drop,[data-drop-status]")
      ?.classList.remove("drag-over"),
  );
  document.addEventListener("dragstart", (event) => {
    const card = (
      event.target instanceof Element ? event.target : null
    )?.closest<HTMLElement>("[data-drag-id]");
    if (card)
      event.dataTransfer!.setData("text/plain", card.dataset.dragId || "");
  });
  document.addEventListener("drop", async (event) => {
    const column = (
      event.target instanceof Element ? event.target : null
    )?.closest<HTMLElement>("[data-drop-status]");
    if (column) {
      event.preventDefault();
      column.classList.remove("drag-over");
      updateStatus(
        event.dataTransfer!.getData("text/plain"),
        column.dataset.dropStatus,
      );
    }
    const photoDrop = (
      event.target instanceof Element ? event.target : null
    )?.closest<HTMLElement>(".photo-drop");
    if (photoDrop && draft) {
      event.preventDefault();
      photoDrop.classList.remove("drag-over");
      const file = event.dataTransfer!.files[0];
      if (file?.type.startsWith("image/") && file.size < 12 * 1024 * 1024) {
        try {
          saveDraftFields();
          draft.photo = await readPhoto(file);
          renderWizard();
        } catch {
          toast("This photo could not be opened");
        }
      }
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (overlayRoot.children.length) dismissOverlay();
      closeNav();
    }
    if (event.key === "Tab" && overlayRoot.children.length) {
      const panel = $("[role=dialog]", overlayRoot);
      if (!panel) return;
      const items = $$(
        'button:not([disabled]),input,textarea,select,a[href],[tabindex="0"]',
        panel,
      ).filter((el) => el.offsetParent !== null);
      const first = items[0],
        last = items.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === panel)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    if (
      event.key === "/" &&
      !/INPUT|TEXTAREA|SELECT/.test(
        event.target instanceof Element ? event.target.tagName : "",
      ) &&
      !overlayRoot.children.length
    ) {
      event.preventDefault();
      navigate("map");
    }
  });
  // A light press ripple is shared across primary actions and navigation.
  document.addEventListener("pointerdown", (event) => {
    const button = (
      event.target instanceof Element ? event.target : null
    )?.closest<HTMLElement>(
      ".primary-button,.sidebar-report,.nav-item,.send-circle",
    );
    if (!button || reduced()) return;
    const rect = button.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.left = event.clientX - rect.left + "px";
    ripple.style.top = event.clientY - rect.top + "px";
    button.append(ripple);
    setTimeout(() => ripple.remove(), 650);
  });
  function finishIntro(immediate = false) {
    if (introFinished) return;
    introFinished = true;
    clearTimeout(introTimer);
    $("#intro").classList.add("intro-out");
    shell.inert = document.body.classList.contains("overlay-open");
    document.body.classList.remove("intro-active");
    document.body.classList.add("app-ready");
    const hide = () => {
      $("#intro").hidden = true;
      $<HTMLIFrameElement>("#intro iframe").removeAttribute("src");
      document.documentElement.classList.add("intro-seen");
    };
    if (immediate) hide();
    else introHideTimer = setTimeout(hide, 700);
    const resume = afterIntro;
    afterIntro = null;
    resume?.();
  }
  function startIntro(force = false) {
    clearTimeout(introTimer);
    clearTimeout(introHideTimer);
    introFinished = false;
    lastActivity = Date.now();
    writeActivity();
    if (!force && window.__fixmycitySkipIntro) {
      finishIntro(true);
      return;
    }
    document.documentElement.classList.remove("intro-seen");
    $("#intro").hidden = false;
    $("#intro").classList.remove("intro-out");
    document.body.classList.add("intro-active");
    document.body.classList.remove("app-ready");
    shell.inert = true;
    const frame = $<HTMLIFrameElement>("#intro iframe");
    frame.src = frame.dataset.src + (force ? "?replay=" + Date.now() : "");
    introTimer = setTimeout(() => finishIntro(), 8500);
  }
  addEventListener("message", (event) => {
    if (
      event.source === $<HTMLIFrameElement>("#intro iframe").contentWindow &&
      event.data?.type === "fixmycity-intro-complete"
    )
      finishIntro();
  });
  function readHash(initial = false) {
    if (!initial && overlayRoot.children.length) closeOverlay(false);
    const route = currentRoute(),
      view = route.view,
      reportId =
        route.reportId && reports.some((r) => r.id === route.reportId)
          ? route.reportId
          : null;
    if (view !== state.view) {
      state.category = "all";
      state.status = "all";
      state.query = "";
    }
    state.view = view;
    if (!location.hash || !route.valid || (route.reportId && !reportId))
      history.replaceState(null, "", `#${view}`);
    if (!initial) afterIntro = null;
    closeNav();
    render();
    if (reportId) {
      const show = () => openReport(reportId, { route: false });
      if (!introFinished) afterIntro = show;
      else show();
    }
  }
  document.addEventListener("pointerdown", recordActivity, { passive: true });
  document.addEventListener("pointermove", recordActivity, { passive: true });
  document.addEventListener("wheel", recordActivity, { passive: true });
  document.addEventListener("keydown", recordActivity, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flushPersistence();
  });
  addEventListener("pagehide", flushPersistence);
  addEventListener("hashchange", () => readHash());
  addEventListener("fixmycity:install-instructions", (event) => {
    const info = event.detail;
    if (!info) return;
    openOverlay(
      `<div class="simple-dialog install-dialog"><img src="assets/brand-mark.svg" alt="" class="install-app-icon"><h2 id="dialogTitle">${h(info.title)}</h2><ol class="install-steps">${info.steps.map((step) => `<li>${h(step)}</li>`).join("")}</ol><button class="primary-button full-width" data-action="close-overlay">Done</button></div>`,
    );
  });
  addEventListener("fixmycity:pwa-state", (event) => {
    const button = $<HTMLButtonElement>('[data-action="install-app"]');
    if (button) {
      button.disabled = event.detail.installed || event.detail.prompting;
      $(".install-label", button).textContent = event.detail.installed
        ? "App installed"
        : event.detail.prompting
          ? "Installing…"
          : "Install app";
    }
  });
  addEventListener("appinstalled", () => toast("FixMyCity installed"));
  readHash(true);
  if (savedDraft && !currentRoute().reportId)
    afterIntro = () => {
      draft = savedDraft;
      if (draft.pickerOpen) showLocationPicker();
      else renderWizard();
    };
  startIntro();
})();
