# FR-025 — Growth & Development (Chapter 5)

## What
Show buyers what is changing near a property — confirmed funded projects, named developments with current status, and their expected impact on traffic, amenities, and neighborhood character.

## Problem
A home purchase is a 10-30 year commitment, but buyers evaluate neighborhoods based on what they see today. The coffee shop that made the block charming might be displaced by a mixed-use development. The vacant lot next door has an approved 200-unit apartment complex. The highway expansion will add noise and cut 4 minutes off the commute. None of this is visible at a Sunday open house.

Buyers who miss this information often feel blindsided within 12-24 months of moving in: "I didn't know they were building that."

---

## Gate 1: Conceptual Review

### Quality Checks

**Actionable — Does this change their decision or preparation?**
Yes. A confirmed grocery store opening 0.4 miles away in 18 months changes the walkability equation. An approved 400-unit apartment complex on the adjacent parcel changes the neighborhood density permanently. A DOT highway expansion 0.2 miles away changes noise projections and potentially property values. Buyers may adjust their offer, negotiate contingencies, or walk away based on this.

**Revealing — Does this show something hidden or invisible?**
Yes. A planning commission approval is public record but requires knowing which county portal to search, what documents to request, and how to interpret zoning language. Most buyers don't do this. Development projects that are "approved" but pre-construction are completely invisible at a showing.

**Avoids Regret — Does this prevent an "I wish I had known" moment?**
Yes, directly. "I wish I had known they were building a distribution warehouse 0.3 miles away" is an exact regret pattern. Development projects that break ground 6-18 months after purchase are the primary source of post-purchase neighborhood surprises.

**Exclusive — Can they get this elsewhere easily?**
No. Zillow, Redfin, and Niche show current neighborhood data, not pipeline data. Finding development projects requires searching county planning portals (which vary by jurisdiction), DOT project databases, and local news — and then synthesizing across sources. Livably does this aggregation; no consumer tool currently does.

### Score: 4/4
### Decision: MUST HAVE

---

## Gate 2: Data Source Validation

### Source 1: US Census Bureau Building Permits Survey
- **Type:** Government data, free
- **URL:** https://www.census.gov/construction/bps/
- **What it provides:** Monthly building permit counts by permit-issuing place (city/county), broken down by structure type (single-family, multi-family, etc.)
- **Accuracy:** High — official government collection
- **Freshness:** Monthly (1-2 month lag)
- **Legal Status:** Public domain
- **Cost:** Free
- **Use:** Establish baseline permit activity trend (is construction activity rising/falling in this jurisdiction?)
- **Limitation:** Counts only, not specific projects or locations

### Source 2: County Planning Department Portals
- **Type:** Public records, varies by jurisdiction
- **What it provides:** Filed planning applications, approved projects, variance requests, conditional use permits
- **Accuracy:** High — official records
- **Freshness:** Varies (days to weeks after filing)
- **Legal Status:** Public records
- **Cost:** Free
- **Use:** Identify specific named projects with addresses, status, and approved unit counts
- **Limitation:** No unified API — each county has different portal structure. Requires jurisdiction-specific scraping or manual lookup. Not feasible to automate at scale for v1.

### Source 3: State DOT Project Databases
- **Type:** Government data, free
- **What it provides:** Funded and approved highway/road projects with location, scope, timeline, and budget
- **Accuracy:** High — official project lists
- **Freshness:** Quarterly updates typical
- **Legal Status:** Public domain
- **Cost:** Free
- **Examples:**
  - KYTC (Kentucky): https://transportation.ky.gov/Planning/Pages/Six-Year-Road-Plan.aspx
  - Federal-Aid projects: FHWA FMIS database
- **Use:** Surface road projects within 1 mile of address
- **Limitation:** State-specific URLs, no unified national API

### Source 4: Google Places API (New/Upcoming Businesses)
- **Type:** Commercial API
- **What it provides:** Recently opened businesses near an address
- **Accuracy:** Medium (Google data freshness varies)
- **Freshness:** Weeks to months after opening
- **Legal Status:** Terms of Service compliant with API key
- **Cost:** Per-request (existing API key covers this)
- **Use:** Identify new commercial developments that have opened in the last 12 months
- **Limitation:** Shows what opened, not what's planned

### Source 5: OpenStreetMap Changesets
- **Type:** Community-maintained, free
- **What it provides:** Recently added or modified map features indicating new construction
- **Accuracy:** Medium (community-maintained, high coverage in populated areas)
- **Freshness:** Near real-time
- **Legal Status:** Open Database License
- **Cost:** Free via Overpass API
- **Use:** Detect new roads, buildings, commercial areas added to OSM in last 12 months near address

### Verification Method
Cross-reference any project found across at least two sources. A planning approval should also appear in local news coverage or county records.

### Fallback if Primary Sources Unavailable
For jurisdictions without accessible planning portals:
- Surface Census building permit trend data with context ("Permit activity in [County] is up 34% year-over-year, indicating active development")
- Note: "Specific project details require checking [County] Planning Department directly"

### If No Reliable Data Exists
Note clearly: "Development pipeline data not available for this jurisdiction. Contact the [County] Planning Department directly for pending projects."

---

## Requirements

### Three Display Components

**1. Permit Activity Trend**
- Annual building permits issued in this jurisdiction (3-year trend)
- Context: Rising, Stable, or Declining construction activity
- Source: Census BPS

**2. Named Projects (when data available)**
For each identified project within 1 mile:
- Project name and type (residential, commercial, mixed-use, infrastructure)
- Status label: Under Construction | Approved | Planned
- Distance from subject property
- Approximate unit count or square footage (if known)
- Expected timeline (if available)
- Impact summary: one sentence on how this affects the buyer (traffic, amenities, noise, character)

**3. DOT Projects (when data available)**
- Named road/highway projects within 1 mile
- Project type: widening, new interchange, new road, bridge work
- Status and timeline
- Impact: commute time change, noise projection, traffic pattern change

### Status Label Definitions
- **Under Construction** — visible activity, permits pulled, confirmed by multiple sources
- **Approved** — planning commission approved, permits may not yet be issued
- **Planned** — application filed or publicly announced, not yet approved
- No speculation or "could happen" language — every item must be sourced

### Report Section
New chapter card: "Growth & Development" under standard tier.

Output narrative style (not a raw data table):
- Lead paragraph: what the overall development picture looks like for this area
- 2-3 paragraphs covering confirmed projects with specific impact framing
- Key Takeaway callout: the single most important development finding

---

## Implementation Approach

### Phase 1 (v1 — feasible now)

Use a combination of:

1. **Census BPS API** for jurisdiction-level permit trend
```javascript
// Census Building Permits API
// Endpoint: https://api.census.gov/data/timeseries/eits/bps
// Parameters: county FIPS code, last 3 years
async function getBuildingPermitTrend(fips) {
  const url = `https://api.census.gov/data/timeseries/eits/bps` +
    `?get=APERM&for=county:${fips}&time=from+2022`;
  const data = await fetch(url).then(r => r.json());
  return interpretPermitTrend(data);
}
```

2. **Google Places API** for recently opened businesses (proxy for commercial development activity)
```javascript
// Find places opened in the last 12 months within 1 mile
// Use "opening_hours" recency as a proxy
// Filter by type: shopping_mall, supermarket, restaurant cluster, hospital
async function findRecentCommercialActivity(lat, lng) {
  // Use nearbysearch with rankby=distance
  // Filter results opened recently based on place metadata
}
```

3. **Narrative generation** based on available signals
- High permit activity + recent commercial openings = "active growth area"
- Low permits + no recent openings = "stable, established neighborhood"

### Phase 2 (future — requires jurisdiction-specific work)
- County planning portal scrapers for top 50 metros
- DOT project database integrations by state
- Manual curation for high-value markets

---

## Expected Output Format

```
Growth & Development

Georgetown, KY is in an active growth phase — Scott County issued 847 building
permits last year, up 23% from two years prior, reflecting sustained residential
expansion on the city's east and south sides.

[IF projects found:]
The most significant near-term change within a mile of this address is [Project Name],
a [type] development [distance] away. Currently [status], it's expected to [specific
impact]. For daily life, this means [practical consequence].

[IF DOT project found:]
KY Route 460 is slated for a widening project between [intersection] and [intersection],
approximately [X] miles from this address. The project is [funded/approved] with
construction expected to begin [timeline]. During construction, expect [traffic impact];
once complete, commute times to [destination] should [change].

[IF no projects found:]
No active or approved development projects were identified within one mile of this
address in available public records. For the most current information, contact the
Scott County Planning and Zoning office directly.

Key Takeaway: [Most impactful single finding]

Source: US Census Bureau Building Permits Survey, [County] Planning Department,
[State] DOT project database. Research date: [date].
```

---

## Acceptance Criteria
- [ ] Building permit trend displayed for the jurisdiction (3-year)
- [ ] Named projects surfaced when data is available
- [ ] Every project has a clear status label (Under Construction / Approved / Planned)
- [ ] No speculative or unverified projects included
- [ ] DOT projects surfaced within 1 mile when data is available
- [ ] Impact framed in practical, buyer-relevant terms
- [ ] Clear fallback when data is unavailable for a jurisdiction
- [ ] Output is narrative prose, not a raw data table
- [ ] Tested with urban (Louisville, KY), suburban (Georgetown, KY), and rural (Harlan, KY) addresses
- [ ] Key Takeaway callout present

## Data Quality Requirements
- Never list a project without a named source
- Never present a "could happen" scenario as confirmed
- Never show permit counts without a trend comparison (the number alone is meaningless)
- Always disclose research date

## Estimated Effort
**Medium** — 4-5 hours
- Census BPS API integration
- Google Places recency proxy
- Narrative generation logic
- Fallback handling for data-sparse jurisdictions
- Testing across urban/suburban/rural addresses
