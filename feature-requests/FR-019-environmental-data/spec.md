# FR-019 — Environmental Data (Noise, Air Quality, Flood Risk)

## What
Display environmental conditions including noise levels, air quality, and flood risk to help buyers understand environmental factors at any address.

## Problem
Environmental factors significantly impact quality of life but are rarely consolidated:
- **Noise:** Traffic, airports, trains, industrial areas
- **Air Quality:** Pollution, allergens, health risks
- **Flood Risk:** FEMA zones, insurance requirements, climate risk

Buyers must research multiple sources (EPA, FEMA, local agencies) to piece together environmental data.

## Requirements

### Three Core Data Points

**1. Air Quality Index (AQI)** 🌫️
- Current AQI (0-500 scale)
- Rating (Good, Moderate, Unhealthy, etc.)
- Primary pollutants (PM2.5, Ozone, etc.)
- Historical average

**2. Noise Level Estimate** 🔊
- Estimated noise level (dB scale)
- Noise sources (traffic, airport, rail)
- Distance to major noise sources
- Quiet vs Urban context

**3. Flood Risk** 💧
- FEMA flood zone designation
- Flood insurance requirement (Yes/No)
- Historical flood events
- Climate risk projection

### Report Section
New section: "Environmental Factors" 🌍
- Three subsections (Air Quality, Noise, Flood Risk)
- Visual indicators (color-coded ratings)
- Context explanations for each

## Implementation Notes

### API Options

**Air Quality:**
- **EPA AirNow API** (Free, official)
- **IQAir API** (Free tier: 1,000 calls/month)
- **OpenWeatherMap Air Pollution API** (Free tier available)

**Noise:**
- **BTS Transportation Noise Map** (Free, limited)
- **HowLoud API** (Paid, comprehensive)
- **Estimation algorithm** (free, less accurate)

**Flood Risk:**
- **FEMA Flood Map Service API** (Free)
- **FloodFactor.com API** (Paid, includes climate projections)
- **First Street Foundation** (Free for basic data)

---

### Air Quality - EPA AirNow API

```javascript
const AIRNOW_API_KEY = process.env.AIRNOW_API_KEY;

async function getAirQuality(lat, lng) {
  try {
    const response = await fetch(
      `https://www.airnowapi.org/aq/observation/latLong/current/` +
      `?format=application/json&latitude=${lat}&longitude=${lng}` +
      `&distance=25&API_KEY=${AIRNOW_API_KEY}`
    );
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      return null;
    }
    
    // Find the highest AQI among all pollutants
    const maxAQI = Math.max(...data.map(d => d.AQI));
    const primaryPollutant = data.find(d => d.AQI === maxAQI);
    
    return {
      aqi: maxAQI,
      category: getAQICategory(maxAQI),
      primaryPollutant: primaryPollutant.ParameterName,
      dateTime: primaryPollutant.DateObserved,
      location: primaryPollutant.ReportingArea
    };
  } catch (error) {
    console.error('Air quality API error:', error);
    return null;
  }
}

function getAQICategory(aqi) {
  if (aqi <= 50) return { label: 'Good', color: 'green', description: 'Air quality is satisfactory' };
  if (aqi <= 100) return { label: 'Moderate', color: 'gold', description: 'Acceptable for most people' };
  if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', color: 'orange', description: 'May affect sensitive individuals' };
  if (aqi <= 200) return { label: 'Unhealthy', color: 'red', description: 'Everyone may experience health effects' };
  if (aqi <= 300) return { label: 'Very Unhealthy', color: 'purple', description: 'Health alert: everyone may be affected' };
  return { label: 'Hazardous', color: 'maroon', description: 'Emergency conditions' };
}
```

---

### Noise Level - Estimation Algorithm

```javascript
async function estimateNoiseLevel(lat, lng, address) {
  // Start with baseline (40 dB = quiet residential)
  let noiseLevel = 40;
  const noiseSources = [];
  
  // Check proximity to highways
  const nearbyHighways = await findNearbyHighways(lat, lng);
  if (nearbyHighways.length > 0) {
    const closestHighway = nearbyHighways[0];
    if (closestHighway.distance < 0.5) { // Within 0.5 miles
      noiseLevel += 20; // 60 dB
      noiseSources.push(`Highway traffic (${closestHighway.name})`);
    } else if (closestHighway.distance < 1) {
      noiseLevel += 10; // 50 dB
      noiseSources.push(`Nearby highway (${closestHighway.name})`);
    }
  }
  
  // Check proximity to airports
  const nearbyAirports = await findNearbyAirports(lat, lng);
  if (nearbyAirports.length > 0) {
    const closestAirport = nearbyAirports[0];
    if (closestAirport.distance < 5) { // Within 5 miles
      noiseLevel += 15;
      noiseSources.push(`Airport flight path (${closestAirport.name})`);
    }
  }
  
  // Check for urban vs rural (based on population density)
  const isUrban = await checkUrbanDensity(lat, lng);
  if (isUrban) {
    noiseLevel += 5;
    noiseSources.push('Urban area traffic');
  }
  
  // Cap at 75 dB (very loud)
  noiseLevel = Math.min(noiseLevel, 75);
  
  return {
    level: noiseLevel,
    category: getNoiseCategory(noiseLevel),
    sources: noiseSources,
    estimated: true
  };
}

function getNoiseCategory(db) {
  if (db < 45) return { label: 'Very Quiet', color: 'green', description: 'Rural or quiet suburban' };
  if (db < 55) return { label: 'Quiet', color: 'lightgreen', description: 'Typical suburban neighborhood' };
  if (db < 65) return { label: 'Moderate', color: 'gold', description: 'Busy suburban or light urban' };
  if (db < 70) return { label: 'Noisy', color: 'orange', description: 'Urban area with traffic' };
  return { label: 'Very Noisy', color: 'red', description: 'Heavy traffic or industrial' };
}
```

---

### Flood Risk - FEMA API

```javascript
async function getFloodRisk(lat, lng) {
  try {
    const response = await fetch(
      `https://hazards.fema.gov/gis/nfhl/services/public/NFHL/MapServer/28/query?` +
      `geometry=${lng},${lat}&geometryType=esriGeometryPoint&` +
      `spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&` +
      `f=json`
    );
    
    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      return {
        zone: 'X',
        risk: 'Minimal',
        insuranceRequired: false,
        description: 'Outside high-risk flood areas'
      };
    }
    
    const floodZone = data.features[0].attributes.FLD_ZONE;
    const zoneInfo = interpretFloodZone(floodZone);
    
    return {
      zone: floodZone,
      risk: zoneInfo.risk,
      insuranceRequired: zoneInfo.insuranceRequired,
      description: zoneInfo.description
    };
  } catch (error) {
    console.error('Flood risk API error:', error);
    return null;
  }
}

function interpretFloodZone(zone) {
  const zoneMap = {
    'A': { risk: 'High', insuranceRequired: true, description: '1% annual flood chance (100-year floodplain)' },
    'AE': { risk: 'High', insuranceRequired: true, description: '1% annual flood chance with base flood elevation' },
    'AH': { risk: 'High', insuranceRequired: true, description: 'Shallow flooding area' },
    'AO': { risk: 'High', insuranceRequired: true, description: 'Sheet flow flooding area' },
    'V': { risk: 'Very High', insuranceRequired: true, description: 'Coastal high-velocity wave action' },
    'VE': { risk: 'Very High', insuranceRequired: true, description: 'Coastal flood with wave action' },
    'X': { risk: 'Minimal', insuranceRequired: false, description: 'Outside high-risk flood areas' },
    'B': { risk: 'Moderate', insuranceRequired: false, description: '0.2% annual flood chance (500-year floodplain)' },
    'C': { risk: 'Minimal', insuranceRequired: false, description: 'Minimal flood hazard' }
  };
  
  return zoneMap[zone] || { risk: 'Unknown', insuranceRequired: false, description: 'Flood zone data unavailable' };
}
```

---

### HTML Template

```html
<section class="environmental-section">
  <h2>Environmental Factors 🌍</h2>
  <p class="section-intro">
    Air quality, noise levels, and flood risk for this location.
  </p>
  
  <!-- Air Quality -->
  <div class="env-card">
    <div class="env-header">
      <h3>🌫️ Air Quality</h3>
      <div class="env-badge badge-${airQuality.category.color}">
        ${airQuality.category.label}
      </div>
    </div>
    
    <div class="env-content">
      <div class="aqi-value">${airQuality.aqi}</div>
      <div class="aqi-scale">AQI (0-500 scale)</div>
      <p>${airQuality.category.description}</p>
      <p class="env-detail">Primary pollutant: ${airQuality.primaryPollutant}</p>
    </div>
  </div>
  
  <!-- Noise Level -->
  <div class="env-card">
    <div class="env-header">
      <h3>🔊 Noise Level</h3>
      <div class="env-badge badge-${noise.category.color}">
        ${noise.category.label}
      </div>
    </div>
    
    <div class="env-content">
      <div class="noise-value">~${noise.level} dB</div>
      <div class="noise-scale">Estimated noise level</div>
      <p>${noise.category.description}</p>
      ${noise.sources.length > 0 ? `
        <p class="env-detail">Noise sources: ${noise.sources.join(', ')}</p>
      ` : ''}
    </div>
  </div>
  
  <!-- Flood Risk -->
  <div class="env-card">
    <div class="env-header">
      <h3>💧 Flood Risk</h3>
      <div class="env-badge badge-${getFloodColor(flood.risk)}">
        ${flood.risk} Risk
      </div>
    </div>
    
    <div class="env-content">
      <div class="flood-zone">Zone ${flood.zone}</div>
      <div class="flood-scale">FEMA Flood Zone</div>
      <p>${flood.description}</p>
      <p class="env-detail">
        <strong>Flood Insurance:</strong> 
        ${flood.insuranceRequired ? 'Required for mortgages' : 'Not required'}
      </p>
    </div>
  </div>
</section>

<script>
function getFloodColor(risk) {
  if (risk === 'Minimal') return 'green';
  if (risk === 'Moderate') return 'gold';
  if (risk === 'High') return 'orange';
  if (risk === 'Very High') return 'red';
  return 'gray';
}
</script>
```

### CSS

```css
.environmental-section {
  margin: 3rem 0;
}

.env-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.env-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid var(--border);
}

.env-header h3 {
  font-family: var(--font-serif);
  font-size: 1.3rem;
  margin: 0;
}

.env-badge {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9rem;
}

.badge-green { background: rgba(40, 167, 69, 0.1); color: #28a745; }
.badge-lightgreen { background: rgba(92, 184, 92, 0.1); color: #5cb85c; }
.badge-gold { background: rgba(212, 175, 55, 0.1); color: var(--gold); }
.badge-orange { background: rgba(253, 126, 20, 0.1); color: #fd7e14; }
.badge-red { background: rgba(220, 53, 69, 0.1); color: #dc3545; }
.badge-purple { background: rgba(111, 66, 193, 0.1); color: #6f42c1; }
.badge-maroon { background: rgba(128, 0, 0, 0.1); color: #800000; }
.badge-gray { background: rgba(108, 117, 125, 0.1); color: #6c757d; }

.env-content {
  line-height: 1.7;
}

.aqi-value,
.noise-value,
.flood-zone {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.aqi-scale,
.noise-scale,
.flood-scale {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
}

.env-detail {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-top: 0.75rem;
}

@media (max-width: 768px) {
  .env-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
```

## Acceptance Criteria
- [ ] Air quality (AQI) displayed with category
- [ ] Noise level estimated with sources
- [ ] Flood risk zone shown with insurance requirement
- [ ] Color-coded badges for each factor
- [ ] Context descriptions for all metrics
- [ ] Graceful handling when data unavailable
- [ ] Works nationwide
- [ ] Mobile responsive
- [ ] Data sources attributed

## Optional Enhancements (Future)
- [ ] Historical AQI trends (chart)
- [ ] Noise heat map overlay
- [ ] Climate change flood projections
- [ ] Wildfire risk assessment
- [ ] Earthquake risk (seismic zones)
- [ ] Radon levels
- [ ] Water quality data

## API Considerations

### Rate Limits
- **EPA AirNow:** 500 calls/hour (free)
- **FEMA:** No rate limits (public data)

### Cost
- Air quality: Free (EPA)
- Noise: Free (estimation) or ~$100/month (HowLoud)
- Flood: Free (FEMA)

### Data Quality
- **AQI:** Real-time, very accurate
- **Noise:** Estimated (moderate accuracy), HowLoud API for precision
- **Flood:** Official FEMA data, accurate but doesn't include recent climate changes

## Dependencies

No new NPM packages required

## Environment Variables

Add to `.env`:
```
AIRNOW_API_KEY=your_key_here
```

Sign up at: https://docs.airnowapi.org/

## Estimated Effort
**Medium** — 4-5 hours
- EPA AirNow API integration
- Noise estimation algorithm
- FEMA flood zone API integration
- HTML templates for three factors
- CSS styling with color badges
- Error handling for missing data
- Testing across different locations
