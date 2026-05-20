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

---

## Chapter Quality Framework

### Core Principle: "Will They Remember This Report?"

Every chapter must justify its existence. If someone looks back on their home purchase and this report played NO role in their decision or understanding, we failed.

### The 4-Point Quality Test

Every chapter is evaluated against these criteria:

**ACTIONABLE** — Does this change their decision or preparation?
- Changes what they offer, what they negotiate, or what they prepare for
- Example: "Flood zone = need $3,200/year flood insurance" (actionable)
- Not: "Some flood risk exists in the region" (too vague)

**REVEALING** — Does this show something hidden or invisible?
- Can't be discovered during a 20-minute showing
- Requires investigation, data analysis, or local knowledge
- Example: "Flight path passes overhead 6-7am weekdays" (hidden until you live there)
- Not: "There's an airport nearby" (visible on map)

**AVOIDS REGRET** — Does this prevent an "I wish I had known" moment?
- Catches dealbreakers before commitment
- Reveals future changes that impact value or livability
- Example: "Elementary school boundary changes in 2027 - your kids would switch schools"
- Not: "This school has good test scores" (available on GreatSchools)

**EXCLUSIVE** — Can they ONLY get this from Livably?
- Not readily available on Zillow, Redfin, Niche, or Google
- Requires aggregation, analysis, or investigation
- Example: Parcel-level permit history cross-referenced with listing claims
- Not: "Median home price is $340K" (on every real estate site)

### Scoring & Decision Matrix

| Score | Decision | Action |
|-------|----------|--------|
| 4/4 | Must Have | Standalone chapter — critical to user decision |
| 3/4 | Include | Standalone chapter — valuable but not critical |
| 2/4 | Merge | Extract valuable elements, integrate into related chapter |
| 1/4 | Merge | Pull only useful pieces into related chapter |
| 0/4 | Merge | Find any salvageable elements for related chapters |

**Merge Policy: Nothing is cut. Value is redistributed.**

If a chapter scores low, don't delete it. Extract what's valuable and integrate it where it belongs. Every piece of data that helps the user decision stays in the report.

---

## Quality Gates — Required Before Building Any Chapter

### Gate 1: Conceptual Review

Before writing a single line of code, every chapter must pass:

```markdown
## Chapter Proposal: [Name]

### What it covers:
[Detailed description of scope]

### Quality Checks:
- [ ] Actionable - How does this change their decision?
      Answer: [Specific example]

- [ ] Revealing - What hidden thing does this show?
      Answer: [Specific example]

- [ ] Avoids Regret - What "I wish I knew" does this prevent?
      Answer: [Specific example]

- [ ] Exclusive - Can they get this elsewhere easily?
      Answer: [Why not / Where else]

### Score: [X/4]
### Decision: MUST HAVE | INCLUDE | MERGE

### If MERGE:
- What's valuable? [List specific elements]
- Which chapter absorbs it? [Target chapter]
- How integrated? [Subsection, callout, or woven in]
```

Minimum passing score: 3/4

### Gate 2: Data Source Validation

Every data point must be verified before implementation:

```markdown
## Data Sources for [Chapter Name]

### Primary Source:
- Name: [API name / Public records source]
- Type: Free API | Public Records | Government Data | Scraped
- URL: [Link to documentation]
- Accuracy: High | Medium | Low
- Freshness: Real-time | Daily | Monthly | Annually
- Legal Status: Public domain | Terms of Service | Prohibited
- Cost: Free | $X per call | $X/month subscription

### Verification Method:
[How we confirm this data is accurate]

### Fallback if Primary Unavailable:
[Alternative source or approach]

### If No Reliable Data Exists:
- [ ] Skip this element entirely
- [ ] Disclose limitation clearly to user
- [ ] Use proxy/estimation with disclaimer
- [ ] Note in report: "Data not available for this area"
```

Data quality requirements:
- Never show data we can't verify
- Never use "estimated" without clear disclosure
- Never present old data as current
- Never claim accuracy we don't have

### Gate 3: Narrative Review

Before finalizing content, test the actual writing:

```markdown
## Sample Output for [Chapter Name]

### Lead Paragraph:
[Write the actual opening - this is what the user sees first]

### Second Paragraph:
[The follow-up that builds on the lead]

### Third Paragraph:
[The conclusion or call-to-action]

### Quality Checks:
- [ ] Would I read this entire section?
- [ ] Does it answer questions as they form?
- [ ] Is this genuinely useful or just filler?
- [ ] Would I need to Google for more info after reading?
- [ ] Does this sound like a human wrote it, not AI?
- [ ] Does every sentence add value?

### "So What?" Test:
If the user reads this and thinks "So what?", we failed.
Every paragraph must answer: "Why does this matter to ME?"

### Length Check:
- Too short? Feels rushed, lacks context
- Too long? Padding, repetitive, boring
- Just right? Substantive but moves along
```

### Gate 4: End-to-End Testing

Before considering a chapter "done":

```markdown
## Testing Checklist for [Chapter Name]

### Technical Testing:
- [ ] Generate report for 3 different addresses (urban, suburban, rural)
- [ ] Verify all data matches source (spot check)
- [ ] Confirm no broken API calls
- [ ] Check for edge cases (missing data, unusual values)
- [ ] Verify formatting on mobile and desktop

### User Testing:
- [ ] Time how long it takes to read (should be 2-5 min per chapter)
- [ ] Does it feel like part of $10 value?
- [ ] Ask: "What action would you take after reading this?"
- [ ] Ask: "What surprised you in this section?"
- [ ] Ask: "What questions do you still have?"

### Quality Validation:
- [ ] No generic filler ("The neighborhood is nice")
- [ ] No obvious statements ("Houses have doors")
- [ ] No data dumps without context (just listing numbers)
- [ ] Every claim is specific and grounded
- [ ] Tone is helpful friend, not corporate robot

### The Georgetown Test:
Test with someone who KNOWS Georgetown, KY intimately.
If they say "Yeah, that's accurate" -> Pass
If they say "That's not quite right" -> Fix before launch
```

---

## Revised Chapter Structure (12 Chapters)

### Standard Tier (9 Chapters)

**Chapter 1: Health & Safety** (4/4 — Must Have)
Covers: Fire department type/ISO rating, EMS response times, nearest emergency room, traffic safety context, utility reliability, emergency communication reliability.
Why it matters: Medical emergencies happen. Distance to ER can be life or death. ISO rating affects insurance costs.

**Chapter 2: Daily Life & Access** (4/4 — Must Have)
Covers: Drive times (8am Tuesday, door-to-door) to grocery, pharmacy, hospital, highway, urgent care, gas station; cell coverage quality for remote workers.
Why it matters: You make these trips 300+ times per year. 5 minutes each way = 50 hours annually.

**Chapter 3: Schools & Education** (4/4 — Must Have)
Covers: Assigned school by parcel (not nearest), ratings with trajectory, school choice options, student highlights, programs.
Why it matters: School boundaries change. "Nearest" does not equal "assigned". Trajectory matters more than current rating. Boundary changes mean kids might switch schools mid-elementary.

**Chapter 4: Neighborhood Character** (4/4 — Must Have)
Covers: Owner-occupancy rate and 3-year trend, median resident tenure, population growth/decline, HOA status and rules, permit activity trends, neighborhood watch presence, food culture snapshot, local dining scene, hidden gems, community events.
Why it matters: High turnover = instability. Declining owner-occupancy = area in transition. Local culture tells you what daily life actually feels like.

**Chapter 5: Growth & Development** (4/4 — Must Have)
Covers: Confirmed funded projects only (no speculation), named developments with status labels (Under Construction, Approved, Planned), distance from property, impact on traffic/amenities/character.
Why it matters: New grocery store = convenience boost. New highway exit = noise and traffic. Mixed-use development = area transformation. This tells you the FUTURE of the neighborhood.

**Chapter 6: Climate & Weather Risks** (4/4 — Must Have)
Covers: Flood zone (parcel-level, not ZIP code), FEMA designation and insurance requirements, tornado/wildfire/heat risk with historical data, insurance cost implications.
Why it matters: Flood insurance can cost $3,200/year. FEMA maps are parcel-specific. "100-year flood zone" means 26% chance over a 30-year mortgage.

**Chapter 7: Property Intelligence** (3/4 — Include)
Covers: Permit history for this parcel, utility connections confirmed (water, sewer, electric, gas, fiber), construction era and implications, property tax history, unpermitted work warnings, lot size and characteristics, soil type and drainage, USDA hardiness zone.
Why it matters: Unpermitted deck = negotiation leverage. Failing septic = $15K replacement. Tax history shows if assessments are climbing faster than market.

**Chapter 8: Sensory & Environmental** (4/4 — Must Have)
Covers: Flight path analysis with timing, road noise estimation, rail proximity and schedule frequency, industrial sources within 1 mile, light pollution index, air quality index and trends, water quality and violations, radon zone level, Superfund site proximity, EPA EJSCREEN data.
Why it matters: You can't discover these during a 2pm Sunday showing. Train horns at 3am. Planes overhead during breakfast. Air quality affects health.

**Chapter 9: Key Insights** (reimagined — not a standalone chapter)
Instead: Pull top 5 critical findings into the Hero section "At A Glance". Add dynamic "Key Takeaway" callout boxes throughout the report. Each box highlights one actionable insight from that section.
Why it matters: Busy users need quick wins. Callouts highlight what matters most without rehashing everything at the end.

### Premium Tier (3 Chapters — $24.99 Add-On)

**Chapter 10: Development Pipeline** (4/4 — Premium)
Covers: Pre-permit planning intelligence (zoning applications filed but not approved), pre-application meetings (public records), land assemblages indicating future development, conceptual plans in review, environmental impact studies filed.
Why it matters: This is 6-12 months ahead of funded projects. Tells you what's coming before ground breaks.

**Chapter 11: Investment Analysis** (4/4 — Premium)
Covers: Price tier performance (appreciation by bracket), rental market depth (active rentals, vacancy rate, average days on market), carrying costs breakdown (mortgage, tax, insurance, HOA, maintenance), transaction costs estimate, market liquidity (days on market trend, sale-to-list ratio).
Why it matters: Not everyone is owner-occupying. Investors need cash flow analysis. Even homeowners benefit from understanding appreciation trends and exit liquidity.

**Chapter 12: Schools Deep Dive** (4/4 — Premium)
Covers: District financial health and 5-year trend, AP course offerings and pass rates, teacher tenure and turnover rate, attendance boundary stability (changes in last 10 years), accreditation status and warnings, enrollment trends, student-teacher ratios, college acceptance rates.
Why it matters: District financial health predicts future program cuts. High teacher turnover = instability. Boundary changes = your kid switches schools.

---

## Merge Map: Old Structure to New Structure

- Ch 01 Safety Infrastructure (0/4) → emergency communication into Ch 01; cell coverage into Ch 02; neighborhood watch into Ch 04
- Ch 02 Health & Safety (4/4) → becomes Ch 01: Health & Safety (standalone)
- Ch 03 Daily Reachability (2/4) → becomes Ch 02: Daily Life & Access (standalone, expanded)
- Ch 04 Schools & Education (4/4) → becomes Ch 03: Schools & Education (standalone)
- Ch 05 Neighborhood Dynamics (4/4) → becomes Ch 04: Neighborhood Character (expanded, absorbs Ch 01 community connectivity and Ch 16 lifestyle elements)
- Ch 06 Growth & Investment (4/4) → becomes Ch 05: Growth & Development (standalone)
- Ch 07 Weather & Climate (4/4) → becomes Ch 06: Climate & Weather Risks (standalone)
- Ch 08 Property Livability (3/4) → becomes Ch 07: Property Intelligence (standalone, absorbs Ch 14 soil/lot)
- Ch 09 Sensory Environment (4/4) → becomes Ch 08: Sensory & Environmental (expanded, absorbs Ch 10 air/water quality)
- Ch 10 Environment & Health (3/4) → merges into Ch 08: Sensory & Environmental
- Ch 11 Report Summary (1/4) → transforms into Ch 09: Key Insights (distributed callouts, not standalone)
- Ch 12 Development Pipeline (4/4) → becomes Ch 10: Development Pipeline (Premium)
- Ch 13 Financial & Investment (4/4) → becomes Ch 11: Investment Analysis (Premium)
- Ch 14 Nature Deep Dive (1/4) → soil/hardiness zone into Ch 07; skip detailed planting guides
- Ch 15 Schools Deep Dive (4/4) → becomes Ch 12: Schools Deep Dive (Premium)
- Ch 16 Lifestyle & Community (2/4) → food/culture/gems into Ch 04; skip generic lifestyle fluff

---

## Implementation Guidelines

### Before Building Any Chapter:

1. Run Gate 1: Conceptual Review — score against 4 criteria, minimum 3/4 to proceed
2. Run Gate 2: Data Source Validation — verify API availability, test with 3 sample addresses, document fallback
3. Run Gate 3: Narrative Review — write sample output, test readability, eliminate filler
4. Run Gate 4: End-to-End Testing — generate test reports, time reading duration, validate with local knowledge

### Writing Standards:

**Voice & Tone:**
- Helpful friend, not corporate robot
- Conversational but professional
- Honest about limitations
- No jargon unless explained
- No AI tells ("delve", "underscores", "tapestry")

**Content Rules:**
- Every paragraph must answer "Why does this matter to ME?"
- No generic statements ("The neighborhood is nice")
- No obvious facts ("Houses have kitchens")
- No data dumps without context
- Specific over vague ("6-7am weekdays" not "morning")
- Numbers need context ("$3,200/year" not "high")

**Length Guidelines:**
- Chapter intro: 1 paragraph (2-4 sentences)
- Main content: 3-5 paragraphs
- Subsections: 2-3 paragraphs each
- Total chapter: 2-5 minute read

**The "Holy Crap" Test:**
Every chapter should contain at least one moment where the user thinks "Holy crap, I didn't know that" or "I'm glad I found out now, not later" or "This changes how I think about this place." If a chapter doesn't generate that reaction, it's not earning its place.

---

## Data Source Priority

1. **Government/Official Sources** (highest trust) — FEMA, EPA, USDA, Census, FAA, NOAA, county assessor, planning department, school district data
2. **Verified APIs** (good trust if documented) — Google Maps, OpenStreetMap, weather services with citations, public records aggregators
3. **Estimated/Derived** (must disclose) — calculated scores, noise levels from proximity, trend projections — always note estimation method
4. **Never Use** — scraped data violating Terms of Service, undocumented sources, outdated data presented as current

**When data is unavailable:** Skip the element entirely, note "Data not available for this area", or use a proxy with a clear disclaimer. Never make up data or claim certainty we don't have.

---

## Success Metrics

**User behavior signals (working):**
- Reads entire section without skimming
- Takes 2-5 minutes per chapter
- Says "I didn't know that"
- References it when making decisions
- Shares report with family or agent

**Anti-patterns (failing):**
- User skims and moves on (boring)
- User Googles for more info (incomplete)
- User questions accuracy (data issues)
- User says "I already knew this" (not valuable)
- User doesn't reference it when deciding (not impactful)

**The ultimate test:** Six months after move-in, ask the homeowner: "Did the Livably report help your decision?" If yes with specific examples, we succeeded. If "I don't remember" or "Not really", we failed.
