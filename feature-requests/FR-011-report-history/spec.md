# FR-011 — Report History & Saved Searches

## What
Allow users to view their previously generated reports and quickly re-run searches without re-entering addresses.

## Problem
Currently:
- No way to see what addresses you've searched before
- Must re-type addresses to regenerate reports
- Can't track which addresses you've evaluated
- No browsing history or quick access to past reports

## Requirements

### Report History Page
- Route: `/history`
- Shows list of all previously searched addresses
- Sorted by most recent first
- Each entry shows:
  - Address
  - Livability score
  - Date/time searched
  - "View Report" button
  - "Delete" button (optional)

### Storage
- Persist search history across sessions
- Store: address, timestamp, score (optional: cache full report data)
- Limit: Last 50 searches (configurable)
- Auto-cleanup: Remove entries older than 90 days (optional)

### Quick Access
- "View History" link in nav/header
- Recently searched addresses appear on homepage
- Autocomplete suggestions based on history

### Privacy
- History stored locally (browser localStorage) OR server-side per user
- Clear all history button
- Optional: Session-based (clears when browser closes)

## Implementation Notes

### Storage Options

**Option 1: Browser localStorage (Simple, No Backend)**
```javascript
// Save to history
function saveToHistory(address, score) {
  const history = JSON.parse(localStorage.getItem('livablyHistory') || '[]');
  
  const entry = {
    address,
    score,
    timestamp: Date.now(),
    id: Date.now().toString()
  };
  
  // Add to beginning (most recent first)
  history.unshift(entry);
  
  // Limit to 50 entries
  if (history.length > 50) {
    history.pop();
  }
  
  localStorage.setItem('livablyHistory', JSON.stringify(history));
}

// Get history
function getHistory() {
  return JSON.parse(localStorage.getItem('livablyHistory') || '[]');
}

// Clear history
function clearHistory() {
  localStorage.removeItem('livablyHistory');
}
```

**Option 2: Server-side storage (Requires database)**
- Store in SQLite/JSON file
- Associate with session ID or user account
- More persistent, accessible across devices

### Client-side Implementation (Option 1)

**On report page:**
```html
<script>
  // Save to history when report loads
  window.addEventListener('load', () => {
    const address = '${address}';
    const score = ${score.overall};
    saveToHistory(address, score);
  });
  
  function saveToHistory(address, score) {
    const history = JSON.parse(localStorage.getItem('livablyHistory') || '[]');
    
    // Check if address already exists
    const existingIndex = history.findIndex(h => h.address === address);
    if (existingIndex !== -1) {
      // Move to top (most recent)
      history.splice(existingIndex, 1);
    }
    
    history.unshift({
      address,
      score,
      timestamp: Date.now(),
      id: Date.now().toString()
    });
    
    if (history.length > 50) history.pop();
    
    localStorage.setItem('livablyHistory', JSON.stringify(history));
  }
</script>
```

**History page (`public/history.html`):**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Search History | Livably</title>
  <link rel="stylesheet" href="/report.css">
</head>
<body class="history-page">
  <div class="history-container">
    <div class="history-header">
      <div class="form-logo">Liv<span class="logo-gold">ably</span></div>
      <h1>Your Search History</h1>
      <div class="history-actions">
        <a href="/" class="btn-secondary">New Search</a>
        <button onclick="clearHistory()" class="btn-danger">Clear All</button>
      </div>
    </div>
    
    <div id="historyList" class="history-list">
      <!-- Populated by JavaScript -->
    </div>
    
    <div id="emptyState" class="empty-state" style="display: none;">
      <p>No search history yet.</p>
      <a href="/">Generate your first report</a>
    </div>
  </div>
  
  <script>
    function loadHistory() {
      const history = JSON.parse(localStorage.getItem('livablyHistory') || '[]');
      const listEl = document.getElementById('historyList');
      const emptyEl = document.getElementById('emptyState');
      
      if (history.length === 0) {
        listEl.style.display = 'none';
        emptyEl.style.display = 'block';
        return;
      }
      
      listEl.innerHTML = history.map(entry => renderHistoryItem(entry)).join('');
    }
    
    function renderHistoryItem(entry) {
      const date = new Date(entry.timestamp);
      const dateStr = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      
      const scoreClass = getScoreClass(entry.score);
      
      return `
        <div class="history-item">
          <div class="history-info">
            <div class="history-address">${entry.address}</div>
            <div class="history-meta">
              <span class="history-date">${dateStr}</span>
              <span class="history-score score-${scoreClass}">${entry.score}</span>
            </div>
          </div>
          <div class="history-actions">
            <a href="/report?address=${encodeURIComponent(entry.address)}" class="btn-primary">
              View Report
            </a>
            <button onclick="deleteHistoryItem('${entry.id}')" class="btn-delete">
              🗑️
            </button>
          </div>
        </div>
      `;
    }
    
    function getScoreClass(score) {
      if (score >= 80) return 'green';
      if (score >= 60) return 'gold';
      if (score >= 40) return 'orange';
      return 'red';
    }
    
    function deleteHistoryItem(id) {
      const history = JSON.parse(localStorage.getItem('livablyHistory') || '[]');
      const filtered = history.filter(h => h.id !== id);
      localStorage.setItem('livablyHistory', JSON.stringify(filtered));
      loadHistory();
    }
    
    function clearHistory() {
      if (confirm('Are you sure you want to clear all search history?')) {
        localStorage.removeItem('livablyHistory');
        loadHistory();
      }
    }
    
    // Load on page load
    window.addEventListener('load', loadHistory);
  </script>
</body>
</html>
```

### Homepage Integration

**Add "Recent Searches" section to `public/index.html`:**
```html
<div class="form-container">
  <div class="form-logo">Liv<span class="logo-gold">ably</span></div>
  <p class="form-tagline">The things you'd only learn after living there for two years.</p>
  
  <!-- Recent searches -->
  <div id="recentSearches" class="recent-searches" style="display: none;">
    <h3>Recent Searches</h3>
    <div id="recentList"></div>
  </div>
  
  <form action="/report" method="get" class="address-form">
    <input type="text" name="address" placeholder="Enter a home address" autocomplete="street-address" required>
    <button type="submit">Generate report</button>
  </form>
  
  <div class="form-footer">
    <a href="/history">View all history</a>
  </div>
</div>

<script>
  // Show recent 3 searches
  window.addEventListener('load', () => {
    const history = JSON.parse(localStorage.getItem('livablyHistory') || '[]');
    const recent = history.slice(0, 3);
    
    if (recent.length > 0) {
      const recentEl = document.getElementById('recentSearches');
      const listEl = document.getElementById('recentList');
      
      listEl.innerHTML = recent.map(entry => `
        <a href="/report?address=${encodeURIComponent(entry.address)}" class="recent-item">
          ${entry.address} <span class="recent-score">${entry.score}</span>
        </a>
      `).join('');
      
      recentEl.style.display = 'block';
    }
  });
</script>
```

### CSS

```css
/* History Page */
.history-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.history-header {
  text-align: center;
  margin-bottom: 2rem;
}

.history-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 1rem;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.history-item {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.history-address {
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.history-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.history-score {
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.history-score.score-green { background: rgba(40, 167, 69, 0.2); color: #28a745; }
.history-score.score-gold { background: rgba(212, 175, 55, 0.2); color: var(--gold); }
.history-score.score-orange { background: rgba(253, 126, 20, 0.2); color: #fd7e14; }
.history-score.score-red { background: rgba(220, 53, 69, 0.2); color: #dc3545; }

.btn-delete {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.btn-delete:hover {
  opacity: 1;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-secondary);
}

/* Recent Searches (Homepage) */
.recent-searches {
  margin-bottom: 2rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 8px;
}

.recent-searches h3 {
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.75rem;
  color: var(--text-secondary);
}

.recent-item {
  display: block;
  padding: 0.75rem;
  background: white;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  text-decoration: none;
  color: var(--text-primary);
  transition: background 0.2s;
  display: flex;
  justify-content: space-between;
}

.recent-item:hover {
  background: var(--cream);
}

.recent-score {
  font-weight: 600;
  color: var(--gold);
}
```

## Acceptance Criteria
- [ ] Search history persists across browser sessions
- [ ] History page displays all past searches
- [ ] Most recent searches appear first
- [ ] Each entry shows address, score, date
- [ ] "View Report" button regenerates report
- [ ] "Delete" button removes individual entries
- [ ] "Clear All" button removes all history (with confirmation)
- [ ] Recent searches (3) appear on homepage
- [ ] Empty state shows when no history
- [ ] Works on mobile and desktop
- [ ] History limited to 50 most recent entries

## Optional Enhancements (Future)
- [ ] Server-side storage (multi-device sync)
- [ ] User accounts (login to access history)
- [ ] Export history as CSV
- [ ] Search/filter history by address or score
- [ ] Star/favorite addresses
- [ ] Notes on each search
- [ ] Auto-delete old entries (90+ days)
- [ ] Cache full report data (faster re-viewing)

## Testing Scenarios
1. **First search** → Saved to history
2. **Multiple searches** → All appear in history page
3. **View report from history** → Regenerates correctly
4. **Delete entry** → Removed from list
5. **Clear all** → History empty
6. **50+ searches** → Only shows recent 50
7. **Browser refresh** → History persists
8. **Empty history** → Shows empty state
9. **Recent searches on homepage** → Shows top 3

## Privacy Considerations
- History stored in browser localStorage (user-controlled)
- No server-side tracking (unless Option 2 implemented)
- Clear history functionality gives user control
- Consider adding: "Don't save to history" checkbox on form

## Dependencies
- No new NPM packages required (localStorage is native)
- Pure JavaScript
- Optional: Add simple Node.js route for server-side storage

## Estimated Effort
**Low-Medium** — 2-3 hours (localStorage version)
- localStorage save/retrieve logic
- History page HTML/CSS
- Recent searches on homepage
- Delete and clear functionality
- Testing across browsers

**Medium** — 4-5 hours (Server-side version)
- Add database/JSON storage
- Server routes for CRUD operations
- Session/user association
- Sync across devices
