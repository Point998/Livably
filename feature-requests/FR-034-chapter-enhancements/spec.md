# FR-034 — Chapter Enhancements (Items 1–3)

## Enhancement 1: Construction Era Health Risks
**Chapter:** Property Intelligence — L3 Building Age tab

### What
Expand `buildHousingAgeTab` in `src/modules/property/template.js` to add a dedicated "Era Health Risks" subsection below the histogram bars. The subsection is keyed off `era.medianYearBuilt` (already available as 2nd param), not the tract distribution bands.

### What's Already There
- `era.medianYearBuilt` passed to `buildHousingAgeTab` as 2nd param
- `ERA_RISK` array in the template already has notes for Pre-1960, 1960s, 1970s, 1980s
- `getConstructionEraContext(year)` in logic.js returns `{ era, cautions[] }` per decade

### New Content Per Era
Only show if `era.medianYearBuilt < 2000` (modern construction has minimal actionable risks).

**Pre-1940:**
- Lead paint: assumed present in original surfaces, $10,000–$30,000 for full abatement; inspector should test all painted surfaces
- Plumbing: galvanized or cast iron may be at end of life; full replacement $4,000–$15,000
- Electrical: knob-and-tube wiring possible if not updated; upgrade $8,000–$15,000
- Asbestos: common in insulation, siding, floor tiles; testing $250–$800, abatement $1,500–$30,000+

**1940s–50s:**
- Lead paint: likely in original finishes; testing $20–$50/room, abatement $10,000–$30,000
- Asbestos: common in popcorn ceilings, floor tiles, pipe insulation
- Galvanized plumbing aging; original electrical may not be grounded

**1960s–70s (pre-1978):**
- Lead paint: federally mandated disclosure but buyers often underestimate scope
- Asbestos: floor tiles, textured ceilings, pipe insulation
- Aluminum wiring (1965–1973): fire risk if not updated — electrical inspection critical

**Late 1970s–80s (1978–1989):**
- Polybutylene plumbing (1978–1995): recalled for failure risk; replacement $4,000–$15,000. Ask if it has been replaced.
- Asbestos: possible in textured surfaces or tiles if not remediated
- Synthetic stucco (EIFS) if applicable: moisture intrusion risk

**1990s:**
- Chinese drywall: if built 2004–2007 specifically, check for sulfur compounds
- Polybutylene plumbing tail end (1978–1995)
- Low risk overall; standard inspection scope

### Output
A `.prem-intel-era-risks` subsection below the histogram bars, with individual risk items as `.prem-intel-era-risk-item`. Each item shows: title (bold), body text with cost estimates, and a "What to ask your inspector" note where relevant. Show 2–5 items based on era.

### Acceptance Criteria
- Shown only when `era.medianYearBuilt < 2000`
- Content is era-specific to `medianYearBuilt`, not the tract distribution
- No inline styles (CONSTRAINT-008)
- No scoring/grades (CONSTRAINT-001)
- Tests cover: pre-1940, 1970s, 1990s, modern (absent)

---

## Enhancement 2: Civic Infrastructure
**Chapter:** Daily Reachability — new section in Additional Services

### What
Add library, recreation center, and post office destinations to the Daily Reachability chapter. Rendered as a new "Civic Infrastructure" subsection in `buildAdditionalServicesCardHTML`.

### Data Flow
1. **New functions** in `src/modules/recreation/data.js`:
   - `findNearestLibrary(originLatLng)` → Google Places type: `library`
   - `findNearestRecreationCenter(originLatLng)` → Google Places type: `community_center`
   - `findNearestPostOffice(originLatLng)` → Google Places type: `post_office`
   - Same pattern as `findNearestPark`: placesNearby, rankby: distance, getDriveTime, placesCache
   - Return shape: `{ name, address, location, driveTimeMinutes }` or throw

2. **reportBuilder.js**: Add all 3 to the `Promise.allSettled` batch; destructure as `library`, `recCenter`, `postOffice`; pass to `buildReportHTML`

3. **reportPage.js**: Update `buildReportHTML` signature and `buildAdditionalServicesCardHTML` call to pass `library`, `recCenter`, `postOffice`

4. **reachability/template.js**: Update `buildAdditionalServicesCardHTML` signature to accept `library`, `recCenter`, `postOffice`. Add a "Civic Infrastructure" subsection (separate from the existing school/park/coffee grid) that shows a 3-row list with name and drive time. Show only if at least one civic result is available.

### Graceful Degradation (CONSTRAINT-015)
If all 3 civic destinations fail to resolve, `buildAdditionalServicesCardHTML` receives all null and simply omits the civic subsection — no error, no placeholder, no "data not available."

### Acceptance Criteria
- Library link to Scott County Public Library (Georgetown KY test address)
- Civic section absent when all 3 resolve to null
- No cross-state results (library/rec/post office don't require CONSTRAINT-006 filtering — they're not healthcare/school)
- No inline styles (CONSTRAINT-008)
- Tests cover: all present, partial, all absent

---

## Enhancement 3: The 10-Year Horizon
**Chapter:** Growth & Development — new body section

### What
Add a synthesized forward-looking "10-Year Horizon" section to `buildGrowthAndDevelopmentHTML` in `src/modules/growth/template.js`. No new APIs — synthesizes existing data:
- `permits.trend` (rising/stable/declining) + `permits.percentChange`
- `newConstruction.newConstructionPct`
- `namedProjects` array (under construction / approved / planned)
- `establishments` array (commercial density)
- `locationInfo.county` / `locationInfo.city`

### Logic
Build a 3-signal summary:

**Signal 1 — Development pace:**
- Rising permits (≥10%): "Active growth area"
- Stable permits: "Steady market"
- Declining permits (≤-10%): "Cooling construction pace"
- No permits but newConstructionPct ≥ 20%: "Recent build-out area"
- No permits but newConstructionPct < 10%: "Established neighborhood"

**Signal 2 — Pipeline:**
- Named projects under construction or approved: "Confirmed development incoming"
- No named projects: "No major confirmed development nearby"

**Signal 3 — Commercial:**
- 2+ establishments within 0.5 mi: "Active commercial environment"
- Some establishments within 1.5 mi: "Accessible commercial corridor"
- No establishments: "Limited nearby commercial development"

### Output
A `<div class="prem-growth-horizon">` section with:
- Section label: "10-Year Outlook"
- A 2–4 sentence synthesized paragraph: tone is honest and factual, not alarming. Uses the signals above.
- Only rendered when at least one signal is available (permits OR newConstruction OR namedProjects.length > 0)

### Sample Output
"Georgetown is in an active growth phase — building permits are up 15% year-over-year and Maplewood Subdivision Phase 2 is under construction nearby. The 10-year signals here point toward continued residential and commercial expansion rather than contraction. That's generally positive for property values, but also means the immediate neighborhood will likely change in character over the next decade."

vs. declining:
"Construction activity in Scott County has slowed from recent levels. That can reflect a maturing market, rising costs, or broader economic factors — established neighborhoods with stable demand often hold value well even as permit activity cools. No major new development projects were confirmed in the immediate area."

### Acceptance Criteria
- Shown when at least one signal is available
- Absent when all signals are null/empty (no permits, no newConstruction, empty namedProjects)
- Tone: factual, not alarming. "These are documented trends, not predictions."
- No inline styles (CONSTRAINT-008)
- No scoring (CONSTRAINT-001)
- Tests cover: rising permits + named projects, declining permits, no data
