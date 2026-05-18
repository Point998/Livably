# FR-016 — PDF Export

## What
Allow users to download their Livably reports as PDF files for printing, emailing, or offline storage.

## Problem
Currently:
- Reports only viewable in browser
- No way to save for offline review
- Can't easily email to family/realtor/roommates
- Browser print produces inconsistent results
- No professional format for sharing

## Requirements

### PDF Export Button
- "Download PDF" button prominently displayed on report
- Generates PDF with clean, professional formatting
- Includes all report sections:
  - Hero (address + score)
  - Service listings with drive times
  - Map (if FR-006 complete)
  - Score breakdown (if FR-008 complete)
  - Custom destinations (if FR-012 complete)

### PDF Design
- Clean, printable layout (white background, black text)
- Livably branding (logo, colors)
- Page breaks at logical sections
- Header/footer with address and date
- Optimized for Letter size (8.5" × 11")

### File Naming
- Format: `livably-report-{address-slug}-{date}.pdf`
- Example: `livably-report-georgetown-ky-2026-05-17.pdf`

### Performance
- Generate PDF on-demand (not pre-generated)
- Show loading indicator during generation
- PDF size: <2MB for typical report

## Implementation Notes

### PDF Generation Library

**Recommended: Puppeteer** (headless Chrome)
```bash
npm install puppeteer
```

Puppeteer renders HTML to PDF with high fidelity, supporting CSS and images.

**Alternative: PDFKit** (lower-level, more control)
```bash
npm install pdfkit
```

### Server-side PDF Generation

**Route: `/report/pdf`**
```javascript
const puppeteer = require('puppeteer');

app.get('/report/pdf', async (req, res) => {
  const address = req.query.address;
  
  if (!address) {
    return res.status(400).send('Address required');
  }
  
  try {
    // Generate report HTML (reuse existing logic)
    const reportData = await generateFullReport(address);
    const html = renderReportForPDF(reportData);
    
    // Launch headless browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set content
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Generate PDF
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      }
    });
    
    await browser.close();
    
    // Send PDF
    const filename = `livably-report-${slugify(address)}-${getDateSlug()}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdf.length
    });
    
    res.send(pdf);
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).send('Failed to generate PDF');
  }
});

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

function getDateSlug() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

### PDF-Specific HTML Template

**Render report with print-friendly styles:**
```javascript
function renderReportForPDF(reportData) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Livably Report - ${reportData.address}</title>
      <style>
        ${getPDFStyles()}
      </style>
    </head>
    <body>
      <header class="pdf-header">
        <div class="logo">Liv<span class="logo-gold">ably</span></div>
        <div class="tagline">The things you'd only learn after living there for two years.</div>
      </header>
      
      <main>
        <section class="hero">
          <h1>${reportData.address}</h1>
          <div class="score-section">
            <div class="score-circle">
              <span class="score-value">${reportData.score.overall}</span>
            </div>
            <p class="score-label">${reportData.score.rating.label}</p>
          </div>
        </section>
        
        <section class="services">
          <h2>Essential Services</h2>
          ${renderServicesForPDF(reportData.services)}
        </section>
        
        ${reportData.map ? `
          <section class="map">
            <h2>Location Overview</h2>
            <img src="${reportData.mapImageUrl}" alt="Map" style="width: 100%;">
          </section>
        ` : ''}
        
        ${reportData.scoreBreakdown ? `
          <section class="score-breakdown">
            <h2>Score Breakdown</h2>
            ${renderScoreBreakdownForPDF(reportData.scoreBreakdown)}
          </section>
        ` : ''}
      </main>
      
      <footer class="pdf-footer">
        <p>Generated on ${new Date().toLocaleDateString()}</p>
        <p>Livably.com</p>
      </footer>
    </body>
    </html>
  `;
}

function getPDFStyles() {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700&family=DM+Sans:wght@400;600&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'DM Sans', sans-serif;
      color: #1a1a1a;
      background: white;
      line-height: 1.6;
    }
    
    .pdf-header {
      text-align: center;
      padding: 1.5rem 0;
      border-bottom: 2px solid #D4AF37;
      margin-bottom: 2rem;
    }
    
    .logo {
      font-family: 'Fraunces', serif;
      font-size: 2rem;
      font-weight: 700;
    }
    
    .logo-gold {
      color: #D4AF37;
    }
    
    .tagline {
      font-size: 0.9rem;
      color: #666;
      margin-top: 0.5rem;
    }
    
    .hero {
      margin-bottom: 2rem;
      text-align: center;
    }
    
    .hero h1 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
    }
    
    .score-circle {
      width: 100px;
      height: 100px;
      border: 3px solid #D4AF37;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 1rem auto;
    }
    
    .score-value {
      font-family: 'Fraunces', serif;
      font-size: 2.5rem;
      font-weight: 700;
      color: #D4AF37;
    }
    
    .services {
      margin-bottom: 2rem;
    }
    
    h2 {
      font-family: 'Fraunces', serif;
      font-size: 1.3rem;
      margin-bottom: 1rem;
      color: #1a1a1a;
      border-bottom: 1px solid #ddd;
      padding-bottom: 0.5rem;
    }
    
    .service-item {
      margin-bottom: 1rem;
      padding: 0.75rem;
      background: #f9f9f9;
      border-left: 3px solid #D4AF37;
    }
    
    .service-name {
      font-weight: 600;
      margin-bottom: 0.25rem;
    }
    
    .service-address {
      font-size: 0.9rem;
      color: #666;
    }
    
    .service-time {
      font-weight: 600;
      color: #D4AF37;
      margin-top: 0.25rem;
    }
    
    .pdf-footer {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 0.85rem;
      color: #666;
    }
    
    @page {
      margin: 0.5in;
    }
    
    section {
      page-break-inside: avoid;
    }
  `;
}
```

### Download Button in Web Report

**Add to report HTML:**
```html
<div class="report-actions">
  <button onclick="downloadPDF()" class="btn-pdf">
    📄 Download PDF
  </button>
  <button onclick="shareReport()" class="btn-share">
    🔗 Share Report
  </button>
</div>

<script>
  function downloadPDF() {
    const address = '${encodeURIComponent(reportData.address)}';
    window.location.href = `/report/pdf?address=${address}`;
  }
</script>
```

### CSS for PDF Button

```css
.report-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin: 2rem 0;
}

.btn-pdf,
.btn-share {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-pdf {
  background: var(--gold);
  color: white;
}

.btn-share {
  background: white;
  color: var(--gold);
  border: 1px solid var(--gold);
}

.btn-pdf:hover,
.btn-share:hover {
  opacity: 0.9;
}
```

### Map in PDF (Static Image)

**Generate static map URL for PDF:**
```javascript
function getStaticMapUrl(reportData) {
  const { origin, services } = reportData;
  
  // Build markers string
  const markers = [
    `color:0xD4AF37|label:H|${origin.lat},${origin.lng}`, // Home (gold)
    `color:red|label:G|${services.grocery.location.lat},${services.grocery.location.lng}`,
    `color:blue|label:P|${services.pharmacy.location.lat},${services.pharmacy.location.lng}`,
    // ... more markers
  ].join('&markers=');
  
  const url = `https://maps.googleapis.com/maps/api/staticmap?` +
    `size=600x400` +
    `&markers=${markers}` +
    `&key=${googleMapsApiKey}`;
  
  return url;
}
```

## Acceptance Criteria
- [ ] "Download PDF" button appears on report
- [ ] Clicking button downloads PDF file
- [ ] PDF includes all report sections
- [ ] PDF is properly formatted and printable
- [ ] Filename includes address and date
- [ ] PDF size is reasonable (<2MB)
- [ ] Works on mobile and desktop browsers
- [ ] Loading indicator during generation
- [ ] Error handling if PDF generation fails
- [ ] Branding (logo, colors) matches web report

## Optional Enhancements (Future)
- [ ] Email PDF directly from report
- [ ] Customizable PDF (choose which sections to include)
- [ ] Multiple PDF templates (minimal, detailed, comparison)
- [ ] Watermark with generation date
- [ ] Include QR code linking to web report
- [ ] Compress PDF for smaller file size
- [ ] Batch export (compare multiple addresses → single PDF)

## Testing Scenarios
1. **Standard report** → PDF downloads with all sections
2. **Mobile browser** → PDF downloads successfully
3. **Report with map** → Map appears in PDF
4. **Large report** (custom destinations, traffic) → PDF <2MB
5. **Special characters in address** → Filename sanitized
6. **PDF opened** → Formatted correctly, printable
7. **Error during generation** → User-friendly error message

## Performance Considerations
- Puppeteer can be slow (2-5 seconds per PDF)
- Consider queuing for high traffic
- Cache PDFs for 24 hours (similar to reports)
- Limit concurrent PDF generations (max 3)

**Optimization:**
```javascript
const pdfQueue = [];
let activePDFGenerations = 0;
const MAX_CONCURRENT_PDFS = 3;

async function generatePDFQueued(reportData) {
  while (activePDFGenerations >= MAX_CONCURRENT_PDFS) {
    await delay(500);
  }
  
  activePDFGenerations++;
  
  try {
    const pdf = await generatePDF(reportData);
    return pdf;
  } finally {
    activePDFGenerations--;
  }
}
```

## Dependencies
```bash
npm install puppeteer
```

**Alternatives:**
- `pdfkit` — Lower-level, more manual
- `html-pdf` — Deprecated, not recommended
- `wkhtmltopdf` — External binary, harder to deploy

## Deployment Considerations
- Puppeteer requires Chrome/Chromium binary
- Docker: Use `node:18-slim` with Chromium
- Heroku: Add buildpack `jontewks/puppeteer`
- Lambda: Use `chrome-aws-lambda` package

**Dockerfile example:**
```dockerfile
FROM node:18-slim

# Install Chromium
RUN apt-get update && apt-get install -y \
  chromium \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

CMD ["node", "src/app.js"]
```

## Estimated Effort
**Medium** — 4-5 hours
- Install and configure Puppeteer
- PDF-specific HTML template
- PDF styles (print-friendly)
- Server route for PDF generation
- Download button on report
- Static map integration
- Filename generation
- Error handling
- Testing across browsers
- Deployment configuration
