# FR-001 — Chapter 03 Design

## What
Apply the Livably design system to the Chapter 03 report output. Replace plain HTML with styled report matching `reference/livably_report_georgetown_v4.html`.

## Requirements
- Fraunces + DM Sans Google Fonts
- Dark ink header (#1a1a1a) with Livably logo (gold accent on "ably")
- Address hero block: street address + city/state + research date. No score, no ring.
- Chapter 03 rendered as a styled card
- Grocery section: 3 stores in clean sub-list
- All drive times formatted as "X min" not "X minutes"
- Three-bucket labels where applicable (Things to Consider / Things to Check / Cool Things to Know)
- Mobile-first, max-width 480px
- Cream background (#faf8f4), white cards, gold accents
- Footer: research date, address, legal line
- "Back to address form" link styled as subtle text link

## Acceptance Criteria
- Report looks like reference HTML (minus scoring ring)
- Renders correctly on mobile viewport (375px)
- All 6 Chapter 03 destinations display with correct styling
- No inline styles — use a `<style>` block with CSS variables

## Not In Scope
- Other chapters
- Collapsible front matter (FR-003)
- Address input form redesign (FR-012)
