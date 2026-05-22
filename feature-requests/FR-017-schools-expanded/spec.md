# FR-017 — Schools & Education (Chapter 3)

## Status
✅ COMPLETE — Rebuilt from 2.5/4 to 4/4. See summary.md for full implementation details.

---

## What It Does

Displays the school picture for a specific address: the assigned public schools (elementary, middle, high), their drive times, and available private school alternatives within 10 miles — with a prominent warning that nearest school ≠ assigned school, and an action checklist buyers can use before closing.

**Chapter 3 in the standard tier report.** Rendered via `buildSchoolRatingsHTML()` / `getSchoolRatings()` in `src/premium.js`.

---

## Inputs

- Address coordinates (lat, lng)
- Drive time from origin to assigned elementary school (from existing school lookup)
- Google Places API (for private school discovery)

## Outputs

- Assigned school alert banner (gold-bordered, prominent at top)
- Three public school cards (elementary, middle, high) with name, distance, type
- Private schools within 10 miles (Google Places, graceful if none found)
- Action checklist: 4 questions to ask before closing
- Key Takeaway callout (drive time + boundary context)

---

## Key Design Decisions

**No GreatSchools API.** The original spec proposed GreatSchools integration (1-10 ratings, color-coded). This was abandoned because:
1. Numeric ratings violate the no-scoring rule in CLAUDE.md
2. GreatSchools free tier is limited; paid tier requires partnership
3. The "assigned school" problem is more important than the rating problem

**No color-coded rating badges.** Per CLAUDE.md non-negotiable: no numerical ratings, no score bands.

**Google Places for private schools.** `type:school` search within 16km radius, filtered to exclude public institutions by name pattern where possible. Returns name, distance, type.

**Boundary warning is the hero finding.** Most buyers assume "nearest school = assigned school." This is false and causes post-purchase regret when kids end up zoned to a different school. The alert is the most actionable element in the chapter.

---

## Acceptance Criteria (as built)

- [x] Assigned school alert displayed prominently at top of section
- [x] "Assigned ≠ nearest" warning visible before any school data
- [x] Public schools (elementary, middle, high) displayed with name and drive time
- [x] Private school discovery via Google Places within 10 miles
- [x] Graceful handling when no private schools found
- [x] Action checklist with 4 specific questions to ask district/seller
- [x] Key Takeaway uses actual drive time and is context-aware
- [x] Tested: Georgetown, KY (suburban) — 3 public, 5 private ✅
- [x] Tested: Harlan, KY (rural) — public found, fewer private (expected) ✅
- [x] Tested: Louisville, KY (urban) — multiple schools, more private options ✅
- [x] No numeric ratings or scoring of any kind

---

## Data Considerations

### Assigned School vs Nearest School
The report shows nearest school by distance/drive time — NOT assigned school by parcel boundary. School boundary APIs are not publicly available at a usable resolution. The alert and checklist exist to ensure buyers verify their actual assignment with the district.

### Private School Data
Google Places returns schools tagged with `type:school` or `type:secondary_school`. Results include charter and private schools but may also include tutoring centers or vocational programs. Quality varies by area density. Georgetown test found 5 strong results.

### Future Enhancements (not in scope)
- District boundary API if/when one becomes available nationally
- School rating trajectories (3-year trend)
- Magnet/charter program details
- Open enrollment policy and lottery information

---

## Fair Housing Note

School data is presented as informational. Ratings, test score comparisons, or any language that could steer buyers based on demographic composition of student body is prohibited. The checklist and boundary warning are the safe, actionable framing.

---

## Original Spec Notes (FR-017-school-ratings)

The original spec (FR-017-school-ratings) proposed GreatSchools API integration with numeric 1-10 ratings and color-coded badges. This approach was superseded by the rebuilt version for the reasons above. The GreatSchools integration code from that spec is not used. The API documentation, rate limit notes, and pricing information in the original spec remain accurate if that integration is ever revisited.
