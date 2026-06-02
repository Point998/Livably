# FR-050 — Health L3/L4 Deep Dive

## Problem
The Health & Safety chapter renders `depth-l1` (glance) and `depth-l2` (body) but has no content at Deep Read (L3) or Research (L4) depth levels. Users who select those depths see nothing.

Additionally, `urgentCare` data is fetched and available in the report builder but is never passed to `buildHealthSafetyChapterHTML`, so it is silently unused in this chapter.

## Solution

### L3 — Deep Read: "Medical Access in Depth"
A 3-tab panel rendered inside `<div class="depth-l3">`:

**Tab 1: Urgent Care**
- Nearest urgent care clinic: name, drive time, address
- Contextual narrative comparing drive time to ER
- Cross-state warning if applicable
- Graceful fallback with Solv Health and Urgent Care Association links if no data

**Tab 2: Station Details**
- Fire station: name, address, distance, response time badge
- Police/EMS station: same
- Brief disclaimer about estimate variability

**Tab 3: ISO Fire Rating**
- Static educational content: what ISO PPC is, classes 1–10, premium implications
- How to get your address-specific rating (call insurance agent)
- Incorporates nearest fire station response time if available

### L4 — Research: Raw Data Table
A single table inside `<div class="depth-l4">`:
| Type | Name | Address | Time |
| Emergency Room | ... | ... | X min drive |
| Urgent Care | ... | ... | X min drive |
| Fire Station | ... | ... | ~X min response |
| Police/EMS | ... | ... | ~X min response |

## Inputs
- `hospital` — `{ name, address, driveTimeMinutes, crossStateWarning?, crossStateNote? }`
- `emergency` — `{ fire: { name, address, distanceMiles, response: { estimate, category } }, police: ... }`
- `urgentCare` — `{ name, address, driveTimeMinutes, crossStateWarning?, crossStateNote? }` (may be null)

## Constraints
- CONSTRAINT-008: no inline styles
- CONSTRAINT-009: no business logic in template
- CONSTRAINT-015: graceful degradation — if urgentCare null, show actionable links
- No new API calls — all data already fetched

## Acceptance Criteria
- [ ] `depth-l3` wrapper present when hospital or emergency data available
- [ ] All 3 tabs render with correct content
- [ ] Urgent Care tab shows fallback when urgentCare is null
- [ ] `depth-l4` wrapper present with facilities table
- [ ] urgentCare row absent from table when null
- [ ] No inline styles
- [ ] All 5 test addresses render without error
