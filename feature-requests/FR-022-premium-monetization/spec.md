# FR-022 — Premium Tier & Monetization

## What
Implement a two-tier system (Free and Premium) with Stripe payment integration to monetize advanced features.

## Problem
- API costs are increasing (Walk Score, GreatSchools, etc.)
- Premium data sources require paid subscriptions
- Need revenue to sustain and grow the product
- Users get more value, should pay for premium insights

## Requirements

### Two Report Tiers

**Free Report:**
- Basic services (grocery, pharmacy, hospital, urgent care, highway, gas)
- Drive times
- Map visualization
- Things to Know sections
- Shareable links

**Premium Report ($9.99 one-time):**
- Everything in Free, PLUS:
- School ratings (FR-017)
- Crime data & safety scores (FR-018)
- Environmental data (FR-019)
- Emergency services response times (FR-020)
- Walk Score & Transit Score (FR-021)
- Property & market data (FR-023)
- Demographics (FR-024)
- PDF export (FR-016)
- Priority support

### Payment Flow

1. User generates **free report**
2. At bottom of free report: **"Unlock Premium Insights"** CTA
3. User clicks → Stripe Checkout modal
4. User pays $9.99 → Payment confirmed
5. Report upgrades with premium sections
6. User receives shareable premium report link

### No User Accounts (Initially)

**Simple approach:**
- No signup/login required
- One-time payment per report
- Payment tied to report ID (from FR-007)
- User gets shareable link to premium report

**Future:** Add accounts for report history, subscriptions

## Implementation Notes

### Stripe Integration

**Stripe Checkout:** Hosted payment page (easiest)

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Create checkout session
app.post('/create-checkout-session', async (req, res) => {
  const { reportId } = req.body;
  
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Livably Premium Report',
              description: 'Unlock all premium insights for this address',
            },
            unit_amount: 999, // $9.99 in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.DOMAIN}/report/premium/${reportId}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.DOMAIN}/report?address=${encodeURIComponent(reportAddress)}`,
      metadata: {
        reportId: reportId
      }
    });
    
    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: 'Payment session creation failed' });
  }
});

// Webhook to handle successful payments
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const reportId = session.metadata.reportId;
    
    // Mark report as premium in database
    await markReportAsPremium(reportId, session.id);
  }
  
  res.json({ received: true });
});

// Check if report is premium
function isReportPremium(reportId) {
  const reports = loadReports(); // From FR-007
  return reports[reportId]?.premium === true;
}

function markReportAsPremium(reportId, stripeSessionId) {
  const reports = loadReports();
  if (reports[reportId]) {
    reports[reportId].premium = true;
    reports[reportId].stripeSessionId = stripeSessionId;
    reports[reportId].upgradedAt = new Date().toISOString();
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf8');
  }
}
```

---

### Frontend: Upgrade CTA

**At bottom of free report:**

```html
<section class="upgrade-cta">
  <div class="upgrade-container">
    <h2>🔓 Unlock Premium Insights</h2>
    <p class="upgrade-intro">
      Get the complete picture with school ratings, crime data, Walk Score, 
      environmental factors, and more.
    </p>
    
    <div class="premium-features">
      <div class="premium-feature">
        <span class="feature-icon">🏫</span>
        <span class="feature-name">School Ratings</span>
      </div>
      <div class="premium-feature">
        <span class="feature-icon">🚨</span>
        <span class="feature-name">Crime & Safety</span>
      </div>
      <div class="premium-feature">
        <span class="feature-icon">🌍</span>
        <span class="feature-name">Environmental Data</span>
      </div>
      <div class="premium-feature">
        <span class="feature-icon">🚶</span>
        <span class="feature-name">Walk Score</span>
      </div>
      <div class="premium-feature">
        <span class="feature-icon">📊</span>
        <span class="feature-name">Market Trends</span>
      </div>
      <div class="premium-feature">
        <span class="feature-icon">📄</span>
        <span class="feature-name">PDF Export</span>
      </div>
    </div>
    
    <div class="upgrade-pricing">
      <div class="price">$9.99</div>
      <div class="price-label">One-time payment</div>
    </div>
    
    <button id="upgradeBtn" class="btn-upgrade">Upgrade to Premium</button>
    
    <p class="upgrade-note">
      Secure payment via Stripe • No subscription • Instant access
    </p>
  </div>
</section>

<script src="https://js.stripe.com/v3/"></script>
<script>
  const stripe = Stripe('${process.env.STRIPE_PUBLISHABLE_KEY}');
  const reportId = '${reportId}';
  
  document.getElementById('upgradeBtn').addEventListener('click', async () => {
    const response = await fetch('/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId })
    });
    
    const { sessionId } = await response.json();
    
    const { error } = await stripe.redirectToCheckout({ sessionId });
    
    if (error) {
      alert('Payment failed. Please try again.');
    }
  });
</script>
```

---

### Premium Report Route

```javascript
app.get('/report/premium/:reportId', async (req, res) => {
  const { reportId } = req.params;
  const sessionId = req.query.session_id;
  
  // Verify payment with Stripe
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status !== 'paid') {
      return res.status(403).send('Payment not completed');
    }
    
    // Mark report as premium if not already
    await markReportAsPremium(reportId, sessionId);
    
    // Redirect to report (will now show premium sections)
    return res.redirect(`/r/${reportId}`);
  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).send('Payment verification failed');
  }
});
```

---

### Report Generation Logic

```javascript
app.get('/report', async (req, res) => {
  const address = req.query.address;
  
  // Generate report...
  const reportId = saveReport(address);
  const isPremium = isReportPremium(reportId);
  
  // Fetch basic data (always)
  const basicData = await fetchBasicData(address);
  
  // Fetch premium data (only if premium)
  let premiumData = null;
  if (isPremium) {
    premiumData = await fetchPremiumData(address);
  }
  
  return res.send(buildReportHTML(address, {
    ...basicData,
    ...premiumData,
    reportId,
    isPremium
  }));
});

async function fetchPremiumData(address) {
  const origin = await geocodeAddress(address);
  const originLatLng = `${origin.lat},${origin.lng}`;
  
  const [schools, crime, environmental, emergency, walkScore] = 
    await Promise.allSettled([
      findSchoolsNearAddress(origin.lat, origin.lng),  // FR-017
      getCrimeData(origin.lat, origin.lng),            // FR-018
      getEnvironmentalData(origin.lat, origin.lng),    // FR-019
      getEmergencyServices(origin.lat, origin.lng),    // FR-020
      getWalkScore(origin.lat, origin.lng, address)    // FR-021
    ]);
  
  return {
    schools: schools.status === 'fulfilled' ? schools.value : null,
    crime: crime.status === 'fulfilled' ? crime.value : null,
    environmental: environmental.status === 'fulfilled' ? environmental.value : null,
    emergency: emergency.status === 'fulfilled' ? emergency.value : null,
    walkScore: walkScore.status === 'fulfilled' ? walkScore.value : null
  };
}
```

---

### CSS for Upgrade CTA

```css
.upgrade-cta {
  margin: 4rem 0;
  padding: 3rem 2rem;
  background: linear-gradient(135deg, #f8f9fa 0%, #fff9e6 100%);
  border-radius: 12px;
  text-align: center;
  border: 2px solid var(--gold);
}

.upgrade-container h2 {
  font-family: var(--font-serif);
  font-size: 2rem;
  margin-bottom: 1rem;
}

.upgrade-intro {
  font-size: 1.1rem;
  color: var(--text-secondary);
  max-width: 600px;
  margin: 0 auto 2rem;
}

.premium-features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  max-width: 800px;
  margin: 0 auto 2rem;
}

.premium-feature {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.feature-icon {
  font-size: 1.5rem;
}

.feature-name {
  font-weight: 600;
  font-size: 0.9rem;
}

.upgrade-pricing {
  margin: 2rem 0;
}

.price {
  font-size: 3rem;
  font-weight: 700;
  color: var(--gold);
  font-family: var(--font-serif);
}

.price-label {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.btn-upgrade {
  background: var(--gold);
  color: white;
  border: none;
  padding: 1rem 3rem;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-upgrade:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
}

.upgrade-note {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: 1rem;
}

@media (max-width: 768px) {
  .premium-features {
    grid-template-columns: 1fr;
  }
}
```

## Acceptance Criteria
- [ ] Free report displays all basic features
- [ ] "Upgrade to Premium" CTA at bottom of free report
- [ ] Stripe Checkout integration works
- [ ] Payment of $9.99 processes successfully
- [ ] After payment, report shows premium sections
- [ ] Premium report is shareable (retains premium status)
- [ ] Webhook marks report as premium in database
- [ ] Premium badge/indicator on premium reports
- [ ] Secure payment flow (HTTPS required)
- [ ] Works on mobile and desktop

## Optional Enhancements (Future)
- [ ] User accounts (save multiple reports)
- [ ] Subscription model ($19.99/month unlimited reports)
- [ ] Bulk pricing (5 reports for $39.99)
- [ ] Realtor/agent accounts (white-label reports)
- [ ] Gift reports (buy for someone else)
- [ ] Promo codes and discounts

## Technical Requirements

### Stripe Setup
1. Create Stripe account
2. Get API keys (Publishable and Secret)
3. Set up webhook endpoint
4. Configure webhook events: `checkout.session.completed`

### Security
- Use HTTPS in production (required for Stripe)
- Verify webhook signatures
- Store Stripe keys in environment variables
- Don't expose secret key in client-side code

### Testing
- Use Stripe test mode
- Test card: 4242 4242 4242 4242
- Test webhook with Stripe CLI

## Legal Requirements

### Terms of Service
Must include:
- Refund policy (e.g., "No refunds after premium data is accessed")
- Data accuracy disclaimer
- Service availability terms

### Privacy Policy
Must disclose:
- Payment processed by Stripe
- No credit card data stored on Livably servers
- How report data is stored/used

## Dependencies

```bash
npm install stripe
```

## Environment Variables

Add to `.env`:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
DOMAIN=http://localhost:3000
```

## Pricing Strategy

### Recommended Pricing:
- **Free Report:** $0 (acquisition)
- **Premium Report:** $9.99 (one-time)

**Why $9.99?**
- Low enough for impulse purchase
- High enough to cover API costs (~$2-3 per premium report)
- Competitive with other real estate data tools

### Alternative Pricing Models:
- **Freemium:** Free + $19.99/month unlimited
- **Pay-per-report:** $4.99 per report (no free tier)
- **Bundles:** 5 reports for $39.99

## Revenue Projections

**Assumptions:**
- 1,000 free reports/month
- 10% conversion to premium
- $9.99 per premium report

**Monthly Revenue:** 100 × $9.99 = $999

**Annual Revenue:** $11,988

**Costs:**
- Walk Score API: $250/month = $3,000/year
- GreatSchools: Free
- Hosting: ~$50/month = $600/year
- **Net profit:** ~$8,000/year at 100 premium reports/month

## Estimated Effort
**Medium-High** — 5-6 hours
- Stripe account setup
- Checkout session endpoint
- Webhook integration
- Premium report logic
- Upgrade CTA design
- Payment verification
- Testing payment flow
- Webhook testing
- Error handling
- Terms and privacy policy drafts
