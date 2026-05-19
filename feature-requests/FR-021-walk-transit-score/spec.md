# FR-021 — Walk Score & Transit Score

## What
Integrate Walk Score, Transit Score, and Bike Score to help buyers evaluate walkability and transportation options at any address.

## Problem
Modern buyers, especially younger demographics, care about:
- Can I walk to daily needs?
- Is public transit accessible?
- Is this neighborhood bike-friendly?

Walk Score is the industry standard for measuring these factors, but it's not consolidated with other home-buying data.

## Requirements

### Three Scores

**1. Walk Score (0-100)** 🚶
- Measures walkability to amenities
- 90-100: Daily errands do not require a car
- 70-89: Most errands can be accomplished on foot
- 50-69: Some errands can be accomplished on foot
- 25-49: Most errands require a car
- 0-24: Almost all errands require a car

**2. Transit Score (0-100)** 🚇
- Measures public transportation access
- Based on proximity and frequency of transit
- Only available in cities with public transit

**3. Bike Score (0-100)** 🚴
- Measures bikeability
- Considers bike lanes, hills, destinations
- Only available in select cities

### Report Section
New section: "Walkability & Transit" 🚶
- Three circular score badges
- Category labels (Car-Dependent, Somewhat Walkable, Very Walkable, etc.)
- Context paragraph explaining what scores mean
- Link to full Walk Score analysis

## Implementation Notes

### Walk Score API

**Official API:** https://www.walkscore.com/professional/api.php

**Pricing:**
- Free tier: NOT available (requires paid plan)
- Paid: Starting at $250/month for 5,000 requests

**Alternative:**
- Free embedding (limited): Can embed Walk Score widget
- Screen scraping (NOT recommended, against TOS)

**Recommendation:** This is a **premium feature** that requires budget allocation. Consider:
- Option 1: Pay for Walk Score API ($250/month)
- Option 2: Defer until monetization (FR-022) to offset cost
- Option 3: Use Google Places data to calculate a simple walkability proxy (free but less accurate)

---

### Walk Score API Integration

```javascript
const WALKSCORE_API_KEY = process.env.WALKSCORE_API_KEY;

async function getWalkScore(lat, lng, address) {
  try {
    const response = await fetch(
      `https://api.walkscore.com/score?` +
      `format=json&address=${encodeURIComponent(address)}` +
      `&lat=${lat}&lon=${lng}&transit=1&bike=1` +
      `&wsapikey=${WALKSCORE_API_KEY}`
    );
    
    const data = await response.json();
    
    if (data.status !== 1) {
      throw new Error('Walk Score API error');
    }
    
    return {
      walkScore: {
        score: data.walkscore,
        description: data.description,
        link: data.ws_link
      },
      transitScore: data.transit ? {
        score: data.transit.score,
        description: data.transit.description,
        summary: data.transit.summary
      } : null,
      bikeScore: data.bike ? {
        score: data.bike.score,
        description: data.bike.description
      } : null
    };
  } catch (error) {
    console.error('Walk Score API error:', error);
    return null;
  }
}

function getWalkScoreCategory(score) {
  if (score >= 90) return { label: "Walker's Paradise", color: 'green', icon: '🌟' };
  if (score >= 70) return { label: 'Very Walkable', color: 'lightgreen', icon: '✅' };
  if (score >= 50) return { label: 'Somewhat Walkable', color: 'gold', icon: '🚶' };
  if (score >= 25) return { label: 'Car-Dependent', color: 'orange', icon: '🚗' };
  return { label: 'Very Car-Dependent', color: 'red', icon: '🚗🚗' };
}

function getTransitScoreCategory(score) {
  if (score >= 90) return { label: 'Rider's Paradise', color: 'green' };
  if (score >= 70) return { label: 'Excellent Transit', color: 'lightgreen' };
  if (score >= 50) return { label: 'Good Transit', color: 'gold' };
  if (score >= 25) return { label: 'Some Transit', color: 'orange' };
  return { label: 'Minimal Transit', color: 'red' };
}

function getBikeScoreCategory(score) {
  if (score >= 90) return { label: "Biker's Paradise", color: 'green' };
  if (score >= 70) return { label: 'Very Bikeable', color: 'lightgreen' };
  if (score >= 50) return { label: 'Bikeable', color: 'gold' };
  return { label: 'Somewhat Bikeable', color: 'orange' };
}
```

---

### Alternative: Simple Walkability Proxy (Free)

If Walk Score API is too expensive, create a basic walkability metric:

```javascript
async function calculateWalkabilityProxy(lat, lng) {
  // Count amenities within walking distance (0.5 miles = 800m)
  const amenityTypes = [
    'grocery_or_supermarket',
    'restaurant',
    'cafe',
    'bank',
    'pharmacy',
    'park',
    'school',
    'transit_station'
  ];
  
  let totalAmenities = 0;
  
  for (const type of amenityTypes) {
    const response = await googleMapsClient.placesNearby({
      params: {
        location: `${lat},${lng}`,
        radius: 800, // 0.5 miles
        type: type,
        key: googleMapsApiKey
      }
    });
    
    totalAmenities += (response.data.results || []).length;
  }
  
  // Score 0-100 based on amenity count
  // 50+ amenities = 100, scale linearly
  const score = Math.min(100, (totalAmenities / 50) * 100);
  
  return {
    score: Math.round(score),
    description: getWalkScoreCategory(score).label,
    amenityCount: totalAmenities,
    disclaimer: 'Estimated walkability based on nearby amenities. Not an official Walk Score.'
  };
}
```

---

### HTML Template

```html
<section class="walkability-section">
  <h2>Walkability & Transit 🚶</h2>
  <p class="section-intro">
    How easy is it to walk, bike, or use public transportation from this address?
  </p>
  
  <div class="scores-grid">
    <!-- Walk Score -->
    <div class="score-card">
      <div class="score-circle circle-${walkScoreCategory.color}">
        <div class="score-number">${walkScore.score}</div>
      </div>
      <div class="score-label">Walk Score</div>
      <div class="score-category">${walkScoreCategory.icon} ${walkScoreCategory.label}</div>
      <p class="score-description">${walkScore.description}</p>
    </div>
    
    <!-- Transit Score -->
    ${transitScore ? `
      <div class="score-card">
        <div class="score-circle circle-${transitScoreCategory.color}">
          <div class="score-number">${transitScore.score}</div>
        </div>
        <div class="score-label">Transit Score</div>
        <div class="score-category">${transitScoreCategory.label}</div>
        <p class="score-description">${transitScore.description}</p>
        ${transitScore.summary ? `<p class="transit-summary">${transitScore.summary}</p>` : ''}
      </div>
    ` : `
      <div class="score-card score-unavailable">
        <div class="score-circle circle-gray">
          <div class="score-number">—</div>
        </div>
        <div class="score-label">Transit Score</div>
        <p class="unavailable-note">Public transit data not available for this area</p>
      </div>
    `}
    
    <!-- Bike Score -->
    ${bikeScore ? `
      <div class="score-card">
        <div class="score-circle circle-${bikeScoreCategory.color}">
          <div class="score-number">${bikeScore.score}</div>
        </div>
        <div class="score-label">Bike Score</div>
        <div class="score-category">${bikeScoreCategory.label}</div>
        <p class="score-description">${bikeScore.description}</p>
      </div>
    ` : `
      <div class="score-card score-unavailable">
        <div class="score-circle circle-gray">
          <div class="score-number">—</div>
        </div>
        <div class="score-label">Bike Score</div>
        <p class="unavailable-note">Bike score not available for this area</p>
      </div>
    `}
  </div>
  
  <div class="walkscore-attribution">
    <p>
      Scores powered by <a href="${walkScore.link}" target="_blank">Walk Score®</a>
      <br>
      <a href="https://www.walkscore.com/how-it-works/" target="_blank">Learn how Walk Score works</a>
    </p>
  </div>
</section>
```

---

### CSS

```css
.walkability-section {
  margin: 3rem 0;
}

.scores-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
  margin: 2rem 0;
}

.score-card {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.score-circle {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
  border: 6px solid;
}

.circle-green { border-color: #28a745; }
.circle-lightgreen { border-color: #5cb85c; }
.circle-gold { border-color: var(--gold); }
.circle-orange { border-color: #fd7e14; }
.circle-red { border-color: #dc3545; }
.circle-gray { border-color: #ccc; }

.score-number {
  font-size: 3rem;
  font-weight: 700;
  font-family: var(--font-serif);
}

.score-label {
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.score-category {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.score-description {
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.transit-summary {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: 0.5rem;
  font-style: italic;
}

.score-unavailable {
  opacity: 0.6;
}

.unavailable-note {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-style: italic;
}

.walkscore-attribution {
  text-align: center;
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 4px;
  font-size: 0.85rem;
}

.walkscore-attribution a {
  color: var(--gold);
  text-decoration: none;
}

.walkscore-attribution a:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .scores-grid {
    grid-template-columns: 1fr;
  }
}
```

## Acceptance Criteria
- [ ] Walk Score displayed (0-100)
- [ ] Transit Score displayed (if available)
- [ ] Bike Score displayed (if available)
- [ ] Category labels for each score
- [ ] Circular score badges with color coding
- [ ] Descriptions explain what each score means
- [ ] "Not available" message for missing scores
- [ ] Walk Score attribution and link
- [ ] Mobile responsive
- [ ] Works nationwide

## Optional Enhancements (Future)
- [ ] Nearby transit stops list
- [ ] Transit route map
- [ ] Bike lane map overlay
- [ ] Walkability to specific destinations
- [ ] Car-free lifestyle feasibility analysis

## API Considerations

### Cost
- **Walk Score API:** $250-500/month (5,000-15,000 requests)
- **Alternative (proxy):** Free but less accurate

### Rate Limits
- Walk Score: Included in plan (e.g., 5,000/month)

### Data Quality
- **Walk Score:** Highly accurate, industry standard
- **Transit Score:** Good coverage in cities with transit
- **Bike Score:** Limited to select cities

### Attribution Requirements
- **MUST** display "Powered by Walk Score®"
- **MUST** link back to Walk Score
- Cannot modify or obscure scores

## Decision Point

**Before implementing, decide:**

**Option A: Pay for Walk Score API** ($250/month)
- ✅ Official, accurate scores
- ✅ Recognizable brand
- ❌ Ongoing cost

**Option B: Build walkability proxy** (free)
- ✅ No API cost
- ✅ Custom to your needs
- ❌ Less accurate
- ❌ Not industry-recognized

**Option C: Defer to premium tier** (FR-022)
- Only show Walk Score for paid reports
- Offsets API cost with revenue

**Recommendation:** Start with **Option C** - make this a premium feature to offset the $250/month cost.

## Dependencies

No new NPM packages required

## Environment Variables

Add to `.env`:
```
WALKSCORE_API_KEY=your_key_here
```

Sign up at: https://www.walkscore.com/professional/api.php

## Estimated Effort
**Low-Medium** — 2-3 hours (if API access secured)
- Walk Score API integration
- Score category determination
- HTML template with three score circles
- CSS styling
- Attribution requirements
- Error handling for unavailable scores
- Testing across different locations

**OR**

**Medium** — 4-5 hours (if building proxy)
- Amenity counting logic
- Score calculation algorithm
- Same HTML/CSS work
- More extensive testing needed
