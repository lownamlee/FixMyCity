(() => {
  let skip = false;
  try {
    const seen = sessionStorage.getItem("fixmycity-intro-seen") === "1";
    const raw = sessionStorage.getItem("fixmycity-last-active");
    const last = Number(raw),
      age = Date.now() - last;
    skip =
      seen &&
      (raw === null ||
        (Number.isFinite(last) && last > 0 && age >= 0 && age < 300000));
  } catch {
    skip =
      (
        performance.getEntriesByType("navigation")[0] as
          PerformanceNavigationTiming | undefined
      )?.type === "reload";
  }
  if (new URLSearchParams(location.search).has("skipIntro")) skip = true;
  window.__fixmycitySkipIntro = skip;
  if (skip) document.documentElement.classList.add("intro-seen");
})();
