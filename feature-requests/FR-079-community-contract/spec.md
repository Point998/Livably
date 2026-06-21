# FR-079 — Community chapter → report contract (rollout #1)

**Phases 1–3 (discovery + spec + plan) — concise; the contract pattern is proven (FR-078).**
Date: 2026-06-21
Module: `community` (keyed as `chapters.demographics` in the report)

## Why community is the right first rollout
It's the **Fair-Housing-sensitive** chapter (CONSTRAINT-002) — migrating it forces the contract to
prove it can carry demographic *facts* without *characterizing* an area. That's the schema-as-guard
thesis under its hardest case.

## Source shape (`getDemographics` output)
`{ totalPop, medianAge, age{…,primaryGroup}, income{median, level{label,color}},
education{bachelor,graduate,collegePct,level}, community{ownershipRate,avgHHSize,medianTenureYears,
type,densityType}, incomeDistribution, educationLadder, householdComposition, commuteMode, tractFips }`

## ADR — Fair Housing stance for the community contract (the novel decision)

**ADR-1: All community findings are `tone: 'neutral'`, `bucket: 'cool'`.**
Demographic attributes (income, education, age, household) must never be tagged `favorable`/`caution`
— assigning a value judgment to who lives in an area is exactly the CONSTRAINT-002 violation. This is
*more conservative* than the current UI's color gradient (education renders green/lightgreen today),
and it's the correct contract-level stance: demographics are "Cool things to know" (context), never
"things to consider/check" (judgments). Enforced by a test: every community finding has tone neutral.

**ADR-2: Income compares to NATIONAL median only.** `comparison.basis === 'national_median'`, never
state/local — mirrors the existing `getIncomeLevel` (which already returns a constant `color` per
tier, i.e. refuses to characterize local economic class). `referenceValue` is left `null` (we don't
carry the exact national figure — no manufactured precision); `direction` is derived from the
existing level label. Enforced by a test.

**ADR-3: Missing-income fallback reuses the FR-077 fix** — `fallbackAction` → data.census.gov, so the
contract and the (just-shipped) template fallback agree.

## Findings emitted
- `population-density` (Urban/Suburban/Rural — physical character, allowed), measure totalPop.
- `age-distribution` (primaryGroup), neutral/cool.
- `household-income` (median vs national median) OR `income-missing` (fallbackAction).
- `educational-attainment` (collegePct vs US avg), neutral/cool.
- `homeownership` (ownershipRate + community type), neutral/cool.

provenance: `{ source: 'Census ACS', asOf, modeled: false }` (ACS vintage in `asOf`; precise vintage
plumbing is a tracked follow-up per honest-provenance).

## Acceptance criteria
- [ ] AC-1 `buildCommunityContract` returns a `ChapterContract`-valid object (chapterId `community`).
- [ ] AC-2 **Every** finding is `tone: neutral` (ADR-1) — tested.
- [ ] AC-3 The income finding's `comparison.basis === 'national_median'` (ADR-2) — tested.
- [ ] AC-4 Missing income → `fallbackAction` to data.census.gov (ADR-3) — tested.
- [ ] AC-5 No finding carries a score/grade/color (inherited from `.strict()`); contract JSON has no `"color"`.
- [ ] AC-6 Wired into `reportBuilder` contract envelope under `chapters.community`.
- [ ] AC-7 Per-address snapshots incl. Jeffersonville IN; full suite green.

## Plan
1. `src/modules/community/contract.js` — `buildCommunityContract(demographics, opts)` via `safeBuild`.
2. `reportBuilder` — add `community: chapters?.demographics ? buildCommunityContract(...) : null`.
3. Tests `tests/modules/community/contract.test.js` — validity, ADR-1/2/3 invariants, snapshots.
4. Full suite + summary.

## Non-goals
Other 12 chapters; deleting `defaultCopy`; ACS-vintage precise plumbing; touching the live template.
