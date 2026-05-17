# FR-003 — Extract Design System to CSS File

## What
Move all styles out of the `REPORT_STYLES` constant in `app.js` into a standalone `public/report.css` file. The report HTML will link to it as an external stylesheet.

## Why
- Design changes should not require touching app logic
- Designers or collaborators can work on CSS independently
- Easier to iterate on the visual design without risking data logic
- Prepares for future theming or white-labeling

## Requirements
- Create `public/report.css` with all current styles from `REPORT_STYLES`
- Remove `REPORT_STYLES` constant from `app.js`
- Remove `FONT_LINKS` constant from `app.js`
- Report HTML `<head>` links to `/report.css` and Google Fonts via `<link>` tags
- All existing styles work identically after the move
- No visual change to the rendered report

## Acceptance Criteria
- Report renders identically before and after
- `app.js` contains zero CSS
- `public/report.css` contains all styles
- Tested on Georgetown, rural, and urban addresses
