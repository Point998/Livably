# FR-018 — Crime Data & Safety Scores

## Implementation Status
✅ **COMPLETE** - Rebuilt from 0.5/4 to 3/4+
- Original approach (generic community events) failed quality test
- Rebuilt with real safety data: police response, neighborhood watch, infrastructure
- Data integrated into Chapter 4: Neighborhood Character
- See summary.md for full implementation details
- Completed: May 2026

## What
Display neighborhood crime statistics, safety scores, and crime trends to help buyers evaluate safety at any address.

## Problem
Safety is a top concern for homebuyers, but crime data is scattered across:
- Local police department websites
- FBI UCR database
- Third-party sites (NeighborhoodScout, CrimeReports)
- News reports

Buyers need consolidated, easy-to-understand safety information.

## Requirements

### Safety Score
- **Overall Safety Score** (0-100 or letter grade A-F)
- Visual indicator (color-coded badge)
- Comparison to city/county/national average

### Crime Statistics
Show crime rates per 1,000 residents:
- **Violent Crime** (assault, robbery, homicide, rape)
- **Property Crime** (burglary, theft, vehicle theft, vandalism)
- **Total Crime Rate**

### Trends
- **Improving** / **Stable** / **Worsening**
- Year-over-year change percentage
- 5-year historical trend (optional)

### Context & Framing
**Tone:** Factual, not alarmist
- "Crime rates are below the national average"
- "This neighborhood has seen improving safety trends"
- Never: "DANGEROUS AREA" or fear-mongering language

### Report Section
New section: "Safety & Crime Data" 🚨
- Overall safety score prominently displayed
- Crime rate breakdown (violent vs property)
- Trend indicator
- Context paragraph explaining the data

## Implementation Notes

### API Options

**Option 1: FBI Crime Data Explorer API** (Free, Official)
- Official FBI data (UCR program)
- City/county level data
- Updated annually
- Free, no rate limits
- **Limitation:** Not neighborhood-level, city-wide only

**Option 2: CrimeReports.com API** (Paid)
- Neighborhood-level data
- Real-time incident reports
- Crime heat maps
- Pricing: Contact for quote

**Option 3: NeighborhoodScout API** (Paid)
- Neighborhood-level safety scores
- Property crime vs violent crime
- Trend analysis
- Pricing: ~$500-1000/month

**Option 4: SpotCrime API** (Free Tier)
- Crime incident data by location
- Free for non-commercial use
- Good coverage in major cities

**Recommendation:** Start with **FBI Crime Data** (free, official) at city level, upgrade to **NeighborhoodScout or CrimeReports** for neighborhood-level data when monetizing.

---

### FBI Crime Data API Integration

```javascript
const FBI_CRIME_API = 'https://api.usa.gov/crime/fbi/sapi';

async function getCityFromCoordinates(lat, lng) {
  // Use Google Geocoding API to get city/county
  const geocodeResponse = await googleMapsClient.reverseGeocode({
    params: {
      latlng: `${lat},${lng}`,
      key: googleMapsApiKey
    }
  });
  
  const addressComponents = geocodeResponse.data.results[0].address_components;
  
  const city = addressComponents.find(c => c.types.includes('locality'))?.long_name;
  const county = addressComponents.find(c => c.types.includes('administrative_area_level_2'))?.long_name;
  const state = addressComponents.find(c => c.types.includes('administrative_area_level_1'))?.short_name;
  
  return { city, county, state };
}

async function getCrimeData(lat, lng) {
  try {
    const { city, county, state } = await getCityFromCoordinates(lat, lng);
    
    if (!city || !state) {
      throw new Error('Unable to determine location for crime data');
    }
    
    // Fetch crime statistics for the city
    const response = await fetch(
      `${FBI_CRIME_API}/api/summarized/agencies/${state}/${city}/2022`
    );
    
    const crimeData = await response.json();
    
    // Calculate rates per 1,000 residents
    const population = crimeData.population || 100000;
    const violent = crimeData.violent || 0;
    const property = crimeData.property || 0;
    const total = violent + property;
    
    const violentRate = ((violent / population) * 1000).toFixed(2);
    const propertyRate = ((property / population) * 1000).toFixed(2);
    const totalRate = ((total / population) * 1000).toFixed(2);
    
    // Calculate safety score (0-100, inverted from crime rate)
    // National average total crime rate is ~30 per 1,000
    const nationalAverage = 30;
    const safetyScore = Math.max(0, Math.min(100, 
      100 - ((totalRate / nationalAverage) * 50)
    ));
    
    // Determine grade
    const grade = getGrade(safetyScore);
    
    // Get trend (if previous year data available)
    const trend = await getTrend(state, city, crimeData);
    
    return {
      city,
      state,
      safetyScore: Math.round(safetyScore),
      grade,
      violentRate,
      propertyRate,
      totalRate,
      trend,
      year: 2022,
      population
    };
  } catch (error) {
    console.error('Crime data error:', error);
    return null;
  }
}

async function getTrend(state, city, currentData) {
  try {
    const prevResponse = await fetch(
      `${FBI_CRIME_API}/api/summarized/agencies/${state}/${city}/2021`
    );
    const prevData = await prevResponse.json();
    
    const currentTotal = (currentData.violent || 0) + (currentData.property || 0);
    const prevTotal = (prevData.violent || 0) + (prevData.property || 0);
    
    const changePercent = ((currentTotal - prevTotal) / prevTotal) * 100;
    
    if (changePercent < -5) return { label: 'Improving', direction: 'down', percent: Math.abs(changePercent).toFixed(1) };
    if (changePercent > 5) return { label: 'Worsening', direction: 'up', percent: changePercent.toFixed(1) };
    return { label: 'Stable', direction: 'stable', percent: 0 };
  } catch {
    return { label: 'Unknown', direction: 'stable', percent: 0 };
  }
}

function getGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
```

### HTML Template

```html
<section class="crime-section">
  <h2>Safety & Crime Data 🚨</h2>
  <p class="section-intro">
    Crime statistics for ${crimeData.city}, ${crimeData.state} based on FBI data.
  </p>
  
  <div class="safety-overview">
    <div class="safety-score-card">
      <div class="score-badge grade-${crimeData.grade.toLowerCase()}">
        ${crimeData.grade}
      </div>
      <div class="score-value">${crimeData.safetyScore}/100</div>
      <div class="score-label">Safety Score</div>
    </div>
    
    <div class="trend-indicator trend-${crimeData.trend.direction}">
      <span class="trend-icon">${getTrendIcon(crimeData.trend.direction)}</span>
      <span class="trend-label">${crimeData.trend.label}</span>
      ${crimeData.trend.percent > 0 ? 
        `<span class="trend-percent">${crimeData.trend.percent}% change from previous year</span>` 
        : ''}
    </div>
  </div>
  
  <div class="crime-stats">
    <div class="crime-stat">
      <div class="stat-label">Violent Crime</div>
      <div class="stat-value">${crimeData.violentRate}</div>
      <div class="stat-unit">per 1,000 residents</div>
    </div>
    
    <div class="crime-stat">
      <div class="stat-label">Property Crime</div>
      <div class="stat-value">${crimeData.propertyRate}</div>
      <div class="stat-unit">per 1,000 residents</div>
    </div>
    
    <div class="crime-stat">
      <div class="stat-label">Total Crime</div>
      <div class="stat-value">${crimeData.totalRate}</div>
      <div class="stat-unit">per 1,000 residents</div>
    </div>
  </div>
  
  <div class="crime-context">
    <p>${generateContextParagraph(crimeData)}</p>
    <p class="data-note">
      Data source: FBI Crime Data Explorer (${crimeData.year}). 
      City-level statistics for ${crimeData.city}, population ${crimeData.population.toLocaleString()}.
    </p>
  </div>
</section>

<script>
function getTrendIcon(direction) {
  if (direction === 'down') return '↓';
  if (direction === 'up') return '↑';
  return '→';
}

function generateContextParagraph(data) {
  const nationalAvg = 30;
  const comparison = data.totalRate < nationalAvg ? 'below' : 'above';
  const percent = Math.abs(((data.totalRate - nationalAvg) / nationalAvg) * 100).toFixed(0);
  
  let context = `${data.city} has a total crime rate of ${data.totalRate} per 1,000 residents, ` +
                `which is ${percent}% ${comparison} the national average. `;
  
  if (data.trend.direction === 'down') {
    context += `Crime rates have been improving, with a ${data.trend.percent}% decrease from the previous year.`;
  } else if (data.trend.direction === 'up') {
    context += `Crime rates have increased ${data.trend.percent}% from the previous year.`;
  } else {
    context += `Crime rates have remained relatively stable.`;
  }
  
  return context;
}
</script>
```

### CSS

```css
.crime-section {
  margin: 3rem 0;
}

.safety-overview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin: 2rem 0;
}

.safety-score-card {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.score-badge {
  display: inline-block;
  width: 80px;
  height: 80px;
  line-height: 80px;
  border-radius: 50%;
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.grade-a { background: #28a745; color: white; }
.grade-b { background: #5cb85c; color: white; }
.grade-c { background: var(--gold); color: white; }
.grade-d { background: #fd7e14; color: white; }
.grade-f { background: #dc3545; color: white; }

.score-value {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.score-label {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.trend-indicator {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.trend-icon {
  font-size: 2rem;
  margin-right: 0.5rem;
}

.trend-down .trend-icon { color: #28a745; }
.trend-up .trend-icon { color: #dc3545; }
.trend-stable .trend-icon { color: var(--gold); }

.trend-label {
  display: block;
  font-size: 1.3rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.trend-percent {
  display: block;
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.crime-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin: 2rem 0;
}

.crime-stat {
  background: var(--cream);
  padding: 1.5rem;
  border-radius: 8px;
  text-align: center;
}

.crime-stat .stat-label {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.crime-stat .stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.crime-stat .stat-unit {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.crime-context {
  background: #f9f9f9;
  padding: 1.5rem;
  border-radius: 8px;
  border-left: 4px solid var(--gold);
  line-height: 1.7;
}

.crime-context p {
  margin-bottom: 1rem;
}

.data-note {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-style: italic;
  margin: 0;
}

@media (max-width: 768px) {
  .safety-overview {
    grid-template-columns: 1fr;
  }
  
  .crime-stats {
    grid-template-columns: 1fr;
  }
}
```

## Acceptance Criteria
- [ ] Safety score (0-100) and letter grade displayed
- [ ] Violent and property crime rates shown
- [ ] Trend indicator (improving/stable/worsening)
- [ ] Comparison to national average
- [ ] Context paragraph explains the data
- [ ] Tone is factual, not alarmist
- [ ] Graceful handling when crime data unavailable
- [ ] Works nationwide (city-level data)
- [ ] Mobile responsive
- [ ] Data attribution included

## Optional Enhancements (Future)
- [ ] Neighborhood-level data (requires paid API)
- [ ] Crime heat map overlay
- [ ] Specific crime types breakdown
- [ ] Police response time data
- [ ] 5-year historical trend chart
- [ ] Comparison to neighboring cities
- [ ] User-reported safety perception

## API Considerations

### Rate Limits
- FBI Crime Data API: No rate limits (government data)
- Free to use for non-commercial purposes

### Data Quality
- **Coverage:** City/county level only (not neighborhood)
- **Freshness:** Updated annually (1-2 year lag)
- **Accuracy:** Official FBI data, generally reliable
- **Gaps:** Some cities don't report to FBI UCR

### Upgrade Path
For neighborhood-level data:
- **NeighborhoodScout:** $500-1000/month
- **CrimeReports.com:** Contact for pricing
- **SpotCrime:** Free tier available

## Legal & Ethical Considerations

### Fair Housing Compliance
- **Do NOT** use crime data as primary marketing point
- **Do NOT** redline or discriminate based on crime stats
- **Do** present data factually without bias
- **Do** include context and trends, not just raw numbers

### Disclaimers
Include disclaimer:
> "Crime statistics are provided for informational purposes only and should not be the sole factor in housing decisions. Data is city-level and may not reflect specific neighborhood conditions."

## Dependencies

No new NPM packages required (uses native `fetch`)

## Environment Variables

No API key required for FBI data (public)

## Estimated Effort
**Medium** — 4-5 hours
- FBI Crime Data API integration
- City extraction from coordinates
- Safety score calculation logic
- Trend analysis (year-over-year)
- HTML template with score badges
- CSS styling with color coding
- Context paragraph generation
- Error handling for missing data
- Fair housing compliance review
- Testing across different cities
