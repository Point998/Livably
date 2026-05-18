# FR-010 — Compare Addresses Side-by-Side

## What
Allow users to compare 2-3 addresses side-by-side to help with relocation decisions.

## Problem
Currently:
- Users must generate separate reports and manually compare
- Hard to visualize differences between locations
- No direct comparison of scores, drive times, or services
- Decision-making requires switching between browser tabs

## Requirements

### Compare Interface
- **Input:** Add 2-3 addresses on comparison page
- **Layout:** Side-by-side columns (mobile: vertical stack)
- **Comparison Table:** Shows all services with drive times
- **Visual Indicators:** Highlights best/worst times with color coding
- **Score Comparison:** Display livability scores for each address
- **Map View:** Show all addresses + services on one map

### URL Structure
- Comparison page: `/compare`
- With addresses: `/compare?addresses=ADDRESS1|ADDRESS2|ADDRESS3`
- Shareable comparison URLs (like FR-007)

### Comparison Metrics
For each address, show:
- Overall livability score
- Drive times to all 6 core services
- Drive times to additional services (if FR-009 complete)
- Winner/loser indicators (green checkmark / red X)
- Percentage differences between locations

### Visual Design
```
┌─────────────────────────────────────────────────────────────────┐
│  Compare Addresses                                              │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Address 1     │   Address 2     │   Address 3                 │
│   Georgetown    │   Lexington     │   Louisville                │
│   Score: 78     │   Score: 85     │   Score: 72                 │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ Grocery         │                 │                             │
│ 5 min ✓         │ 3 min ✓✓        │ 8 min                       │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ Hospital        │                 │                             │
│ 12 min          │ 8 min ✓         │ 15 min                      │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

## Implementation Notes

### Comparison Page (`/compare`)

**New route in `src/app.js`:**
```javascript
app.get('/compare', async (req, res) => {
  const addressesParam = req.query.addresses;
  
  if (!addressesParam) {
    // Show blank comparison form
    return res.send(renderComparisonForm());
  }
  
  const addresses = addressesParam.split('|').slice(0, 3); // Max 3
  
  try {
    // Generate reports for all addresses in parallel
    const reports = await Promise.all(
      addresses.map(address => generateReportData(address))
    );
    
    return res.send(renderComparisonTable(reports));
  } catch (error) {
    return res.send(renderComparisonError(error.message));
  }
});

async function generateReportData(address) {
  const origin = await geocodeAddress(address);
  const originLatLng = `${origin.lat},${origin.lng}`;
  
  const [grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation] = 
    await Promise.all([
      findNearestGrocery(originLatLng),
      findNearestPharmacy(originLatLng),
      findNearestHospital(originLatLng),
      findNearestUrgentCare(originLatLng),
      findNearestHighwayOnRamp(originLatLng),
      findNearestGasStation(originLatLng),
    ]);
  
  const score = calculateLivabilityScore({
    grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation
  });
  
  return {
    address,
    origin,
    score,
    services: { grocery, pharmacy, hospital, urgentCare, highwayRamp, gasStation }
  };
}
```

### Comparison Form HTML
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Compare Addresses | Livably</title>
  <link rel="stylesheet" href="/report.css">
</head>
<body class="compare-page">
  <div class="compare-container">
    <div class="form-logo">Liv<span class="logo-gold">ably</span></div>
    <h1>Compare Addresses</h1>
    <p class="compare-intro">
      Compare up to 3 addresses side-by-side to see which location works best for you.
    </p>
    
    <form action="/compare" method="get" class="compare-form">
      <div class="address-input-group">
        <label for="address1">Address 1</label>
        <input type="text" name="address1" id="address1" placeholder="Enter first address" required>
      </div>
      
      <div class="address-input-group">
        <label for="address2">Address 2</label>
        <input type="text" name="address2" id="address2" placeholder="Enter second address" required>
      </div>
      
      <div class="address-input-group">
        <label for="address3">Address 3 (optional)</label>
        <input type="text" name="address3" id="address3" placeholder="Enter third address">
      </div>
      
      <button type="submit">Compare</button>
    </form>
  </div>
  
  <script>
    // Combine addresses into pipe-delimited format on submit
    document.querySelector('.compare-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const addr1 = document.getElementById('address1').value;
      const addr2 = document.getElementById('address2').value;
      const addr3 = document.getElementById('address3').value;
      
      let addresses = [addr1, addr2];
      if (addr3) addresses.push(addr3);
      
      window.location.href = `/compare?addresses=${encodeURIComponent(addresses.join('|'))}`;
    });
  </script>
</body>
</html>
```

### Comparison Table HTML
```html
<div class="comparison-results">
  <div class="comparison-header">
    <h1>Address Comparison</h1>
    <a href="/compare" class="btn-secondary">Compare Different Addresses</a>
  </div>
  
  <div class="comparison-grid">
    <div class="comparison-col">
      <div class="address-card">
        <h3>${report1.address}</h3>
        <div class="score-display score-${report1.score.rating.color}">
          ${report1.score.overall}
        </div>
        <div class="score-label">${report1.score.rating.label}</div>
      </div>
    </div>
    
    <div class="comparison-col">
      <div class="address-card">
        <h3>${report2.address}</h3>
        <div class="score-display score-${report2.score.rating.color}">
          ${report2.score.overall}
        </div>
        <div class="score-label">${report2.score.rating.label}</div>
      </div>
    </div>
    
    <!-- Repeat for address 3 if exists -->
  </div>
  
  <table class="comparison-table">
    <thead>
      <tr>
        <th>Service</th>
        <th>${report1.address}</th>
        <th>${report2.address}</th>
        <!-- Address 3 column if exists -->
      </tr>
    </thead>
    <tbody>
      ${renderComparisonRow('Grocery', [
        report1.services.grocery.driveTimeMinutes,
        report2.services.grocery.driveTimeMinutes
      ])}
      ${renderComparisonRow('Pharmacy', [
        report1.services.pharmacy.driveTimeMinutes,
        report2.services.pharmacy.driveTimeMinutes
      ])}
      <!-- More rows -->
    </tbody>
  </table>
</div>

<script>
function renderComparisonRow(serviceName, driveTimes) {
  const minTime = Math.min(...driveTimes);
  
  return `
    <tr>
      <td class="service-name">${serviceName}</td>
      ${driveTimes.map(time => `
        <td class="${time === minTime ? 'best-time' : ''}">
          ${time} min
          ${time === minTime ? '<span class="winner">✓</span>' : ''}
        </td>
      `).join('')}
    </tr>
  `;
}
</script>
```

### CSS

```css
/* Comparison Form */
.compare-page {
  background: var(--cream);
  min-height: 100vh;
  padding: 2rem 1rem;
}

.compare-container {
  max-width: 600px;
  margin: 0 auto;
}

.compare-intro {
  color: var(--text-secondary);
  margin-bottom: 2rem;
}

.address-input-group {
  margin-bottom: 1.5rem;
}

.address-input-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.address-input-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 1rem;
}

/* Comparison Results */
.comparison-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}

.address-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.score-display {
  font-size: 3rem;
  font-weight: 700;
  margin: 1rem 0;
}

/* Comparison Table */
.comparison-table {
  width: 100%;
  border-collapse: collapse;
  margin: 2rem 0;
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.comparison-table th,
.comparison-table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.comparison-table th {
  background: var(--cream);
  font-weight: 600;
}

.service-name {
  font-weight: 600;
}

.best-time {
  background: rgba(40, 167, 69, 0.1);
  font-weight: 600;
  color: #28a745;
}

.winner {
  margin-left: 0.5rem;
  color: #28a745;
}

/* Mobile: Stack columns */
@media (max-width: 768px) {
  .comparison-table {
    display: block;
    overflow-x: auto;
  }
}
```

## Acceptance Criteria
- [ ] Comparison form accepts 2-3 addresses
- [ ] Comparison table displays side-by-side
- [ ] Best drive times highlighted in green
- [ ] Livability scores displayed for each address
- [ ] Mobile: comparison works in vertical stack layout
- [ ] Desktop: comparison works in side-by-side layout
- [ ] URL is shareable (encodes addresses)
- [ ] Link back to comparison form to start over
- [ ] Error handling if address not found
- [ ] Tested with 2 and 3 addresses

## Optional Enhancements (Future)
- [ ] Save comparisons (requires FR-007 storage)
- [ ] Export comparison as PDF
- [ ] Add custom notes to each address
- [ ] Filter: "Only show addresses scoring 70+"
- [ ] Winner/loser summary at bottom
- [ ] Percentage difference indicators (+20% farther)
- [ ] Map showing all addresses simultaneously

## Testing Scenarios
1. **2 addresses** → Table shows 2 columns
2. **3 addresses** → Table shows 3 columns
3. **Mix of urban/rural** → Highlights differences clearly
4. **Similar addresses** → Shows subtle differences
5. **Invalid address** → Error message, don't break comparison
6. **Mobile viewport** → Table scrolls or stacks
7. **Shareable URL** → Copy/paste URL loads comparison

## API Considerations
- Generates multiple full reports (6 API calls × number of addresses)
- For 3 addresses: **18 API calls total**
- Consider caching (FR-014) to reduce costs
- Rate limiting (FR-015) important here

## Dependencies
- No new NPM packages required
- Reuses existing report generation logic
- Pure JavaScript and CSS

## Estimated Effort
**Medium-High** — 5-6 hours
- Comparison form HTML/CSS
- Server route for comparison
- Parallel report generation
- Comparison table rendering
- Best/worst highlighting logic
- Responsive design
- URL parameter handling
- Testing across scenarios
