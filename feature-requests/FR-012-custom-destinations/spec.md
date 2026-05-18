# FR-012 — Custom Destinations (User-Defined POIs)

## What
Allow users to add their own custom destinations (workplace, family homes, recurring appointments) and see drive times from the address being evaluated.

## Problem
Currently:
- Report only shows generic services
- Users can't evaluate addresses based on their specific needs
- No way to factor in personal commute, family proximity, or frequent destinations
- One-size-fits-all approach doesn't capture individual priorities

## Requirements

### Custom Destination Input
- Add destinations before or after generating report
- Enter: destination name, address
- Optional: destination type (work, family, recreation, medical, other)
- Limit: 5-10 custom destinations per report

### Display in Report
- New section: "Your Custom Destinations"
- Shows: name, address, drive time, distance
- Include in map visualization (distinct marker color/icon)
- Optional: Include in scoring algorithm (user-weighted)

### Use Cases
- **Commute:** "My office at 123 Main St"
- **Family:** "Mom's house in Louisville"
- **Childcare:** "Daycare on Elm Street"
- **Recreation:** "My gym", "Favorite hiking trail"
- **Medical:** "My doctor's office"

### Persistence
- Save custom destinations with report (FR-007 integration)
- Option to save as "template" for reuse across multiple addresses
- Export/import custom destination lists

## Implementation Notes

### Input Interface

**Option 1: Add to comparison/report form**
```html
<div class="custom-destinations-input">
  <h3>Add Your Custom Destinations (Optional)</h3>
  <p>Add places you visit regularly to see drive times from this address.</p>
  
  <div id="customDestinationsList"></div>
  
  <button type="button" onclick="addCustomDestination()">+ Add Destination</button>
</div>

<script>
let customDestinations = [];

function addCustomDestination() {
  const container = document.getElementById('customDestinationsList');
  const index = customDestinations.length;
  
  const html = `
    <div class="custom-dest-row" data-index="${index}">
      <input type="text" 
             name="customDestName[]" 
             placeholder="Name (e.g., My Office)" 
             required>
      <input type="text" 
             name="customDestAddress[]" 
             placeholder="Address" 
             required>
      <select name="customDestType[]">
        <option value="work">Work</option>
        <option value="family">Family</option>
        <option value="medical">Medical</option>
        <option value="recreation">Recreation</option>
        <option value="other">Other</option>
      </select>
      <button type="button" onclick="removeCustomDestination(${index})">✕</button>
    </div>
  `;
  
  container.insertAdjacentHTML('beforeend', html);
  customDestinations.push({ index });
}

function removeCustomDestination(index) {
  document.querySelector(`[data-index="${index}"]`).remove();
  customDestinations = customDestinations.filter(d => d.index !== index);
}
</script>
```

**Option 2: Modal/popup for adding destinations**
```html
<button onclick="openCustomDestModal()">+ Add Custom Destination</button>

<div id="customDestModal" class="modal" style="display: none;">
  <div class="modal-content">
    <h3>Add Custom Destination</h3>
    <form id="customDestForm">
      <input type="text" name="name" placeholder="Name" required>
      <input type="text" name="address" placeholder="Address" required>
      <select name="type">
        <option value="work">Work</option>
        <option value="family">Family</option>
        <option value="medical">Medical</option>
        <option value="recreation">Recreation</option>
        <option value="other">Other</option>
      </select>
      <button type="submit">Add</button>
      <button type="button" onclick="closeCustomDestModal()">Cancel</button>
    </form>
  </div>
</div>
```

### Server-side Processing (`src/app.js`)

```javascript
app.get('/report', async (req, res) => {
  const address = req.query.address;
  
  // Parse custom destinations from query params
  const customDestNames = req.query.customDestName || [];
  const customDestAddresses = req.query.customDestAddress || [];
  const customDestTypes = req.query.customDestType || [];
  
  const customDestinations = [];
  
  for (let i = 0; i < customDestAddresses.length; i++) {
    if (!customDestAddresses[i]) continue;
    
    try {
      const destLocation = await geocodeAddress(customDestAddresses[i]);
      const driveTimeMinutes = await getDriveTime(
        originLatLng,
        `${destLocation.lat},${destLocation.lng}`
      );
      
      customDestinations.push({
        name: customDestNames[i] || 'Custom Destination',
        address: customDestAddresses[i],
        type: customDestTypes[i] || 'other',
        location: destLocation,
        driveTimeMinutes
      });
    } catch (error) {
      console.error(`Failed to add custom destination: ${customDestAddresses[i]}`, error);
      // Continue without this destination
    }
  }
  
  // Pass to template
  const reportData = {
    // ... existing data
    customDestinations
  };
  
  res.send(renderReport(reportData));
});
```

### Display in Report

```html
${customDestinations.length > 0 ? `
  <section class="custom-destinations">
    <h2>Your Custom Destinations</h2>
    <p class="section-intro">
      Drive times to the places you've added.
    </p>
    
    ${customDestinations.map(dest => `
      <div class="destination-card custom-${dest.type}">
        <div class="dest-icon">${getIconForType(dest.type)}</div>
        <div class="dest-info">
          <h3>${dest.name}</h3>
          <p class="dest-address">${dest.address}</p>
          <p class="dest-time">${dest.driveTimeMinutes} minutes</p>
        </div>
      </div>
    `).join('')}
  </section>
` : ''}

<script>
function getIconForType(type) {
  const icons = {
    work: '💼',
    family: '🏠',
    medical: '⚕️',
    recreation: '⛳',
    other: '📍'
  };
  return icons[type] || '📍';
}
</script>
```

### Template Feature

**Save destinations as template:**
```javascript
// localStorage template storage
function saveAsTemplate(customDestinations) {
  const templates = JSON.parse(localStorage.getItem('destinationTemplates') || '[]');
  
  const templateName = prompt('Name this destination set:');
  if (!templateName) return;
  
  templates.push({
    name: templateName,
    destinations: customDestinations,
    createdAt: Date.now()
  });
  
  localStorage.setItem('destinationTemplates', JSON.stringify(templates));
}

// Load template
function loadTemplate(templateName) {
  const templates = JSON.parse(localStorage.getItem('destinationTemplates') || '[]');
  const template = templates.find(t => t.name === templateName);
  
  if (template) {
    // Populate form with template destinations
    template.destinations.forEach(dest => {
      addCustomDestination(dest);
    });
  }
}
```

### CSS

```css
/* Custom Destinations Input */
.custom-destinations-input {
  margin: 2rem 0;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 8px;
}

.custom-dest-row {
  display: grid;
  grid-template-columns: 1fr 2fr auto auto;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  align-items: center;
}

.custom-dest-row input,
.custom-dest-row select {
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 4px;
}

.custom-dest-row button {
  padding: 0.5rem;
  background: var(--red, #dc3545);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

/* Custom Destinations Display */
.destination-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  margin-bottom: 1rem;
  border-left: 4px solid var(--gold);
}

.destination-card.custom-work { border-left-color: #0066cc; }
.destination-card.custom-family { border-left-color: #28a745; }
.destination-card.custom-medical { border-left-color: #dc3545; }
.destination-card.custom-recreation { border-left-color: #fd7e14; }

.dest-icon {
  font-size: 2rem;
}

.dest-info h3 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
}

.dest-address {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0 0 0.25rem;
}

.dest-time {
  font-weight: 600;
  color: var(--gold);
  margin: 0;
}

@media (max-width: 768px) {
  .custom-dest-row {
    grid-template-columns: 1fr;
  }
}
```

## Acceptance Criteria
- [ ] Users can add custom destinations (name + address)
- [ ] Up to 10 custom destinations per report
- [ ] Drive times calculated for each custom destination
- [ ] Custom destinations displayed in report
- [ ] Each destination shows: name, address, drive time
- [ ] Icons/colors differentiate destination types
- [ ] Can remove destinations before generating report
- [ ] Custom destinations included in map (if FR-006 complete)
- [ ] Form validates addresses (basic check)
- [ ] Works on mobile and desktop
- [ ] Optional: Save as template for reuse

## Optional Enhancements (Future)
- [ ] Include custom destinations in scoring (user-weighted)
- [ ] Recurring destinations (auto-populate from history)
- [ ] Suggest common destinations ("Add your workplace?")
- [ ] Import from Google Maps saved places
- [ ] Share custom destination templates
- [ ] Weekly/monthly frequency input (affects scoring weight)
- [ ] Round-trip vs one-way commute option

## Testing Scenarios
1. **Add 1 custom destination** → Appears in report with drive time
2. **Add 5 custom destinations** → All display correctly
3. **Remove destination** → Removed from list
4. **Invalid address** → Shows error, doesn't break report
5. **Different types** → Icons/colors differentiate
6. **Mobile viewport** → Input form stacks properly
7. **Map integration** → Custom markers appear on map
8. **Save as template** → Can reload on next search

## API Considerations
- Each custom destination = 2 API calls (geocode + drive time)
- 5 custom destinations = 10 additional API calls
- Total with 5 custom: 6 core + 10 custom = **16 API calls**
- Rate limiting (FR-015) becomes important

## Dependencies
- No new NPM packages required
- Uses existing geocoding and drive time functions
- Optional: localStorage for templates

## Estimated Effort
**Medium** — 4-5 hours
- Input form UI (add/remove destinations)
- Server-side processing
- Geocoding and drive time calculation
- Report display section
- CSS styling
- Map integration (if FR-006 complete)
- Template save/load (optional)
- Testing and validation
