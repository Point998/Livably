# FR-077 — Summary (Degradation Coverage Fan-Out → logging + 015 audit)

**Phase 4 — Implementation complete.**
Date: 2026-06-21
Branch: `FR-077-degradation-coverage-fanout`

---

## The story

Nathan asked to fan out the FR-076 pattern to the remaining 6 SOURCES-but-no-runtime-
`sourceChain` modules (health, community, access, schools, safety, garden). **Discovery
disproved the premise:** none of the 6 has a utilities-style silent multi-source `||` fallback.
They are single-source or multi-datum-single-source-each, mostly already resilient
(`Promise.allSettled` + defensive defaults). So there was **no `sourceChain` routing to do** —
the high-value part of the pilot didn't apply.

Nathan chose the minimal, honest scope: **logging consistency + a CONSTRAINT-015 audit.**

## What shipped (2 small code changes)

1. **`community/data.js`** — the one remaining `console.error('[Demographics]')` swallow site →
   structured `logError('getDemographics', \`${lat},${lng}\`, err)`. (The other 5 modules already
   used `logError` or had no console.error swallow sites.)
2. **`community/template.js`** — the one real CONSTRAINT-015 gap. The income card rendered a bare
   `"Income data unavailable"` when `d.income.median` was null. Replaced with a named, actionable
   fallback: *"Income wasn't returned for this tract — look it up at data.census.gov."* (no
   economic-class characterization — CONSTRAINT-002; reuses existing `prem-demo-sub` class — no
   inline styles, CONSTRAINT-008).

## CONSTRAINT-015 audit result (the substance)

| Module | Result | Notes |
|---|---|---|
| health | PASS | urgent care → Solv + Urgent Care Association; CMS type → CMS Care Compare; primary care → insurer. |
| **community** | **FIXED** | income-null generic message → data.census.gov actionable fallback. |
| access | N/A | no template.js; highway output renders via the (already resilient) Reachability chapter. |
| schools | PASS | GreatSchools search + NCES School Search on empty/missing. |
| safety | PASS | crime-prep section (CrimeMapping + SpotCrime) always renders with actionable links. |
| garden | PASS | hardiness-null → USDA Plant Hardiness Zone Map; urban soil → geotechnical/seller; per-datum `allSettled` degrade. |

`if (!data) return ''` guards in the PASS modules omit the chapter rather than render an empty
shell — acceptable under CONSTRAINT-015 (no empty section is shown). Borderline contextual
sub-messages (schools "within search radius", safety "no station nearby") left as-is: they sit
inside chapters that already carry actionable fallbacks elsewhere.

## Tests

- community/template.test.js: income-null renders a `data.census.gov` anchor; does **not** render
  "Income data unavailable"; median-present output unchanged; no inline styles.
- community/data.test.js: `getDemographics` resolves to null (no throw) when the Census fetch
  rejects — the `logError` catch path.
- +5 tests. **Full suite: 87 suites / 1,662 tests green** (1,657 baseline + 5). No `console.error`
  remains in any of the 6 modules' `data.js`.

CONSTRAINT-011: the change has no location-specific branch (income fallback is address-agnostic);
existing Jeffersonville IN integration coverage stands.

## Net

The valuable output of this FR was the **audit itself** — confirming graceful degradation is
honest across all 6 chapters — plus closing the two concrete gaps it found. No ceremony added
where there was no bug (no `sourceChain` wrapping of single sources). The FR-076 + FR-077 pair now
leaves the degradation-observability story complete: multi-source modules record fallbacks to the
ledger; single-source modules log failures + degrade gracefully with actionable fallbacks.
