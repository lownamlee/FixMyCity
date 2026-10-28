/** Renders the index interface without a static HTML file. */
export function renderIndex(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0c2b55">
  <!-- INTRO_PREPAINT -->
  <style>html.intro-seen #intro{display:none}html.intro-seen .app-shell{opacity:1}html.intro-seen body.intro-active{overflow:auto}</style>
  <meta name="description" content="Report and track city issues with FixMyCity. Interactive interface preview.">
  <title>FixMyCity — City reports</title>
  <link rel="icon" href="assets/brand-mark.svg" type="image/svg+xml">
  <link rel="manifest" href="./manifest.webmanifest">
  <link rel="apple-touch-icon" href="./assets/icons/apple-touch-icon.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="FixMyCity">
  <link rel="preload" href="assets/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="assets/fonts/inter-tight.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="styles.css">
  <script src="city-map.js" defer></script>
  <script src="photo-picker.js" defer></script>
  <script src="story-gestures.js" defer></script>
  <script src="pwa.js" defer></script>
  <script src="app.js" defer></script>
</head>
<body class="intro-active">
  <svg class="icon-library" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>
    <symbol id="i-home" viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/></symbol>
    <symbol id="i-map" viewBox="0 0 24 24"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16"/></symbol>
    <symbol id="i-pin" viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></symbol>
    <symbol id="i-reports" viewBox="0 0 24 24"><path d="M14 2H5a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8Zm0 0v6h6M8 12h8m-8 4h5"/></symbol>
    <symbol id="i-grid" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></symbol>
    <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M4 12h16m-6-6 6 6-6 6"/></symbol>
    <symbol id="i-up" viewBox="0 0 24 24"><path d="M12 20V4m-6 6 6-6 6 6"/></symbol>
    <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
    <symbol id="i-minus" viewBox="0 0 24 24"><path d="M5 12h14"/></symbol>
    <symbol id="i-x" viewBox="0 0 24 24"><path d="m6 6 12 12M6 18 18 6"/></symbol>
    <symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></symbol>
    <symbol id="i-camera" viewBox="0 0 24 24"><path d="M8 5 9.5 3h5L16 5h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/></symbol>
    <symbol id="i-bell" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6"/></symbol>
    <symbol id="i-chevron" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></symbol>
    <symbol id="i-search" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></symbol>
    <symbol id="i-heart" viewBox="0 0 24 24"><path d="M20.8 4.6a5.6 5.6 0 0 0-8 .2l-.8.8-.8-.8a5.6 5.6 0 0 0-8 7.8L12 21l8.8-8.4a5.6 5.6 0 0 0 0-8Z"/></symbol>
    <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></symbol>
    <symbol id="i-wrench" viewBox="0 0 24 24"><path d="m14 6 4 4 4-4a7 7 0 0 1-9 9L5 23l-4-4 8-8a7 7 0 0 1 9-9Z"/></symbol>
    <symbol id="i-spark" viewBox="0 0 24 24"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></symbol>
    <symbol id="i-road" viewBox="0 0 24 24"><path d="m7 2-4 20M17 2l4 20M12 3v3m0 4v4m0 4v3"/></symbol>
    <symbol id="i-light" viewBox="0 0 24 24"><path d="M12 21V6a4 4 0 0 1 8 0M16 7h8M8 21h8M20 10v2m-4-2-1 2m9-2 1 2"/></symbol>
    <symbol id="i-drain" viewBox="0 0 24 24"><path d="M3 15h18M3 20h18M6 15v5m4-5v5m4-5v5m4-5v5M12 2s-4 4.3-4 7a4 4 0 0 0 8 0c0-2.7-4-7-4-7Z"/></symbol>
    <symbol id="i-bin" viewBox="0 0 24 24"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></symbol>
    <symbol id="i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/></symbol>
    <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></symbol>
    <symbol id="i-settings" viewBox="0 0 24 24"><path d="m9 3-1 3-3 1-2 3 2 2-1 3 2 3 3-1 2 3h3l1-3 3-1 2-3-2-2 1-3-2-3-3 1-2-3Z"/><circle cx="12" cy="11.5" r="3"/></symbol>
    <symbol id="i-share" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 10 6-3m-6 7 6 3"/></symbol>
    <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></symbol>
    <symbol id="i-board" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18m6-18v18M6 7v5m6-5v3m6-3v8"/></symbol>
    <symbol id="i-list" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1"/></symbol>
    <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/></symbol>
    <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></symbol>
    <symbol id="i-leaf" viewBox="0 0 24 24"><path d="M20 3C6 2 1 8 6 16s16 5 14-13ZM4 21 16 9"/></symbol>
  </defs></svg>
  <div id="intro" class="intro-screen" aria-label="FixMyCity introduction">
    <iframe data-src="intro.html" title="FixMyCity intro animation" tabindex="-1"></iframe>
  </div>
  <div class="app-shell" id="appShell" inert>
    <div class="sidebar-shade" data-action="close-nav"></div>
    <aside class="sidebar">
      <a class="brand" href="#home" aria-label="FixMyCity home"><img src="assets/brand-wordmark.svg" alt="FixMyCity"></a>
      <nav class="main-nav" aria-label="Main navigation">
        <button class="nav-item active" data-view="home" aria-label="Overview" title="Overview"><svg class="icon"><use href="#i-home"/></svg><span>Overview</span></button>
        <button class="nav-item" data-view="map" aria-label="City map" title="City map"><svg class="icon"><use href="#i-map"/></svg><span>City map</span></button>
        <button class="nav-item" data-view="reports" aria-label="My reports" title="My reports"><svg class="icon"><use href="#i-reports"/></svg><span>My reports</span><span class="nav-count" id="reportCount">3</span></button>
        <div class="nav-divider"></div>
        <button class="nav-item" data-view="council" aria-label="Council" title="Council"><svg class="icon"><use href="#i-grid"/></svg><span>Council</span></button>
      </nav>
      <button class="sidebar-report" data-action="new-report" aria-label="Report an issue" title="Report an issue"><svg class="icon"><use href="#i-plus"/></svg><span>Report an issue</span></button>
      <div class="sidebar-bottom">
        <button class="nav-item" data-action="about" aria-label="About this preview" title="About this preview"><svg class="icon"><use href="#i-info"/></svg><span>About this preview</span></button>
        <button class="profile" data-action="settings" aria-label="My space and settings" title="My space and settings"><span class="avatar"><svg class="icon"><use href="#i-user"/></svg></span><span>My space</span><svg class="icon small"><use href="#i-settings"/></svg></button>
      </div>
    </aside>
    <div class="workspace">
      <header class="app-header">
        <button class="icon-button mobile-menu" data-action="open-nav" aria-label="Open menu"><svg class="icon"><use href="#i-menu"/></svg></button>
        <h1 id="viewTitle">Overview</h1>
        <div class="header-actions">
          <button class="location-switch" data-action="neighborhood"><svg class="icon"><use href="#i-pin"/></svg><span>Kuala Lumpur</span><svg class="icon small"><use href="#i-chevron"/></svg></button>
          <button class="preview-pill" data-action="about">Preview</button>
          <button class="icon-button notification-button" data-action="notifications" aria-label="Notifications"><svg class="icon"><use href="#i-bell"/></svg><i></i></button>
        </div>
      </header>
      <main id="view" class="view-content"></main>
    </div>
    <nav class="mobile-bottom" aria-label="Mobile navigation">
      <button data-view="home" class="active"><svg class="icon"><use href="#i-home"/></svg><span>Home</span></button>
      <button data-view="map"><svg class="icon"><use href="#i-map"/></svg><span>Map</span></button>
      <button class="mobile-create" data-action="new-report" aria-label="Report an issue"><svg class="icon"><use href="#i-plus"/></svg></button>
      <button data-view="reports"><svg class="icon"><use href="#i-reports"/></svg><span>Reports</span></button>
      <button data-view="council"><svg class="icon"><use href="#i-grid"/></svg><span>Council</span></button>
    </nav>
  </div>
  <div id="overlayRoot"></div>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <input id="photoInput" type="file" accept="image/*" hidden>
</body>
</html>
`;
}
