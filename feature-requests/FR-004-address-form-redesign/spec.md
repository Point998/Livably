# FR-004 — Address Input Form Redesign

## What
Replace the plain `public/index.html` form with a styled Livably-branded address entry page.

## Requirements
- Livably logo (Fraunces serif, gold "ably") centered or top-left
- Single address input field, full width, clean styling
- Submit button styled with gold accent
- Tagline below logo: "The things you'd only learn after living there for two years."
- Matches report design system (same fonts, colors, cream background)
- Mobile-first, max-width 480px
- On submit, navigates to `/report?address=...`
- Placeholder text: "Enter a home address"
- No extra fields, no clutter

## Acceptance Criteria
- Page looks like it belongs with the report
- Works on mobile (375px viewport)
- Address submits correctly and opens the report
- Tested with a real address end-to-end
