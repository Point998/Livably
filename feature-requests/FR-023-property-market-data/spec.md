# FR-023 — Property & Market Data

## Implementation Status
✅ **COMPLETE** - Fixed from 1.5/4 to 3/4+
- Removed unreliable Census home value estimates
- Added carrying cost breakdown (tax, insurance, HOA, utilities)
- Enhanced property tax context with state comparisons and explanations
- Directs to Zillow/Redfin for current home values (no estimates)
- See summary.md for full implementation details
- Completed: May 2026

## What
Display property-specific information including tax rates, home value trends, market statistics, and neighborhood appreciation to help buyers understand the financial aspects of a location.

## Problem
Homebuyers need to understand:
- What are property taxes here?
- Are home values rising or falling?
- How quickly do homes sell?
- Is this a good investment?

This data is scattered across Zillow, Redfin, county tax assessor websites, and MLS listings.

## Requirements

### Four Core Data Points

**1. Property Tax Rate** 💰
- Effective property tax rate (%)
- Estimated annual taxes (based on median home value)
- Comparison to county/state average
- Tax district information

**2. Home Value Trends** 📈
- Median home value
- 1-year change (%)
- 5-year change (%)
- Trend indicator (Rising, Stable, Declining)
- Historical chart (optional)

**3. Market Activity** 🏠
- Average days on market
- Median list price
- List-to-sale price ratio
- Inventory levels (months of supply)

**4. Neighborhood Appreciation** 💹
- Appreciation rate (annual %)
- Comparison to city/county
- Investment grade (A, B, C, D)

### Report Section
New section: "Property & Market Insights" 📊
- Four subsections with key metrics
- Visual indicators (charts, trend arrows)
- Context explanations

## Implementation Notes

### API Options

**Property Tax:**
- **ATTOM Data API** (Paid, $500+/month)
- **County Assessor Websites** (Free but requires scraping, varies by county)
- **Estimation:** Average tax rate by state/county

**Home Values & Trends:**
- **Zillow API** (Deprecated, no longer available)
- **Redfin Data Center** (Free public data, but no API)
- **ATTOM Property API** (Paid, comprehensive)
- **Realtor.com API** (Requires partnership)

**Market Activity:**
- **Redfin Data Center** (Free CSV downloads, manual integration)
- **ATTOM Market Trends API** (Paid)
- **Local MLS** (Requires broker license)

**Recommendation:** Start with **free public data** (Redfin Data Center, Census) and upgrade to **ATTOM API** when monetizing.

---

### Property Tax Estimation

```javascript
// Simple approach: Use average tax rate by county
const PROPERTY_TAX_RATES = {
  // Sample data - would need comprehensive database
  'Jefferson County, KY': 1.12,
  'Davidson County, TN': 1.47,
  'Los Angeles County, CA': 0.72,
  // ... more counties
};

async function getPropertyTaxInfo(lat, lng) {
  const { county, state } = await getCityFromCoordinates(lat, lng);
  
  const countyKey = `${county}, ${state}`;
  const taxRate = PROPERTY_TAX_RATES[countyKey] || getStateAverageTaxRate(state);
  
  // Estimate annual taxes based on median home value
  const medianHomeValue = await getMedianHomeValue(county, state);
  const annualTax = medianHomeValue * (taxRate / 100);
  
  return {
    taxRate,
    annualTax: Math.round(annualTax),
    county,
    state,
    medianHomeValue
  };
}

function getStateAverageTaxRate(state) {
  const stateRates = {
    'KY': 0.86,
    'CA': 0.76,
    'TX': 1.80,
    'NY': 1.72,
    // ... more states
  };
  return stateRates[state] || 1.00; // National average
}
```

---

### Home Value Trends (Using Public Data)

```javascript
async function getHomeValueTrends(county, state) {
  // This would ideally pull from Redfin/Zillow data
  // For now, use Census data + estimates
  
  try {
    // Fetch from public data source (Redfin CSV, Census API, etc.)
    const data = await fetchMarketData(county, state);
    
    return {
      medianValue: data.medianValue,
      oneYearChange: data.oneYearChange,
      fiveYearChange: data.fiveYearChange,
      trend: getTrendLabel(data.oneYearChange)
    };
  } catch (error) {
    // Fallback to estimates
    return {
      medianValue: null,
      oneYearChange: null,
      fiveYearChange: null,
      trend: 'Unknown'
    };
  }
}

function getTrendLabel(changePercent) {
  if (changePercent > 5) return { label: 'Rising', color: 'green', icon: '↑' };
  if (changePercent > 0) return { label: 'Stable', color: 'gold', icon: '→' };
  if (changePercent > -5) return { label: 'Softening', color: 'orange', icon: '↘' };
  return { label: 'Declining', color: 'red', icon: '↓' };
}
```

---

### Market Activity

```javascript
async function getMarketActivity(county, state) {
  try {
    const data = await fetchMarketData(county, state);
    
    return {
      daysOnMarket: data.avgDaysOnMarket,
      medianListPrice: data.medianListPrice,
      listToSaleRatio: data.listToSaleRatio,
      monthsOfSupply: data.monthsOfSupply,
      marketType: getMarketType(data.monthsOfSupply)
    };
  } catch (error) {
    return null;
  }
}

function getMarketType(monthsOfSupply) {
  // 0-3 months: Seller's market
  // 4-6 months: Balanced
  // 7+ months: Buyer's market
  
  if (monthsOfSupply < 3) return { label: "Seller's Market", color: 'red' };
  if (monthsOfSupply <= 6) return { label: 'Balanced Market', color: 'gold' };
  return { label: "Buyer's Market", color: 'green' };
}
```

---

### HTML Template

```html
<section class="market-section">
  <h2>Property & Market Insights 📊</h2>
  <p class="section-intro">
    Financial considerations for ${county}, ${state}.
  </p>
  
  <div class="market-grid">
    <!-- Property Tax -->
    <div class="market-card">
      <h3>💰 Property Tax</h3>
      <div class="metric-large">${taxInfo.taxRate}%</div>
      <div class="metric-label">Effective tax rate</div>
      <p class="metric-detail">
        Estimated annual taxes: <strong>$${taxInfo.annualTax.toLocaleString()}</strong>
        <br>
        <span class="note">Based on median home value of $${taxInfo.medianHomeValue.toLocaleString()}</span>
      </p>
    </div>
    
    <!-- Home Value Trends -->
    <div class="market-card">
      <h3>📈 Home Values</h3>
      <div class="trend-indicator">
        <span class="trend-icon trend-${valueTrends.trend.color}">
          ${valueTrends.trend.icon}
        </span>
        <span class="trend-label">${valueTrends.trend.label}</span>
      </div>
      <div class="metric-detail">
        <p>Median value: <strong>$${valueTrends.medianValue.toLocaleString()}</strong></p>
        <p>1-year change: <strong>${valueTrends.oneYearChange > 0 ? '+' : ''}${valueTrends.oneYearChange}%</strong></p>
        <p>5-year change: <strong>${valueTrends.fiveYearChange > 0 ? '+' : ''}${valueTrends.fiveYearChange}%</strong></p>
      </div>
    </div>
    
    <!-- Market Activity -->
    <div class="market-card">
      <h3>🏠 Market Activity</h3>
      <div class="metric-large">${marketActivity.daysOnMarket}</div>
      <div class="metric-label">Avg. days on market</div>
      <div class="metric-detail">
        <p>List price: <strong>$${marketActivity.medianListPrice.toLocaleString()}</strong></p>
        <p>List-to-sale ratio: <strong>${marketActivity.listToSaleRatio}%</strong></p>
        <p class="market-type market-${marketActivity.marketType.color}">
          ${marketActivity.marketType.label}
        </p>
      </div>
    </div>
    
    <!-- Investment Grade -->
    <div class="market-card">
      <h3>💹 Investment Outlook</h3>
      <div class="grade-badge grade-${investmentGrade.letter.toLowerCase()}">
        ${investmentGrade.letter}
      </div>
      <div class="metric-label">${investmentGrade.description}</div>
      <p class="metric-detail">
        Annual appreciation: <strong>${investmentGrade.appreciationRate}%</strong>
        <br>
        <span class="note">${investmentGrade.context}</span>
      </p>
    </div>
  </div>
  
  <div class="market-disclaimer">
    <p>
      <strong>Note:</strong> Market data is based on county-level statistics and public records. 
      Individual property values may vary. Consult a licensed real estate professional for 
      property-specific advice.
    </p>
  </div>
</section>
```

---

### CSS

```css
.market-section {
  margin: 3rem 0;
}

.market-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2rem;
  margin: 2rem 0;
}

.market-card {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.market-card h3 {
  font-family: var(--font-serif);
  font-size: 1.3rem;
  margin: 0 0 1rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid var(--border);
}

.metric-large {
  font-size: 3rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.metric-label {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
}

.metric-detail {
  line-height: 1.7;
}

.metric-detail p {
  margin: 0.5rem 0;
}

.metric-detail .note {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-style: italic;
}

.trend-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.trend-icon {
  font-size: 2rem;
}

.trend-icon.trend-green { color: #28a745; }
.trend-icon.trend-gold { color: var(--gold); }
.trend-icon.trend-orange { color: #fd7e14; }
.trend-icon.trend-red { color: #dc3545; }

.trend-label {
  font-size: 1.2rem;
  font-weight: 600;
}

.market-type {
  padding: 0.5rem;
  border-radius: 4px;
  font-weight: 600;
  margin-top: 0.5rem;
}

.market-type.market-green { background: rgba(40, 167, 69, 0.1); color: #28a745; }
.market-type.market-gold { background: rgba(212, 175, 55, 0.1); color: var(--gold); }
.market-type.market-red { background: rgba(220, 53, 69, 0.1); color: #dc3545; }

.grade-badge {
  display: inline-block;
  width: 80px;
  height: 80px;
  line-height: 80px;
  text-align: center;
  border-radius: 50%;
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.grade-a { background: #28a745; color: white; }
.grade-b { background: #5cb85c; color: white; }
.grade-c { background: var(--gold); color: white; }
.grade-d { background: #fd7e14; color: white; }

.market-disclaimer {
  background: #f9f9f9;
  padding: 1rem;
  border-left: 4px solid var(--gold);
  border-radius: 4px;
  font-size: 0.85rem;
  line-height: 1.6;
  margin-top: 2rem;
}

@media (max-width: 768px) {
  .market-grid {
    grid-template-columns: 1fr;
  }
}
```

## Acceptance Criteria
- [ ] Property tax rate displayed
- [ ] Estimated annual taxes shown
- [ ] Home value trends (1-year, 5-year)
- [ ] Market activity metrics (days on market, etc.)
- [ ] Investment grade/outlook
- [ ] Visual indicators (trend arrows, grades)
- [ ] Context and comparisons
- [ ] Disclaimer about data sources
- [ ] Works for all US locations
- [ ] Mobile responsive

## Optional Enhancements (Future)
- [ ] Historical price chart (line graph)
- [ ] Comparable sales (recent nearby sales)
- [ ] Rent vs buy calculator
- [ ] Property tax history (past 5 years)
- [ ] School quality impact on home values
- [ ] Foreclosure rate
- [ ] New construction activity

## API Considerations

### Data Sources
**Free (Limited):**
- Census Bureau
- Redfin Data Center (public CSVs)
- State/county tax assessor websites

**Paid (Comprehensive):**
- ATTOM Property API: $500+/month
- CoreLogic: Enterprise pricing
- Black Knight: Enterprise pricing

### Recommendation
- **Phase 1:** Use free public data (county averages)
- **Phase 2:** Integrate ATTOM API for property-specific data

### Data Quality
- **Tax rates:** Accurate at county level
- **Home values:** Estimates, not appraisals
- **Market activity:** 1-3 month lag typical
- **Trends:** Historical, not predictive

## Legal Considerations

### Disclaimers Required
- Not a property appraisal
- Not tax advice
- Estimates only, not guaranteed
- Consult professionals for decisions

### Fair Housing Compliance
- Do NOT use data to discriminate
- Present data factually
- Avoid language that steers buyers

## Dependencies

No new NPM packages required (uses public data)

**OR**

If using ATTOM API:
```bash
npm install node-fetch
```

## Environment Variables

If using ATTOM API, add to `.env`:
```
ATTOM_API_KEY=your_key_here
```

## Estimated Effort

**Low (Free data approach)** — 3-4 hours
- County tax rate database
- Public data integration
- HTML template
- CSS styling
- Disclaimers

**Medium-High (ATTOM API)** — 5-6 hours
- API integration
- Property-specific lookups
- All of the above
- Testing and validation
