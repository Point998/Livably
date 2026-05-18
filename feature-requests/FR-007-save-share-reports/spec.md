# FR-007 — Save/Share Reports

## What
Allow users to save and share their Livably reports via shareable URLs and optional PDF export.

## Problem
Currently:
- Reports are ephemeral (no way to bookmark or save)
- Users can't share reports with family, realtors, or roommates
- No easy way to reference a report later
- URL contains full address in query string (privacy concern for sharing)

## Requirements

### Shareable URLs
- Generate short, shareable URLs for each report
- Format: `https://livably.com/r/abc123` (instead of `/report?address=...`)
- URLs are permanent and can be shared via text, email, social media
- Opening a shareable URL loads the full report

### Share Button
- "Share this report" button at top of report
- Clicking copies URL to clipboard
- Shows confirmation toast: "Link copied!"
- Optional: Social share buttons (Twitter, Facebook, Email)

### URL Shortening / Report IDs
- Generate unique ID for each report (e.g., base62 encoded hash)
- Store mapping: `reportId → address + timestamp`
- Redirect `/r/:reportId` → regenerate report for that address

### Privacy Considerations
- Shareable URLs don't expose full address in plain text
- Anyone with the link can view the report (no authentication)
- Optional: Add expiration dates (e.g., links expire after 90 days)

## Implementation Notes

### Database/Storage Options

**Option 1: Simple JSON file storage** (for prototype)
```javascript
// reports.json
{
  "abc123": {
    "address": "100 Wishing Well Path, Georgetown, KY",
    "createdAt": "2026-05-17T10:30:00Z",
    "lastAccessed": "2026-05-17T10:30:00Z"
  }
}
```

**Option 2: SQLite database** (for production)
```sql
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  access_count INTEGER DEFAULT 0
);
```

**Option 3: Redis/Cloud storage** (for scale)

### ID Generation
```javascript
const crypto = require('crypto');

function generateReportId(address) {
  const hash = crypto.createHash('sha256').update(address).digest('hex');
  return hash.substring(0, 8); // 8-char hex ID
}

// Or use nanoid for shorter IDs
const { nanoid } = require('nanoid');
const reportId = nanoid(8); // 'a1b2c3d4'
```

### Server Routes

**Create/Save Report:**
```javascript
app.get('/report', async (req, res) => {
  const address = req.query.address;
  
  // Generate report data (existing logic)
  const reportData = await generateReport(address);
  
  // Save report and get ID
  const reportId = await saveReport(address);
  
  // Render report with share button
  res.send(renderReport(reportData, reportId));
});
```

**Load Shared Report:**
```javascript
app.get('/r/:reportId', async (req, res) => {
  const reportId = req.params.reportId;
  
  // Look up address from storage
  const report = await getReport(reportId);
  
  if (!report) {
    return res.status(404).send('Report not found');
  }
  
  // Update last accessed timestamp
  await updateReportAccess(reportId);
  
  // Redirect to generate fresh report
  res.redirect(`/report?address=${encodeURIComponent(report.address)}`);
});
```

### Share Button HTML
```html
<div class="share-section">
  <button id="shareBtn" class="share-button">
    📋 Share this report
  </button>
  <div id="shareToast" class="share-toast hidden">
    Link copied! ✓
  </div>
</div>

<script>
document.getElementById('shareBtn').addEventListener('click', async () => {
  const shareUrl = window.location.origin + '/r/' + REPORT_ID;
  
  try {
    await navigator.clipboard.writeText(shareUrl);
    showToast('Link copied!');
  } catch (err) {
    // Fallback for older browsers
    prompt('Copy this link:', shareUrl);
  }
});

function showToast(message) {
  const toast = document.getElementById('shareToast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}
</script>
```

### CSS for Share Button
```css
.share-section {
  margin: 2rem 0;
  text-align: center;
}

.share-button {
  background: var(--gold);
  color: var(--cream);
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.share-button:hover {
  opacity: 0.9;
}

.share-toast {
  display: inline-block;
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--green, #28a745);
  color: white;
  border-radius: 4px;
  font-size: 0.9rem;
}

.share-toast.hidden {
  display: none;
}
```

## Acceptance Criteria
- [ ] Each report generates a unique shareable URL
- [ ] Share button copies URL to clipboard
- [ ] Confirmation message appears after copy
- [ ] Shared URLs load the correct report
- [ ] `/r/:reportId` redirects properly
- [ ] IDs are short (6-10 characters)
- [ ] Reports persist across server restarts
- [ ] Shared URLs work on mobile and desktop
- [ ] No sensitive data exposed in URLs
- [ ] Share button styled consistently with design system

## Optional Enhancements (Future)
- [ ] PDF export button
- [ ] Email report button (send via email)
- [ ] Social share buttons (Twitter, Facebook)
- [ ] QR code for easy mobile sharing
- [ ] Report expiration (90-day auto-delete)
- [ ] View count tracking
- [ ] "Report last updated" timestamp

## Technical Details

### Storage Strategy
**Phase 1 (Prototype):**
- Use simple JSON file (`data/reports.json`)
- Read/write on each request
- Works for <1000 reports

**Phase 2 (Production):**
- Migrate to SQLite (server-side)
- Or use cloud storage (Redis, DynamoDB, Firestore)

### ID Collision Handling
```javascript
async function generateUniqueId() {
  let id;
  let exists = true;
  
  while (exists) {
    id = nanoid(8);
    exists = await reportExists(id);
  }
  
  return id;
}
```

### Cache Considerations
- Cache report data for 24 hours (reduce API calls)
- When loading `/r/:reportId`, check if cached
- If cache miss or expired, regenerate report

### Privacy & Security
- Don't log full addresses in server logs
- Rate-limit report generation (prevent abuse)
- Consider adding CAPTCHA for public deployments
- Optional: Add "Delete this report" button

## Testing Scenarios
1. **Generate report** → Share button appears with unique URL
2. **Click share button** → URL copied, toast appears
3. **Open shared URL** → Report loads correctly
4. **Share URL on mobile** → Opens in mobile browser
5. **Server restart** → Shared URLs still work
6. **Same address twice** → Can generate new shareable URL or reuse existing
7. **Invalid report ID** → Shows 404 error

## Dependencies
- `nanoid` (npm package for ID generation) — **9KB, zero dependencies**
- Optional: `better-sqlite3` if using SQLite
- No other external dependencies

```bash
npm install nanoid
```

## Estimated Effort
**Medium-High** — 4-5 hours
- Storage implementation (JSON file or SQLite)
- ID generation and collision handling
- `/r/:reportId` route
- Share button UI and copy-to-clipboard
- Toast notification
- Testing and debugging
