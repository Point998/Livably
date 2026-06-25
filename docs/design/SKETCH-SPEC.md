# The Livably Sketch — Technical & Creative Spec
*The address coming to life as you discover it*
*Addendum to DESIGN-BRIEF.md (same folder)*

> **Status: FE-phase design idea — deferred.** Companion to `DESIGN-BRIEF.md`. Belongs
> to the standalone frontend's dedicated design phase, not the headless backend.
> Relocated from repo root to `docs/design/` June 2026.

---

## The Concept

A hand-drawn sketch of a home that starts as a bare outline and gets filled in as the buyer scrolls through the report. Every chapter adds something new to the drawing — trees, paths, neighbors, stars, plants, clouds. By the time the buyer reaches the bottom, the house that started empty is now a fully realized sketch of a home in its world.

It is not a mascot. It is not a character. It is the address coming to life.

---

## The Emotional Arc

```
Report loads:      A simple house outline appears — just the shape
                   "This is where you're going"

Health & Safety:   A hospital cross appears in the distance
                   A dotted road leads away from the house

Daily Life:        A coffee cup appears near the front door
                   A grocery bag on the doorstep

Daily Reachability: Dotted paths radiate outward in all directions
                   Small destination markers at the ends

Schools:           A small school building appears nearby
                   A dotted walking path connects them

Safety:            A fire station sketch appears
                   A tiny fire truck on the road

Community:         Simple stick figures appear around the house
                   A neighbor waving from next door

Growth:            A construction crane appears in the distance
                   A building going up on the horizon

Climate:           Clouds or sun drawn above the house
                   Rain lines OR sunshine rays depending on flood zone

What Will Grow:    Trees sketch themselves in the yard
                   Flowers appear along the path
                   A garden bed drawn beside the house

Sensory:           Stars drawn above at night
                   Sound wave lines near the road
                   A plane silhouette if airport is nearby

Walkability:       A walking figure on a path from the house
                   Sidewalk lines appear

Property Costs:    A simple coin/dollar near the house
                   Subtle — financial grounding

End of report:     The complete sketch — house in its full world
                   A gentle color wash tints each element
                   Trees get botanical green
                   Sky gets storm blue-grey
                   Yard gets amber warmth
                   The house glows softly gold
```

---

## Visual Style

### Hand-Drawn Aesthetic
The sketch must feel like a child drew it — not a professional illustration. Intentionally imperfect. Wobbly lines. Slightly uneven proportions. The kind of drawing that feels honest and warm.

**Achieving this in SVG:**
- All paths use slight curves even on "straight" lines (control points offset by 2-4px)
- Stroke width varies slightly along paths (use `stroke-width` animation or variable width paths)
- Lines don't perfectly connect at corners — slight overshoot (2-3px past corners)
- Hatching for shadows (parallel wobbly lines, not solid fills)
- Letters if any are hand-lettered style (avoid)

### Stroke Properties
```css
stroke: currentColor;           /* Inherits chapter color context */
stroke-width: 2px;              /* Consistent base weight */
stroke-linecap: round;          /* Rounded ends feel hand-drawn */
stroke-linejoin: round;         /* Rounded joins */
fill: none;                     /* Outline only until color wash */
```

### The Color Wash
At the end of the report, each SVG element gets a subtle fill:
```css
/* Trees/plants — botanical green tint */
.sketch-nature { fill: rgba(45, 107, 61, 0.12); }

/* Sky elements — storm blue */
.sketch-sky { fill: rgba(61, 90, 122, 0.10); }

/* House — warm gold glow */
.sketch-house { fill: rgba(184, 146, 42, 0.08); }

/* Roads/paths — warm charcoal */
.sketch-roads { fill: rgba(74, 63, 53, 0.08); }

/* People — warm plum */
.sketch-people { fill: rgba(123, 79, 138, 0.10); }
```

The wash happens as a CSS transition over 2000ms when the report footer enters the viewport. Gentle. Not a sudden flood of color.

---

## SVG Layer Structure

The entire sketch is ONE SVG file with multiple groups, each group representing a chapter's additions.

```svg
<svg id="livably-sketch" 
     viewBox="0 0 400 500" 
     xmlns="http://www.w3.org/2000/svg"
     class="sketch-container">

  <!-- Layer 0: The House (always visible, loads with report) -->
  <g id="sketch-house" class="sketch-layer sketch-layer--base">
    <!-- Main house shape -->
    <path class="sketch-path" d="..." /> <!-- roof -->
    <path class="sketch-path" d="..." /> <!-- walls -->
    <path class="sketch-path" d="..." /> <!-- door -->
    <path class="sketch-path" d="..." /> <!-- windows (2) -->
    <path class="sketch-path" d="..." /> <!-- chimney -->
    <!-- Ground line -->
    <path class="sketch-path" d="..." />
  </g>

  <!-- Layer 1: Health & Safety -->
  <g id="sketch-health" class="sketch-layer sketch-layer--hidden">
    <path class="sketch-path" d="..." /> <!-- hospital in distance -->
    <path class="sketch-path" d="..." /> <!-- cross symbol -->
    <path class="sketch-path sketch-path--dotted" d="..." /> <!-- road to hospital -->
  </g>

  <!-- Layer 2: Daily Life -->
  <g id="sketch-daily" class="sketch-layer sketch-layer--hidden">
    <path class="sketch-path" d="..." /> <!-- coffee cup near door -->
    <path class="sketch-path" d="..." /> <!-- steam lines -->
    <path class="sketch-path" d="..." /> <!-- grocery bag -->
  </g>

  <!-- Layer 3: Daily Reachability -->
  <g id="sketch-reach" class="sketch-layer sketch-layer--hidden">
    <path class="sketch-path sketch-path--dotted" d="..." /> <!-- path N -->
    <path class="sketch-path sketch-path--dotted" d="..." /> <!-- path S -->
    <path class="sketch-path sketch-path--dotted" d="..." /> <!-- path E -->
    <path class="sketch-path sketch-path--dotted" d="..." /> <!-- path W -->
    <circle class="sketch-marker" cx="..." cy="..." r="3" /> <!-- destination dots -->
    <circle class="sketch-marker" cx="..." cy="..." r="3" />
    <circle class="sketch-marker" cx="..." cy="..." r="3" />
  </g>

  <!-- Layer 4: Schools -->
  <g id="sketch-school" class="sketch-layer sketch-layer--hidden">
    <path class="sketch-path" d="..." /> <!-- school building -->
    <path class="sketch-path" d="..." /> <!-- school flag -->
    <path class="sketch-path sketch-path--dotted" d="..." /> <!-- walking path -->
  </g>

  <!-- Layer 5: Safety & Emergency -->
  <g id="sketch-safety" class="sketch-layer sketch-layer--hidden">
    <path class="sketch-path" d="..." /> <!-- fire station -->
    <path class="sketch-path" d="..." /> <!-- fire truck (simple) -->
  </g>

  <!-- Layer 6: Community -->
  <g id="sketch-community" class="sketch-layer sketch-layer--hidden">
    <path class="sketch-path" d="..." /> <!-- neighbor house -->
    <path class="sketch-path" d="..." /> <!-- stick figure 1 -->
    <path class="sketch-path" d="..." /> <!-- stick figure 2 (waving) -->
  </g>

  <!-- Layer 7: Growth & Development -->
  <g id="sketch-growth" class="sketch-layer sketch-layer--hidden">
    <path class="sketch-path" d="..." /> <!-- crane -->
    <path class="sketch-path" d="..." /> <!-- building outline -->
    <path class="sketch-path" d="..." /> <!-- scaffolding lines -->
  </g>

  <!-- Layer 8: Climate (conditional — sun OR clouds+rain) -->
  <g id="sketch-climate-clear" class="sketch-layer sketch-layer--hidden">
    <path class="sketch-path" d="..." /> <!-- sun circle -->
    <path class="sketch-path" d="..." /> <!-- sun rays (8) -->
  </g>
  <g id="sketch-climate-rain" class="sketch-layer sketch-layer--hidden">
    <path class="sketch-path" d="..." /> <!-- cloud 1 -->
    <path class="sketch-path" d="..." /> <!-- cloud 2 -->
    <path class="sketch-path" d="..." /> <!-- rain lines -->
  </g>

  <!-- Layer 9: What Will Grow Here -->
  <g id="sketch-garden" class="sketch-layer sketch-layer--hidden">
    <path class="sketch-path" d="..." /> <!-- tree left -->
    <path class="sketch-path" d="..." /> <!-- tree right -->
    <path class="sketch-path" d="..." /> <!-- garden bed -->
    <path class="sketch-path" d="..." /> <!-- flowers (3) -->
    <path class="sketch-path" d="..." /> <!-- bush -->
  </g>

  <!-- Layer 10: Sensory & Environmental -->
  <g id="sketch-sensory" class="sketch-layer sketch-layer--hidden">
    <path class="sketch-path" d="..." /> <!-- stars (5-7) -->
    <path class="sketch-path" d="..." /> <!-- moon crescent -->
    <path class="sketch-path" d="..." /> <!-- sound waves near road -->
    <!-- Conditional: plane silhouette if airport nearby -->
    <path class="sketch-path sketch-path--conditional-airport" d="..." />
  </g>

  <!-- Layer 11: Walkability -->
  <g id="sketch-walk" class="sketch-layer sketch-layer--hidden">
    <path class="sketch-path" d="..." /> <!-- sidewalk lines -->
    <path class="sketch-path" d="..." /> <!-- walking figure -->
    <path class="sketch-path" d="..." /> <!-- footsteps -->
  </g>

  <!-- Layer 12: Property Costs -->
  <g id="sketch-costs" class="sketch-layer sketch-layer--hidden">
    <path class="sketch-path" d="..." /> <!-- simple coin/dollar -->
    <!-- Subtle, small, near the house base -->
  </g>

  <!-- Layer 13: Color wash (triggered at footer) -->
  <g id="sketch-color-wash" class="sketch-layer sketch-layer--hidden">
    <!-- Filled versions of key elements, low opacity -->
    <path class="sketch-fill sketch-nature" d="..." /> <!-- tree fills -->
    <path class="sketch-fill sketch-house" d="..." />  <!-- house fill -->
    <path class="sketch-fill sketch-sky" d="..." />    <!-- sky fill -->
  </g>

</svg>
```

---

## The Draw Animation

Each layer uses SVG stroke-dashoffset animation — the classic "draws itself" technique.

```javascript
// Calculate total path length for each path in a layer
function prepareLayer(layerEl) {
  const paths = layerEl.querySelectorAll('.sketch-path');
  paths.forEach(path => {
    const length = path.getTotalLength();
    path.style.strokeDasharray = length;
    path.style.strokeDashoffset = length; // fully hidden
  });
}

// Animate a layer drawing itself in
function drawLayer(layerEl, delay = 0) {
  const paths = layerEl.querySelectorAll('.sketch-path');
  layerEl.classList.remove('sketch-layer--hidden');
  
  paths.forEach((path, index) => {
    const length = path.getTotalLength();
    const duration = Math.max(400, length * 2); // longer paths take longer
    
    setTimeout(() => {
      path.style.transition = `stroke-dashoffset ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
      path.style.strokeDashoffset = '0';
    }, delay + (index * 120)); // stagger each path 120ms
  });
}

// Intersection Observer for each chapter
const chapterLayerMap = {
  'chapter-health':    'sketch-health',
  'chapter-daily':     'sketch-daily',
  'chapter-reach':     'sketch-reach',
  'chapter-school':    'sketch-school',
  'chapter-safety':    'sketch-safety',
  'chapter-community': 'sketch-community',
  'chapter-growth':    'sketch-growth',
  'chapter-climate':   'sketch-climate-clear', // or sketch-climate-rain
  'chapter-garden':    'sketch-garden',
  'chapter-sensory':   'sketch-sensory',
  'chapter-walk':      'sketch-walk',
  'chapter-costs':     'sketch-costs',
  'report-footer':     'sketch-color-wash',
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const chapterId = entry.target.id;
      const layerId = chapterLayerMap[chapterId];
      if (layerId) {
        const layer = document.getElementById(layerId);
        if (layer && !layer.classList.contains('sketch-drawn')) {
          drawLayer(layer);
          layer.classList.add('sketch-drawn'); // don't redraw
        }
      }
      observer.unobserve(entry.target); // only trigger once
    }
  });
}, { threshold: 0.15 });

// Observe all chapter sections
Object.keys(chapterLayerMap).forEach(id => {
  const el = document.getElementById(id);
  if (el) observer.observe(el);
});
```

---

## Positioning

### Desktop
The sketch lives in a **fixed sidebar** on the right side of the screen, outside the main content column:

```css
.sketch-container {
  position: fixed;
  right: 48px;
  top: 50%;
  transform: translateY(-50%);
  width: 200px;
  height: 250px;
  opacity: 0.85;
  pointer-events: none; /* doesn't interfere with clicks */
  z-index: 10;
}

/* Fade in when report loads */
.sketch-container.sketch-visible {
  animation: sketchAppear 1000ms ease forwards;
}

@keyframes sketchAppear {
  from { opacity: 0; transform: translateY(-50%) scale(0.95); }
  to   { opacity: 0.85; transform: translateY(-50%) scale(1); }
}
```

Only shows when viewport is wide enough to accommodate it without overlapping content:
```css
@media (max-width: 1400px) {
  .sketch-container { display: none; }
}
```

### Tablet / Narrow Desktop
Hidden entirely — the sketch doesn't work at narrow widths.

### Mobile
A smaller version (120x150px) appears as a **decorative element between sections** — not fixed, inline. Each chapter section ends with its sketch layer drawn inline, building up as the user scrolls. Less sophisticated than the desktop version but still present.

---

## The House SVG — Base Drawing

The house should feel like the first thing a 7-year-old draws when asked to draw a house. Classic peaked roof, square walls, centered door, two windows, a chimney.

Key imperfections to build in:
- The roof peak is very slightly off-center (3px)
- The left wall is 1px longer than the right
- The door is slightly wider at the bottom than top
- Window panes have one line that doesn't quite reach the corner
- Chimney leans very slightly (2 degree rotation)
- Ground line has a gentle wave (not perfectly flat)

These are invisible at a glance but give it that hand-drawn warmth when you look closely.

---

## Conditional Elements

Some sketch elements depend on report data:

**Climate layer:** 
- Zone X (minimal risk) → sun with rays
- Zone A/AE (high risk) → dark clouds + rain lines
- Moderate risk → partly cloudy (sun partially behind cloud)

**Sensory layer:**
- Airport within 10 miles → plane silhouette in sky
- No nearby airport → no plane
- Rail within 3 miles → tiny train on horizon

**Garden layer (seasonal tint on color wash):**
- Zone 5 or below → sparse trees, bare branches suggested
- Zone 6-7 → full trees, flowers
- Zone 8+ → lush, tropical suggestion, extra plants

**Community layer:**
- High owner-occupancy (70%+) → two neighbor houses visible
- Lower owner-occupancy → one neighbor house, more distant

---

## Accessibility

```css
/* Hide from screen readers — purely decorative */
.sketch-container {
  aria-hidden: true;
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .sketch-path {
    transition: none !important;
    stroke-dashoffset: 0 !important; /* show all layers immediately */
  }
  .sketch-layer--hidden {
    display: none; /* layers appear instantly as chapters load */
  }
}
```

---

## Implementation Notes for Claude Code

1. **Build the base house SVG first** — get the wobbly hand-drawn style right before adding layers
2. **Test the draw animation** on the house before building all 13 layers
3. **The sketch lives in public/sketch.js** — separate file, loaded after report renders
4. **The SVG lives in public/sketch.svg** — loaded inline via fetch and injected into the DOM
5. **Chapter IDs must match** the chapterLayerMap exactly — coordinate with chapter HTML builders in premium.js
6. **The color wash is the finale** — save it for last, test it thoroughly
7. **Don't over-perfect the paths** — imperfection is the point. Slightly wobbly > perfectly smooth

---

## The "Wow" Moment

A buyer scrolling through a property report does not expect a hand-drawn sketch of their new home to be coming to life in the corner of the screen.

When they notice the trees appearing around the house as they read about native plants — that's the moment. That's when Livably stops being a report and becomes something they've never experienced before.

That moment is worth building carefully.

---

*The Sketch is Livably's signature. Nothing else in real estate intelligence has this.*
*Spec v1.0 — May 2026*
