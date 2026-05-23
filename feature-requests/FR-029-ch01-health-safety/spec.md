# FR-029 — CH01: Health & Safety — Spec

**Gate 1: Conceptual Review**

Score: 4/4 — MUST HAVE

- ACTIONABLE: ISO fire rating directly affects insurance premiums. ER distance changes how a buyer with young children or health conditions evaluates the property. $24.99 premium unlocked by knowing your fire station is 18 minutes away.
- REVEALING: You cannot see fire station distance or response category during a showing. Hospital drive time requires calculation. ISO rating requires asking your insurance agent — buyers routinely skip this.
- AVOIDS REGRET: Extended ER access (>20 min) is a practical consideration for households with medical conditions. A fire that spreads for 14 minutes before suppression arrives has a different outcome than one suppressed in 5.
- EXCLUSIVE: Aggregated proximity + estimated response time + ISO action item, all in one place. Not available on Zillow or Redfin.

**Gate 2: Data Sources**

- Nearest ER: `hospital` result (already in free tier, drive time verified via Distance Matrix)
- Fire station: `premium.emergency.fire` — fetched via `getEmergencyServices` for every report; response time estimated from `estimateResponseTime(distanceMiles, 'fire')`
- Police station: `premium.emergency.police` — same source
- ISO rating: no direct API available; replaced with action item directing buyer to insurance agent
- Fallback: if emergency data absent, render ER section only; if both absent, return ''

**Gate 3: Narrative Review**

Sample output (Georgetown, KY):
> Centerpoint Health - Georgetown is 4 minutes away — a full-service emergency department within quick reach. For cardiac events or serious trauma, that proximity is meaningful.
>
> Georgetown Fire Department is 1.2 miles away. Estimated fire response: ~3 minutes (Excellent). Homes with fast fire response often qualify for ISO ratings in the 1–4 range, which directly affects your homeowner's insurance premium.
>
> Georgetown Police Department is 0.8 miles away. Estimated response: ~2 minutes (Excellent).

Things to Check:
- Ask your insurance agent for the ISO PPC rating for this address
- Drive the ER route on a weekday morning before you close
- Test smoke and CO detectors on move-in day

Quality: Short, specific, actionable. Each fact answers "Why does this matter to me?"

**Acceptance Criteria**
- Chapter card renders on all 3 test addresses
- Shows ER name + drive time with narrative context
- Shows fire station and police station with response time badge
- Shows Things to Check with 3 action items
- Key Takeaway present and dynamically derived
- No duplicate of what's already in Daily Reachability (ER appears there too — CH01 tells the story, Daily Reachability shows the table row)
