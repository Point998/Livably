# FR-079 — Summary: Community chapter → report contract (rollout #1)

**Phase 4 — Implementation complete.**
Date: 2026-06-21
Branch: `FR-079-community-contract`

## What shipped
The first **rollout** of the FR-078 headless contract pattern, onto the **community** chapter —
chosen deliberately because it's the Fair-Housing-sensitive one (CONSTRAINT-002) and thus the
hardest test of "demographic facts without characterization."

- **`src/modules/community/contract.js`** — `buildCommunityContract(demographics, opts)` maps the
  `getDemographics(...)` output → findings: `population-density`, `age-distribution`,
  `household-income` (or `income-missing`), `educational-attainment`, `homeownership`.
- **`reportBuilder`** — contract envelope now carries `chapters.community` alongside
  `chapters.utilities` (additive).

## Fair Housing decisions (the substance — see spec ADRs)
- **ADR-1: every community finding is `tone: neutral`, `bucket: cool`.** Demographics are context
  to *know*, never a favorable/caution judgment about who lives in an area. This is *stricter*
  than the live UI (which renders an education color gradient today) and is the correct
  contract-level stance. Enforced by test.
- **ADR-2: income compares to the NATIONAL median only** (`basis: 'national_median'`, `region:
  null`), mirroring the existing `getIncomeLevel` (constant color per tier — already refuses to
  characterize local economic class). `referenceValue: null` — no manufactured precision; the
  level label supplies `direction`. Enforced by test.
- **ADR-3: missing income → `data.census.gov` fallbackAction**, agreeing with the FR-077 template
  fix so contract and UI fallback are consistent.

## Tests
`tests/modules/community/contract.test.js` (10): schema validity; **every finding tone neutral**;
demographics never in consider/caution framing; income national-median-only; missing-income
fallback; no color/score; provenance Census ACS; per-address snapshots incl. **Jeffersonville IN**.

Snapshot verified: all findings `tone: neutral` / `bucket: cool`, income `national_median`,
education `national_average`.

**Full suite: 90 suites / 1,696 tests green** (1,686 baseline + 10), 6 snapshots.

## Rollout status
2 of 14 chapters now on the contract (utilities, community). Pattern holding: per-module
`contract.js` + `safeBuild` + Zod conformance + per-address snapshots, wired additively into the
report envelope. 12 chapters remain.

## Follow-ups (tracked)
- Precise ACS vintage in `provenance.asOf` (currently report-time month) — honest-provenance plumbing.
- Remaining 12 chapters.
- Delete `defaultCopy` when the frontend owns voice.
