# FR-009 — Additional Services (Schools, Parks, Coffee Shops)

## What
Expand the report to include additional quality-of-life destinations beyond the core 6 services.

## Problem
Current report only covers essential services (grocery, pharmacy, hospital, etc.). Users also want to know about:
- Schools (for families with children)
- Parks and recreation (quality of life)
- Coffee shops (social/work spaces)
- Libraries (community resources)
- Restaurants (dining options)
- Fitness centers (health/wellness)

## Requirements

### New Service Categories

**Priority 1 (Core Additions):**
- **Elementary School** — nearest public elementary school
- **Park** — nearest public park (playground, walking trails)
- **Coffee Shop** — nearest coffee shop (not gas station)

**Priority 2 (Nice to Have):**
- Library — public library
- Restaurant — highly-rated restaurant
- Fitness Center — gym/fitness center

### Data to Display (Same as Core Services)
- Service name
- Address
- Drive time (door-to-door, 8am Tuesday)
- Distance in miles

### Report Integration
- Add new sections after core 6 services
- Clearly labeled as "Additional Nearby Places"
- Optional: Toggle to show/hide (keep report focused)
- Include in map visualization (different marker color/icon)
- Include in scoring algorithm (lower weight)

### Scoring Impact
Extend FR-008 scoring to include these services with reduced weights:
- Elementary School: 5% (only relevant for families)
- Park: 5%
- Coffee Shop: 3%
- Library: 2%
- Restaurant: 0% (informational only)
- Fitness: 0% (informational only)

## Implementation Notes

### Google Places API Queries

**Elementary School:**
```javascript
async function findNearestElementarySchool(originLatLng) {
  let placesResponse = await googleMapsClient.textSearch({
    params: {
      key: googleMapsApiKey,
      query: 'public elementary school',
      location: originLatLng,
      radius: 10000, // 10km
    },
  });
  
  // Filter out preschools, daycares, private schools if needed
  let placeResults = (placesResponse.data.results || []).filter(
    (place) => !isExcludedSchoolType(place.name)
  );
  
  const place = placeResults[0];
  if (!place) {
    throw new Error('No elementary school found near that address.');
  }
  
  return {
    name: place.name,
    address: place.formatted_address || place.vicinity || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
}

function isExcludedSchoolType(name) {
  const excluded = ['preschool', 'daycare', 'montessori', 'private'];
  const normalized = (name || '').toLowerCase();
  return excluded.some((term) => normalized.includes(term));
}
```

**Park:**
```javascript
async function findNearestPark(originLatLng) {
  const placesResponse = await googleMapsClient.placesNearby({
    params: {
      key: googleMapsApiKey,
      location: originLatLng,
      rankby: 'distance',
      type: 'park',
    },
  });
  
  const place = (placesResponse.data.results || [])[0];
  if (!place) {
    throw new Error('No park found near that address.');
  }
  
  return {
    name: place.name,
    address: place.vicinity || place.formatted_address || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
}
```

**Coffee Shop:**
```javascript
async function findNearestCoffeeShop(originLatLng) {
  const coffeeExclusions = [
    'gas station',
    'convenience store',
    'sheetz',
    'circle k',
    '7-eleven',
    'speedway',
  ];
  
  let placesResponse = await googleMapsClient.textSearch({
    params: {
      key: googleMapsApiKey,
      query: 'coffee shop',
      location: originLatLng,
      radius: 15000,
    },
  });
  
  let placeResults = (placesResponse.data.results || []).filter(
    (place) => !isExcludedPlaceName(place.name, coffeeExclusions)
  );
  
  const place = placeResults[0];
  if (!place) {
    throw new Error('No coffee shop found near that address.');
  }
  
  return {
    name: place.name,
    address: place.formatted_address || place.vicinity || place.name,
    location: place.geometry.location,
    driveTimeMinutes: await getDriveTime(originLatLng, place.geometry.location),
  };
}
```

### Server Route Update (`src/app.js`)

```javascript
app.get('/report', async (req, res) => {
  try {
    const origin = await geocodeAddress(address);
    const originLatLng = `${origin.lat},${origin.lng}`;
    
    // Core services (existing)
    const [
      grocery,
      pharmacy,
      hospital,
      urgentCare,
      highwayRamp,
      gasStation,
      // New services
      elementarySchool,
      park,
      coffeeShop,
    ] = await Promise.all([
      findNearestGrocery(originLatLng),
      findNearestPharmacy(originLatLng),
      findNearestHospital(originLatLng),
      findNearestUrgentCare(originLatLng),
      findNearestHighwayOnRamp(originLatLng),
      findNearestGasStation(originLatLng),
      findNearestElementarySchool(originLatLng).catch(() => null), // Optional
      findNearestPark(originLatLng).catch(() => null),
      findNearestCoffeeShop(originLatLng).catch(() => null),
    ]);
    
    // Pass to template
  }
});
```

### HTML Template

```html
<!-- Core Services Section -->
<section class="core-services">
  <h2>Essential Services</h2>
  ${renderDestinationSection('1. Nearest full-service grocery', grocery)}
  ${renderDestinationSection('2. Nearest pharmacy', pharmacy)}
  ${renderDestinationSection('3. Nearest hospital', hospital)}
  ${renderDestinationSection('4. Nearest urgent care', urgentCare)}
  ${renderDestinationSection('5. Nearest highway on-ramp', highwayRamp)}
  ${renderDestinationSection('6. Nearest gas station', gasStation)}
</section>

<!-- Additional Services Section -->
<section class="additional-services">
  <h2>Additional Nearby Places</h2>
  <p class="section-intro">
    These quality-of-life destinations enhance your daily living experience.
  </p>
  ${renderDestinationSection('Elementary School', elementarySchool)}
  ${renderDestinationSection('Park', park)}
  ${renderDestinationSection('Coffee Shop', coffeeShop)}
</section>
```

### CSS

```css
.additional-services {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 2px solid var(--border);
}

.section-intro {
  color: var(--text-secondary);
  margin-bottom: 2rem;
  font-size: 0.95rem;
}

.additional-services section {
  opacity: 0.9; /* Slightly de-emphasize vs core services */
}
```

## Acceptance Criteria
- [ ] Report includes 3 new service categories (school, park, coffee)
- [ ] Each shows name, address, drive time
- [ ] Services integrated into map (FR-006)
- [ ] Optional services fail gracefully (don't break report if not found)
- [ ] "Additional Services" section clearly labeled
- [ ] Design matches existing sections
- [ ] Tested with urban, suburban, rural addresses
- [ ] Scoring updated to include new services (FR-008)

## Optional Enhancements (Future)
- [ ] User customization: "Show me services relevant to me" (checkboxes)
- [ ] Service ratings (from Google Places)
- [ ] Multiple results per category (e.g., 3 nearest coffee shops)
- [ ] Photos of places
- [ ] Operating hours
- [ ] Toggle "Show more places" / "Show fewer places"

## Testing Scenarios
1. **Urban address** → All services found within 5-15 minutes
2. **Suburban address** → Most services found, some may be 20-30 min
3. **Rural address** → Some services not found (graceful failure)
4. **Service not found** → Section shows "Not available" or omitted
5. **Map integration** → New markers appear with distinct icons

## API Considerations

### Rate Limits
Adding 3 more API calls per report:
- Text Search: 3 calls (school, coffee)
- Nearby Search: 1 call (park)
- Distance Matrix: 3 calls (drive times)

**Total per report:** 6 existing + 6 new = **12 API calls**

### Cost Optimization
- Make optional service calls non-blocking (use `Promise.allSettled()`)
- Cache results for 24 hours (same address)
- Consider making these "premium" features (gated)

```javascript
const [coreResults, optionalResults] = await Promise.all([
  Promise.all([/* core 6 services */]),
  Promise.allSettled([/* optional 3 services */])
]);

// Handle optional failures gracefully
const elementarySchool = optionalResults[0].status === 'fulfilled' 
  ? optionalResults[0].value 
  : null;
```

## Dependencies
- No new NPM packages required
- Uses existing Google Maps API
- Extends existing functions

## Estimated Effort
**Medium** — 3-4 hours
- Implement 3 new search functions
- Update Promise.all to include new services
- HTML template updates
- CSS styling for new section
- Map integration (if FR-006 complete)
- Scoring integration (if FR-008 complete)
- Testing and error handling
