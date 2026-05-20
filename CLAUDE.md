# CLAUDE.md — Livably

Read this file at the start of every session before making any changes.

---

## Project Overview

Livably is a residential address intelligence report for US homebuyers. Delivered as a web link (HTML). The goal is to make a buyer feel genuinely more informed about the home they're buying — not judged, not scared, not overwhelmed. The report should feel like a gift.

**Full product spec:** `PRD.md`
**Build queue:** `feature-requests/` folder — one subfolder per feature

---

## Non-Negotiable Rules

### No scoring. Ever.
No composite scores. No chapter grades. No numerical ratings. No ring charts. No score bands. No "78/100". The three-bucket framework replaces all scoring:
- **Things to Consider** — conditions worth knowing
- **Things to Check** — specific action items with named resources
- **Cool Things to Know** — genuinely positive or interesting findings

### Tone
Informative, warm, confident. Reads like a knowledgeable friend. Never alarming. Never clinical. Never a compliance document.

### Fair Housing
No finding may reference or imply racial, ethnic, national origin, income, or class composition of any area. Describe documented behavior and infrastructure only — never who lives there. This is non-negotiable and applies to every chapter.

### Design
- Fonts: Fraunces (serif headings), DM Sans (body) — Google Fonts
- Colors: dark ink header (#1a1a1a), cream background (#faf8f4), gold accents (#b8922a)
- Mobile-first, max-width 480px
- Visual target: `reference/livably_report_georgetown_v4.html`
- No scoring ring. Replace with clean address hero block.

---

## Feature Request Workflow

**Every build task follows this 4-phase workflow. No exceptions.**

Never implement a feature without completing phases 1-3 first. Skipping phases produces broken features that pass superficial checks but fail in real use — this has already happened with the grocery, hospital, and highway functions.

### Phase 1 — Discovery (read-only)
- Read `PRD.md` and the relevant chapter spec
- Read existing code in `src/app.js`
- Identify what exists, what's missing, what could break
- Output: written summary of findings, proposed approach
- **No code changes in this phase**

### Phase 2 — Specification
- Write `spec.md` in the feature's folder under `feature-requests/`
- Define: what it does, inputs, outputs, edge cases, error states
- Define: what "done" looks like (acceptance criteria)
- **No code changes in this phase**

### Phase 3 — Planning
- Write `implementation-plan.md` in the feature's folder
- Break into ordered tasks
- Flag any risks or unknowns
- **No code changes in this phase**

### Phase 4 — Implementation
- Execute the plan from `implementation-plan.md`
- Make changes to `src/app.js` or other files
- Restart server and test with Georgetown address: `100 Wishing Well Path Unit 2306 Georgetown, KY 40324`
- Test with at least one rural address and one urban address
- Write `summary.md` in the feature's folder documenting what was built and any deviations from the plan
- Commit and push: `git add -A && git commit -m "FR-NNN: description" && git push`
- Mark feature `[x]` complete in its folder

---

## Known Bugs — Never Repeat These

These are documented failures from prior build sessions. Treat each as a permanent constraint.

### BUG-001: Hospital search returned second-nearest, not nearest
**Cause:** Took Google's first text search result without verifying by drive time.
**Fix applied:** Calculate drive time for top 5 results, return the one with shortest drive time.
**Rule:** Never trust Google's relevance ranking for safety-critical destinations (hospital, urgent care). Always verify by actual drive time.

### BUG-002: Grocery search returned distant store over nearby one
**Cause:** textSearch ranks by Google relevance, not distance. A store 29 minutes away outranked one 3 minutes away.
**Fix applied:** Use textSearch with tight 8km radius, calculate drive times for top 8, return 3 fastest.
**Rule:** Never use textSearch without also sorting results by actual drive time. Relevance ranking is not distance ranking.

### BUG-003: Highway search returned a boat ramp
**Cause:** Searching for "highway on ramp" as a place matched the word "ramp" generically.
**Fix applied:** Geocode each interstate by name near city/state, validate returned address contains highway name.
**Rule:** Never search for highway access as a Google Places query. Use geocoding with validation.

### BUG-004: Urgent care returned retail health clinic (Little Clinic inside Kroger)
**Cause:** Little Clinic appears in urgent care searches but is a retail wellness clinic, not a true urgent care.
**Fix applied:** Exclude by name: 'little clinic', 'minuteclinic', 'minute clinic', 'cvs health', 'walgreens health'.
**Rule:** Urgent care search must always filter out retail health clinics. These are not equivalent to urgent care.

### BUG-005: Highway validation filter too strict, dropped valid interstates
**Cause:** Address string validation didn't match all formats Google returns for interstate addresses.
**Status:** Partially fixed — I-75 returns correctly, I-64 still not returning for Georgetown. Needs further work in TICKET-002.
**Rule:** When validating geocoded interstate results, check multiple address string formats.

### BUG-006: Claude Code changes not persisting to disk / GitHub out of sync
**Cause:** Claude Code sometimes reports making changes without actually writing them to disk.
**Rule:** After any Claude Code session, always verify with `git status` and check GitHub matches local file. If out of sync, manually replace the file.

---

## Data Standards

- **Drive times:** Google Maps Distance Matrix API, 8am Tuesday departure, door-to-door from specific address
- **Hospital:** Must be nearest full-service ER verified by drive time — not proximity, not search rank
- **School:** Nearest by distance with disclaimer. Parcel-level assignment requires manual district verification.
- **Flood zone:** Parcel-level from FEMA MSC — never neighborhood-level
- **Every finding:** Named source + research date
- **Highway:** Only show interstates within 20 minutes. Fall back to single closest if none within 20 min.

---

## Tech Stack

- Node.js + Express
- `@googlemaps/google-maps-services-js`
- APIs: Geocoding, Reverse Geocoding, Distance Matrix, Places Nearby, Text Search
- HTML rendered server-side in `/report` route
- `.env` holds `GOOGLE_MAPS_API_KEY`
- Port 3000 local dev
- GitHub: https://github.com/Point998/Livably

## Do Not
- Add npm packages without noting it in the feature summary
- Change or read the `.env` file
- Add scoring of any kind
- Use hardcoded store or chain names for filtering (use Google place types instead)
- Skip the feature request workflow phases
- Mark a feature complete without testing on at least 3 addresses
