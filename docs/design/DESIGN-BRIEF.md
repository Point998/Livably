# Livably — Creative Design Brief v2.0
*Updated May 2026 — Full redesign with eclectic living color system*
*For Claude Code execution with frontend-design, ui-design, interaction-design plugins*

> **Status: FE-phase design-system source of truth — not current backend guidance.**
> The Livably backend is headless: it emits a versioned report contract
> (`GET /api/report.json`; see `src/contract/` and `docs/IMPLEMENTATION_ROADMAP.md`).
> This brief defines the visual identity for the **standalone frontend**, built in a
> later, dedicated design phase (SSG-per-report) that consumes the contract. It is also
> the design-system source Claude Design imports from this repo. Relocated from repo
> root to `docs/design/` June 2026. See `SKETCH-SPEC.md` for the companion animation spec.

---

## The Core Creative Idea

**Livably is not a data tool. It is a journey of discovery.**

The report IS the community. The report IS the place. Every section reflects the character of what it covers — not flattened into a single brand palette, but alive with the energy of the subject matter itself. Health & Safety feels different from What Will Grow Here. Traffic feels different from Community. Because they ARE different. That's the point.

The design must feel like stepping into a place for the first time — curious, alive, full of character. The buyer should feel the same mix of excitement and wonder they feel driving through a new area thinking "what is this place?"

**The emotional arc:**
1. **Intrigue** — "What will this tell me?"
2. **Discovery** — "I didn't know this existed"
3. **Belonging** — "I can already picture my life here"

---

## Design Philosophy

### The Report IS the Place
Each chapter has its own color identity drawn from what it covers. Not random. Not jarring. Genuinely expressive of its subject. The typography, spacing, and layout hold everything together as unmistakably Livably — but the color and visual treatment celebrates the unique character of each dimension of life at this address.

### Eclectic but Cohesive
Wide open to color and expression. Sophisticated but full of life. Like the area itself — it is what it is, and you learn to love all it offers. The report reflects that energy rather than flattening it into beige.

### Reveal, Don't Display
Information is revealed as you scroll — not dumped. Each section is a moment. Each data point is a gift. The reader should feel rewarded for continuing to scroll.

### Use the Screen
Full width on desktop. Two-column layouts. Large typographic moments. The report should feel like an editorial magazine spread on a big screen — not a mobile app stretched to desktop.

### Delight Without Excess
Animation exists to make information land harder. One bold visual element per chapter. Everything else is quiet so the bold moment hits.

---

## Typography System

### Display: Fraunces (Google Fonts)
The soul of Livably. Warm, literary, unexpected. Carries weight without heaviness.

```
Hero address:        clamp(48px, 5vw, 80px), weight 300, optical display
Chapter numbers:     140px, weight 300, opacity 0.06, decorative background
Chapter titles:      clamp(36px, 3vw, 52px), weight 500-600
Section headings:    28px, weight 500
Pull quotes:         20-22px, weight 300, italic, leading 1.6
Logo:                28px, "Liv" in --ink, "ably" in chapter accent color
```

### Body: DM Sans (Google Fonts)
Clean, warm, highly legible. Never competes with Fraunces.

```
Body text:           16px, weight 400, leading 1.7, max 68ch line length
Data labels:         11px, weight 600, letter-spacing 0.08em, ALL CAPS
Drive times/numbers: 18-48px, weight 700, tabular nums (varies by context)
Large data moments:  48-64px, weight 700, tabular nums
Footnotes/sources:   11px, weight 400, muted color
Navigation:          13px, weight 500, letter-spacing 0.05em
```

### UI Icons: Lucide (CDN)
```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
```
Use for: navigation arrows, checkmarks, warning icons, download, share.
Size: 16-20px for inline, 24px for section icons.

### Chapter Icons: Custom SVG (inline)
Each chapter gets a unique hand-crafted SVG icon — line art style, 2px stroke, rounded caps. These are NOT emoji replacements. They are distinct visual anchors for each chapter.

---

## The Eclectic Living Color System

### Core (always present)
```css
--ink:        #1a1a1a;   /* Primary text */
--ink-60:     #666260;   /* Secondary text */
--ink-30:     #b0adaa;   /* Muted, labels */
--ink-10:     #e8e5e0;   /* Dividers */
--ink-04:     #f5f3f0;   /* Subtle backgrounds */
--white:      #ffffff;   /* Pure white */
--page:       #f8f6f2;   /* Page background — warm off-white */
```

### Homepage / Dark surfaces
```css
--dark:       #0f1a0f;   /* Deep forest dark — the portal */
--dark-mid:   #1a2e1a;   /* Mid dark green */
--dark-text:  rgba(255,255,255,0.92);
--dark-muted: rgba(255,255,255,0.45);
--dark-border:rgba(255,255,255,0.08);
```

### Chapter Color Identities
Each chapter has a primary color, a light tint, and a text-on-tint color.

```css
/* 01 — Health & Safety */
--ch-health:       #1e3a5f;   /* Deep confident blue */
--ch-health-light: #e8f0f8;
--ch-health-text:  #1e3a5f;

/* 02 — What Daily Life Looks Like */
--ch-daily:        #c47c1a;   /* Warm amber/ochre — morning light */
--ch-daily-light:  #fdf4e3;
--ch-daily-text:   #8a5510;

/* 03 — Daily Reachability */
--ch-reach:        #2d5a8e;   /* Clean slate/navy — maps, precision */
--ch-reach-light:  #e8f0f8;
--ch-reach-text:   #2d5a8e;

/* Traffic Patterns */
--ch-traffic:      #0e7c7b;   /* Electric teal — movement, flow */
--ch-traffic-light:#e0f5f5;
--ch-traffic-text: #0e7c7b;

/* Schools & Education */
--ch-school:       #3d7a4f;   /* Sage green — growth, potential */
--ch-school-light: #e8f4ec;
--ch-school-text:  #2a5535;

/* Safety & Emergency */
--ch-safety:       #c04a2e;   /* Bold terracotta — urgency without alarm */
--ch-safety-light: #fdf0ed;
--ch-safety-text:  #8a2e1a;

/* Demographics & Community */
--ch-community:    #7b4f8a;   /* Warm plum — people, texture, diversity */
--ch-community-light:#f4eef7;
--ch-community-text: #5a3566;

/* Growth & Development */
--ch-growth:       #e05c1a;   /* Vivid orange — energy, momentum */
--ch-growth-light: #fef0e6;
--ch-growth-text:  #a03d0a;

/* Climate & Weather */
--ch-climate:      #3d5a7a;   /* Storm blue-grey — sky, weather */
--ch-climate-light:#eaeff5;
--ch-climate-text: #2a3f55;

/* What Will Grow Here */
--ch-garden:       #2d6b3d;   /* Deep botanical green — earth, life */
--ch-garden-light: #e8f4ec;
--ch-garden-text:  #1a4525;

/* Property Intelligence */
--ch-property:     #4a3f35;   /* Warm charcoal — structural, solid */
--ch-property-light:#f0ece8;
--ch-property-text: #2a221a;

/* Sensory & Environmental */
--ch-sensory:      #4a2d7a;   /* Dusk purple/violet — atmosphere, night */
--ch-sensory-light:#f0eaf8;
--ch-sensory-text: #2d1a4f;

/* Walkability */
--ch-walk:         #d45c3d;   /* Coral/salmon — movement, feet on pavement */
--ch-walk-light:   #fdf0ed;
--ch-walk-text:    #8a2e1a;

/* Property Costs */
--ch-costs:        #1a6b6b;   /* Deep teal — financial clarity */
--ch-costs-light:  #e0f5f5;
--ch-costs-text:   #0a4040;
```

### Three-Bucket Colors (consistent across all chapters)
```css
--bucket-check:        #c04a2e;   /* Things to Check — rust */
--bucket-check-light:  #fdf0ed;
--bucket-consider:     #c47c1a;   /* Things to Consider — amber */
--bucket-consider-light:#fdf4e3;
--bucket-cool:         #2d6b3d;   /* Cool Things to Know — forest */
--bucket-cool-light:   #e8f4ec;
```

---

## Layout & Screen Real Estate

### The Problem Solved
No more narrow column. The report uses the full screen on every device.

### Responsive Breakpoints
```
Mobile:  375px–767px   → single column, 20px padding
Tablet:  768px–1023px  → single column, 40px padding, max 760px
Laptop:  1024px–1279px → two-column where applicable, max 960px
Desktop: 1280px+       → two-column layouts, max 1100px, 48px padding
```

### Desktop Chapter Layout
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [01]  ←── decorative number, 140px Fraunces, 6% opacity   │
│                                                             │
│  Chapter Title (Fraunces 52px)                             │
│  Chapter intro (DM Sans 17px, max 600px)                   │
│                                                             │
│  LEFT COLUMN (62%)          RIGHT COLUMN (38%)             │
│  ──────────────────         ──────────────────             │
│  Narrative text             Key data snapshot              │
│  (DM Sans 16px, 68ch)       Response badges                │
│                             Drive times                    │
│  Action checklist           Key Takeaway card              │
│                                                             │
│  ─────────── SOURCE ATTRIBUTION ──────────────────────     │
└─────────────────────────────────────────────────────────────┘
```

### Full-Width Moments
One per chapter — breaks out of the column completely:
- Flood zone banner (Climate chapter)
- Frost date timeline (Garden chapter)
- Bortle scale gradient bar (Sensory chapter)
- Traffic pattern bars (full width, dramatic)
- Age distribution chart (full width)

### No Cards
Chapters live directly on the page. Separation via:
- 100-120px vertical whitespace between chapters
- 1px full-width rule at chapter end (--ink-10)
- Background alternation (--page → --white → --page)
- Decorative chapter number as visual anchor

---

## Scroll Animations

### Rules
1. Every animation has a purpose — makes information land harder
2. Respect `prefers-reduced-motion`
3. No loops on content (only decorative/ambient elements)
4. Fast in, slow out: cubic-bezier(0.16, 1, 0.3, 1)
5. Stagger multiple elements 80-150ms apart

### Animation Inventory
```
Page load:
  Hero address: translateY(24px)→0 + opacity, staggered per line, 600ms

Scroll entry (Intersection Observer, 10% threshold):
  Chapter titles: translateY(20px)→0 + opacity, 500ms
  Body text: opacity 0→1, 400ms, 100ms delay after title
  Data rows: translateX(-16px)→0 + opacity, staggered 60ms each
  Full-width moments: translateY(16px)→0 + opacity, 500ms

Drive time counters:
  Count 0→final over 800ms easeOut
  Triggers once on scroll entry
  Monospace font during animation for stability

Traffic/data bars:
  Width 0→final% over 700ms, staggered 100ms per bar
  Color fills left to right

Chapter number (decorative):
  Fades in at 6% opacity over 1000ms on chapter entry
  Subtle parallax on scroll (moves at 0.3x scroll speed)

SVG line art icons:
  stroke-dashoffset animation — draws itself on scroll entry
  Duration: 600-800ms per icon

```

---

## Chapter-by-Chapter Design Treatments

### Report Hero
**Full width. Generous. The first impression.**

```
[Livably Report]                    [May 24, 2026]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

100 Wishing Well Path               ← Fraunces 72px
Unit 2306                           ← Fraunces 48px, muted
Georgetown, KY 40324                ← DM Sans 20px, muted

AT A GLANCE ──────────────────────────────────────
[5 insights, staggered entrance, bucket-colored]

[Share this report]                 ← subtle outline button
```

---

### 01 — Health & Safety
**Color: Deep blue (#1e3a5f)**
**SVG Icon: Heartbeat/pulse line**
**Full-width moment: None — let the response badges be the visual anchor**

Two-column desktop:
- Left: ER narrative + action checklist
- Right: Station cards with colored response badges (Excellent=green, Good=teal, Fair=amber)

Response badges are the "wow" — large, colored, impossible to miss.

---

### What Daily Life Looks Like Here
**Color: Warm amber (#c47c1a)**
**SVG Icon: Sun with rays (morning light)**
**Full-width moment: The three subsections (Conveniences, Peace of Mind, Getting Around) as a three-column feature on desktop**

The amber warmth says "morning routine, everyday life." The three-column layout on desktop makes this feel like a lifestyle spread.

---

### Daily Reachability
**Color: Navy/slate (#2d5a8e)**
**SVG Icon: Compass rose**
**Full-width moment: None — the destination grid IS the moment**

Three-column grid on desktop: grocery/pharmacy/hospital in one row, urgent care/highway/school in another. Drive times large (48px), teal, right-aligned. Like a departure board.

---

### Traffic Patterns
**Color: Electric teal (#0e7c7b)**
**SVG Icon: Waveform/signal**
**Full-width moment: The traffic bars — full width, dramatic, animated**

The bars are the whole chapter. Make them large. Animate them on scroll. The "Best" badges should pop in with a slight bounce.

---

### Schools & Education
**Color: Sage green (#3d7a4f)**
**SVG Icon: Graduation cap or open book**
**Full-width moment: The "4 Questions to Ask Before You Close" checklist — full width, centered, screenshot-worthy**

The warning banner (nearest ≠ assigned) should be impossible to miss but not alarming. Sage green border, warm background.

---

### Safety & Emergency Response
**Color: Terracotta (#c04a2e)**
**SVG Icon: Shield**
**Full-width moment: None — response badges carry the visual weight**

Terracotta says urgency without panic. The research checklist should feel action-oriented, not scary.

---

### Demographics & Community
**Color: Warm plum (#7b4f8a)**
**SVG Icon: People/community (3 connected circles)**
**Full-width moment: Age distribution bar chart — full width, animated bars**

The age bars animating in on scroll is the moment. Income displayed as one large number in Fraunces. Plum says "people, texture, warmth."

---

### Growth & Development
**Color: Vivid orange (#e05c1a)**
**SVG Icon: Construction/building outline**
**Full-width moment: Named project cards — full width, status badges prominent**

Orange says energy and momentum. "UNDER CONSTRUCTION" badge in orange is perfect. The commercial landscape list can be compact — the named projects are the star.

---

### Climate & Weather Risks
**Color: Storm blue-grey (#3d5a7a)**
**SVG Icon: Cloud/weather**
**Full-width moment: Flood zone banner — full width, color-coded by risk level**

The flood zone banner is the most important finding in the report. Full width. Zone X gets a calm blue-grey with a shield. Higher risk zones get progressively warmer colors. Can't be missed.

---

### What Will Grow Here
**Color: Deep botanical green (#2d6b3d)**
**SVG Icon: Leaf or seedling (draws itself on scroll)**
**Full-width moment: Frost date timeline — full width, horizontal, animated**

The frost timeline is magical. A horizontal line from spring frost to fall frost, with "183 growing days" displayed large in the middle. Draws itself on scroll entry.

Native plant cards: each plant gets a name, Latin name, and a thin green left border. On hover: background washes to --ch-garden-light.

The botanical green is the most distinctive chapter color in the report. It should feel alive.

---

### Property Intelligence
**Color: Warm charcoal (#4a3f35)**
**SVG Icon: Blueprint/grid**
**Full-width moment: None — the county assessor link card is the moment**

Warm charcoal says "solid, structural, trustworthy." The county assessor link card should feel like a key being handed to the buyer.

---

### Sensory & Environmental
**Color: Dusk purple (#4a2d7a)**
**SVG Icon: Sound waves or eye**
**Full-width moment: Bortle scale gradient — full width, marker animated to position**

The Bortle scale is the most visually distinctive element in the report. A gradient bar from pitch black (left) to white (right), with a marker dropping into position on scroll entry. Dusk purple says "night sky, atmosphere, the invisible."

---

### Getting Around on Foot
**Color: Coral (#d45c3d)**
**SVG Icon: Walking figure**
**Full-width moment: Walkability category badge — oversized, centered**

The walkability badge should be large and honest. "Car-Dependent" in charcoal on coral. "Very Walkable" in white on deep coral. Center it. Let it breathe.

---

### Property Costs & Market
**Color: Deep teal (#1a6b6b)**
**SVG Icon: Dollar sign or balance scale**
**Full-width moment: Monthly carrying cost table — full width, hover states on rows**

The carrying cost table is the most practically useful element for most buyers. Make it scannable. Large numbers. Clear column headers. Hover state highlights the row.

---

## The Report Footer

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

          Liv[ably]                ← Fraunces, gold "ably"

   May 24, 2026 · 100 Wishing Well Path Unit 2306 Georgetown KY

   Drive times estimated via Google Maps for 8am Tuesday.
   Assigned school requires verification with district.
   For informational purposes only.

         [Download PDF]     [← Back to start]
```

---

## What to Avoid

- Narrow centered columns on desktop — use the full screen
- All chapters looking the same — lean into the color differences
- Cards with borders around everything — let whitespace do the separation
- Generic icons (emoji, Font Awesome defaults)
- Purple gradients on white (the cliché AI aesthetic)
- Animations on text people need to read quickly
- More than one "wow moment" per chapter — restraint makes them land harder
- Any reference to the old design system

---

## The 8-Question Test

Before calling any design complete:

1. Does the homepage make you want to enter an address immediately?
2. Does each chapter FEEL like what it covers?
3. Do the drive time counters make you smile?
4. Does the flood zone banner land with appropriate weight?
5. Does What Will Grow Here make you want to go outside?
6. Would a buyer screenshot the Key Takeaway from any chapter?
7. Does the full report feel like it was made for THIS specific address?
8. Does scrolling through feel like exploring a place for the first time?

If any answer is no — keep going.

---

*This is the design-system source of truth for Livably's visual layer (the frontend, and the interim server-rendered report's CSS). All previous design patterns are deprecated. It is not backend build guidance — see the status note at the top of this file.*
*Version 2.0 — May 2026*
