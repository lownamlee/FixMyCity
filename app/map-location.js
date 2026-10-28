/* The shared venue is always the map's starting point, independently of GPS. */
(() => {
  'use strict';
  const destination = Object.freeze({
    name: 'Dewan Seri Sarjana', area: 'UNITEN',
    lat: 2.9680752, lng: 101.727679, zoom: 16,
    url: 'https://maps.app.goo.gl/jm4W2bqEGY1vKNw2A'
  });
  function defaultReportLocation(report) {
    const coordinates = report.coordinates;
    const hasCoordinates = Number.isFinite(coordinates?.lat) && Number.isFinite(coordinates?.lng) && Math.abs(coordinates.lat)<=90 && Math.abs(coordinates.lng)<=180;
    const label = `${destination.name}, ${destination.area}`;
    if (hasCoordinates || (report.location && !['Location not confirmed',label].includes(report.location))) return report;
    report.location = label;
    report.coordinates = {lat: destination.lat, lng: destination.lng};
    report.locationConfirmed = false;
    return report;
  }
  function createLocationRequest({geolocation, onChange = () => {}, onPosition = () => {}}) {
    let state = 'idle';
    function update(next) { state = next; onChange(next); }
    function request() {
      if (state === 'pending' || state === 'granted') return;
      if (!geolocation) { update('unavailable'); return; }
      update('pending');
      try {
        geolocation.getCurrentPosition(position => {
          const {latitude: lat, longitude: lng, accuracy} = position.coords || {};
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
            update('unavailable'); return;
          }
          // No storage, reverse geocoding, or change to the venue/map centre.
          onPosition({lat, lng, accuracy});
          update('granted');
        }, error => update(error?.code === 1 ? 'denied' : error?.code === 3 ? 'timeout' : 'unavailable'),
        {enableHighAccuracy: false, timeout: 10000, maximumAge: 60000});
      } catch { update('unavailable'); }
    }
    return Object.freeze({request, getState: () => state});
  }
  window.FMCMapLocation = Object.freeze({destination, createLocationRequest, defaultReportLocation});
})();
