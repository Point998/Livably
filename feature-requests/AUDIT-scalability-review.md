# Audit: Scalability, Quality Gates, Fair Housing, Tone
**Date:** May 2026  
**Scope:** Full codebase review — `src/app.js`, `src/premium.js`  
**Test addresses:** Georgetown KY 40324, Harlan KY 40831, Louisville KY 40202, Bozeman MT 59715, Tupelo MS 38801

---

## 1. Hardcoded Names / Scalability

### ISSUE-001: Interstate list missing ~35 major US interstates (app.js:432-436)

**Severity:** High — reports for CA, OR, WA, TX, TN, NC, AL, MS, LA, CO, UT, AZ, NV, MT, ND, SD, WI, MN, WV, VT states miss their primary highway infrastructure.

**Current list (24):** I-10, I-20, I-25, I-35, I-40, I-55, I-57, I-64, I-65, I-70, I-71, I-75, I-77, I-78, I-80, I-81, I-83, I-85, I-87, I-90, I-93, I-94, I-95, I-96

**Missing (35+):** I-5, I-8, I-11, I-12, I-15, I-16, I-17, I-19, I-22, I-24, I-26, I-27, I-29, I-30, I-37, I-38, I-39, I-41, I-43, I-44, I-49, I-59, I-69, I-72, I-73, I-74, I-76, I-79, I-82, I-84, I-86, I-88, I-89, I-97, I-99

**Fix:** Expand to comprehensive list. **FIXED in this audit.**

### ISSUE-002: School exclusion list uses descriptors, not chain names (app.js — OK)

`findNearestElementarySchool()` exclusions: `['preschool', 'pre-school', 'daycare', 'day care', 'montessori', 'private']` — these are generic descriptors, not hardcoded chain names. **No action needed.**

### ISSUE-003: Other place searches use Google place types (app.js — OK)

`findNearestGrocery()`, `isRetailEmbeddedHealth()` use Google place type fields (pharmacy, drug_store, store, supermarket, grocery_or_supermarket, gas_station, convenience_store, lodging). **No action needed.**

---

## 2. Premium / Standard Split

No premium gating found. `buildPremiumSectionsHTML()` renders all sections unconditionally. **PASS.**

---

## 3. Quality Gate Compliance

All 10 chapters evaluated against the 4-point test (Actionable, Revealing, Avoids Regret, Exclusive):

| Chapter | Score | Wow Factor |
|---------|-------|------------|
| Schools & Education | 4/4 | Assigned ≠ nearest boundary warning |
| Safety & Emergency | 4/4 | ISO PPC rating affects insurance premium |
| Demographics & Community | 3/4 | Tenure/ownership stability data |
| Growth & Development | 4/4 | Planning office CTA for pipeline |
| Climate & Weather Risks | 4/4 | FEMA flood zone parcel-level |
| What Will Grow Here (FR-031) | 4/4 | iNaturalist native plants + zone-specific frost dates |
| Property Intelligence | 4/4 | Hydric soil warning, permit call |
| Sensory & Environmental | 4/4 | Radon zone + mitigation cost, airport timing |
| Getting Around on Foot | 3/4 | Car-dependency aging-in-place angle |
| Property Costs & Market | 4/4 | Carrying cost table with real dollar figures |

All chapters score 3/4 or above. **PASS.**

---

## 4. Fair Housing Violations

### ISSUE-004: Income narrative characterizes neighborhood quality (premium.js:2437-2439) — CRITICAL

**Violation 1 (inc > 100000):**
> "indicates an affluent area. That usually correlates with well-maintained properties, strong local tax base..."

Links income bracket to property condition and service quality — implying area desirability based on income composition. Fair Housing violation.

**Violation 2 (inc > 60000):**
> "puts this solidly in the middle tier—a working and professional community with financial stability. The range of incomes typically produces diverse, grounded neighborhoods."

Characterizes community identity by income bracket. Fair Housing violation.

**Violation 3 (below median):**
> "is below the national median. Communities at this income level vary widely — what matters most is what you observe during visits: how properties are maintained..."

Directs buyer to evaluate neighborhood by income-linked property condition cues. Fair Housing violation.

**Fix:** Replace income narrative with factual statements about the figure and tax implications only — no neighborhood quality/character characterization. **FIXED in this audit.**

### ISSUE-005: Income synthesis pushes income labels into neighborhood character (premium.js:2462-2463)

`'affluent household incomes'` and `'modest household incomes'` appended to neighborhood character synthesis. Income characterization of area identity is a Fair Housing concern.

**Fix:** Remove income labels from synthesis. **FIXED in this audit.**

### ISSUE-006: `getIncomeLevel()` labels "Below average" with orange warning color (premium.js:192)

`{ label: 'Below average', color: 'orange' }` on income data renders a visual quality judgment — orange warning badge — on a protected-class-adjacent metric.

**Fix:** Replace "Below average" with "Below national median" and change color from orange to gold (neutral). **FIXED in this audit.**

---

## 5. "Not Available" Fallbacks (UX)

### ISSUE-007: Grocery / dest / school sections show bare "Not available." (app.js:776, 794, 813)

When data is unavailable, sections render only "Not available." with no context or action path. Users are left with a dead end.

**Fix:** Add a Google Maps search link as the fallback for each destination type. **FIXED in this audit.**

---

## 6. Data Source Quality

All API calls in `getPremiumData()` use `Promise.allSettled()` — no single API failure crashes the report. Individual builders null-check their data before rendering. **PASS.**

---

## 7. Tone Review

All sections reviewed. No clinical/alarming/generic AI language found in the chapters not flagged above. Walkability prose ("car-dependent territory...space, quiet, nature — a different kind of value") and school prose ("talk to parents at afternoon pickup") match the intended voice. **PASS on tone.**

---

## Summary of Fixes Applied

| Issue | File | Status |
|-------|------|--------|
| ISSUE-001: Interstate list expanded to 59 interstates | app.js | FIXED |
| ISSUE-004: Income narrative Fair Housing violations | premium.js | FIXED |
| ISSUE-005: Income labels removed from synthesis | premium.js | FIXED |
| ISSUE-006: "Below average" → "Below national median", orange → gold | premium.js | FIXED |
| ISSUE-007: "Not available." fallbacks → actionable Google Maps links | app.js | FIXED |
