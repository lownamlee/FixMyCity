/** Renders the home-map interface without a static HTML file. */
export function renderHomeMap(): string {
  return `<section id="page-map" data-page="map" class="app-page map-page" aria-label="UNITEN report map" hidden>
  <div class="page-header-slot" data-title="Map" data-kind="map"></div>
  <div class="map-stage" id="map-stage" role="region" aria-label="Map of Dewan Seri Sarjana, UNITEN. Drag to pan or use the zoom controls.">
    <div id="map-live" class="map-live"></div>
    <div class="map-network-note" id="map-network-note" role="status" hidden>
      <strong>Dewan Seri Sarjana · UNITEN</strong>
      <span>Map tiles could not load. Check your connection and retry.</span>
      <button id="map-retry-tiles">Retry map</button>
      <a href="https://maps.app.goo.gl/jm4W2bqEGY1vKNw2A" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
    </div>
  </div>
  <div class="map-filter-row" role="group" aria-label="Filter reports on the map">
    <button class="map-filter" data-map-category="All" aria-pressed="true">All</button>
    <button class="map-filter" data-map-category="Roads" aria-pressed="false">Roads</button>
    <button class="map-filter" data-map-category="Lighting" aria-pressed="false">Lighting</button>
    <button class="map-filter" data-map-category="Cleanliness" aria-pressed="false">Cleanliness</button>
  </div>
  <div class="map-count" id="map-count" role="status">6 sample reports</div>
  <div class="map-tools">
    <button id="map-layers" class="map-tool" aria-label="Map layers and zoom" aria-expanded="false"><svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5"/></svg></button>
    <button id="map-recenter" class="map-tool" aria-label="Recenter map on UNITEN"><svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg></button>
  </div>
  <div class="map-layer-panel" id="map-layer-panel" hidden>
    <p>Map display</p>
    <button data-map-style="street" aria-pressed="true">Street map <span>✓</span></button>
    <button data-map-style="density" aria-pressed="false">Report density <span></span></button>
    <div class="map-zoom"><button id="map-zoom-out" aria-label="Zoom out">−</button><span id="map-zoom-label">16</span><button id="map-zoom-in" aria-label="Zoom in">+</button></div>
    <p class="map-location-status" id="map-location-status" role="status">The map stays on UNITEN.</p>
    <button id="map-request-location">Enable location</button>
    <a href="https://maps.app.goo.gl/jm4W2bqEGY1vKNw2A" target="_blank" rel="noopener noreferrer">Open in Google Maps ↗</a>
  </div>
  <article class="map-report-preview" id="map-report-preview" aria-label="Selected sample report"></article>
  <div class="map-empty" id="map-empty" hidden><svg class="icon" aria-hidden="true"><use href="#i-pin"/></svg><strong>No matching reports</strong><p>Try another place or category.</p><button id="map-clear-search">Clear search &amp; filters</button></div>
</section>
`;
}
