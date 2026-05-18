# FR-006 Implementation Plan

## Overview

Four files change: `src/app.js`, `public/report.css`. No new dependencies. Uses the existing `GOOGLE_MAPS_API_KEY`.

## Tasks

### 1. Fix script execution in `buildLoadingHTML` (`app.js`)

After the DOM swap, scripts injected via `innerHTML` don't execute (known browser behavior). Add a `reExecScripts(el)` helper inside the loading page's IIFE and call it on `document.head` and `document.body` after the swap:

```javascript
function reExecScripts(el) {
  el.querySelectorAll('script').forEach(function (old) {
    var s = document.createElement('script');
    for (var i = 0; i < old.attributes.length; i++) {
      s.setAttribute(old.attributes[i].name, old.attributes[i].value);
    }
    s.textContent = old.textContent;
    old.parentNode.replaceChild(s, old);
  });
}
// ...after DOM swap:
reExecScripts(document.head);
reExecScripts(document.body);
```

Order matters: head scripts run first (defines `MAP_DATA` and `initMap`), then the external Maps JS script loads and calls `initMap` via its callback.

### 2. Pass `origin` to `buildReportHTML` (`app.js`)

In the `/report` route, pass `origin` alongside the services:

```javascript
return res.send(buildReportHTML(address, { grocery, pharmacy, hospital, urgentCare, highwayRamp, school, origin }));
```

Update `buildReportHTML` signature to destructure `origin`.

### 3. Build `mapData` in `buildReportHTML` (`app.js`)

Assemble a `mapData` object from the home location and all non-null services. Grocery is an array; others are single objects.

```javascript
const mapServices = [];

if (grocery && grocery.length) {
  grocery.forEach((s, i) => {
    if (s?.location) mapServices.push({
      name: s.name,
      address: s.address,
      driveTimeMinutes: s.driveTimeMinutes,
      lat: s.location.lat,
      lng: s.location.lng,
      type: 'grocery',
      label: i === 0 ? 'Grocery' : null,
    });
  });
}

const singles = [
  { result: pharmacy,   type: 'pharmacy',    label: 'Pharmacy' },
  { result: hospital,   type: 'hospital',    label: 'Hospital' },
  { result: urgentCare, type: 'urgentcare',  label: 'Urgent Care' },
  { result: highwayRamp,type: 'highway',     label: highwayRamp?.name || 'Highway' },
  { result: school,     type: 'school',      label: 'School' },
];

singles.forEach(({ result, type, label }) => {
  if (result?.location) mapServices.push({
    name: result.name,
    address: result.address,
    driveTimeMinutes: result.driveTimeMinutes,
    lat: result.location.lat,
    lng: result.location.lng,
    type,
    label,
  });
});

const mapData = {
  home: { lat: origin.lat, lng: origin.lng },
  services: mapServices,
};
```

Inject as a non-executable-type inline script to avoid HTML parser issues:

```html
<script id="map-data" type="application/json">${JSON.stringify(mapData)}</script>
```

Reading via `JSON.parse(document.getElementById('map-data').textContent)` avoids injecting raw JSON into a `<script>` block, which can contain `</script>` in data and break the page.

### 4. Add map section HTML to `buildReportHTML` (`app.js`)

Place it between the hero section and the chapter card:

```html
<div class="map-section">
  <div id="map" class="report-map"></div>
</div>
```

### 5. Add `initMap` inline script and Maps JS API loader (`app.js`)

At the bottom of `<body>`:

```html
<script>
  window.initMap = function () {
    try {
      var raw = document.getElementById('map-data');
      if (!raw) return;
      var data = JSON.parse(raw.textContent);
      var home = { lat: data.home.lat, lng: data.home.lng };

      var map = new google.maps.Map(document.getElementById('map'), {
        center: home,
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      var bounds = new google.maps.LatLngBounds();
      bounds.extend(home);

      // Home marker — gold circle
      new google.maps.Marker({
        position: home,
        map: map,
        title: 'Your address',
        zIndex: 10,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#b8922a',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 10,
        },
      });

      // Service markers
      var infoWindow = new google.maps.InfoWindow();
      data.services.forEach(function (svc) {
        var pos = { lat: svc.lat, lng: svc.lng };
        bounds.extend(pos);
        var marker = new google.maps.Marker({
          position: pos,
          map: map,
          title: svc.name,
        });
        marker.addListener('click', function () {
          infoWindow.setContent(
            '<div style="font-family:DM Sans,sans-serif;font-size:0.85rem;max-width:200px">' +
            '<strong>' + svc.name + '</strong>' +
            (svc.label ? '<br><span style="color:#6b6b6b;font-size:0.75rem">' + svc.label + '</span>' : '') +
            '<br><span style="color:#6b6b6b">' + svc.address + '</span>' +
            '<br><strong>' + svc.driveTimeMinutes + ' min</strong>' +
            '</div>'
          );
          infoWindow.open(map, marker);
        });
      });

      map.fitBounds(bounds);
      // Don't over-zoom for close destinations
      var listener = google.maps.event.addListener(map, 'idle', function () {
        if (map.getZoom() > 15) map.setZoom(15);
        google.maps.event.removeListener(listener);
      });
    } catch (e) {
      var el = document.getElementById('map');
      if (el) el.style.display = 'none';
    }
  };
</script>
<script src="https://maps.googleapis.com/maps/api/js?key=${escapeHtml(googleMapsApiKey)}&callback=initMap" async defer></script>
```

Note: the API key will be visible in the page source. This is unavoidable for the Maps JS API and is standard practice. The key should be restricted to the app's domain in Google Cloud Console.

### 6. Add map CSS to `public/report.css`

```css
.map-section {
  padding: 0 1rem 0.5rem;
}
.report-map {
  width: 100%;
  height: 380px;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}
```

No media query needed — the report is already capped at 480px.

### 7. Test

- Georgetown address → loading → report with map, all 6 service markers, home pin ✓
- Rural address → map zooms out to show spread-out services ✓
- Urban address → map clusters tightly ✓
- `?fetch=1` direct access → map renders (scripts execute normally) ✓
- Via loading page → map renders (reExecScripts fires correctly) ✓
- One null service (simulate) → map skips null, rest render ✓

### 8. Write `summary.md`, commit, push

## Risks

**`reExecScripts` execution order**: Head scripts run synchronously (inline); body scripts run synchronously (inline `initMap` definition). The external Maps JS `<script src="...">` is `async defer`, so it loads after both inline scripts have run. `initMap` will be defined in `window` when the Maps API calls it. Order is correct.

**`</script>` in JSON data**: Avoided by using `type="application/json"` with a separate `<script id="map-data">` element and reading via `textContent`. Raw addresses or names won't break the HTML parser.

**API key scope**: `googleMapsApiKey` is in scope inside `buildReportHTML` since it's a module-level variable. The template literal interpolates it safely via `escapeHtml`.

**Grocery array vs null array**: `grocery` from `Promise.allSettled` can be null (if the finder threw) or an array. Check `grocery && grocery.length` before iterating.
