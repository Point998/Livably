# FR-024 — Demographics & Community Data

## What
Display neighborhood demographics including age distribution, income levels, education, population density, and community characteristics to help buyers understand who lives in the area.

## Problem
Buyers want to know:
- What's the age mix? (Families? Retirees? Young professionals?)
- What's the income level?
- Is this a highly educated area?
- How dense/crowded is it?
- What's the community vibe?

This information helps buyers determine if they'll fit in and find their community.

## Requirements

### Five Core Demographics

**1. Age Distribution** 👨‍👩‍👧‍👦
- Percentage breakdown by age group
- Median age
- Visual: Horizontal bar chart
- Context: "Predominantly families" vs "Young professionals"

**2. Income Levels** 💵
- Median household income
- Income distribution (low, middle, upper)
- Comparison to state/national median
- Context about affordability

**3. Education Levels** 🎓
- High school graduation rate
- College degree percentage
- Advanced degree percentage
- Context about educational attainment

**4. Population Density** 🏘️
- People per square mile
- Category (Urban, Suburban, Rural)
- Growth rate (past 10 years)

**5. Community Profile** 🌆
- Homeownership rate
- Average household size
- Commute patterns
- Top industries/occupations

### Report Section
New section: "Demographics & Community" 👥
- Five subsections with key metrics
- Visual charts (age distribution)
- Context paragraphs
- Comparison to regional/national averages

## Implementation Notes

### API Options

**US Census Bureau API** (Free, Official)
- American Community Survey (ACS) 5-year estimates
- Comprehensive demographic data
- County, city, ZIP code, tract level
- Free, no rate limits
- **Best source for this data**

**Alternative Sources:**
- Data.gov (repackaged Census data)
- Point2Homes API (Paid, real estate focused)

---

### Census Bureau API Integration

```javascript
const CENSUS_API_KEY = process.env.CENSUS_API_KEY;

async function getDemographics(lat, lng) {
  try {
    // Get FIPS code for location
    const fipsCode = await getFIPSCode(lat, lng);
    
    // Fetch demographics from Census ACS API
    const [ageData, incomeData, educationData, densityData, communityData] = 
      await Promise.all([
        getAgeDistribution(fipsCode),
        getIncomeData(fipsCode),
        getEducationData(fipsCode),
        getPopulationDensity(fipsCode),
        getCommunityProfile(fipsCode)
      ]);
    
    return {
      age: ageData,
      income: incomeData,
      education: educationData,
      density: densityData,
      community: communityData
    };
  } catch (error) {
    console.error('Demographics error:', error);
    return null;
  }
}

async function getFIPSCode(lat, lng) {
  // Use Census Geocoding API to get FIPS code
  const response = await fetch(
    `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?` +
    `x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&` +
    `format=json`
  );
  
  const data = await response.json();
  const tract = data.result.geographies['Census Tracts'][0];
  
  return {
    state: tract.STATE,
    county: tract.COUNTY,
    tract: tract.TRACT
  };
}

async function getAgeDistribution(fipsCode) {
  const response = await fetch(
    `https://api.census.gov/data/2021/acs/acs5?` +
    `get=B01001_001E,B01001_003E,B01001_027E,` + // Total, Under 5
    `B01001_007E,B01001_031E,` +                   // 18-24
    `B01001_010E,B01001_034E,` +                   // 25-44
    `B01001_013E,B01001_037E,` +                   // 45-64
    `B01001_016E,B01001_040E` +                    // 65+
    `&for=tract:${fipsCode.tract}` +
    `&in=state:${fipsCode.state}%20county:${fipsCode.county}` +
    `&key=${CENSUS_API_KEY}`
  );
  
  const data = await response.json();
  const values = data[1]; // First row after headers
  
  const total = parseInt(values[0]);
  const under18 = (parseInt(values[1]) + parseInt(values[2])) / total * 100;
  const age18to34 = (parseInt(values[3]) + parseInt(values[4])) / total * 100;
  const age35to64 = (parseInt(values[5]) + parseInt(values[6])) / total * 100;
  const age65plus = (parseInt(values[7]) + parseInt(values[8])) / total * 100;
  
  return {
    under18: under18.toFixed(1),
    age18to34: age18to34.toFixed(1),
    age35to64: age35to64.toFixed(1),
    age65plus: age65plus.toFixed(1),
    medianAge: await getMedianAge(fipsCode),
    primaryGroup: getPrimaryAgeGroup(under18, age18to34, age35to64, age65plus)
  };
}

function getPrimaryAgeGroup(under18, young, middle, senior) {
  const groups = [
    { pct: under18, label: 'Families with children' },
    { pct: young, label: 'Young professionals' },
    { pct: middle, label: 'Established families' },
    { pct: senior, label: 'Retirees and seniors' }
  ];
  
  const primary = groups.reduce((a, b) => a.pct > b.pct ? a : b);
  return primary.label;
}

async function getIncomeData(fipsCode) {
  const response = await fetch(
    `https://api.census.gov/data/2021/acs/acs5?` +
    `get=B19013_001E,B19001_002E,B19001_007E,B19001_013E` + // Median, <$25k, $50-75k, $100k+
    `&for=tract:${fipsCode.tract}` +
    `&in=state:${fipsCode.state}%20county:${fipsCode.county}` +
    `&key=${CENSUS_API_KEY}`
  );
  
  const data = await response.json();
  const values = data[1];
  
  const medianIncome = parseInt(values[0]);
  const under25k = parseInt(values[1]);
  const middle = parseInt(values[2]);
  const over100k = parseInt(values[3]);
  
  const total = under25k + middle + over100k;
  
  return {
    median: medianIncome,
    under25k: (under25k / total * 100).toFixed(1),
    middle: (middle / total * 100).toFixed(1),
    over100k: (over100k / total * 100).toFixed(1),
    incomeLevel: getIncomeLevel(medianIncome)
  };
}

function getIncomeLevel(median) {
  // US median household income ~$70k
  if (median > 100000) return { label: 'Upper income', color: 'green' };
  if (median > 70000) return { label: 'Above average', color: 'lightgreen' };
  if (median > 50000) return { label: 'Middle income', color: 'gold' };
  return { label: 'Below average', color: 'orange' };
}

async function getEducationData(fipsCode) {
  const response = await fetch(
    `https://api.census.gov/data/2021/acs/acs5?` +
    `get=B15003_001E,B15003_017E,B15003_022E,B15003_025E` + // Total, HS, Bachelor, Grad
    `&for=tract:${fipsCode.tract}` +
    `&in=state:${fipsCode.state}%20county:${fipsCode.county}` +
    `&key=${CENSUS_API_KEY}`
  );
  
  const data = await response.json();
  const values = data[1];
  
  const total = parseInt(values[0]);
  const hsGrad = parseInt(values[1]) / total * 100;
  const bachelor = parseInt(values[2]) / total * 100;
  const graduate = parseInt(values[3]) / total * 100;
  
  return {
    highSchool: hsGrad.toFixed(1),
    bachelor: bachelor.toFixed(1),
    graduate: graduate.toFixed(1),
    educationLevel: getEducationLevel(bachelor + graduate)
  };
}

function getEducationLevel(collegePct) {
  // US average ~35% college degree
  if (collegePct > 60) return { label: 'Very highly educated', color: 'green' };
  if (collegePct > 40) return { label: 'Highly educated', color: 'lightgreen' };
  if (collegePct > 25) return { label: 'Moderately educated', color: 'gold' };
  return { label: 'Below average education', color: 'orange' };
}

async function getPopulationDensity(fipsCode) {
  const response = await fetch(
    `https://api.census.gov/data/2021/acs/acs5?` +
    `get=B01003_001E` + // Total population
    `&for=tract:${fipsCode.tract}` +
    `&in=state:${fipsCode.state}%20county:${fipsCode.county}` +
    `&key=${CENSUS_API_KEY}`
  );
  
  const data = await response.json();
  const population = parseInt(data[1][0]);
  
  // Would need tract area to calculate actual density
  // For now, categorize based on population
  
  return {
    population,
    densityType: getDensityType(population),
    growthRate: await getPopulationGrowth(fipsCode) // Optional
  };
}

function getDensityType(population) {
  if (population > 5000) return { label: 'Urban', color: 'red', icon: '🏙️' };
  if (population > 2000) return { label: 'Suburban', color: 'gold', icon: '🏘️' };
  return { label: 'Rural', color: 'green', icon: '🌳' };
}

async function getCommunityProfile(fipsCode) {
  const response = await fetch(
    `https://api.census.gov/data/2021/acs/acs5?` +
    `get=B25003_002E,B25003_003E,B25010_001E` + // Owned, Rented, Avg household size
    `&for=tract:${fipsCode.tract}` +
    `&in=state:${fipsCode.state}%20county:${fipsCode.county}` +
    `&key=${CENSUS_API_KEY}`
  );
  
  const data = await response.json();
  const values = data[1];
  
  const owned = parseInt(values[0]);
  const rented = parseInt(values[1]);
  const avgHouseholdSize = parseFloat(values[2]);
  
  const ownershipRate = (owned / (owned + rented)) * 100;
  
  return {
    ownershipRate: ownershipRate.toFixed(1),
    avgHouseholdSize: avgHouseholdSize.toFixed(1),
    communityType: getCommunityType(ownershipRate, avgHouseholdSize)
  };
}

function getCommunityType(ownershipRate, householdSize) {
  if (ownershipRate > 70 && householdSize > 2.5) {
    return { label: 'Established family neighborhood', icon: '👨‍👩‍👧‍👦' };
  }
  if (ownershipRate < 40) {
    return { label: 'Rental community', icon: '🏢' };
  }
  if (householdSize < 2) {
    return { label: 'Singles and young professionals', icon: '👤' };
  }
  return { label: 'Mixed residential community', icon: '🏘️' };
}
```

---

### HTML Template

```html
<section class="demographics-section">
  <h2>Demographics & Community 👥</h2>
  <p class="section-intro">
    Who lives in this neighborhood and what's the community like?
  </p>
  
  <!-- Age Distribution -->
  <div class="demo-card">
    <h3>👨‍👩‍👧‍👦 Age Distribution</h3>
    <p class="demo-summary">Predominantly ${age.primaryGroup}</p>
    
    <div class="age-chart">
      <div class="age-bar">
        <span class="age-label">Under 18</span>
        <div class="bar-container">
          <div class="bar-fill" style="width: ${age.under18}%"></div>
        </div>
        <span class="age-percent">${age.under18}%</span>
      </div>
      
      <div class="age-bar">
        <span class="age-label">18-34</span>
        <div class="bar-container">
          <div class="bar-fill" style="width: ${age.age18to34}%"></div>
        </div>
        <span class="age-percent">${age.age18to34}%</span>
      </div>
      
      <div class="age-bar">
        <span class="age-label">35-64</span>
        <div class="bar-container">
          <div class="bar-fill" style="width: ${age.age35to64}%"></div>
        </div>
        <span class="age-percent">${age.age35to64}%</span>
      </div>
      
      <div class="age-bar">
        <span class="age-label">65+</span>
        <div class="bar-container">
          <div class="bar-fill" style="width: ${age.age65plus}%"></div>
        </div>
        <span class="age-percent">${age.age65plus}%</span>
      </div>
    </div>
    
    <p class="demo-note">Median age: ${age.medianAge} years</p>
  </div>
  
  <!-- Income -->
  <div class="demo-card">
    <h3>💵 Income Levels</h3>
    <div class="metric-large">$${income.median.toLocaleString()}</div>
    <div class="metric-label">Median household income</div>
    <div class="income-badge badge-${income.incomeLevel.color}">
      ${income.incomeLevel.label}
    </div>
  </div>
  
  <!-- Education -->
  <div class="demo-card">
    <h3>🎓 Education</h3>
    <div class="edu-stats">
      <div class="edu-stat">
        <span class="edu-percent">${education.bachelor}%</span>
        <span class="edu-label">Bachelor's degree</span>
      </div>
      <div class="edu-stat">
        <span class="edu-percent">${education.graduate}%</span>
        <span class="edu-label">Graduate degree</span>
      </div>
    </div>
    <div class="edu-badge badge-${education.educationLevel.color}">
      ${education.educationLevel.label}
    </div>
  </div>
  
  <!-- Density & Community -->
  <div class="demo-card">
    <h3>🏘️ Community Profile</h3>
    <div class="community-stat">
      <span class="stat-icon">${density.densityType.icon}</span>
      <span class="stat-text">${density.densityType.label} area</span>
    </div>
    <div class="community-stat">
      <span class="stat-icon">${community.communityType.icon}</span>
      <span class="stat-text">${community.communityType.label}</span>
    </div>
    <div class="community-stat">
      <span class="stat-icon">🏠</span>
      <span class="stat-text">${community.ownershipRate}% homeownership</span>
    </div>
  </div>
  
  <div class="demo-disclaimer">
    <p>
      <strong>Data source:</strong> US Census Bureau, American Community Survey 5-year estimates.
      Demographic data is for the census tract containing this address and may not reflect 
      the immediate neighborhood.
    </p>
  </div>
</section>
```

---

### CSS

```css
.demographics-section {
  margin: 3rem 0;
}

.demo-card {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.demo-card h3 {
  font-family: var(--font-serif);
  font-size: 1.3rem;
  margin: 0 0 1rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid var(--border);
}

.demo-summary {
  font-weight: 600;
  font-size: 1.1rem;
  margin-bottom: 1.5rem;
}

.age-chart {
  margin: 2rem 0;
}

.age-bar {
  display: grid;
  grid-template-columns: 100px 1fr 60px;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1rem;
}

.age-label {
  font-weight: 600;
  font-size: 0.9rem;
}

.bar-container {
  height: 24px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: var(--gold);
  transition: width 0.3s ease;
}

.age-percent {
  text-align: right;
  font-weight: 600;
}

.demo-note {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-top: 1rem;
}

.metric-large {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.metric-label {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
}

.income-badge,
.edu-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 600;
  margin-top: 1rem;
}

.badge-green { background: rgba(40, 167, 69, 0.1); color: #28a745; }
.badge-lightgreen { background: rgba(92, 184, 92, 0.1); color: #5cb85c; }
.badge-gold { background: rgba(212, 175, 55, 0.1); color: var(--gold); }
.badge-orange { background: rgba(253, 126, 20, 0.1); color: #fd7e14; }

.edu-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2rem;
  margin: 1.5rem 0;
}

.edu-stat {
  text-align: center;
}

.edu-percent {
  display: block;
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.edu-label {
  display: block;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.community-stat {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  background: var(--cream);
  border-radius: 4px;
}

.stat-icon {
  font-size: 1.5rem;
}

.stat-text {
  font-weight: 600;
}

.demo-disclaimer {
  background: #f9f9f9;
  padding: 1rem;
  border-left: 4px solid var(--gold);
  border-radius: 4px;
  font-size: 0.85rem;
  line-height: 1.6;
  margin-top: 2rem;
}

@media (max-width: 768px) {
  .age-bar {
    grid-template-columns: 80px 1fr 50px;
  }
  
  .edu-stats {
    grid-template-columns: 1fr;
  }
}
```

## Acceptance Criteria
- [ ] Age distribution displayed with bar chart
- [ ] Median household income shown
- [ ] Education levels (bachelor's, graduate)
- [ ] Population density category
- [ ] Community profile (ownership rate, household size)
- [ ] Context labels (e.g., "Predominantly families")
- [ ] Comparison to averages where relevant
- [ ] Data attribution (Census Bureau)
- [ ] Works for all US locations
- [ ] Mobile responsive

## Optional Enhancements (Future)
- [ ] Racial/ethnic diversity data
- [ ] Language spoken at home
- [ ] Veteran population
- [ ] Disability statistics
- [ ] Commute patterns (mode of transportation)
- [ ] Industry/occupation breakdown
- [ ] Historical population trends

## API Considerations

### Census Bureau API
- **Free:** No cost
- **Rate limits:** None for most endpoints
- **Coverage:** Nationwide
- **Freshness:** 5-year estimates (1-2 year lag)

### API Key
Sign up (free): https://api.census.gov/data/key_signup.html

## Privacy & Ethics

### Fair Housing Compliance
**CRITICAL:** Be very careful with demographic data.
- **Do NOT** use demographics to discriminate or steer
- **Do NOT** imply certain groups are better/worse
- **Do** present data factually and neutrally
- **Do** include disclaimer about data purpose

### Disclaimer Example:
> "Demographic data is provided for informational purposes only and represents the census tract, not the specific neighborhood. This information should not be used as a basis for housing discrimination."

## Dependencies

No new NPM packages required

## Environment Variables

Add to `.env`:
```
CENSUS_API_KEY=your_key_here
```

## Estimated Effort
**Medium** — 4-5 hours
- Census Bureau API integration
- FIPS code lookup
- Age distribution chart
- Income and education metrics
- Community profile
- HTML templates
- CSS styling
- Fair housing compliance review
- Testing across locations
