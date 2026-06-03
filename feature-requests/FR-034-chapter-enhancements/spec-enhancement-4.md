# FR-034 Enhancement 4 — Healthcare Depth

## Goal
Add a "Healthcare Ecosystem" tab to the Health & Safety chapter L3 deep dive. Surfaces hospital type from CMS Hospital Compare and primary care physician count from the NPI Registry — two pieces of context buyers cannot easily find elsewhere.

## Why It Matters
A buyer sees "Centerpoint Health: 4 min away" and feels reassured. But Centerpoint may be a Critical Access Hospital (≤25 beds) that transfers major trauma to a regional center 30 min away. The distinction matters for families with young children, chronic conditions, or elderly members. Similarly, "healthcare is available" is different from "primary care physicians are accepting new patients here."

## New Data

### getCMSHospitalType(address)
**API:** CMS Hospital General Information dataset
**URL:** `https://data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0`
**Method:** Extract 5-digit ZIP from `hospital.address` string with regex `/\b(\d{5})\b/`. Query `?conditions[0][property]=zip_code&conditions[0][operator]=%3D&conditions[0][value]={ZIP}&limit=10`
**Returns:** `{ label, note }` or `null` on failure/no match

Hospital type mapping:
- `"Acute Care Hospitals"` → `{ label: 'Acute Care Hospital', note: 'Equipped for most emergencies. Verify trauma center designation directly with the hospital if your household has specific trauma care needs.' }`
- `"Critical Access Hospitals"` → `{ label: 'Critical Access Hospital', note: 'A smaller rural hospital (typically ≤25 beds). Excellent for local access, but major trauma, complex cardiac events, and specialty procedures are typically transferred to a larger regional medical center.' }`
- `"Children's"` → `{ label: "Children's Hospital", note: 'Specialized pediatric facility — not a general emergency department for adults.' }`
- `"Psychiatric"` → `{ label: 'Psychiatric Hospital', note: 'Specialized psychiatric facility — not a general emergency department.' }`
- Anything else → `null`

Timeout: 10s. Returns `null` on any error.

### getPrimaryCareCount(city, state)
**API:** CMS NPI Registry
**URL:** `https://npiregistry.cms.hhs.gov/api/?version=2.1&enumeration_type=NPI-1&taxonomy_description={TAXONOMY}&city={CITY}&state={STATE}&limit=1`
**Method:** Two parallel calls — taxonomy_description = "Family Medicine" and "Internal Medicine". Sum `result_count` from each response (the `result_count` field in the JSON, not the length of `results` array). Total = family medicine count + internal medicine count.

Returns: integer (sum) or `null` on failure. Returns `null` if city or state are blank.

Timeout: 10s each.

### getHealthcareDepth(hospital, locationInfo)
Wrapper function in `src/modules/health/data.js`. Calls both APIs in parallel via `Promise.allSettled`. Returns `{ designation, primaryCareCount }` where either field may be `null`.

## Data Flow

1. `src/modules/health/data.js` → export `getHealthcareDepth`
2. `src/services/reportBuilder.js` → after main batch resolves, if `hospital` is not null: call `getHealthcareDepth(hospital, locationInfo)` and store result as `healthcareDepth`
3. Pass `healthcareDepth` into `buildReportHTML`
4. `src/templates/pages/reportPage.js` → pass `healthcareDepth` as 4th arg to `buildHealthSafetyChapterHTML`
5. `src/modules/health/template.js` → `buildHealthSafetyChapterHTML(hospital, emergency, urgentCare, healthcareDepth)` → pass to `buildHealthDeepDiveHTML` → new tab

## New Tab: "Healthcare Ecosystem"

Added as 4th tab in `buildHealthDeepDiveHTML`. Always present if hospital exists (never omit — CONSTRAINT-015 requires actionable fallback).

Tab content (all sections conditional on data availability):

**Section 1: Hospital Designation** (if `healthcareDepth?.designation`)
```
[designation.label]
[designation.note]

To verify trauma center designation: call [hospital.name] directly or look it up on
CMS Hospital Compare — hospitalcompare.hhs.gov — which includes emergency services
and hospital type for every Medicare-certified facility in the US.
```

If no designation data:
```
[hospital.name] is your nearest emergency department. To understand its capabilities —
trauma designation, ICU capacity, specialty coverage — call the hospital directly or
look it up on CMS Hospital Compare (hospitalcompare.hhs.gov).
```

**Section 2: Primary Care** (always shown)
Count interpretation:
- `null`: "Primary care physician data was not available for this location. Contact your health insurer for a list of in-network family medicine physicians accepting new patients near this address."
- `0`: "No family medicine or internal medicine physicians were found in [city] via the CMS NPI Registry. Verify primary care availability directly with your insurer before committing."
- `1–5`: "Only [N] family medicine and internal medicine physicians are registered in [city]. Competition for new patient slots may be limited — search for a PCP before you close, not after."
- `6–15`: "[N] family medicine and internal medicine physicians are registered in [city] — a moderate number. Contact your insurer for in-network options accepting new patients."  
- `16+`: "[N] family medicine and internal medicine physicians are registered in [city], indicating solid primary care availability."

Always append: "**Action:** Contact your health insurer and ask for a list of in-network primary care physicians accepting new patients at this zip code. It typically takes 2–6 weeks to schedule a first appointment."

Source disclaimer: "Physician count from CMS NPI Registry — registered practitioners in [city], [state]. Not all may be actively seeing patients or accepting new patients."

## Constraints
- CONSTRAINT-002 (Fair Housing): Data is about institutions and physician counts, not demographics. Safe.
- CONSTRAINT-008: No inline styles
- CONSTRAINT-009: No HTML in data.js
- CONSTRAINT-015: Tab always renders if hospital exists — minimum content is actionable CMS link

## Acceptance Criteria
- [ ] `getCMSHospitalType` returns correct type for Georgetown KY (Centerpoint Health → Acute Care)
- [ ] `getPrimaryCareCount` returns a non-null integer for Georgetown KY
- [ ] "Healthcare Ecosystem" tab appears in the L3 deep dive when hospital is present
- [ ] Tab renders correctly when both APIs fail (graceful degradation with CMS link)
- [ ] No inline styles
- [ ] Tests cover: designation present, designation absent, primary care count variants, null healthcareDepth
