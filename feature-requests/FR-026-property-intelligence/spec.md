# FR-026 — Property Intelligence (Chapter 7)

## What
Surface parcel-level information about the specific property: its permit history, confirmed utility connections, construction era and what that implies, property tax trajectory, and any unpermitted work warnings — plus soil and lot characteristics that affect ownership costs.

## Problem
Buyers spend 20 minutes walking through a home with an agent. They see walls, floors, and fixtures. They don't see whether the deck was permitted, whether the sewer line is confirmed or assumed, whether property taxes jumped 18% last year, or whether the soil has drainage problems that will cost $8,000 to fix.

Home inspectors catch mechanical and structural issues. They don't check permit history, utility confirmation, or tax trajectories. That gap is where expensive surprises live.

---

## Gate 1: Conceptual Review

### Quality Checks

**Actionable — Does this change their decision or preparation?**
Yes, substantially. An unpermitted addition is negotiation leverage — buyers can request remediation or a price reduction. A septic system that hasn't been pumped in 7 years needs inspection. A property tax bill that increased 22% over two years signals a trajectory the buyer needs to model. Confirmed fiber availability changes the work-from-home calculus. These findings change what buyers ask for and what they're willing to pay.

**Revealing — Does this show something hidden or invisible?**
Yes. Permit history requires pulling records from the county building department — not visible at a showing. Soil type and drainage class aren't on a listing sheet. Property tax history requires accessing the assessor's database. Unpermitted work by definition looks identical to permitted work from the outside.

**Avoids Regret — Does this prevent an "I wish I had known" moment?**
Yes. "I didn't know the addition was unpermitted" and "I didn't know the septic was a cesspool, not a modern system" and "I didn't know taxes had jumped $2,400 in two years" are documented buyer regret patterns. These are discoverable pre-purchase but require knowing where to look.

**Exclusive — Can they get this elsewhere easily?**
Partially. County assessor sites are public but require knowing the parcel number and navigating a jurisdiction-specific interface. USDA Web Soil Survey is free but has a complex GIS interface most buyers won't use. The value here is aggregation and interpretation, not exclusive data access.

### Score: 3/4
### Decision: INCLUDE (standalone chapter — valuable but not critical for every buyer)

**Note on the 3/4 score:** The "Exclusive" criterion is partially met. The underlying data is technically public, but the synthesis — pulling permit history, tax trajectory, soil type, and utility confirmation into a single readable summary — is not available in any consumer product today. The aggregation is the differentiator, not the data itself.

---

## Gate 2: Data Source Validation

### Source 1: County Assessor / Property Records
- **Type:** Public records (varies by county)
- **What it provides:** Parcel ID, ownership history, assessed value history, property tax history, building characteristics (year built, square footage, structure type)
- **Accuracy:** High — official government records
- **Freshness:** Typically updated annually (assessment) to quarterly (sales)
- **Legal Status:** Public records
- **Cost:** Free
- **Access method:** Many counties expose this via REST APIs or open data portals. ATTOM and similar aggregators provide normalized access (paid).
- **Fallback:** If no API available for a jurisdiction, note "Tax history not available for this county — contact [County] Assessor directly"

### Source 2: County Building Department (Permit Records)
- **Type:** Public records
- **What it provides:** Building permits issued for this parcel: type, date, scope, contractor, final inspection status
- **Accuracy:** High — official records
- **Freshness:** Updated as permits are filed/closed
- **Legal Status:** Public records
- **Cost:** Free
- **Access method:** Highly variable by jurisdiction. Some counties have online permit search portals. No unified national API.
- **Fallback:** "Permit records for this jurisdiction require direct inquiry with [County] Building Department."

### Source 3: USDA Web Soil Survey
- **Type:** Government data, free
- **URL:** https://websoilsurvey.sc.egov.usda.gov/App/WebSoilSurvey.aspx
- **API:** USDA Soil Data Mart (https://sdmdataaccess.sc.egov.usda.gov/)
- **What it provides:** Soil series name, drainage class, flooding frequency, hydric soil flag, corrosion potential, septic system suitability
- **Accuracy:** High — official USDA soil survey data
- **Freshness:** Surveys updated periodically (stable data for most parcels)
- **Legal Status:** Public domain
- **Cost:** Free
- **Use:** Soil drainage class (affects basement flooding, landscaping costs), hydric status (wetlands indicator), septic suitability (rural properties)

```javascript
// USDA Soil Data Mart - query by coordinates
async function getSoilData(lat, lng) {
  const query = `
    SELECT mapunit.muname, component.compname, component.drainagecl,
           component.hydgrp, component.hydricrating, component.taxorder
    FROM mapunit
    JOIN component ON mapunit.mukey = component.mukey
    JOIN mupolygon ON mapunit.mukey = mupolygon.mukey
    WHERE mupolygon.mukey = (
      SELECT mukey FROM SDA_Get_Mukey_from_intersection_with_WktWgs84(
        'point(${lng} ${lat})'
      )
    )
    ORDER BY component.majcompflag DESC
    LIMIT 1
  `;
  const url = `https://sdmdataaccess.sc.egov.usda.gov/Tabular/SDMTabularService/post.rest`;
  // POST with query parameter
}
```

### Source 4: USDA Hardiness Zone
- **Type:** Government data, free
- **URL:** https://planthardiness.ars.usda.gov/
- **API:** Available via coordinate lookup
- **What it provides:** USDA plant hardiness zone (1a-13b)
- **Accuracy:** High
- **Freshness:** Updated 2023 (stable reference data)
- **Legal Status:** Public domain
- **Cost:** Free
- **Use:** Gardening/landscaping context for the property

### Source 5: FCC Broadband Map
- **Type:** Government data, free
- **URL:** https://broadbandmap.fcc.gov/
- **API:** Available (address-level lookup)
- **What it provides:** Available internet providers and max advertised speeds at a specific address
- **Accuracy:** Medium (provider self-reported, but FCC-regulated)
- **Freshness:** Semi-annual updates
- **Legal Status:** Public domain
- **Cost:** Free
- **Use:** Confirm fiber/cable/DSL availability — critical for remote workers

```javascript
// FCC Broadband Map API
async function getBroadbandAvailability(lat, lng) {
  const url = `https://broadbandmap.fcc.gov/location/availability` +
    `?latitude=${lat}&longitude=${lng}&unit=location&limit=25`;
  // Returns list of providers, technology types, and max speeds
}
```

### Verification Method
For permit history and tax records: cross-reference assessed value from county assessor with any available sale price data. For soil data: confirm drainage class against FEMA flood zone (hydric soils in non-flood zones can still have drainage issues).

### If No Reliable Data Exists
Each element degrades independently:
- No permit data: "Permit records not available online for [County]. Contact [County] Building Department at [phone/URL] before closing."
- No tax history: "Tax history requires direct inquiry with [County] Assessor."
- Soil data is available nationwide via USDA — no fallback needed.
- Broadband data is available nationwide via FCC — no fallback needed.

---

## Requirements

### Four Core Data Points

**1. Permit Activity Summary**
- Were permits pulled for known improvements (decks, additions, HVAC, electrical)?
- Any permits still open (work started but never inspected/closed)?
- Unpermitted work warning if structure square footage exceeds permitted records
- Source: County building department

**2. Property Tax Trajectory**
- Tax bill for last 3 years (if available)
- Year-over-year change (%)
- Context: faster than inflation = assessment pressure; faster than neighborhood = dispute opportunity
- Current effective tax rate vs. county median

**3. Utility & Infrastructure Confirmation**
- Water source: public municipal water or private well (confirmed, not assumed)
- Sewer: public sewer or private septic (confirmed)
- Internet: available providers and max speeds (FCC data)
- Electric: utility serving this address (via county assessor or utility territory maps)

**4. Property & Soil Characteristics**
- Lot size (from assessor records)
- Year built and construction era context (e.g., "1978 construction: pre-1980 homes may have lead paint and may lack modern insulation standards")
- USDA soil drainage class with practical implication
- USDA hardiness zone (for reference)
- Hydric soil flag (wetlands indicator — affects building and landscaping)

### Report Section
Chapter card: "Property Intelligence" under standard tier.

Output narrative style:
- Lead: what the assessor records reveal about this specific parcel
- Permit paragraph: history of permitted work, any open permits, any gaps
- Tax paragraph: trajectory with year-over-year numbers
- Infrastructure paragraph: confirmed utilities + broadband
- Soil/lot paragraph: drainage class, what it means for ownership
- Key Takeaway callout: the single most actionable finding

---

## Expected Output Format

```
Property Intelligence

County records show this is a [year]-built [structure type] on a [lot size]-square-foot
lot in [jurisdiction]. The assessed value has moved from $[X] to $[Y] over the past
three years — a [Z]% change that [compares to county average context].

[PERMITS:]
Building permits on record include [list of permitted work with years]. [IF open permits:]
One permit from [year] for [scope] appears to have no final inspection on record —
this warrants clarification with the seller before closing. [IF no issues:] All permits
on record show closed inspections.

[TAX TRAJECTORY:]
Property taxes were $[amount] last year, up [X]% from two years prior. At this pace,
annual taxes would reach approximately $[projected] within three years. The current
effective rate of [X]% compares to the county median of [Y]%.

[UTILITIES:]
This address is served by [utility] for electric and connected to [public sewer / private
septic — confirm type with seller]. Municipal water is [confirmed / not confirmed — verify].
Internet: [providers] offer service here, with maximum advertised speeds of [X] Mbps.

[SOIL & LOT:]
The lot sits on [soil series name], classified as [drainage class] drainage. In practical
terms, this means [implication: well-drained = low basement moisture risk / poorly-drained =
potential for wet basement or landscaping limitations]. [IF hydric:] USDA flags this soil
as hydric, which may indicate historic wetland conditions — worth discussing with your
inspector.

Key Takeaway: [Most actionable single finding]

Source: [County] Assessor (accessed [date]), [County] Building Department,
USDA Web Soil Survey, FCC Broadband Map.
```

---

## Acceptance Criteria
- [ ] Year built and assessed value trajectory displayed
- [ ] Permit summary shown (or clear fallback if unavailable)
- [ ] Open/unresolved permits flagged explicitly
- [ ] Property tax trajectory shown (3-year, with % change)
- [ ] Water source type surfaced (public vs well)
- [ ] Sewer type surfaced (public vs septic)
- [ ] Internet availability shown via FCC Broadband Map
- [ ] USDA soil drainage class shown with plain-language implication
- [ ] Hydric soil flagged when present
- [ ] Construction era context provided for pre-1978 homes (lead paint note)
- [ ] Output is narrative prose with specific numbers, not a data table
- [ ] Tested with urban (Louisville, KY), suburban (Georgetown, KY), and rural (Harlan, KY) addresses
- [ ] Graceful degradation when county-specific data is unavailable

## Data Quality Requirements
- Never present utility type as confirmed unless sourced — "appears to be" is not acceptable
- Never omit the research date on tax and permit data
- Always note when permit data requires direct county inquiry
- Hydric soil flag must come from USDA, not estimated

## Estimated Effort
**Medium-High** — 5-7 hours
- USDA Soil Data Mart API integration
- FCC Broadband Map API integration
- County assessor data (Census ACS as proxy for tax rate when direct access unavailable)
- Permit history (fallback pattern for jurisdictions without APIs)
- Construction era context logic
- Narrative generation
- Testing across address types
