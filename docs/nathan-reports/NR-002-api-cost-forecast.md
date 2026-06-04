# NR-002 — API Cost Forecast & Pricing Viability
*Nathan Borders — June 2026*

---

## The Question

Can Livably generate margin at launch, and at what point do API costs become a structural problem?

This document models Google Maps Platform costs per report, maps them against plausible revenue models, and identifies where the economics break down.

---

## What Each Report Costs to Generate

Three Google APIs fire on every report generation. The codebase has been audited for exact call counts.

**No Dynamic Maps charges.** The report HTML has no Google Maps JavaScript API embed. The only googleapis.com references are Google Fonts — no billing.

### Calls Per Report (no cache, no custom destinations)

| API | Calls | Where they come from |
|-----|-------|----------------------|
| Places Nearby / Text Search | 12 | Hospital (Text Search), urgent care, grocery, pharmacy, gas, park, coffee, school, elementary school, library, rec center, post office |
| Distance Matrix | 23 | Hospital top-5 drive-time verification (5), 10 standard destinations (10), traffic variation slots — 4 × 2 targets (8) |
| Geocoding | 8 | Forward geocode, reverse geocode, highway validation, 4 cross-state checks (hospital, urgent care, school, elementary school) |

### Unit Costs (from pricing CSV, standard tier)

| API | Rate | Cost/report |
|-----|------|-------------|
| Places Nearby / Text Search | $32.00 / 1,000 | **$0.384** |
| Distance Matrix | $10.00 / 1,000 | **$0.230** |
| Geocoding | $5.00 / 1,000 | **$0.040** |
| **Total** | | **~$0.65 / report** |

Places Search is 59% of per-report cost. The hospital top-5 drive-time verification (CONSTRAINT-003) is the single most expensive operation — 5 Distance Matrix calls vs. 1 for every other destination.

---

## Free Tier

Each service has a zero-cost first tier per billing period.

| API | Free calls | Reports covered |
|-----|-----------|-----------------|
| Distance Matrix | 5,000 | ~217 |
| Places Nearby / Text Search | 5,000 | ~416 |
| Geocoding | 10,000 | ~1,250 |

**Distance Matrix exhausts first at ~217 reports.** Google also historically provides a $200/month platform credit — verify current status in the Cloud Console, as this could push the effective free threshold to ~500+ reports/month. Do not rely on it for planning.

---

## Monthly Cost at Volume

Assumes standard-tier rates throughout (volume discounts on Places and Distance Matrix kick in above 100,000 calls, which requires ~8,300+ reports/month).

| Reports/month | Places | Distance Matrix | Geocoding | Total API spend |
|---------------|--------|-----------------|-----------|-----------------|
| 100 | ~$0 | ~$0 | ~$0 | **~$0** (free tier) |
| 250 | ~$0 | ~$12 | ~$0 | **~$12** |
| 500 | $192 | $115 | $20 | **~$327** |
| 1,000 | $384 | $230 | $40 | **~$654** |
| 2,500 | $960 | $575 | $100 | **~$1,635** |
| 5,000 | $1,920 | $1,150 | $200 | **~$3,270** |
| 10,000 | ~$3,712* | $2,040* | $400 | **~$6,152** |

*At 10k reports: Places crosses 100k calls ($25.60 tier); Distance Matrix crosses 100k calls ($8.00 tier).

---

## Revenue Model Scenarios

### Model A — Per-Report (Direct to Buyer)

Buyer pays per report at time of generation. No subscription.

| Price per report | API cost | Gross margin per report | Break-even volume |
|-----------------|----------|------------------------|-------------------|
| $25 | $0.65 | $24.35 (97%) | Any |
| $49 | $0.65 | $48.35 (99%) | Any |
| $99 | $0.65 | $98.35 (99%) | Any |

API costs are negligible at any per-report price above ~$5. The margin risk here is not API costs — it's customer acquisition cost and conversion rate.

**Verdict:** Per-report model is economically trivial to sustain. $0.65 is a rounding error against any viable price point.

---

### Model B — Agent Subscription (Monthly Flat Fee)

Agent pays a monthly fee for unlimited report generation. Cost model changes because high-volume agents compress margin.

**Key question:** How many reports does the average agent generate per month?

Assumption: Active residential agent closes 2–4 transactions/month, might generate reports on 5–10 addresses (showings, listings, buyer clients). Call it 8–15 reports/month per agent.

| Subscription price | Reports/month assumed | API cost | Net after API |
|-------------------|-----------------------|----------|---------------|
| $49/mo | 10 | $6.50 | $42.50 (87%) |
| $99/mo | 20 | $13.00 | $86.00 (87%) |
| $149/mo | 30 | $19.50 | $129.50 (87%) |
| $299/mo | 75 | $48.75 | $250.25 (84%) |

Margin holds well at realistic agent volumes. Risk scenario: a high-volume team using a single subscription account to generate 300+ reports/month.

| Risk scenario | Reports/month | API cost | At $299/mo plan |
|--------------|---------------|----------|-----------------|
| Power user | 300 | $195 | $104 net (35%) |
| Team abuse | 600 | $390 | -$91 (loss) |

**Verdict:** Agent subscription works at typical volumes. Needs a per-report cap or fair-use policy above ~200 reports/month on any plan tier, or tiered pricing with a hard ceiling.

---

### Model C — Lender / Title Integration (B2B Licensing)

Per-transaction pricing negotiated with lenders, title companies, or real estate platforms. Livably generates a report at loan origination or purchase contract.

Monthly US purchase mortgage volume runs ~300,000–500,000 transactions. A single mid-size lender might close 2,000–5,000 loans/month.

| Volume | API cost/month | Minimum license fee for 50% margin |
|--------|---------------|-------------------------------------|
| 1,000 transactions | $650 | $1,300/mo |
| 5,000 transactions | $3,270 | $6,540/mo |
| 10,000 transactions | $6,152 | $12,304/mo |

Volume discounts kick in above 8,300 reports/month, improving margin. At enterprise scale the per-report cost drops below $0.50 due to tier discounts.

**Verdict:** B2B model is viable but requires volume pricing negotiation and API cost modeling per contract. Each large client needs a margin floor built into the contract.

---

## The Caching Advantage

The codebase has two caches: `placesCache` (Places results) and `driveTimeCache` (Distance Matrix results). Both are currently in-memory and reset on server restart.

**What this means:**
- Same address generated twice in a session: second report costs ~$0
- Same ZIP code area generated twice: Places results for hospital, grocery, etc. often hit cache — most of the $0.65 disappears

**What this doesn't cover:**
- Server restarts clear all cache — every deploy starts cold
- Separate server instances don't share cache

**Upgrade path:** Persistent shared cache (Redis or simple key-value store) would dramatically cut costs at scale. If 30% of requests hit persistent cache, effective per-report cost drops to ~$0.45. At 10,000 reports/month, that's ~$1,800/month savings.

This is not urgent now, but it becomes the highest-ROI infrastructure investment once volume exceeds 2,000 reports/month.

---

## The Places Search Problem

At $32/1,000 calls, Places Nearby Search is the cost driver to watch. The current architecture makes 12 Places calls per report — one per destination category.

There is no architectural shortcut here: each search has a different type parameter and location context. Batching is not available in the Nearby Search API. The only levers are:

1. **Cache hit rate** — persistent cache eliminates repeat searches for same-area addresses
2. **Fewer destination categories** — removing a Places search category saves $0.032/report (modest but compounding)
3. **Tier discounts** — at 100k+ calls/month (~8,300 reports), rate drops to $25.60/1,000, saving ~$0.077/report

None of these are urgent. The Places cost is manageable at any realistic near-term volume.

---

## Risk Scenarios

### Scenario 1: Viral moment, 10,000 reports in a day
- API cost: ~$6,500
- Mitigation: Google Cloud budget alerts — set a daily spend cap in Cloud Console now. A $50/day alert and a $200/day hard cap prevents surprise bills.

### Scenario 2: Competitor scraping via the API endpoint
- One scraper generating 10,000 automated reports = $6,500 in API costs, charged to you
- Mitigation: Rate limiting is in the codebase (`rateLimit.js`). Verify it enforces per-IP request limits aggressively enough.

### Scenario 3: Agent on $99/month plan generates 500 reports
- API cost: $325 on $99 revenue = loss
- Mitigation: Per-plan monthly report cap, or per-report overage billing above the included allotment

---

## Summary

| Question | Answer |
|----------|--------|
| Cost per report at scale | ~$0.65 |
| Free tier threshold | ~217 reports/month |
| Dominant cost driver | Places Nearby Search (59% of spend) |
| Per-report model viability | Excellent — margin is 97%+ at any viable price |
| Agent subscription viability | Good at typical volumes, needs cap above ~200 reports/month |
| B2B licensing viability | Viable with volume pricing — margin floor required per contract |
| Persistent cache ROI | High above 2,000 reports/month |
| Immediate action needed | Set Cloud Console budget alerts before any public launch |
