# FR-033 — Life at This Address Calculator
*Enhancement to Daily Reachability chapter*

## What
An interactive calculator at the end of the Daily Reachability chapter that shows buyers what their actual weekly life costs in miles, time, and dollars — based on how they actually live. Uses the real drive time data already calculated for the chapter.

## Why This Passes the Filter
- Nobody has built this for homebuyers
- Turns abstract drive times into a felt annual cost
- Interactive — buyer personalizes it to their situation
- EV charging integration makes it forward-looking
- The output is a number that sticks: "$2,200/year in vehicle costs"

## The Interface

### Lifestyle Profile Selector
Three starting profiles (buyer selects one, then adjusts):
```
Remote Worker    Office Commuter    Family with Kids
```

### Sliders
- Days commuting to work per week (0-5)
- Commute destination (dropdown: nearest employment centers by drive time)
- Kids in school (toggle yes/no)
- Weekly grocery trips (1-3)
- Monthly trips to nearest large city (0-4)

### Output Display
```
YOUR ESTIMATED WEEKLY MILES

Commute (3 days × 24mi):     72 mi
School runs (2 kids):         18 mi
Groceries (2×/week):          12 mi
Errands & misc:               15 mi
City trips (monthly avg):     14 mi
─────────────────────────────────
Weekly total:                131 mi
Annual estimate:           6,812 mi

─────────────────────────────────
ANNUAL VEHICLE COST ESTIMATE
At IRS rate ($0.21/mi):    $1,431
At avg gas prices:           $940
If you drove an EV:          $295
─────────────────────────────────
EV CHARGING NEAR YOU
Nearest Level 2:    Kroger (3 min)
Nearest DC Fast:    I-75 exit (10 min)
Home charging:      Likely feasible
                    (house, not condo)
```

## Technical Implementation
- All destination distances already calculated — reuse from chapter data
- Sliders update output in real time (vanilla JS, no framework needed)
- IRS mileage rate pulled from a config constant (update annually)
- Gas price uses EIA state average (already have this from utilities data)
- EV cost calculated from local electric rate (from utilities chapter)
- EV charging locations from Google Places (type: ev_charging_station)
- Property type (condo vs house) from existing property data

## Acceptance Criteria
- Sliders update instantly with no page reload
- Numbers are realistic — test against actual commute scenarios
- EV charging shows real nearby locations, not placeholder
- Works on mobile (sliders are touch-friendly, minimum 44px tap targets)
- Shows "home charging likely feasible" for house, "check parking rules" for condo/apartment

## Tone
Empowering not alarming. "131 miles a week sounds like a lot — it's actually typical for suburban living. The question is whether it fits your lifestyle and budget." Give context, not judgment.

## Placement
After Traffic Patterns section, before chapter ends. The natural capstone of "here's where things are → here's when to go → here's what your life actually costs."
