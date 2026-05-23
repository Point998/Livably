# FR-022 — Premium Monetization: Implementation Plan

## Gate 1: Conceptual Review

### Chapter Proposal: Premium Paywall & Stripe Monetization

### What it covers:
A two-tier access model. Standard report (Daily Reachability, map, quick stats) is always free.
Premium sections (Schools, Health & Safety, Demographics, Growth, Climate, Property Intelligence,
Sensory & Environmental, Walkability, Property Market) are gated behind a $24.99 one-time payment
per report. After payment, premium sections unlock permanently for that report ID.

### Quality Checks:
- [x] Actionable — User knows exactly what they get and what it costs before paying. Unlocking
      reveals sections that directly change purchase decisions (school ratings, flood zone,
      radon, airport noise, property history).

- [x] Revealing — Premium sections surface non-obvious, investigation-required data. Hidden
      without the report; premium gate makes the value proposition explicit.

- [x] Avoids Regret — Buyer who skips premium and later discovers the radon Zone 1 or the
      airport noise problem after closing regrets not paying $24.99. The paywall makes the
      stakes clear.

- [x] Exclusive — Aggregated, parcel-level, multi-source premium data is not assembled
      anywhere else. User cannot replicate it for $24.99 of their own research time.

### Score: 4/4 — MUST HAVE
### Decision: MUST HAVE — passes all quality gates

---

## Gate 2: Data Source Validation

### Primary Source: Stripe Checkout
- Type: Third-party payment API
- Accuracy: High (Stripe-verified)
- Freshness: Real-time
- Legal Status: Standard ToS
- Cost: 2.9% + $0.30 per transaction
- Requires: STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET in .env
- Fallback: If keys absent, show CTA with "payment temporarily unavailable" message

### Premium Status Storage
- Stored in data/reports.json alongside report record
- Field: `premium: true`, `stripeSessionId`, `upgradedAt`
- Verification: session ID checked against Stripe API on premium route

---

## Gate 3: Narrative Review (Upgrade CTA)

### Lead (what user sees first):
"Livably Standard covers your daily essentials. Premium goes deeper — schools, health
infrastructure, climate risk, property history, and sensory environment. Everything that
takes weeks to discover on your own."

### Feature list: 8 premium sections clearly named
### Price: $24.99 shown prominently, one-time framing

### Quality Checks:
- [x] Would I read this? Yes — it's short and specific
- [x] Does it answer questions as they form? Yes — each feature listed
- [x] Is it filler? No — each feature maps to a real decision concern
- [x] Human voice? Yes — no jargon

---

## Implementation Tasks (Phase 4)

### 1. Add premium gate to `buildPremiumSectionsHTML` in premium.js
- If `isPremium` false: return upgrade CTA HTML instead of premium content
- CTA shows: Livably Premium heading, 8 feature bullets, $24.99 price, "Unlock" button

### 2. Add `isPremium` flag to report data flow in app.js
- `saveReport()` already stores report by ID
- Add `isReportPremium(reportId)` function
- Pass `isPremium` flag through to `buildReportHTML` and then to `buildPremiumSectionsHTML`

### 3. Add Stripe routes in app.js
- POST `/create-checkout-session` — creates Stripe session with reportId + address metadata
- GET `/report/premium/:reportId` — verifies payment + marks report premium + redirects
- POST `/webhook` — handles `checkout.session.completed` async confirmation
- All routes graceful when STRIPE_SECRET_KEY absent

### 4. Add markReportAsPremium + isReportPremium functions

### 5. Add CSS for upgrade CTA card in report.css

### 6. No Stripe npm package — use native fetch to Stripe API (avoids npm install requirement)
   OR: Note requirement in summary.md and use `stripe` npm package if available

---

## Constraints
- Price: $24.99 (not $9.99 — per session instructions)
- No user accounts
- Payment tied to report ID
- Stripe keys may not be in .env — implement graceful "payment unavailable" path
- Do not read .env to check for keys — handle missing keys via try/catch on Stripe init
