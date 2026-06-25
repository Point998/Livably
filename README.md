# Livably

A residential address intelligence report for US homebuyers, delivered as a web link.

**The product promise:** the things you'd only learn after living somewhere for two years,
handed to you before you sign — not judged, not scared, not overwhelmed.

> **Read before changing code:** [`CLAUDE.md`](CLAUDE.md) (constraints + 4-phase workflow) and
> [`docs/IMPLEMENTATION_ROADMAP.md`](docs/IMPLEMENTATION_ROADMAP.md) (state, roadmap, backlog —
> the single source of truth).

## What it is

A Node.js / Express service that takes a US address and assembles a multi-chapter report
(health & safety, daily life, climate, what grows here, community, and more) from public data
sources — Google Maps/Places/Distance Matrix, USDA, NOAA, Census ACS, FEMA, EPA, iNaturalist,
eBird, FCC. No scoring, no grades: findings are framed as *Things to Consider / Things to Check /
Cool Things to Know*.

## Architecture in 60 seconds

- **Modular monolith.** Each chapter is a module under `src/modules/`, and every module owns
  three layers that may not reach into each other's concerns:
  1. `data.js` — fetches raw API data only
  2. `logic.js` — validates, processes, applies business rules (cross-module coherence lives in `src/shared/validate.js`)
  3. `template.js` — generates HTML from clean processed data
- **Headless contract.** The report is a versioned, Zod-validated contract (`src/contract/`),
  served at `GET /api/report.json`. The HTML report is one renderer of that contract; the
  standalone frontend (below) is a future one.
- **Report store.** Generated reports are persisted behind a backend-agnostic store interface
  (swap-ready for an external backend — see the roadmap's DO-NEXT).

See [`docs/plans/module-restructure.md`](docs/plans/module-restructure.md) for the module layout.

## Run locally

```bash
npm install
cp .env.example .env   # then fill in API keys — see .env.example for each variable's source
npm start              # serves on http://localhost:3000
```

Open `http://localhost:3000`, enter an address, and the report generates server-side.
For the raw contract instead of HTML: `GET /api/report.json?address=...`.

```bash
npm test               # Jest suite (every module + business rule is tested)
npm run verify:sources # data-source reachability check
```

## Frontend (future phase)

The current report is server-rendered. The standalone frontend is a **separate, later design
phase**: an SSG-per-report site built *from the report contract*, with its own visual identity.

- Design-system source of truth: [`docs/design/DESIGN-BRIEF.md`](docs/design/DESIGN-BRIEF.md)
  (+ [`SKETCH-SPEC.md`](docs/design/SKETCH-SPEC.md)). This is also what
  [Claude Design](https://support.claude.com/en/articles/10167454-use-the-github-integration)
  imports (read-only) when connected to this repo, so its output uses Livably's real tokens and
  conventions rather than generic mockups.
- Planned home: a `web/` workspace in this repo (monorepo), consuming the contract — not a
  separate repo, until a second contract consumer exists.

## Key documents

| Doc | Purpose |
|-----|---------|
| [`CLAUDE.md`](CLAUDE.md) | Constraints, 4-phase workflow, architecture rules — read before changing any file |
| [`docs/IMPLEMENTATION_ROADMAP.md`](docs/IMPLEMENTATION_ROADMAP.md) | Project state, roadmap, backlog (single source of truth) |
| [`docs/design/`](docs/design/) | FE-phase design system (brief + sketch) |
| [`docs/postmortems/`](docs/postmortems/) | PM-XXX: every production bug documented |
| [`docs/nathan-reports/`](docs/nathan-reports/) | NR-XXX: owner strategic reviews |
| [`docs/archive/`](docs/archive/) | Historical docs (e.g. the completed restructure plan) |
