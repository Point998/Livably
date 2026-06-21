# FR-078 — Headless Report Contract (utilities pilot)

**Phase 1 — Discovery + ADR (read-only). No code changes in this phase.**
Date: 2026-06-21

---

## Intent

Make Livably's backend **totally headless**: the report becomes a versioned, presentation-free
JSON **contract**; the frontend is built separately later (Claude design / full creative freedom)
against that contract. Everything visual is a placeholder filled by the frontend.

## Current-state inventory (what's already true)

- **The presentation seam already exists at one point:** `buildReportInner` assembles a complete
  data bundle and only at the last step calls `buildReportHTML(...)` (reportBuilder.js:194),
  returning `{ html, reportId, address }`. Going headless = cutting at that seam.
- **Architecture is one-directional** (`data → logic → template`), so logic is already (mostly)
  presentation-free.
- **CSS is already externalized** (design-tokens.css "Sourced from LIVABLY-DESIGN-BRIEF.md") —
  the placeholder-references-a-document pattern, done right, for visual styling.

### Design-in-code that WOULD leak into a contract (must be cleaned)
1. **Semantic color in logic** — 41 `color: '...'` literals in `*/logic.js`. → replace with a
   `tone` enum; frontend owns color.
2. **Voice/copy inline** — large prose volumes in `template.js` and some `logic.js`
   (`narrative`, `takeaway`). → contract emits structured **claims**, not sentences;
   `defaultCopy` is transitional scaffolding only.

## ADR — decisions (with tradeoffs)

- **ADR-1: Versioned REST JSON contract, not GraphQL (yet).** One first-party consumer → REST +
  schema is sufficient; GraphQL's wins (field selection, typed schema) don't apply or are already
  covered by Zod. The contract is a pure view-model, so GraphQL stays a cheap future bolt-on.
  **Trigger to revisit: consumer count > 1 / 3rd-party data product.**
- **ADR-2: Single machine-checked source of schema truth = Zod.** Vanilla-JS + JSON contract +
  separate frontend with no shared types = silent drift (the #1 headless failure; NR-004 already
  flagged no-TS). Zod gives runtime validation at serialize time AND exportable types, without
  adopting full TS. Backed by **contract snapshot tests** per address.
- **ADR-3: Backend emits structured claims, not prose or color.** `{ subject, measure, comparison,
  bucket, tone, provenance, fallbackAction }`. `defaultCopy` MAY ride along during build-out but is
  explicitly deleted when the frontend owns voice — it is scaffolding, not architecture.
- **ADR-4: Constraints become schema guarantees.** No `score`/`grade` field anywhere
  (CONSTRAINT-001); no demographic-character field (CONSTRAINT-002, Fair Housing); every finding
  MAY carry `fallbackAction` (CONSTRAINT-015 becomes structural). These move from "review 14
  templates" to "impossible by schema" — a real scale win.
- **ADR-5: Frontend rendering strategy is deliberate, not defaulted.** "Delivered as a web link"
  ⇒ shareable, fast first paint, OG previews. The contract enables SSG/SSR or SPA; the choice is
  the frontend's, flagged so the design tool's output fits the delivery model. (Out of scope here.)
- **ADR-6: Pilot-first.** Prove the contract + **governance mechanism** (Zod + snapshot + render-
  from-contract) on ONE chapter before committing 14. The governance is the part that must scale,
  not the JSON.

## What this design cannot do (non-goals)
- Not building the frontend. Not choosing its framework. Not migrating all 14 chapters (pilot only).
- Not adopting TypeScript wholesale (Zod only). Not GraphQL. Not a headless CMS (content is
  computed, not authored).

## Scale verdict
Scales on traffic (JSON caches better than HTML; pairs with FR-058 cell cache + Stage-1 Redis).
The real scale risk is **schema governance across two codebases** — addressed by ADR-2 (Zod +
snapshot tests) and ADR-3 (claims, not prose). With those, headless is strictly better than SSR.

## Phase 1 exit
No code changed. Spec follows (pilot-scoped).
