---
description: Launch and screenshot the Livably Express server for visual verification
---

# Running Livably

Livably is a Node.js/Express server (`src/app.js`) that generates HTML reports on demand by hitting real APIs. Reports take 30–90 seconds to build. Screenshots require Playwright, which lives in the npx cache (not in project node_modules).

---

## 1. Kill any existing server

```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
```

## 2. Start the server

```powershell
Start-Process -FilePath "node" -ArgumentList "src/app.js" -WorkingDirectory "C:\Users\Borde\livably" -WindowStyle Hidden
Start-Sleep -Seconds 3
(Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue).StatusCode
# Expect: 200
```

Server runs on port 3000. `.env` must be present with Google Maps and other API keys.

## 3. Generate a report

Reports build async. The loading page is served without `fetch=1`; the actual report HTML requires it:

```powershell
Add-Type -AssemblyName System.Web
$addr = [System.Web.HttpUtility]::UrlEncode("100 Wishing Well Path Unit 2306, Georgetown, KY 40324")
$r = Invoke-WebRequest -Uri "http://localhost:3000/report?address=$addr&fetch=1" -UseBasicParsing -TimeoutSec 180
# Expect: 180,000+ bytes. Under 10,000 bytes = loading page (wrong URL or missing fetch=1).
Write-Host "$($r.Content.Length) bytes"
```

**Test addresses** (use these for verification, always test all 5 for new features):
1. `100 Wishing Well Path Unit 2306, Georgetown, KY 40324` — suburban KY (primary)
2. `456 Rural Route 1, Harlan, KY 40831` — rural Appalachian
3. `123 Main St, Louisville, KY 40202` — urban KY
4. `789 Main St, Bozeman, MT 59715` — western US
5. `1007 Stonelilly Dr, Jeffersonville, IN 47130` — border city IN/KY

## 4. Take screenshots with Playwright

Playwright is **not** in project `node_modules`. It lives in the npx cache:

```
C:\Users\Borde\AppData\Local\npm-cache\_npx\e41f203b7505f1fb\node_modules\playwright
```

Write a `.cjs` script to the project root, run it with `node`, then delete it:

```javascript
// __shot.cjs
'use strict';
const PW = 'C:\\Users\\Borde\\AppData\\Local\\npm-cache\\_npx\\e41f203b7505f1fb\\node_modules\\playwright';
const { chromium } = require(PW);
const ADDR = encodeURIComponent('100 Wishing Well Path Unit 2306, Georgetown, KY 40324');
const URL  = `http://localhost:3000/report?address=${ADDR}&fetch=1`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  console.log('Loading report...');
  await page.goto(URL, { timeout: 120000 });
  await page.waitForLoadState('networkidle');

  // Screenshot the whole page (viewport)
  await page.screenshot({ path: 'C:\\Users\\Borde\\AppData\\Local\\Temp\\livably-check.png' });
  console.log('done');

  // Screenshot a specific chapter element
  const el = await page.$('.chapter[data-ch="walk"]');
  if (el) await el.screenshot({ path: 'C:\\Users\\Borde\\AppData\\Local\\Temp\\livably-walk.png' });

  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
```

```powershell
Set-Location "C:\Users\Borde\livably"
node __shot.cjs
Remove-Item __shot.cjs -Force
```

**Important:** Screenshot from `http://localhost:3000/...`, not from a saved HTML file. The file:// protocol can't load the Express-served CSS, so screenshots come out unstyled.

## 5. Switch depth levels for a chapter

The depth slider state is set via `data-depth` on `.chapter[data-ch="X"]`. Valid values: `glance`, `overview`, `deepread`, `research`.

```javascript
// Inside a Playwright page.evaluate():
document.querySelector('.chapter[data-ch="walk"]').setAttribute('data-depth', 'deepread');
```

Then screenshot the chapter element or its `.depth-l3` / `.depth-l4` child:

```javascript
const l3 = await page.$('.chapter[data-ch="walk"] .depth-l3');
await l3.screenshot({ path: '...' });
```

## 6. Stop the server

```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
```

---

## Known quirks

- **`[System.Web.HttpUtility]`** requires `Add-Type -AssemblyName System.Web` before use in PowerShell.
- **Report timeout:** some addresses with many API calls take 60–90s. Use `-TimeoutSec 180` on `Invoke-WebRequest`.
- **Short response = wrong URL:** if the response is under 10KB, you're hitting the loading page. Check that `&fetch=1` is in the URL.
- **Playwright browser install:** run `npx playwright install chromium` once if screenshots fail with a missing browser error.
- **Don't use `bash` shell for PowerShell commands** — `Get-Process`, `Stop-Process`, `Start-Process` are PowerShell-only; they'll fail in bash.
