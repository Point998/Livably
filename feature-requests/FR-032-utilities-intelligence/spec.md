# FR-032 — Utilities Intelligence
*A new standalone chapter*

## What
A dedicated utilities chapter that tells buyers who provides essential services at this address, what those services cost relative to state averages, and what the reliability track record looks like. Goes far beyond "electric utility is X" to answer: what does utilities actually cost and how reliable are they?

## Why This Passes the Filter
- Not on Zillow, Redfin, or any listing site
- Requires combining multiple data sources (EIA, NERC, EPA, county records)
- Has massive felt impact — utilities are a monthly cost forever
- Rural vs urban split is genuinely unknown to most buyers
- EV buyers need this before they commit

## What It Covers

### Electric Service
- Provider name and type (municipal, co-op, investor-owned)
- Average residential rate (cents/kWh) vs state average
- Reliability: average outages per year and duration (NERC SAIDI/SAIFI data)
- Infrastructure age context (older = more outages)
- Net metering availability for solar
- EV charging context — what does charging cost here monthly?

### Natural Gas
- Provider if available, or "no natural gas service — propane or electric only"
- Average residential rate vs state average
- If no gas: heating cost implications (electric resistance vs heat pump)

### Water & Sewer
- Municipal water vs well
- If municipal: provider, any recent violations (EPA SDWA)
- If well: typical well depth for this geology, maintenance implications
- Municipal sewer vs septic
- If septic: age estimate based on home era, typical maintenance costs

### Trash & Recycling
- Provider (municipal vs private)
- Collection frequency
- Recycling availability — many rural areas have none
- Bulk/yard waste pickup availability

### Internet (Enhanced)
- All ISPs serving this address with advertised speeds
- Actual speed context from M-Lab/Ookla open data near this address
- Technology type (fiber vs cable vs DSL vs fixed wireless vs satellite)
- "Remote work viability" assessment based on actual available speeds

## Data Sources
- EIA Electric Power Annual — utility rates by state/provider
- NERC SAIDI/SAIFI — reliability metrics by utility territory
- EPA SDWA — water system violations
- FCC National Broadband Map — ISP coverage (with caveat about accuracy)
- M-Lab/Ookla open data — actual speed test results near address
- County assessor — well/septic vs municipal (from permit records)
- USDA Rural Development — rural utility classification

## Acceptance Criteria
- Correctly identifies electric provider for Georgetown KY (Kentucky Utilities) and Bozeman MT (NorthWestern Energy)
- Shows rate context vs state average
- Shows outage frequency — not just "reliable" but actual annual average
- Correctly identifies well vs municipal for rural Harlan KY address
- Shows recycling availability — Georgetown has it, many rural addresses don't
- Internet section shows actual ISPs, not just "broadband available"
- EV section shows monthly charging cost estimate based on local rate + weekly mileage

## Tone
Practical and empowering. "Kentucky Utilities averages 1.4 outages per year lasting about 3 hours each — better than the national average of 2.1 outages. Most are weather-related." Not alarming, just honest.

## Placement
After Property Costs & Market — the last financial chapter before the report footer. Utilities completes the "true cost of living here" picture.

## Chapter Color
Deep teal (#1a6b6b) — financial clarity, water, infrastructure
