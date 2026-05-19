# FR-008 — Location Insights ("Things to Know")

## What
Replace numeric livability scoring with narrative-driven "Things to Know" sections that give buyers honest, helpful context about daily life at this address.

## Philosophy
Home buying is emotional. A score feels judgy ("You got a 67"). Instead, we provide **insider knowledge** — the stuff you'd only learn after living there for two years. We're honest about trade-offs without being alarmist. We celebrate what works well and flag what's worth considering, all in a tone that feels like a helpful friend, not a real estate agent.

## Problem with Scoring (Why We're Not Doing It)
- Numbers feel reductive: "78/100" doesn't capture nuance
- Creates false comparisons: Rural isn't "worse" than urban—just different
- Triggers buyer anxiety: "Did I pick a bad location?"
- Misses the point: People don't want grades, they want to know what daily life is like

## Requirements

### Three Core Sections

**1. Daily Conveniences** 🛒
*"The errands and routines that shape your week"*

**Includes:**
- Grocery store
- Pharmacy
- Gas station
- Coffee shop (if FR-009 complete)

**Tone guidance:**
- If all <10 min: "Everything you need is right around the corner"
- If 10-20 min: "A quick drive gets you to essentials"
- If 20-30 min: "Stock up when you're out—groceries are a 25-minute drive"
- If >30 min: "You'll want to plan your trips. The nearest grocery store is 35 minutes away."

**2. Peace of Mind** 🏥
*"Healthcare access when it matters most"*

**Includes:**
- Hospital
- Urgent care

**Tone guidance:**
- If hospital <15 min: "Medical care is close by"
- If hospital 15-25 min: "The nearest hospital is [X] minutes away—worth knowing for emergencies"
- If hospital >25 min: "Hospital access takes time from here. The nearest is [X] minutes away."
- Always mention urgent care as closer alternative if relevant

**3. Getting Around** 🛣️
*"Connectivity to work, family, and beyond"*

**Includes:**
- Highway access
- Traffic patterns (if FR-013 complete)
- Custom destinations (if FR-012 complete)

**Tone guidance:**
- If highway <5 min: "Quick highway access for commuting"
- If highway 5-15 min: "Highway is [X] minutes away"
- If highway >15 min: "You're off the beaten path—highway access is [X] minutes"

### Heads Up (Callouts for Important Considerations)

When something genuinely matters, add a **"Worth Noting"** callout:

```
⚠️ Worth Noting
The nearest hospital is 40 minutes away. If immediate medical access 
is important to you, this is something to consider.
```

**When to use callouts:**
- Hospital >30 minutes
- Grocery >30 minutes
- Any essential service >45 minutes
- High traffic variation (if FR-013 complete): "Evening commutes can add 15+ minutes"

**Tone of callouts:**
- Factual, not scary
- "Worth noting" not "WARNING"
- Acknowledges trade-offs: "You get space and quiet, but services are farther"
- Always frames as "something to consider" not "deal-breaker"

### Optional 4th Section (if FR-009 complete)

**4. Quality of Life** ⛳
*"What makes this place feel like home"*

**Includes:**
- Parks
- Schools
- Libraries
- Restaurants

**Tone:** Always positive. These are nice-to-haves, not essentials.

## Implementation Notes

### Narrative Generation Logic

```javascript
function generateLocationInsights(services) {
  const insights = {
    dailyConveniences: generateDailyConveniencesNarrative(services),
    peaceOfMind: generatePeaceOfMindNarrative(services),
    gettingAround: generateGettingAroundNarrative(services),
    callouts: generateCallouts(services)
  };
  
  return insights;
}

function generateDailyConveniencesNarrative(services) {
  const { grocery, pharmacy, gasStation } = services;
  const avgTime = Math.round((grocery.driveTimeMinutes + pharmacy.driveTimeMinutes + gasStation.driveTimeMinutes) / 3);
  
  let opening, details;
  
  if (avgTime < 10) {
    opening = "Everything you need is right around the corner.";
  } else if (avgTime < 20) {
    opening = "A quick drive gets you to daily essentials.";
  } else if (avgTime < 30) {
    opening = "Stock up when you're out—errands take a bit longer from here.";
  } else {
    opening = "You'll want to plan your trips. Essential services are farther out.";
  }
  
  details = `Your nearest grocery store (${grocery.name}) is ${grocery.driveTimeMinutes} minutes away. ` +
            `Pharmacy runs take about ${pharmacy.driveTimeMinutes} minutes, ` +
            `and gas is ${gasStation.driveTimeMinutes} minutes.`;
  
  return { opening, details };
}

function generatePeaceOfMindNarrative(services) {
  const { hospital, urgentCare } = services;
  
  let opening, details, tone;
  
  if (hospital.driveTimeMinutes < 15) {
    opening = "Medical care is close by.";
    tone = "reassuring";
  } else if (hospital.driveTimeMinutes < 25) {
    opening = `The nearest hospital is ${hospital.driveTimeMinutes} minutes away—worth knowing for emergencies.`;
    tone = "neutral";
  } else {
    opening = `Hospital access takes time from here.`;
    tone = "considerate";
  }
  
  if (urgentCare.driveTimeMinutes < hospital.driveTimeMinutes - 5) {
    details = `${hospital.name} is ${hospital.driveTimeMinutes} minutes away. ` +
              `For non-emergencies, ${urgentCare.name} is closer at ${urgentCare.driveTimeMinutes} minutes.`;
  } else {
    details = `${hospital.name} is ${hospital.driveTimeMinutes} minutes away.`;
  }
  
  return { opening, details, tone };
}

function generateGettingAroundNarrative(services) {
  const { highwayRamp } = services;
  
  let opening, details;
  
  if (highwayRamp.driveTimeMinutes < 5) {
    opening = "Quick highway access for commuting.";
  } else if (highwayRamp.driveTimeMinutes < 15) {
    opening = `The highway is ${highwayRamp.driveTimeMinutes} minutes away.`;
  } else {
    opening = `You're off the beaten path—highway access is ${highwayRamp.driveTimeMinutes} minutes.`;
  }
  
  // Extract highway info from ramp name
  const highwayMatch = highwayRamp.name.match(/I-?\d+|US-?\d+/i);
  const highwayName = highwayMatch ? highwayMatch[0] : "the highway";
  
  details = `${highwayRamp.name} gets you to ${highwayName} in ${highwayRamp.driveTimeMinutes} minutes.`;
  
  return { opening, details };
}

function generateCallouts(services) {
  const callouts = [];
  
  // Hospital callout
  if (services.hospital.driveTimeMinutes > 30) {
    callouts.push({
      icon: '⚠️',
      title: 'Worth Noting',
      message: `The nearest hospital is ${services.hospital.driveTimeMinutes} minutes away. ` +
               `If immediate medical access is important to you, this is something to consider.`
    });
  }
  
  // Grocery callout
  if (services.grocery.driveTimeMinutes > 30) {
    callouts.push({
      icon: '⚠️',
      title: 'Worth Noting',
      message: `Grocery shopping takes ${services.grocery.driveTimeMinutes} minutes each way. ` +
               `You'll want to plan larger shopping trips and keep a well-stocked pantry.`
    });
  }
  
  // Remote location (if everything is far)
  const avgAll = Math.round(
    (services.grocery.driveTimeMinutes + 
     services.pharmacy.driveTimeMinutes + 
     services.hospital.driveTimeMinutes) / 3
  );
  
  if (avgAll > 40) {
    callouts.push({
      icon: 'ℹ️',
      title: 'Heads Up',
      message: `This is a remote location. You'll enjoy peace, space, and privacy—but services ` +
               `are farther out. Most errands will be 30-45+ minutes.`
    });
  }
  
  return callouts;
}
```

### HTML Template

```html
<section class="location-insights">
  <h2>Things to Know</h2>
  <p class="insights-intro">
    Here's what daily life looks like at this address—the things you'd only 
    learn after living here for two years.
  </p>
  
  <!-- Daily Conveniences -->
  <div class="insight-section">
    <div class="insight-header">
      <span class="insight-icon">🛒</span>
      <h3>Daily Conveniences</h3>
      <p class="insight-subtitle">The errands and routines that shape your week</p>
    </div>
    
    <div class="insight-content">
      <p class="insight-opening">${dailyConveniences.opening}</p>
      <p class="insight-details">${dailyConveniences.details}</p>
      
      <div class="insight-breakdown">
        <div class="insight-item">
          <span class="item-name">Grocery</span>
          <span class="item-place">${grocery.name}</span>
          <span class="item-time">${grocery.driveTimeMinutes} min</span>
        </div>
        <div class="insight-item">
          <span class="item-name">Pharmacy</span>
          <span class="item-place">${pharmacy.name}</span>
          <span class="item-time">${pharmacy.driveTimeMinutes} min</span>
        </div>
        <div class="insight-item">
          <span class="item-name">Gas</span>
          <span class="item-place">${gasStation.name}</span>
          <span class="item-time">${gasStation.driveTimeMinutes} min</span>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Peace of Mind -->
  <div class="insight-section">
    <div class="insight-header">
      <span class="insight-icon">🏥</span>
      <h3>Peace of Mind</h3>
      <p class="insight-subtitle">Healthcare access when it matters most</p>
    </div>
    
    <div class="insight-content">
      <p class="insight-opening">${peaceOfMind.opening}</p>
      <p class="insight-details">${peaceOfMind.details}</p>
      
      <div class="insight-breakdown">
        <div class="insight-item">
          <span class="item-name">Hospital</span>
          <span class="item-place">${hospital.name}</span>
          <span class="item-time">${hospital.driveTimeMinutes} min</span>
        </div>
        <div class="insight-item">
          <span class="item-name">Urgent Care</span>
          <span class="item-place">${urgentCare.name}</span>
          <span class="item-time">${urgentCare.driveTimeMinutes} min</span>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Getting Around -->
  <div class="insight-section">
    <div class="insight-header">
      <span class="insight-icon">🛣️</span>
      <h3>Getting Around</h3>
      <p class="insight-subtitle">Connectivity to work, family, and beyond</p>
    </div>
    
    <div class="insight-content">
      <p class="insight-opening">${gettingAround.opening}</p>
      <p class="insight-details">${gettingAround.details}</p>
      
      <div class="insight-breakdown">
        <div class="insight-item">
          <span class="item-name">Highway Access</span>
          <span class="item-place">${highwayRamp.name}</span>
          <span class="item-time">${highwayRamp.driveTimeMinutes} min</span>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Callouts (Worth Noting) -->
  ${callouts.map(callout => `
    <div class="insight-callout">
      <span class="callout-icon">${callout.icon}</span>
      <div class="callout-content">
        <h4>${callout.title}</h4>
        <p>${callout.message}</p>
      </div>
    </div>
  `).join('')}
</section>
```

### CSS

```css
.location-insights {
  margin: 3rem 0;
}

.insights-intro {
  color: var(--text-secondary);
  margin-bottom: 2rem;
  font-size: 1rem;
  line-height: 1.6;
}

.insight-section {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.insight-header {
  margin-bottom: 1.5rem;
  border-bottom: 2px solid var(--border);
  padding-bottom: 1rem;
}

.insight-icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 0.5rem;
}

.insight-header h3 {
  font-family: var(--font-serif);
  font-size: 1.5rem;
  margin: 0 0 0.25rem;
}

.insight-subtitle {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin: 0;
  font-style: italic;
}

.insight-content {
  line-height: 1.7;
}

.insight-opening {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: var(--text-primary);
}

.insight-details {
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
}

.insight-breakdown {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.insight-item {
  display: grid;
  grid-template-columns: 120px 1fr auto;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--cream);
  border-radius: 4px;
  align-items: center;
}

.item-name {
  font-weight: 600;
  font-size: 0.9rem;
}

.item-place {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.item-time {
  font-weight: 600;
  color: var(--gold);
  font-size: 1rem;
}

/* Callouts */
.insight-callout {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  background: #fff9e6;
  border-left: 4px solid #ffa500;
  border-radius: 4px;
  margin-bottom: 1.5rem;
}

.callout-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.callout-content h4 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 600;
}

.callout-content p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

@media (max-width: 768px) {
  .insight-section {
    padding: 1.5rem;
  }
  
  .insight-item {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }
  
  .item-time {
    margin-top: 0.25rem;
  }
}
```

## Acceptance Criteria
- [ ] Three core sections: Daily Conveniences, Peace of Mind, Getting Around
- [ ] Each section has: icon, title, subtitle, narrative opening, details, breakdown
- [ ] Narrative tone adjusts based on drive times (close/moderate/far)
- [ ] "Worth Noting" callouts appear when hospital >30 min, grocery >30 min, or location is very remote
- [ ] No numeric score displayed anywhere
- [ ] Language is helpful and honest, never alarmist
- [ ] Reads naturally, like advice from a friend
- [ ] Trade-offs acknowledged positively ("You get space and quiet, but...")
- [ ] Design matches report aesthetic
- [ ] Mobile responsive
- [ ] Tested with urban, suburban, and rural addresses

## Writing Guidelines

### DO:
✅ "Everything you need is right around the corner"  
✅ "Stock up when you're out—groceries are a 25-minute drive"  
✅ "You'll enjoy peace and space, but services are farther out"  
✅ "Worth knowing for emergencies"  
✅ "Something to consider"  

### DON'T:
❌ "This location scores poorly"  
❌ "WARNING: Hospital too far"  
❌ "Major concern"  
❌ "You'll regret this"  
❌ "Bad location for medical emergencies"  

### Framing Trade-offs:
- Rural: "You get space, quiet, and privacy—but plan your trips"
- Suburban: "A nice balance of accessibility and breathing room"
- Urban: "Everything's walkable, but you'll trade space for convenience"

## Testing Scenarios
1. **Urban address** (all <10 min) → Positive, celebratory tone
2. **Suburban address** (10-20 min) → Balanced, practical tone
3. **Rural address** (25-45 min) → Honest but not negative, emphasizes trade-offs
4. **Very remote** (45+ min) → Clear callout but frames as lifestyle choice
5. **Mixed** (some close, hospital far) → Balanced narrative with specific callout

## Dependencies
- No new NPM packages required
- Reuses existing service data
- Pure JavaScript for narrative generation

## Estimated Effort
**Medium** — 3-4 hours
- Narrative generation logic
- Callout detection logic
- HTML template updates
- CSS styling for sections and callouts
- Writing tone guidelines
- Testing across address types
- Iteration on language/tone
