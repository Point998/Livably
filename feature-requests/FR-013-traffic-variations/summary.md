# FR-013 — Traffic Variations: Summary

## What was built

A "Traffic Patterns" card on every report page showing how drive times shift across four time slots: 8am Mon (morning rush), 12pm Mon (midday), 5pm Mon (evening rush), and 10am Sat (weekend). A CSS bar chart visualizes the variation per destination, color-coded from green (fastest) to red (slowest), with Best/Worst tags on the extreme rows and a stats line showing average and range. A "High variation" warning appears when the range exceeds 10 minutes.

Traffic analysis runs for grocery store, hospital, and any custom destination of type "Work."

## Changes

**`src/app.js`**
1. `getNextDayAt(targetDay, hour)` — generic future-timestamp helper (0=Sun…6=Sat), always returns a time at least 30 min in the future.
2. `getTrafficVariations(originLatLng, destLocation)` — fires 4 parallel Distance Matrix calls (one per departure time) via `Promise.allSettled`; returns `{ variations, stats: { min, max, avg, range } }` or `null` on total failure.
3. `buildTrafficItemHTML(name, traffic)` — renders one destination's bar chart rows + stat line.
4. `buildTrafficCardHTML(trafficData)` — wraps all destinations in a `chapter-card` with intro text; returns `''` if no data.
5. `/report` route — after computing `customDestinations`, collects traffic targets (grocery[0], hospital, work custom dests), runs `getTrafficVariations` for each in parallel, builds `trafficData`, passes it to `buildReportHTML`.
6. `buildReportHTML` — signature updated to accept `trafficData`; `trafficCardHTML` computed and injected after `customDestinationsCardHTML`.

**`public/report.css`** — added `.traffic-body`, `.traffic-intro`, `.traffic-dest-section`, `.traffic-section-divider`, `.traffic-dest-name`, `.traffic-row`, `.traffic-slot`, `.traffic-bar-track`, `.traffic-bar`, `.traffic-bar-{best,good,mid,worst}`, `.traffic-mins`, `.traffic-tag`, `.traffic-tag-{best,worst}`, `.traffic-stat-row`, `.traffic-warning`.

## Deviations from spec

- No opt-in `?traffic=true` toggle — traffic runs on every report to match the acceptance criteria.
- Template strings are server-side (not a client-side `renderTrafficChart` function as the spec suggested) — consistent with the rest of the codebase.
- `getNextDayAt` handles both Monday and Saturday, replacing the two separate `getNextWeekdayAt`/`getNextSaturdayAt` functions from the spec.
