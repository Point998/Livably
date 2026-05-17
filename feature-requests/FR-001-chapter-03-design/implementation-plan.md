# FR-001 Implementation Plan

## Tasks

### 1. Add design system to report route
- Add Google Fonts link (Fraunces + DM Sans)
- Define CSS variables for all colors
- Set base body styles (font, background, max-width)

### 2. Build header component
- Dark ink background
- Livably logo in Fraunces serif, gold "ably"
- "Standard Report" badge

### 3. Build address hero block
- Street address in large Fraunces serif
- City/state in smaller DM Sans
- Research date
- No score, no ring

### 4. Build chapter card component
- White card with subtle shadow
- Chapter number + title
- Gold left border accent
- Content area for findings

### 5. Style Chapter 03 destinations
- Grocery: 3-store sub-list with dividers
- Each destination: name bold, address muted, drive time prominent
- Highway note in italic
- School disclaimer in italic

### 6. Build footer
- Livably branding
- Research date + address
- Legal disclaimer text

### 7. Test
- Georgetown address: `100 Wishing Well Path Unit 2306 Georgetown, KY 40324`
- Rural address: `456 Rural Route 1, Harlan, KY 40831`
- Urban address: `123 Main St, Louisville, KY 40202`
- Check mobile viewport at 375px

## Risks
- Inline HTML generation in app.js will get long — consider splitting into a template function
