# FR-006 — Map Visualization

## What
Add an interactive map to the report showing the home address and all nearby services with drive time routes.

## Problem
Currently the report only shows text-based information. Users can't visualize:
- Where services are located relative to their home
- Which direction they'd drive to each service
- Spatial relationships between destinations
- Alternative routes or traffic patterns

## Requirements

### Map Display
- Interactive Google Map embedded in the report
- Shows home address with custom marker (house icon or gold pin)
- Shows all 6 service destinations with labeled markers:
  - 🛒 Grocery
  - 💊 Pharmacy  
  - 🏥 Hospital
  - 🩺 Urgent Care
  - 🛣️ Highway Ramp
  - ⛽ Gas Station
- Map automatically zooms to fit all markers
- Clickable markers show service name and address

### Routes (Optional Enhancement)
- Show driving routes from home to each destination
- Color-coded routes by service type
- Toggle routes on/off to reduce clutter

### Design Requirements
- Map placed after the hero section, before service details
- Full-width on mobile, centered with max-width on desktop
- Min height: 400px on mobile, 500px on desktop
- Map controls (zoom, street view) enabled
- Matches design system (gold accents for home marker)

### Responsive Behavior
- Mobile: Full-width map, stacked layout
- Desktop: Map takes 60% width, service list on right (or full-width above list)

## Implementation Notes

### Google Maps JavaScript API
Use the existing `GOOGLE_MAPS_API_KEY` from `.env`

```html
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&callback=initMap" async defer></script>
```

### Map Initialization
```javascript
function initMap() {
  const home = { lat: HOME_LAT, lng: HOME_LNG };
  
  const map = new google.maps.Map(document.getElementById('map'), {
    center: home,
    zoom: 12,
    styles: [] // Optional: custom map styling for branding
  });
  
  // Add home marker
  new google.maps.Marker({
    position: home,
    map: map,
    title: 'Your Address',
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: '#D4AF37', // gold
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeWeight: 2,
      scale: 10
    }
  });
  
  // Add service markers
  services.forEach(service => {
    const marker = new google.maps.Marker({
      position: service.location,
      map: map,
      title: service.name,
      label: service.emoji
    });
    
    const infoWindow = new google.maps.InfoWindow({
      content: `<strong>${service.name}</strong><br>${service.address}<br>${service.driveTimeMinutes} min`
    });
    
    marker.addListener('click', () => {
      infoWindow.open(map, marker);
    });
  });
  
  // Auto-zoom to fit all markers
  const bounds = new google.maps.LatLngBounds();
  bounds.extend(home);
  services.forEach(s => bounds.extend(s.location));
  map.fitBounds(bounds);
}
```

### Server-side Changes (`src/app.js`)
Pass location data to the HTML template:

```javascript
const mapData = {
  home: { lat: origin.lat, lng: origin.lng },
  services: [
    { 
      name: grocery.name,
      location: grocery.location,
      address: grocery.address,
      driveTimeMinutes: grocery.driveTimeMinutes,
      type: 'grocery',
      emoji: '🛒'
    },
    // ... other services
  ]
};

// Inject into HTML as JSON
<script>
  const MAP_DATA = ${JSON.stringify(mapData)};
</script>
```

### HTML Structure
```html
<section class="map-section">
  <h2>Location Overview</h2>
  <div id="map" class="report-map"></div>
</section>
```

### CSS
```css
.report-map {
  width: 100%;
  height: 400px;
  border-radius: 8px;
  margin: 2rem 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

@media (min-width: 768px) {
  .report-map {
    height: 500px;
  }
}
```

## Acceptance Criteria
- [ ] Map displays on report page
- [ ] Home address shown with distinctive marker
- [ ] All 6 services shown with labeled markers
- [ ] Markers are clickable and show service details
- [ ] Map auto-zooms to fit all locations
- [ ] Map is responsive (works on mobile and desktop)
- [ ] No API key exposed in client-side code
- [ ] Map loads without breaking report if API fails
- [ ] Design matches report aesthetic
- [ ] Tested with multiple addresses (urban, suburban, rural)

## Optional Enhancements (Future)
- [ ] Toggle routes on/off
- [ ] Color-coded routes by service category
- [ ] Custom map styling (cream/gold theme)
- [ ] Driving directions on marker click
- [ ] Street View integration
- [ ] Traffic layer toggle

## Technical Details

### API Requirements
- Google Maps JavaScript API must be enabled
- Same API key already used for Places/Distance Matrix
- No additional cost for basic map display

### Performance Considerations
- Load map script asynchronously (don't block page render)
- Lazy-load map (only initialize when scrolled into view)
- Cache map tiles (browser handles this)

### Fallback Behavior
If map fails to load:
- Show static map image (Google Static Maps API)
- Or hide map section entirely
- Don't break the report

```javascript
window.initMap = function() {
  try {
    // map initialization
  } catch (error) {
    console.error('Map failed to load:', error);
    document.getElementById('map').style.display = 'none';
  }
};
```

## Testing Scenarios
1. **Urban address** (many services clustered) → Map shows all markers clearly
2. **Rural address** (services spread out) → Map zooms appropriately
3. **Mobile viewport** → Map renders at correct size, controls accessible
4. **Desktop viewport** → Map displays with proper aspect ratio
5. **API key missing** → Map section hidden gracefully
6. **Slow connection** → Map loads without blocking report

## Dependencies
- Google Maps JavaScript API (already available)
- No new NPM packages required
- Vanilla JavaScript (no frameworks)

## Estimated Effort
**Medium** — 3-4 hours
- Server-side data preparation
- Map initialization JavaScript
- Marker creation and styling
- InfoWindow implementation
- Responsive CSS
- Testing across devices/addresses
