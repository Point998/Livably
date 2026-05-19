# FR-020 — Emergency Services Response Times

## What
Display estimated emergency response times for police, fire, and EMS services to help buyers evaluate emergency coverage at any address.

## Problem
Response time for emergencies can be life-saving. Buyers want to know:
- How quickly can police respond?
- Where is the nearest fire station?
- What's the EMS coverage like?

This data is scattered across local government websites and often not easily accessible.

## Requirements

### Three Emergency Services

**1. Police Response** 🚔
- Estimated average response time (Priority 1 calls)
- Nearest police station/precinct
- Distance to station
- Jurisdiction (city police, county sheriff, state police)

**2. Fire Department** 🚒
- Nearest fire station
- Distance to station
- Estimated response time
- Fire protection rating (ISO score)

**3. Emergency Medical Services (EMS)** 🚑
- Nearest ambulance station/hospital with EMS
- Estimated response time
- Coverage type (municipal, private, volunteer)

### Report Section
New section: "Emergency Services" 🚨
- Three subsections for police, fire, EMS
- Visual indicators (response time badges)
- Context about coverage quality

## Implementation Notes

### Data Sources

**Challenge:** No centralized national API for emergency response times.

**Options:**

**Option 1: Estimated Based on Distance** (Free, Simple)
- Calculate distance to nearest station
- Apply standard response time formula
- Less accurate but free

**Option 2: Municipal Open Data** (Free, Variable Coverage)
- Some cities publish 911 response time data
- Example: NYC Open Data, Seattle Data Portal
- Coverage limited to specific cities

**Option 3: Third-Party APIs** (Paid)
- No comprehensive national service exists yet
- Would need to aggregate multiple sources

**Recommendation:** Start with **Option 1** (distance-based estimation) and note that times are estimates, not official data.

---

### Distance-Based Estimation

```javascript
async function getEmergencyServices(lat, lng) {
  try {
    const [policeStation, fireStation, hospital] = await Promise.all([
      findNearestPoliceStation(lat, lng),
      findNearestFireStation(lat, lng),
      findNearestHospitalWithEMS(lat, lng)
    ]);
    
    return {
      police: {
        station: policeStation.name,
        address: policeStation.address,
        distance: policeStation.distance,
        responseTime: estimatePoliceResponseTime(policeStation.distance),
        type: 'Municipal Police'
      },
      fire: {
        station: fireStation.name,
        address: fireStation.address,
        distance: fireStation.distance,
        responseTime: estimateFireResponseTime(fireStation.distance),
        isoRating: await getISOrating(lat, lng) || 'N/A'
      },
      ems: {
        station: hospital.name,
        address: hospital.address,
        distance: hospital.distance,
        responseTime: estimateEMSResponseTime(hospital.distance),
        type: 'Hospital-based'
      }
    };
  } catch (error) {
    console.error('Emergency services error:', error);
    return null;
  }
}

async function findNearestPoliceStation(lat, lng) {
  const response = await googleMapsClient.placesNearby({
    params: {
      location: `${lat},${lng}`,
      rankby: 'distance',
      type: 'police',
      key: googleMapsApiKey
    }
  });
  
  const station = response.data.results[0];
  if (!station) throw new Error('No police station found');
  
  return {
    name: station.name,
    address: station.vicinity,
    location: station.geometry.location,
    distance: await calculateDistance(lat, lng, station.geometry.location)
  };
}

async function findNearestFireStation(lat, lng) {
  const response = await googleMapsClient.placesNearby({
    params: {
      location: `${lat},${lng}`,
      rankby: 'distance',
      type: 'fire_station',
      key: googleMapsApiKey
    }
  });
  
  const station = response.data.results[0];
  if (!station) throw new Error('No fire station found');
  
  return {
    name: station.name,
    address: station.vicinity,
    location: station.geometry.location,
    distance: await calculateDistance(lat, lng, station.geometry.location)
  };
}

async function findNearestHospitalWithEMS(lat, lng) {
  // Reuse existing hospital search from core services
  // Hospitals typically have EMS/ambulance services
  const response = await googleMapsClient.placesNearby({
    params: {
      location: `${lat},${lng}`,
      rankby: 'distance',
      type: 'hospital',
      key: googleMapsApiKey
    }
  });
  
  const hospital = response.data.results[0];
  if (!hospital) throw new Error('No hospital found');
  
  return {
    name: hospital.name,
    address: hospital.vicinity,
    location: hospital.geometry.location,
    distance: await calculateDistance(lat, lng, hospital.geometry.location)
  };
}

function estimatePoliceResponseTime(distanceMiles) {
  // Police response time formula:
  // Average 30 mph in urban, 45 mph in suburban/rural
  // Add 2 minutes for dispatch and preparation
  const speed = distanceMiles < 5 ? 30 : 45;
  const driveTime = (distanceMiles / speed) * 60; // minutes
  const totalTime = driveTime + 2; // add dispatch time
  
  return {
    estimate: Math.round(totalTime),
    category: getResponseCategory(totalTime, 'police')
  };
}

function estimateFireResponseTime(distanceMiles) {
  // Fire response standard: 4 minutes within city, 6-8 minutes suburban
  const speed = 35; // Average fire truck speed
  const driveTime = (distanceMiles / speed) * 60;
  const totalTime = driveTime + 1.5; // dispatch time shorter for fire
  
  return {
    estimate: Math.round(totalTime),
    category: getResponseCategory(totalTime, 'fire')
  };
}

function estimateEMSResponseTime(distanceMiles) {
  // EMS target: 8 minutes or less (industry standard)
  const speed = 40; // Ambulance average speed
  const driveTime = (distanceMiles / speed) * 60;
  const totalTime = driveTime + 2;
  
  return {
    estimate: Math.round(totalTime),
    category: getResponseCategory(totalTime, 'ems')
  };
}

function getResponseCategory(minutes, serviceType) {
  const thresholds = {
    police: { excellent: 5, good: 10, fair: 15 },
    fire: { excellent: 5, good: 8, fair: 12 },
    ems: { excellent: 8, good: 12, fair: 20 }
  };
  
  const t = thresholds[serviceType];
  
  if (minutes <= t.excellent) return { label: 'Excellent', color: 'green' };
  if (minutes <= t.good) return { label: 'Good', color: 'gold' };
  if (minutes <= t.fair) return { label: 'Fair', color: 'orange' };
  return { label: 'Delayed', color: 'red' };
}

async function getISOrating(lat, lng) {
  // ISO (Insurance Services Office) rating 1-10 (1 = best fire protection)
  // This would require a separate API or dataset
  // For now, return null and note "not available"
  // Future: integrate with ISO Public Protection Classification data
  return null;
}

async function calculateDistance(lat1, lng1, location) {
  // Haversine formula to calculate distance in miles
  const R = 3959; // Earth's radius in miles
  const lat2 = location.lat;
  const lng2 = location.lng;
  
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return distance.toFixed(1);
}
```

---

### HTML Template

```html
<section class="emergency-services-section">
  <h2>Emergency Services 🚨</h2>
  <p class="section-intro">
    Estimated emergency response times based on nearest station locations.
  </p>
  
  <!-- Police -->
  <div class="emergency-card">
    <div class="emergency-header">
      <h3>🚔 Police</h3>
      <div class="response-badge badge-${police.responseTime.category.color}">
        ~${police.responseTime.estimate} min
      </div>
    </div>
    
    <div class="emergency-content">
      <div class="station-name">${police.station}</div>
      <div class="station-address">${police.address}</div>
      <div class="station-distance">${police.distance} miles away</div>
      
      <div class="response-quality">
        <strong>Response Time:</strong> ${police.responseTime.category.label}
      </div>
      <p class="response-note">Estimate for Priority 1 (emergency) calls</p>
    </div>
  </div>
  
  <!-- Fire -->
  <div class="emergency-card">
    <div class="emergency-header">
      <h3>🚒 Fire Department</h3>
      <div class="response-badge badge-${fire.responseTime.category.color}">
        ~${fire.responseTime.estimate} min
      </div>
    </div>
    
    <div class="emergency-content">
      <div class="station-name">${fire.station}</div>
      <div class="station-address">${fire.address}</div>
      <div class="station-distance">${fire.distance} miles away</div>
      
      <div class="response-quality">
        <strong>Response Time:</strong> ${fire.responseTime.category.label}
      </div>
      ${fire.isoRating !== 'N/A' ? `
        <p class="iso-rating">ISO Fire Protection Rating: ${fire.isoRating}/10</p>
      ` : ''}
      <p class="response-note">Industry standard target: 5-8 minutes</p>
    </div>
  </div>
  
  <!-- EMS -->
  <div class="emergency-card">
    <div class="emergency-header">
      <h3>🚑 Emergency Medical (EMS)</h3>
      <div class="response-badge badge-${ems.responseTime.category.color}">
        ~${ems.responseTime.estimate} min
      </div>
    </div>
    
    <div class="emergency-content">
      <div class="station-name">${ems.station}</div>
      <div class="station-address">${ems.address}</div>
      <div class="station-distance">${ems.distance} miles away</div>
      
      <div class="response-quality">
        <strong>Response Time:</strong> ${ems.responseTime.category.label}
      </div>
      <p class="response-note">Industry standard target: 8 minutes or less</p>
    </div>
  </div>
  
  <div class="emergency-disclaimer">
    <p>
      <strong>Note:</strong> Response times are estimates based on distance to nearest stations. 
      Actual response times vary based on traffic, weather, call volume, and other factors. 
      Contact local emergency services for official response time data.
    </p>
  </div>
</section>
```

---

### CSS

```css
.emergency-services-section {
  margin: 3rem 0;
}

.emergency-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.emergency-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid var(--border);
}

.emergency-header h3 {
  font-family: var(--font-serif);
  font-size: 1.3rem;
  margin: 0;
}

.response-badge {
  font-size: 1.2rem;
  font-weight: 700;
  padding: 0.5rem 1rem;
  border-radius: 6px;
}

.badge-green { background: rgba(40, 167, 69, 0.1); color: #28a745; }
.badge-gold { background: rgba(212, 175, 55, 0.1); color: var(--gold); }
.badge-orange { background: rgba(253, 126, 20, 0.1); color: #fd7e14; }
.badge-red { background: rgba(220, 53, 69, 0.1); color: #dc3545; }

.emergency-content {
  line-height: 1.7;
}

.station-name {
  font-weight: 600;
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
}

.station-address {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}

.station-distance {
  color: var(--gold);
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.response-quality {
  padding: 0.75rem;
  background: var(--cream);
  border-radius: 4px;
  margin: 1rem 0;
}

.response-note {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-style: italic;
  margin-top: 0.5rem;
}

.iso-rating {
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.emergency-disclaimer {
  background: #fff9e6;
  padding: 1rem;
  border-left: 4px solid #ffa500;
  border-radius: 4px;
  font-size: 0.9rem;
  line-height: 1.6;
}

.emergency-disclaimer p {
  margin: 0;
}

@media (max-width: 768px) {
  .emergency-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
```

## Acceptance Criteria
- [ ] Police, fire, and EMS response times displayed
- [ ] Nearest station for each service shown
- [ ] Distance to each station calculated
- [ ] Response time category (Excellent/Good/Fair/Delayed)
- [ ] Color-coded badges for response quality
- [ ] Disclaimer about estimates
- [ ] Graceful handling when stations not found
- [ ] Works nationwide
- [ ] Mobile responsive

## Optional Enhancements (Future)
- [ ] Official response time data (from municipal open data)
- [ ] ISO fire protection rating integration
- [ ] 911 call volume statistics
- [ ] Police precinct boundaries
- [ ] Fire station equipment details
- [ ] Hospital emergency room wait times
- [ ] Coast Guard/water rescue (coastal areas)

## API Considerations

### Rate Limits
- Uses existing Google Places API calls
- 3 additional searches per report (police, fire, EMS)

### Cost
- Free (uses existing Google Maps API)

### Data Quality
- **Coverage:** Nationwide via Google Places
- **Accuracy:** Estimates only, not official times
- **Limitations:** Does not account for traffic, call volume, or staffing

## Legal Disclaimer

**Required:** Must include prominent disclaimer that times are estimates and not official data.

Example:
> "Response times are estimates based on distance to nearest stations and do not reflect official response time data. Actual response times vary based on traffic, weather, call volume, staffing, and other factors. For official response time statistics, contact your local emergency services."

## Dependencies

No new NPM packages required (uses existing Google Maps integration)

## Estimated Effort
**Medium** — 3-4 hours
- Google Places searches for stations
- Distance calculation (Haversine formula)
- Response time estimation logic
- HTML template for three services
- CSS styling with color badges
- Disclaimer and context text
- Error handling
- Testing across locations
