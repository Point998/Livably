# FR-005 — Loading States & Error Handling UI

## What
Add professional loading indicators and user-friendly error messages to the report generation flow.

## Problem
Currently, when a user submits an address:
- No feedback while the report is generating (can take 3-10 seconds)
- Generic error messages that don't help users understand what went wrong
- No way to retry after an error without going back to the home page

## Requirements

### Loading State
- Show loading indicator immediately after form submission
- Display progress messages during report generation:
  - "Finding your address..."
  - "Locating nearby services..."
  - "Calculating drive times..."
  - "Generating your report..."
- Prevent double-submission while loading
- Loading screen uses same design system (cream background, Fraunces/DM Sans fonts)

### Error Handling
Replace generic error messages with specific, actionable feedback:

**Address not found:**
- Message: "We couldn't find that address. Please check the spelling and try again."
- Show "Try again" button that returns to form with address pre-filled

**No services found:**
- Message: "This address is very remote. We couldn't find [service type] within 50 miles."
- Show partial report with available services
- Display "Try a different address" button

**API error / Rate limit:**
- Message: "We're experiencing high demand. Please try again in a moment."
- Show "Retry" button with countdown (30s, 60s, etc.)

**Network error:**
- Message: "Connection issue. Please check your internet and try again."
- Show "Retry" button

### Design Requirements
- Loading spinner or animated logo
- Error messages centered, max-width 480px
- Gold accent for retry/action buttons
- Error icon (⚠️ or similar) for visual hierarchy
- Maintain cream background throughout

## Implementation Notes

### Loading Page (`/report?address=...`)
1. Show loading UI immediately
2. Make API calls in background
3. Stream/replace with actual report when ready
4. If error occurs, replace loading UI with error message

### Error Page Structure
```html
<div class="error-container">
  <div class="error-icon">⚠️</div>
  <h1>Error Title</h1>
  <p>User-friendly explanation</p>
  <button>Action Button</button>
  <a href="/">Try a different address</a>
</div>
```

### Loading Messages Timing
- Display each message for ~2-3 seconds
- Cycle through 3-4 messages during typical load time
- If taking longer than expected, show "This is taking longer than usual..."

## Acceptance Criteria
- [ ] Loading indicator appears immediately on form submit
- [ ] Loading messages rotate during report generation
- [ ] Address not found shows helpful error message
- [ ] API errors show retry button with countdown
- [ ] All error states tested (invalid address, API failure, network issue)
- [ ] Error messages are user-friendly (no technical jargon)
- [ ] Retry buttons work correctly
- [ ] Design matches form/report aesthetic
- [ ] Works on mobile (375px viewport)
- [ ] No console errors in browser

## Technical Details

### Server-side Changes (`src/app.js`)
- Wrap existing logic in try/catch blocks
- Return specific error types with status codes:
  - 400: Invalid/not found address
  - 404: No services found
  - 429: Rate limit
  - 500: Server error
  - 503: API unavailable

### Client-side (if adding JS)
- Optional: Add loading state with JavaScript
- Alternative: Server-side rendering with immediate loading page

### Suggested Error Response Format
```javascript
{
  error: true,
  type: 'ADDRESS_NOT_FOUND' | 'NO_SERVICES' | 'RATE_LIMIT' | 'API_ERROR',
  message: 'User-friendly message',
  details: 'Technical details (optional)',
  retryAfter: 30 // seconds (for rate limits)
}
```

## Testing Scenarios
1. **Valid address** → Loading → Report (happy path)
2. **Invalid address** → Loading → Error (address not found)
3. **Very remote address** → Loading → Partial report with error note
4. **Simulate API failure** → Loading → Error (retry button)
5. **Mobile viewport** → All states render correctly

## Dependencies
- No new NPM packages required
- Uses existing CSS/HTML structure
- Optional: Add simple vanilla JS for loading states (no frameworks)

## Estimated Effort
**Medium** — 2-3 hours
- HTML/CSS for loading and error states
- Server-side error handling improvements
- Testing across error scenarios
