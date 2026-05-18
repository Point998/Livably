# FR-008 — Livability Scoring System

## What
Add an overall "Livability Score" to each report based on proximity and accessibility to essential services.

## Problem
Currently:
- Reports show individual drive times but no overall assessment
- Users can't quickly compare multiple addresses
- No single metric to answer "Is this a good location?"
- Hard to understand at-a-glance if an address is well-situated

## Requirements

### Livability Score
- Single numeric score: **0-100**
- Displayed prominently at top of report (hero section)
- Visual representation: progress bar or circular gauge
- Score breakdown showing how it was calculated
- Color-coded: 
  - 80-100: Excellent (green)
  - 60-79: Good (gold)
  - 40-59: Fair (orange)
  - 0-39: Poor (red)

### Scoring Algorithm

**Base scoring by drive time:**
```javascript
function calculateServiceScore(driveTimeMinutes) {
  if (driveTimeMinutes <= 5) return 100;
  if (driveTimeMinutes <= 10) return 90;
  if (driveTimeMinutes <= 15) return 75;
  if (driveTimeMinutes <= 20) return 60;
  if (driveTimeMinutes <= 30) return 40;
  if (driveTimeMinutes <= 45) return 20;
  return 10; // 45+ minutes
}
```

**Weighted categories:**
- Grocery: 25% (most frequent use)
- Pharmacy: 15%
- Hospital: 20% (critical but less frequent)
- Urgent Care: 15%
- Highway Access: 15%
- Gas Station: 10%

**Overall score:**
```javascript
const score = 
  (groceryScore * 0.25) +
  (pharmacyScore * 0.15) +
  (hospitalScore * 0.20) +
  (urgentCareScore * 0.15) +
  (highwayScore * 0.15) +
  (gasScore * 0.10);
```

### Score Display

**Hero section addition:**
```html
<div class="hero-score">
  <div class="score-value">78</div>
  <div class="score-label">Livability Score</div>
  <div class="score-rating">Good</div>
</div>
```

**Score breakdown section:**
```html
<section class="score-breakdown">
  <h2>How we calculated your score</h2>
  <div class="score-category">
    <span class="category-name">Grocery Access</span>
    <div class="score-bar">
      <div class="score-fill" style="width: 90%"></div>
    </div>
    <span class="category-score">90/100</span>
    <span class="category-time">5 min drive</span>
  </div>
  <!-- Repeat for each category -->
</section>
```

### Design Requirements
- Score displayed with large typography (72px+ for number)
- Color-coded based on score tier
- Breakdown section uses same design system
- Progress bars use gold accent for fill
- Mobile-friendly layout

## Implementation Notes

### Server-side Calculation (`src/app.js`)

```javascript
function calculateServiceScore(driveTimeMinutes) {
  if (driveTimeMinutes <= 5) return 100;
  if (driveTimeMinutes <= 10) return 90;
  if (driveTimeMinutes <= 15) return 75;
  if (driveTimeMinutes <= 20) return 60;
  if (driveTimeMinutes <= 30) return 40;
  if (driveTimeMinutes <= 45) return 20;
  return 10;
}

function calculateLivabilityScore(services) {
  const scores = {
    grocery: calculateServiceScore(services.grocery.driveTimeMinutes),
    pharmacy: calculateServiceScore(services.pharmacy.driveTimeMinutes),
    hospital: calculateServiceScore(services.hospital.driveTimeMinutes),
    urgentCare: calculateServiceScore(services.urgentCare.driveTimeMinutes),
    highway: calculateServiceScore(services.highwayRamp.driveTimeMinutes),
    gas: calculateServiceScore(services.gasStation.driveTimeMinutes)
  };
  
  const overallScore = Math.round(
    (scores.grocery * 0.25) +
    (scores.pharmacy * 0.15) +
    (scores.hospital * 0.20) +
    (scores.urgentCare * 0.15) +
    (scores.highway * 0.15) +
    (scores.gas * 0.10)
  );
  
  return {
    overall: overallScore,
    rating: getRating(overallScore),
    breakdown: scores
  };
}

function getRating(score) {
  if (score >= 80) return { label: 'Excellent', color: 'green' };
  if (score >= 60) return { label: 'Good', color: 'gold' };
  if (score >= 40) return { label: 'Fair', color: 'orange' };
  return { label: 'Poor', color: 'red' };
}
```

### HTML Template Updates

**Hero section:**
```html
<div class="hero">
  <div class="hero-address">
    <div class="hero-street">100 Wishing Well Path</div>
    <div class="hero-city">Georgetown, KY 40324</div>
  </div>
  
  <div class="hero-score">
    <div class="score-circle score-${rating.color}">
      <div class="score-value">${overall}</div>
    </div>
    <div class="score-label">${rating.label}</div>
  </div>
</div>
```

**Breakdown section:**
```html
<section class="score-breakdown">
  <h2>How we calculated your score</h2>
  <p class="breakdown-intro">
    Your Livability Score is based on drive times to essential services,
    weighted by how frequently you'll need them.
  </p>
  
  <div class="breakdown-categories">
    ${renderCategoryScore('Grocery', breakdown.grocery, services.grocery.driveTimeMinutes, 25)}
    ${renderCategoryScore('Hospital', breakdown.hospital, services.hospital.driveTimeMinutes, 20)}
    ${renderCategoryScore('Pharmacy', breakdown.pharmacy, services.pharmacy.driveTimeMinutes, 15)}
    ${renderCategoryScore('Urgent Care', breakdown.urgentCare, services.urgentCare.driveTimeMinutes, 15)}
    ${renderCategoryScore('Highway Access', breakdown.highway, services.highwayRamp.driveTimeMinutes, 15)}
    ${renderCategoryScore('Gas Station', breakdown.gas, services.gasStation.driveTimeMinutes, 10)}
  </div>
</section>

function renderCategoryScore(name, score, driveTime, weight) {
  return `
    <div class="category-row">
      <div class="category-header">
        <span class="category-name">${name}</span>
        <span class="category-weight">${weight}% weight</span>
      </div>
      <div class="category-details">
        <div class="score-bar-container">
          <div class="score-bar-fill" style="width: ${score}%"></div>
        </div>
        <span class="category-score">${score}/100</span>
        <span class="category-time">${driveTime} min</span>
      </div>
    </div>
  `;
}
```

### CSS

```css
/* Hero Score */
.hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hero-score {
  text-align: center;
}

.score-circle {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 0.5rem;
  border: 4px solid;
}

.score-circle.score-green { border-color: #28a745; color: #28a745; }
.score-circle.score-gold { border-color: var(--gold); color: var(--gold); }
.score-circle.score-orange { border-color: #fd7e14; color: #fd7e14; }
.score-circle.score-red { border-color: #dc3545; color: #dc3545; }

.score-value {
  font-size: 2.5rem;
  font-weight: 700;
  font-family: var(--font-serif);
}

.score-label {
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

/* Score Breakdown */
.score-breakdown {
  margin: 3rem 0;
}

.breakdown-intro {
  color: var(--text-secondary);
  margin-bottom: 2rem;
}

.category-row {
  margin-bottom: 1.5rem;
}

.category-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.category-name {
  font-weight: 600;
}

.category-weight {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.category-details {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.score-bar-container {
  flex: 1;
  height: 8px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
}

.score-bar-fill {
  height: 100%;
  background: var(--gold);
  transition: width 0.3s ease;
}

.category-score {
  font-weight: 600;
  min-width: 50px;
}

.category-time {
  font-size: 0.85rem;
  color: var(--text-secondary);
  min-width: 60px;
}
```

## Acceptance Criteria
- [ ] Overall score displays in hero section (0-100)
- [ ] Score is color-coded by tier (green/gold/orange/red)
- [ ] Score breakdown section shows all 6 categories
- [ ] Each category shows: name, weight, score, drive time
- [ ] Progress bars visually represent scores
- [ ] Calculation is accurate based on algorithm
- [ ] Design matches report aesthetic
- [ ] Responsive on mobile (stacks hero elements vertically)
- [ ] Tested with various addresses (high/medium/low scores)

## Optional Enhancements (Future)
- [ ] Animated score counter on page load
- [ ] Tooltips explaining scoring methodology
- [ ] Compare scores across multiple addresses
- [ ] Customizable weights (user preferences)
- [ ] Historical score tracking
- [ ] Neighborhood average comparison

## Testing Scenarios
1. **Urban address** (all services <10 min) → Score 85-95 (Excellent)
2. **Suburban address** (services 10-20 min) → Score 60-75 (Good)
3. **Rural address** (services 20-45 min) → Score 30-50 (Fair/Poor)
4. **Edge case** (one service very far) → Score reflects weighted impact
5. **Mobile viewport** → Hero score and breakdown render correctly

## Dependencies
- No new NPM packages required
- Pure JavaScript calculation
- CSS for visual elements

## Estimated Effort
**Medium** — 3-4 hours
- Scoring algorithm implementation
- HTML template updates
- CSS for score display and breakdown
- Testing across address types
- Responsive design adjustments
