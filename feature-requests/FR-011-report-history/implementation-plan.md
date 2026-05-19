# FR-011 — Report History: Implementation Plan

## Approach

Browser localStorage (Option 1). No backend changes beyond a `/history` route and a save script injected into the report page.

## Files changed

- `public/history.html` — new static history page
- `public/index.html` — recent searches section + footer links
- `src/app.js` — `/history` route + `saveHistoryScriptHTML` injected into `buildReportHTML`
- `public/report.css` — history page + recent searches + footer link styles

## Key decisions

- **No scores** — not stored or displayed; history items show address + date only
- **IIFE, not `window.addEventListener('load')`** — report HTML is injected via DOM swap by the loading page; an IIFE fires when `reExecScripts` re-executes scripts, whereas a `load` listener won't re-fire
- **`JSON.stringify(address).replace(/</g, '\\u003c')`** — safe JS string embedding; handles apostrophes, quotes, and `</script>` injection
- **`/history` route** — `res.sendFile` on `public/history.html`; static middleware won't serve `.html` files at the bare path
