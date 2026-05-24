# Livably — Creative Design Brief
*Version 1.0 — May 2026*
*For Claude Code execution with frontend-design, ui-design, interaction-design, and visual-critique plugins*

---

## The Core Creative Idea

**Livably is not a data tool. It is a journey of discovery.**

The buyer already knows the home — they've seen it on Zillow, walked through it with their agent, fallen in love with the kitchen. What they don't know is the *life* that waits for them on the other side of that door. The neighborhood at 7am on a Tuesday. The drive to the ER at midnight. The way the yard smells after rain. The coffee shop they'll stop at every morning without thinking about it.

Livably reveals that life before they sign. Every section is an act of discovery. Every data point is a gift.

The design must feel like that. Not a report. Not a dashboard. Not a document.

**An experience of genuine curiosity, warmth, and revelation.**

The emotional arc of using Livably:
1. **Intrigue** — "What will this tell me about where I'm about to live?"
2. **Discovery** — "I didn't know this. I couldn't have found this anywhere else."
3. **Confidence** — "I know this place now. I'm ready."

Every design decision serves this arc.

---

## Design Principles

### 1. Reveal, Don't Display
Information is not listed. It is revealed. Sections animate into existence as the buyer scrolls — not with gratuitous effects, but with intention. Each reveal feels earned. Like turning a page. Like rounding a corner in a new neighborhood and seeing something unexpected.

### 2. Earn the Space
Generous negative space is not emptiness — it is emphasis. What we choose to show is as important as how we show it. Every element on screen must justify its presence. If it doesn't serve the story, it doesn't exist.

### 3. The Knowledgeable Friend
The voice is warm, specific, confident. Not clinical. Not alarming. Not corporate. The design must match this voice — approachable but authoritative. The typography, the spacing, the color — everything should feel like it was made by someone who genuinely cares about this buyer's decision.

### 4. Delight Without Distraction
Animation exists to guide attention and reward curiosity — not to show off. A counter that animates to "4 min" is delightful. A spinning loader is noise. Every animation has a purpose: to make the information land harder, feel more real, create a moment of "oh."

### 5. The Story of a Place
Each chapter tells a story about one dimension of life at this address. The design should reflect the character of that story. Daily Reachability feels practical and reassuring. What Will Grow Here feels alive and optimistic. Climate & Weather Risks feels honest and grounding. The design vocabulary is consistent but the emotional register shifts chapter by chapter.

---

## Typography System

### Display Font: Fraunces
*Optical size: use the display optical size for headlines, text optical size for body*

Fraunces is the soul of Livably. It is warm, literary, slightly unexpected. It says: "this was made with care." It carries the weight of major headlines without feeling heavy. It has personality without being precious.

Usage:
- **Hero headline:** Fraunces 72-96px, weight 300-400, optical display, loose tracking -0.02em
- **Chapter titles:** Fraunces 36-48px, weight 500-600, tight leading 1.1
- **Section headings:** Fraunces 24-28px, weight 400
- **Pull quotes / Key Takeaways:** Fraunces 20-22px, weight 300, italic, generous leading 1.6
- **Logo:** Fraunces 28px, "Liv" in --ink, "ably" in --gold

### Body Font: DM Sans
Clean, modern, highly legible. Neutral enough not to compete with Fraunces. Warm enough not to feel corporate.

Usage:
- **Body text:** DM Sans 15-16px, weight 400, leading 1.7
- **Data labels:** DM Sans 11px, weight 600, letter-spacing 0.08em, ALL CAPS
- **Drive times / numbers:** DM Sans 18-20px, weight 700, tabular nums
- **Footnotes / sources:** DM Sans 11px, weight 400, --ink-40
- **Navigation:** DM Sans 13px, weight 500, letter-spacing 0.05em

### Monospace accent: JetBrains Mono or similar
For data-heavy displays — drive times, coordinates, census figures — a monospace accent adds technical credibility and visual variety.

---

## Color System

```css
:root {
  /* Core */
  --ink: #1a1a1a;           /* Primary text, dark surfaces */
  --ink-80: #363636;        /* Secondary text */
  --ink-50: #8a8a8a;        /* Muted text, labels */
  --ink-20: #d4d0ca;        /* Borders, dividers */
  --ink-08: #f0eee9;        /* Subtle backgrounds */

  /* Warm surfaces */
  --cream: #faf8f4;         /* Report body background */
  --sand: #f0ece3;          /* Section alternates, cards */
  --parchment: #e8e2d6;     /* Deeper warm tone */
  --white: #ffffff;         /* Card surfaces */

  /* Brand accents */
  --gold: #b8922a;          /* Primary accent — CTAs, highlights */
  --gold-light: #f7f0e0;    /* Gold tint backgrounds */
  --gold-dark: #8a6b1e;     /* Pressed/hover gold */

  /* Chapter-specific accents */
  --teal: #2a7d6e;          /* Daily Life, Healthcare sections */
  --teal-light: #e6f3f1;
  --forest: #3d6b47;        /* What Will Grow Here */
  --forest-light: #e8f2ea;
  --slate: #3d4f6b;         /* Climate, Safety sections */
  --slate-light: #eaecf2;
  --rust: #c04a2e;          /* Warnings, Things to Check */
  --rust-light: #fdf0ed;
  --amber: #c47c1a;         /* Things to Consider */
  --amber-light: #fdf4e3;

  /* Dark hero surfaces */
  --hero-dark: #111111;
  --hero-mid: #1e1e1e;
  --hero-text: rgba(255,255,255,0.92);
  --hero-text-muted: rgba(255,255,255,0.5);
  --hero-border: rgba(255,255,255,0.08);
}
```

**Gradients:**
- Hero background: `radial-gradient(ellipse at 30% 50%, #1e2a1e 0%, #111111 60%)` — dark with a subtle warm green suggestion, like looking at a neighborhood from a distance at dusk
- Section transitions: gentle fade from --cream to --white between cards
- Gold glow on CTAs: `box-shadow: 0 0 40px rgba(184,146,42,0.15)`

---

## The Homepage

### The Mission
The homepage has one job: make the buyer feel that something extraordinary is about to happen. They enter an address. The world opens up.

### Hero Section

**Full viewport height. Dark. Alive.**

Background: Deep dark `#111111` with a subtle animated texture — very fine grain (CSS noise filter or SVG feTurbulence), barely visible, like the surface of night. Optional: extremely subtle, slow-moving radial light bloom, as if a streetlight is somewhere off-screen.

**Headline — center stage, large:**
```
Fraunces, display optical size
Font size: clamp(48px, 8vw, 96px)
Weight: 300
Color: rgba(255,255,255,0.92)
Letter-spacing: -0.02em
Leading: 1.1
```

Headline text (two lines, staggered entrance):
```
The place you're
about to call home.
```

**Subhead** — appears 400ms after headline:
```
DM Sans 17px, weight 400
Color: rgba(255,255,255,0.55)
Max-width: 420px, centered
Leading: 1.6
```
Text: *"The things you'd only learn after living there for two years — handed to you before you sign."*

**Address Input** — appears 700ms after headline:

Not a standard search box. A portal.

```css
/* The input container */
.address-portal {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 12px;
  padding: 6px 6px 6px 20px;
  display: flex;
  align-items: center;
  max-width: 520px;
  width: 100%;
  backdrop-filter: blur(8px);
  transition: border-color 0.3s, box-shadow 0.3s;
}

.address-portal:focus-within {
  border-color: rgba(184,146,42,0.5);
  box-shadow: 0 0 0 4px rgba(184,146,42,0.08),
              0 0 40px rgba(184,146,42,0.12);
}

.address-portal input {
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.92);
  font-family: 'DM Sans', sans-serif;
  font-size: 15px;
  flex: 1;
  outline: none;
  placeholder-color: rgba(255,255,255,0.3);
}

.address-portal button {
  background: var(--gold);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
}

.address-portal button:hover {
  background: var(--gold-dark);
  transform: translateY(-1px);
}
```

**Placeholder text:** `Enter a home address — street, city, state`

**Below the input** — small social proof line, appears last:
```
DM Sans 12px, --hero-text-muted
"Used by homebuyers across the US"
```

**Entrance animation sequence:**
```
0ms:    Page loads — all content invisible
200ms:  Grain texture fades in (opacity 0 → 0.4, 800ms)
400ms:  Headline line 1 slides up from 20px below, fades in (600ms ease-out)
600ms:  Headline line 2 slides up from 20px below, fades in (600ms ease-out)
900ms:  Subhead fades in (500ms)
1100ms: Address portal slides up, fades in (500ms)
1400ms: Social proof fades in (400ms)
```

**Scroll indicator** — at the bottom of the hero, a subtle animated chevron or "EXPLORE ↓" in DM Sans 11px uppercase, --hero-text-muted, gentle bounce animation. Disappears on first scroll.

### Below the Hero — "What Livably Shows You"

Dark fades to cream. Three columns, each representing a dimension of the report:

```
THE PLACE        THE DAY TO DAY      THE FUTURE
───────────      ──────────────      ──────────
Your yard.       3 min to the        Zone X — flood
Your soil.       nearest ER.         insurance not
Your wildlife.   8 min to I-75.      required here.
```

Each column has:
- A small icon (line art, not emoji)
- A short evocative title in Fraunces
- 2-3 lines of sample findings in DM Sans
- Entrance: staggered fade-in as they enter viewport (Intersection Observer)

### Sample Report Preview
A partial screenshot or mockup of a report section — enough to show the quality without revealing everything. Slight tilt (2-3 degrees), subtle shadow, parallax on scroll. Caption: *"Generated for any US address in under 60 seconds."*

### CTA Section
Dark again. Centered. Simple.

```
Fraunces 42px: "Ready to know your new neighborhood?"
DM Sans 16px subhead
Gold button: "Enter your address →"
```

---

## The Report — Overall Structure

### Loading State
After address submission, don't show a generic spinner. Show something that feels like discovery:

```
A dark screen with the address displayed in Fraunces
Below it, a subtle animated progress bar in gold
Rotating text (one at a time, 2s each):
  "Checking your flood zone..."
  "Finding the nearest emergency room..."
  "Identifying native plants for your yard..."
  "Calculating 8am Tuesday drive times..."
  "Locating nearby schools..."
```

This loading experience sets the tone. It tells the buyer: "something real is being built for you."

### Report Header
**Sticky. Dark. Minimal.**

```
Left: Liv[ably] logo — small, 20px
Center: Address in DM Sans 13px, --hero-text-muted (truncated if long)
Right: "Download PDF" — subtle outline button
```

Scrolls with the page but becomes transparent when at the top, gains background and shadow on scroll (CSS scroll-driven animation or JS scroll listener).

### Hero Block
**The first thing they see after loading. Make it land.**

Full-width. Cream background. Large address display.

```
LIVABLY REPORT                    [Research date: May 22, 2026]
─────────────────────────────────────────────────────────────

100 Wishing Well Path              ← Fraunces 52px, --ink
Unit 2306                          ← Fraunces 36px, --ink-50
Georgetown, KY 40324               ← DM Sans 18px, --ink-50
```

Below the address — the **At a Glance** block (5 key insights). These are not cards. They are moments.

Each insight animates in sequentially (150ms stagger) as the page loads:

```
┌─────────────────────────────────────────────────────┐
│  ✓ THINGS TO KNOW                                   │
│  Zone X — flood insurance not required              │
│                                    ──────────────── │
│  ⚠ THINGS TO CHECK                                  │
│  Radon Zone 1 — test before closing                 │
│                                    ──────────────── │
│  ✓ THINGS TO KNOW                                   │
│  I-75 is 11 min away                                │
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

Each insight row:
- Left: bucket icon (checkmark for Cool/Know, warning triangle for Check, info for Consider)
- Bucket label in DM Sans 10px uppercase, colored by bucket type
- Finding text in DM Sans 15px, --ink
- Thin divider between rows
- Hover state: subtle gold left border appears, row background shifts to --gold-light

### The Map
**Not a utility. A orientation.**

Full-width, height 60vh minimum. The map is the buyer's first look at their new neighborhood from above.

Map style: Custom styled Google Maps or Mapbox — muted, warm tones. Roads in --parchment. Parks in --forest-light muted. Water in cool blue-gray. Labels minimal, only major roads named. No default Google blue.

Category filter pills float above the map bottom edge:
```
[ All ] [ Schools ] [ Healthcare ] [ Grocery ] [ Coffee ] [ Parks ]
```

Pills: DM Sans 12px, pill shape, white background, --ink-20 border. Selected: --gold background, white text. Transition: 200ms smooth.

Map markers: Custom SVG pins, not default Google teardrops.
- Healthcare: soft red circle with + 
- Schools: slate blue with graduation cap
- Grocery: forest green with shopping bag
- Coffee: warm brown with cup
- Parks: forest green with leaf

Markers drop in with a subtle bounce (CSS animation) as the map loads, staggered by category.

**Summary card** (floats top-left over the map on desktop, above map on mobile):

```css
.map-summary-card {
  background: white;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.12);
  max-width: 240px;
}
```

Contents:
- "Livably" in Fraunces 14px --gold
- Address in DM Sans 13px bold
- City/state in DM Sans 12px --ink-50
- 4 key stats with icons: Coffee nearby, Groceries, Walkability, Nearest school
- Each stat: icon + label in 11px uppercase + value in 14px bold

### Chapter Cards — The Core Experience

Each chapter is a card. But not a flat card. A **world**.

**Card anatomy:**
```
┌──────────────────────────────────────────────┐
│ CHAPTER LABEL (small caps, chapter color)    │
│ Chapter Title in Fraunces 32px               │
│                                              │
│ Chapter intro — 2-3 sentences of narrative   │
│ in DM Sans 16px, --ink-80, leading 1.7       │
│                                              │
│ ──────────────────────────────────────────── │
│                                              │
│ [Section content — varies by chapter]        │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ 🔑 Key Takeaway                          │ │
│ │ The single most important thing to know  │ │
│ │ from this chapter, in Fraunces italic    │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ [Source attribution — 11px, --ink-40]        │
└──────────────────────────────────────────────┘
```

**Card entrance animation:**
Cards start invisible and slightly translated down (30px). As they enter the viewport (Intersection Observer, 10% threshold), they animate:
```css
@keyframes cardReveal {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
/* Duration: 600ms, easing: cubic-bezier(0.16, 1, 0.3, 1) */
```

**Card left border accent:**
Each chapter gets its accent color as a 3px left border on the chapter header section, with a very subtle matching tint on the header background.

---

## Chapter-by-Chapter Design Treatment

### What Daily Life Looks Like Here
*Character: Warm, practical, reassuring*

This is the chapter that makes the buyer exhale. Everything is close. Everything is manageable. Life here is effortless.

**Visual treatment:**
- Subsections (Daily Conveniences, Peace of Mind, Getting Around) separated by thin --ink-20 rules
- Data rows: destination type label (GROCERY, PHARMACY) in 10px uppercase --ink-50, name in 14px bold, drive time in 18px bold --teal, right-aligned
- Drive time numbers animate as counters (count up from 0 to final value over 800ms) when section enters viewport — this makes every "3 min" feel like a reveal
- Subtle connecting line or timeline motif between the three subsections

**The moment:** The drive time counter animation. Watching "0 → 3 min" for the grocery store is delightful every time.

---

### Daily Reachability
*Character: Precise, comprehensive, trustworthy*

The grid of destinations. This is where the buyer builds their mental map of daily life.

**Visual treatment:**
- Two-column grid on desktop, single column mobile
- Each destination card: subtle border, white background, destination icon top-left
- Drive time displayed large (24px bold, --teal) with "min" in 12px --ink-50
- Grocery section: 3 stores stacked with thin dividers, presented as a list of options not just one answer
- Highway section: interstate number displayed large (like a highway shield), "Also within 20 min:" in smaller text below
- School section: "Things to Check" badge in rust on the assignment disclaimer

**The moment:** The highway shield visual for I-75 and I-64. Small detail, huge character.

---

### Traffic Patterns
*Character: Informative, surprising, data-forward*

This section has the best data story in the report — drive times don't change much here. The bars prove it.

**Visual treatment:**
- Progress bars animate left-to-right when section enters viewport (600ms, staggered 100ms per bar)
- Bar color: --teal gradient (darker at right end)
- "Best" badge: small pill, --forest-light background, --forest text
- Time labels animate as counters simultaneously with bar animation
- Section feels like a dashboard — clean, technical, satisfying

**The moment:** All the bars being the same length and all saying "Best." That's the payoff.

---

### Schools & Education
*Character: Careful, action-oriented, parent-focused*

Parents will read every word of this section. The design should honor that gravity.

**Visual treatment:**
- Warning banner (nearest ≠ assigned) at top: amber left border, --amber-light background, not alarming but impossible to miss
- School listings: each level (Elementary, Middle, High) gets its own sub-card
- Distance and drive time both shown (distance for proximity context, drive time for reality)
- Private schools: compact list with checkmarks, italic "contact for enrollment" note
- Action checklist: numbered items, each with an icon, generous line height — this is meant to be printed or screenshotted
- Key Takeaway: prominent, centered, Fraunces italic

**The moment:** The "4 Questions to Ask Before You Close" checklist. Buyers will screenshot this.

---

### Safety & Emergency Response
*Character: Honest, grounding, practical*

Not alarming. Reassuring. These numbers are good — the design should let them land that way.

**Visual treatment:**
- Response time badges: "Excellent" in --forest pill, "Good" in --teal pill, "Fair" in --amber pill
- Station distance and response time shown side by side
- ISO explanation: collapsible "What is ISO?" section — closed by default, opens with smooth height animation
- Research checklist: same treatment as Schools — numbered, iconed, screenshot-worthy
- Key Takeaway: this one should feel like a deep breath. "Response times are within normal range."

**The moment:** The color-coded response time badges. "Excellent" in green landing next to "~2 min" is immediately reassuring.

---

### Demographics & Community
*Character: Neutral, observational, human*

This section walks the Fair Housing line carefully. The design should feel analytical, not evaluative.

**Visual treatment:**
- Age distribution: horizontal bar chart, bars animate left-to-right on scroll entry
- Bars: gradient from --teal-light to --teal
- Income: single large number ($78,940) in Fraunces 36px, badge below ("Above national median" in --forest pill)
- Education: two numbers side by side, percentage labels in DM Sans uppercase
- Community tags: pill badges, --ink-08 background, --ink text — neutral, factual
- Census tract note: italic, small, clearly attributed

**The moment:** The income number in Fraunces — large, confident, contextual. Not a judgment, just a fact that feels significant.

---

### Growth & Development
*Character: Forward-looking, specific, exciting*

This is where the buyer learns what their neighborhood is becoming.

**Visual treatment:**
- "Confirmed Projects" header with a subtle pulsing dot (like a live indicator) — these are real things happening
- Project cards: name, category, status badge, expected date, narrative
- Status badges: "UNDER CONSTRUCTION" in --rust-light/--rust, "APPROVED" in --forest-light/--forest, "PLANNED" in --amber-light/--amber
- Commercial landscape: compact list with distance, icons by category
- Census new construction stat: displayed as a large percentage with context

**The moment:** "Publix Supermarket — UNDER CONSTRUCTION — Expected Q4 2026." For a buyer, this is genuinely exciting news.

---

### Climate & Weather Risks
*Character: Clear, actionable, not alarming*

Flood zone is the most important finding in the report. The design must make it land.

**Visual treatment:**
- Flood zone: full-width banner at top of chapter. Zone X gets --forest-light with --forest border and a shield icon. Higher risk zones get --amber-light or --rust-light.
- Zone label displayed large: "ZONE X" in Fraunces 28px, "Minimal Risk" in DM Sans below
- Tornado: badge with frequency tier color-coding
- Action checklist: same treatment as Schools/Safety — numbered, specific, screenshot-worthy
- Key Takeaway: pulls the flood zone and tornado together into one confident sentence

**The moment:** The Zone X banner. Green. Shield. "No federally required flood insurance." That's a relief buyers feel physically.

---

### What Will Grow Here
*Character: Alive, optimistic, genuinely unique*

This is Livably's most distinctive section. The design should feel like stepping outside.

**Visual treatment:**
- Chapter accent color: --forest (deep botanical green)
- Background tint: very subtle --forest-light on the chapter card
- Hardiness zone: large badge, "Zone 6b" in Fraunces, temperature range below
- Frost dates: displayed as a simple timeline — spring frost date ←——→ fall frost date, with growing season length between them
- Native plants: each plant gets a name (bold), Latin name (italic, --ink-50), and a one-line description. Left border in --forest. On hover: subtle green background wash
- Invasive species: same treatment but left border in --rust, hover in --rust-light
- Wildlife: free-flowing paragraph, warm and evocative — "White-tailed deer are common... a simple feeder and water source will bring them close"
- Extension office CTA: warm card, --forest-light background, phone number displayed prominently
- Optional: very subtle botanical illustration as background watermark (SVG line art of a leaf or branch, 3% opacity)

**The moment:** The frost date timeline showing "183 growing days." Visual, immediate, meaningful.

---

### Property Intelligence
*Character: Technical, specific, trustworthy*

This is the chapter that makes agents nervous and buyers feel powerful.

**Visual treatment:**
- Construction era: large decade display ("2000s Construction") with inspection implications below
- Soil & drainage badge: "WELL DRAINED" in --forest pill, or "URBAN LAND" in --ink-20 pill
- FCC Broadband: if fallback, show a direct link card with clear CTA
- County assessor: link card with address pre-filled, "One call reveals the full permit history"
- Key Takeaway: frames this as actionable preparation, not a finding

**The moment:** The county assessor card with the direct link. This feels like a secret weapon.

---

### Sensory & Environmental
*Character: Observational, specific, revealing*

What will they hear, see, and breathe at this address?

**Visual treatment:**
- "WHAT YOU'LL HEAR" / "WHAT YOU'LL SEE AT NIGHT" / "WHAT YOU CAN'T SEE" — section dividers in DM Sans uppercase, small, --ink-50
- Airport distance: if within 10 miles, show with a subtle sound wave icon
- Light pollution: Bortle scale shown as a gradient from dark to bright, marker at the address's level — visual, immediate
- AQI: large number ("19") with "Good" in --forest, context sentence below
- Radon: if Zone 1, show with amber warning — specific mitigation cost range
- Dead API fallbacks: styled as action cards, not error messages — "We couldn't confirm water quality data. Check directly →" with a button

**The moment:** The Bortle scale gradient. Seeing your address marked on a dark-to-bright light pollution scale is immediately understandable and memorable.

---

### Walkability / Getting Around on Foot
*Character: Honest, practical, non-judgmental*

Car-dependent is not a verdict. It is a fact about life at this address.

**Visual treatment:**
- Walkability category: large badge. "Car-Dependent" in --ink-08/--ink. "Somewhat Walkable" in --teal-light/--teal. "Very Walkable" in --forest-light/--forest.
- Nearby walkable destinations: compact list with walk time and distance. Walk time in --teal.
- Pedestrian environment: simple checkmark/warning list
- The honest note about car dependency: warm prose, not a warning — "Plan your life around the car, and enjoy the walking for what it is: recreation, not transportation."

**The moment:** The walkability badge. Simple, honest, instantly understood.

---

### Property Costs & Market
*Character: Practical, specific, empowering*

Buyers often don't know what homeownership actually costs per month. This section tells them.

**Visual treatment:**
- Monthly carrying cost table: clean grid, three price tiers, four cost categories
- Numbers in DM Sans tabular nums, large enough to read at a glance
- Row and column highlighting on hover
- Homestead exemption: callout card, --gold-light background, specific dollar amount
- Zillow/Redfin links: styled as neutral external resource links, not CTAs
- Key Takeaway: the total monthly cost number, large, in Fraunces, with the specific breakdown below

**The moment:** "$538/month — before the mortgage." Seeing that number in Fraunces 36px makes it real in a way that a table row never could.

---

## Three-Bucket Visual Language

These must be visually distinct and immediately recognizable throughout the entire report.

### Things to Consider
```css
.bucket-consider {
  border-left: 3px solid var(--amber);
  background: var(--amber-light);
  padding: 12px 16px;
  border-radius: 0 8px 8px 0;
}
.bucket-consider .bucket-label {
  color: var(--amber);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
```
Icon: ℹ️ or custom SVG info circle in --amber

### Things to Check
```css
.bucket-check {
  border-left: 3px solid var(--rust);
  background: var(--rust-light);
  padding: 12px 16px;
  border-radius: 0 8px 8px 0;
}
.bucket-check .bucket-label {
  color: var(--rust);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
```
Icon: ✓ checkbox or custom SVG in --rust

### Cool Things to Know
```css
.bucket-cool {
  border-left: 3px solid var(--teal);
  background: var(--teal-light);
  padding: 12px 16px;
  border-radius: 0 8px 8px 0;
}
.bucket-cool .bucket-label {
  color: var(--teal);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
```
Icon: ✦ or custom SVG spark in --teal

### Key Takeaway
The single most important finding from each chapter. Designed to be screenshot-worthy.

```css
.key-takeaway {
  background: var(--gold-light);
  border: 1px solid rgba(184,146,42,0.2);
  border-radius: 10px;
  padding: 16px 20px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-top: 24px;
}
.key-takeaway .icon {
  font-size: 18px; /* 🔑 */
  flex-shrink: 0;
  margin-top: 2px;
}
.key-takeaway .text {
  font-family: 'DM Sans', sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: var(--ink);
}
.key-takeaway .text strong {
  font-weight: 600;
}
```

---

## Animation Principles

### The Rules
1. **Every animation has a purpose.** If it doesn't make information land harder or guide attention, remove it.
2. **Respect reduced motion.** All animations must respect `prefers-reduced-motion: reduce`.
3. **No loops on content animations.** Entrance animations play once. Only ambient/decorative elements loop.
4. **Fast in, slow out.** Entrance: 400-600ms. Exit (if any): 200ms. Use `cubic-bezier(0.16, 1, 0.3, 1)` for entrances (fast start, gentle settle).
5. **Stagger, don't stack.** Multiple elements entering together: 80-150ms stagger. Never all at once.

### Animation Inventory

**Homepage:**
- Hero text: translateY(20px) → translateY(0) + opacity 0→1, staggered by line
- Address input: same entrance, delayed
- "What Livably Shows" columns: staggered fade-in on scroll entry

**Report loading:**
- Loading screen: rotating status messages, gold progress bar
- Address in Fraunces appears as loading completes

**Report hero:**
- At a Glance insights: staggered entrance, 150ms apart, translateY(16px) → 0

**Drive time counters:**
- Count from 0 to final value over 800ms using easeOut
- Only plays once, when section enters viewport

**Traffic pattern bars:**
- Width animates from 0 to final % over 600ms, staggered 100ms per bar
- Counter animates simultaneously

**Card entrance:**
- All chapter cards: translateY(30px) → 0 + opacity 0→1
- Triggered by Intersection Observer at 10% visibility threshold
- Duration: 600ms, easing: cubic-bezier(0.16, 1, 0.3, 1)

**Map markers:**
- Drop in with a gentle bounce (translateY(-20px) → translateY(0)) when map loads
- Staggered by 80ms per marker

**Flood zone banner:**
- Slides down from -40px when chapter enters viewport
- Special treatment — this is the most important finding

**Bortle scale marker:**
- Slides into position on the gradient bar when section enters viewport

**Native plant cards (What Will Grow Here):**
- Staggered entrance, each plant card fades up with 100ms delay

**Progress bar (loading):**
- Width animates from 0-100% over the actual loading duration
- Gold color, subtle glow

---

## Mobile Design (375px viewport)

**Homepage:**
- Hero headline: clamp(36px, 8vw, 60px) — still large, still impactful
- Address input: full width, button below input (stacked, not inline)
- "What Livably Shows" columns: stacked vertically

**Report:**
- Map: full width, 50vh height, summary card above map (not overlaid)
- Chapter cards: full width, 16px horizontal padding
- Two-column grids (Daily Reachability): collapse to single column
- Drive times: remain large and right-aligned
- Traffic pattern bars: slightly narrower but same treatment
- Key Takeaway: full width, same visual treatment

**Navigation:**
- Sticky header: collapses to logo + "PDF" only on mobile
- Chapter jump links: horizontal scroll pills below the map (optional)

---

## PDF Download

The report should be printable. When "Download PDF" is clicked:
- Print-specific CSS applied
- Dark header becomes ink-efficient (white background, dark text)
- Animations removed
- Map replaced with a static image (screenshot or placeholder)
- Colors preserved where possible, flattened where ink-heavy
- Page breaks before each chapter
- Footer on each page: "Livably Report — [Address] — [Date]"

---

## What to Avoid

**Never:**
- Purple gradients on white (generic AI aesthetic)
- Bouncing, spinning, or looping content animations
- More than 2 typefaces
- Gradient text on body copy
- Shadows heavier than `0 4px 24px rgba(0,0,0,0.12)`
- Borders thicker than 2px
- ALL CAPS for anything longer than 4 words
- Emoji used as primary iconography (only as accent/decoration)
- Generic stock photo imagery
- Alert/warning UI patterns for Things to Consider (too alarming)
- Dark mode (Livably is warm and light — the only dark surface is the hero)

**Be careful with:**
- Gold overuse — it should feel earned, not plastered everywhere
- Animation on text that people need to read quickly
- Mobile tap targets below 44px
- Font sizes below 13px in the report body

---

## Implementation Notes for Claude Code

### File Structure
```
public/
  index.html          ← Homepage (completely redesigned)
  report.css          ← All styles (already extracted)
  animations.css      ← New file: all keyframe animations
  fonts.css           ← New file: Google Fonts imports
src/
  app.js              ← Report route (add loading state)
  premium.js          ← Chapter HTML builders
```

### CSS Architecture
- Use CSS custom properties (already established) for all colors
- Add animation CSS to separate `animations.css` file
- Use `@media (prefers-reduced-motion: reduce)` wrapper for all animations
- Use Intersection Observer for scroll-triggered animations (no GSAP needed)
- CSS-only animations preferred; JS only for counters and complex sequences

### Performance
- Fonts: preconnect to fonts.googleapis.com, load with `display=swap`
- Animations: use `transform` and `opacity` only (GPU-composited, no layout thrash)
- Map: load Google Maps API async, defer non-critical scripts
- Images: use WebP where possible, lazy-load below the fold

### Accessibility
- All animations respect `prefers-reduced-motion`
- Color is never the only signal (icons + text accompany all colored badges)
- Focus states visible and styled (gold ring: `outline: 2px solid var(--gold)`)
- Minimum tap target 44x44px on mobile
- Alt text on all meaningful images

### Browser Support
- Chrome, Safari, Firefox, Edge — last 2 versions
- No IE11 support needed
- CSS Grid and Custom Properties used freely

---

## The Test

Before calling any design complete, ask:

1. **Does the homepage make you want to enter an address immediately?**
2. **Does the loading screen make the wait feel like anticipation rather than frustration?**
3. **Does reading the At a Glance block feel like opening a letter?**
4. **Do the drive time counters make you smile?**
5. **Does the What Will Grow Here section make you want to go outside?**
6. **Does the flood zone result land with appropriate weight — relief if Zone X, clarity if not?**
7. **Would a buyer screenshot the Key Takeaway from any chapter?**
8. **Does the whole report feel like it was made for THIS ADDRESS — not a template filled in?**

If any answer is no — keep going.

---

*This brief is the creative law for all Livably design work. Every decision is made in service of the buyer's emotional arc: intrigue → discovery → confidence. If a design choice doesn't serve that arc, it doesn't belong.*

