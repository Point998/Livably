# FR-013 — Traffic Variations (Time-Based Commute Analysis)

## What
Show how drive times vary throughout the day, highlighting morning rush hour, evening rush hour, and off-peak times.

## Problem
Currently:
- Only shows 8am Tuesday drive times (single data point)
- Users don't know if their commute gets worse at 5pm
- No insight into traffic patterns or congestion
- Can't plan around peak traffic times

## Requirements

### Traffic Time Analysis
For each destination (or select key ones), show drive times at:
- **Morning Rush:** 8:00 AM (weekday)
- **Midday:** 12:00 PM (weekday)
- **Evening Rush:** 5:00 PM (weekday)
- **Weekend:** 10:00 AM (Saturday)

### Visualization
- Traffic timeline chart for each service
- Bar chart or line graph showing variation
- Color coding: Green (fast) → Red (slow)
- Highlight worst time and best time

### Key Destinations
Run traffic analysis on:
- Grocery
- Hospital
- Custom destinations (if FR-012 complete, especially "Work")

Optional: Skip less-critical services (gas station, pharmacy)

### Display Format
```
Grocery Store (Kroger) — 5 miles away

Drive Times by Time of Day:
────────────────────────────────
 8am (Mon)   ████░░░░░░  7 min
12pm (Mon)   ███░░░░░░░  5 min ← Best time
 5pm (Mon)   ██████░░░░ 10 min ← Worst time
10am (Sat)   ████░░░░░░  6 min
────────────────────────────────
Average: 7 minutes | Range: 5-10 min
```

## Implementation Notes

### Google Distance Matrix API

The Distance Matrix API supports `departure_time` parameter for traffic-aware calculations.

```javascript
async function getTrafficVariations(originLatLng, destinationLatLng) {
  const times = {
    morningRush: getNextWeekdayAt(8, 0),  // 8am Monday
    midday: getNextWeekdayAt(12, 0),      // 12pm Monday
    eveningRush: getNextWeekdayAt(17, 0), // 5pm Monday
    weekend: getNextSaturdayAt(10, 0)      // 10am Saturday
  };
  
  const results = await Promise.all(
    Object.entries(times).map(async ([label, departureTime]) => {
      const response = await googleMapsClient.distancematrix({
        params: {
          key: googleMapsApiKey,
          origins: [originLatLng],
          destinations: [destinationLatLng],
          mode: 'driving',
          departure_time: departureTime,
        },
      });
      
      const element = response.data.rows[0]?.elements?.[0];
      if (!element || element.status !== 'OK') {
        throw new Error('Unable to calculate drive time');
      }
      
      return {
        label,
        departureTime,
        minutes: Math.round((element.duration_in_traffic?.value ?? element.duration?.value) / 60)
      };
    })
  );
  
  // Calculate statistics
  const minutes = results.map(r => r.minutes);
  const min = Math.min(...minutes);
  const max = Math.max(...minutes);
  const avg = Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length);
  
  return {
    variations: results,
    stats: {
      min,
      max,
      avg,
      range: max - min
    }
  };
}

function getNextWeekdayAt(hour, minute) {
  const now = new Date();
  const next = new Date(now);
  
  // Get next Monday
  const dayOfWeek = next.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
  next.setDate(next.getDate() + daysUntilMonday);
  
  next.setHours(hour, minute, 0, 0);
  return Math.floor(next.getTime() / 1000);
}

function getNextSaturdayAt(hour, minute) {
  const now = new Date();
  const next = new Date(now);
  
  const dayOfWeek = next.getDay();
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
  next.setDate(next.getDate() + daysUntilSaturday);
  
  next.setHours(hour, minute, 0, 0);
  return Math.floor(next.getTime() / 1000);
}
```

### Server Implementation

```javascript
app.get('/report', async (req, res) => {
  const origin = await geocodeAddress(address);
  const originLatLng = `${origin.lat},${origin.lng}`;
  
  // Get core services (existing)
  const [grocery, hospital] = await Promise.all([
    findNearestGrocery(originLatLng),
    findNearestHospital(originLatLng),
  ]);
  
  // Get traffic variations for key services
  const [groceryTraffic, hospitalTraffic] = await Promise.all([
    getTrafficVariations(originLatLng, `${grocery.location.lat},${grocery.location.lng}`),
    getTrafficVariations(originLatLng, `${hospital.location.lat},${hospital.location.lng}`)
  ]);
  
  // Attach traffic data to services
  grocery.traffic = groceryTraffic;
  hospital.traffic = hospitalTraffic;
  
  // Pass to template
});
```

### HTML Template

```html
<section class="traffic-analysis">
  <h2>Traffic Patterns</h2>
  <p class="section-intro">
    See how drive times change throughout the week. This helps you plan trips and avoid congestion.
  </p>
  
  ${renderTrafficChart('Grocery', grocery)}
  ${renderTrafficChart('Hospital', hospital)}
</section>

<script>
function renderTrafficChart(name, service) {
  const traffic = service.traffic;
  const maxMinutes = traffic.stats.max;
  
  return `
    <div class="traffic-chart">
      <h3>${name} — ${service.name}</h3>
      <p class="traffic-distance">${calculateDistance(service)} miles away</p>
      
      <div class="traffic-bars">
        ${traffic.variations.map(v => `
          <div class="traffic-row">
            <span class="traffic-time">${formatTime(v.label)}</span>
            <div class="traffic-bar-container">
              <div class="traffic-bar ${getTrafficClass(v.minutes, traffic.stats)}" 
                   style="width: ${(v.minutes / maxMinutes) * 100}%">
              </div>
            </div>
            <span class="traffic-minutes">${v.minutes} min</span>
            ${v.minutes === traffic.stats.min ? '<span class="best-tag">Best</span>' : ''}
            ${v.minutes === traffic.stats.max ? '<span class="worst-tag">Worst</span>' : ''}
          </div>
        `).join('')}
      </div>
      
      <div class="traffic-stats">
        <span>Average: ${traffic.stats.avg} min</span>
        <span>Range: ${traffic.stats.min}-${traffic.stats.max} min</span>
        ${traffic.stats.range > 10 ? '<span class="warning">⚠️ High variation</span>' : ''}
      </div>
    </div>
  `;
}

function formatTime(label) {
  const map = {
    morningRush: '8am Mon',
    midday: '12pm Mon',
    eveningRush: '5pm Mon',
    weekend: '10am Sat'
  };
  return map[label] || label;
}

function getTrafficClass(minutes, stats) {
  if (minutes === stats.min) return 'traffic-best';
  if (minutes === stats.max) return 'traffic-worst';
  if (minutes < stats.avg) return 'traffic-good';
  return 'traffic-moderate';
}
</script>
```

### CSS

```css
.traffic-analysis {
  margin: 3rem 0;
}

.traffic-chart {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.traffic-chart h3 {
  margin: 0 0 0.25rem;
}

.traffic-distance {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin: 0 0 1.5rem;
}

.traffic-bars {
  margin: 1rem 0;
}

.traffic-row {
  display: grid;
  grid-template-columns: 80px 1fr 60px 60px;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.traffic-time {
  font-size: 0.85rem;
  font-weight: 600;
}

.traffic-bar-container {
  height: 24px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
}

.traffic-bar {
  height: 100%;
  transition: width 0.3s ease;
  border-radius: 4px;
}

.traffic-bar.traffic-best {
  background: #28a745;
}

.traffic-bar.traffic-good {
  background: var(--gold);
}

.traffic-bar.traffic-moderate {
  background: #fd7e14;
}

.traffic-bar.traffic-worst {
  background: #dc3545;
}

.traffic-minutes {
  font-weight: 600;
  text-align: right;
}

.best-tag,
.worst-tag {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.best-tag {
  background: rgba(40, 167, 69, 0.2);
  color: #28a745;
}

.worst-tag {
  background: rgba(220, 53, 69, 0.2);
  color: #dc3545;
}

.traffic-stats {
  display: flex;
  gap: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.traffic-stats .warning {
  color: #fd7e14;
  font-weight: 600;
}

@media (max-width: 768px) {
  .traffic-row {
    grid-template-columns: 70px 1fr 50px;
  }
  
  .best-tag,
  .worst-tag {
    display: none;
  }
}
```

## Acceptance Criteria
- [ ] Traffic variations shown for key services (grocery, hospital)
- [ ] 4 time periods tested: 8am, 12pm, 5pm weekday + 10am weekend
- [ ] Bar chart visualizes time differences
- [ ] Best/worst times highlighted
- [ ] Stats show average and range
- [ ] Warning shown for high variation (>10 min difference)
- [ ] Design matches report aesthetic
- [ ] Responsive on mobile
- [ ] Tested with urban (high traffic) and rural (low traffic) addresses

## Optional Enhancements (Future)
- [ ] Line graph instead of bar chart
- [ ] Heatmap (7 days × 24 hours)
- [ ] Traffic predictions for specific dates
- [ ] "Reverse commute" indicator (less congestion)
- [ ] Include custom destinations (FR-012 integration)
- [ ] Toggle: Show all services or just key ones
- [ ] Export traffic data as CSV

## Testing Scenarios
1. **Urban address** → High traffic variation (5-15 min)
2. **Suburban address** → Moderate variation (7-12 min)
3. **Rural address** → Low variation (10-11 min)
4. **Weekend vs weekday** → Clear difference shown
5. **Map integration** → Does not conflict with existing map
6. **Mobile viewport** → Charts render correctly

## API Considerations
- Each traffic analysis = 4 API calls (4 departure times)
- 2 services × 4 times = **8 additional API calls per report**
- Total: 6 core + 8 traffic = **14 API calls**
- Caching (FR-014) recommended to reduce costs
- Consider limiting to key services only

### Cost Optimization
- Only run traffic analysis on user request ("Show traffic patterns")
- Cache results for 24 hours
- Skip traffic for less-critical services

```javascript
// Optional: Make traffic analysis opt-in
app.get('/report', async (req, res) => {
  const showTraffic = req.query.traffic === 'true';
  
  if (showTraffic) {
    // Run traffic analysis
  }
});
```

## Dependencies
- No new NPM packages required
- Uses existing Google Maps Distance Matrix API
- Pure JavaScript and CSS for visualization

## Estimated Effort
**Medium-High** — 4-5 hours
- Time calculation functions (weekday/weekend)
- Traffic variation API calls
- HTML/CSS for bar charts
- Statistics calculation (min/max/avg)
- Responsive design
- Testing across different traffic patterns
