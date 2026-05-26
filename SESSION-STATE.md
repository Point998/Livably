# Livably — Session State
*Updated after every Claude Code session. Read this first.*
*Last updated: May 2026*

## How to Start a New Session
Paste these URLs in the planning chat:
- https://raw.githubusercontent.com/Point998/Livably/main/SESSION-STATE.md
- https://raw.githubusercontent.com/Point998/Livably/main/BACKLOG.md

Note: CLAUDE.md CDN caches and sometimes 404s — read it from disk if needed.

## Current Branch
main (FR-035 in progress on fr-035-logic-layer branch)

## Active FR
FR-035 — Logic Layer (validate.js)
Phase: 4 (Implementation in progress)
Scope: src/shared/validate.js — cross-state filtering, rural mode detection, drive time coherence, Fair Housing compliance

## Recently Completed
- FR-036: Utils extraction — src/utils/ owns all constants and pure functions. 613 lines removed. Zero behavior change.
- FR-037: Data layer extraction — src/shared/google/, src/shared/census.js, 5 module data.js files. 37 tests passing. Merged via PR #1.

## Test Suite
- 37 tests passing, 0 failures
- Run: npm test
- Test addresses (always test all 5):
  1. 100 Wishing Well Path Unit 2306, Georgetown, KY 40324
  2. 456 Rural Route 1, Harlan, KY 40831
  3. 123 Main St, Louisville, KY 40202
  4. 789 Main St, Bozeman, MT 59715
  5. 1007 Stonelilly Dr, Jeffersonville, IN 47130

## FR Queue (in order)
1. FR-035 — Logic Layer (IN PROGRESS)
2. FR-038 — Template Components
3. FR-039 — Chapter Templates
4. FR-040 — Test Suite Expansion
5. FR-041 — Services and Routes
6. FR-042 — What Will Grow Here Deep Dive
7. FR-043 — Climate & Weather History Deep Dive
8. FR-033 — Life at This Address Calculator
9. FR-032 — Utilities Intelligence
10. FR-034 — Chapter Enhancements
11. FR-044 — Progressive Disclosure (Level 1/2/3 for all chapters) — spec not yet written

## Key Documents
- CLAUDE.md — 15 constraints, 4-phase workflow, architecture rules
- LIVABLY-ARCHITECTURE.md — full restructure plan
- LIVABLY-DESIGN-BRIEF.md — complete design system
- LIVABLY-SKETCH-SPEC.md — hand-drawn house animation spec
- docs/plans/module-restructure.md — module structure reference
- docs/NARRATIVE-QUALITY-AUDIT.md — 14-chapter quality audit
- docs/IMPLEMENTATION_ROADMAP.md — big picture plan
- BACKLOG.md — all captured ideas and decisions

## Known Issues
- CLAUDE.md CDN cache — sometimes 404s on GitHub raw URL, read from disk
- premium.js still 3000+ lines — extraction happens in FR-039
- Design rebuild pending — LIVABLY-DESIGN-BRIEF.md is the reference, Claude Design exploration ongoing
