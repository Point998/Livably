# FR-017 — School Ratings & District Information

## What
Integrate school ratings, district information, and school boundaries to help families evaluate education quality near any address.

## Problem
Families with children (or planning for children) need to know:
- Which schools serve this address?
- Are the schools highly rated?
- What are test scores and student outcomes?
- Where are school boundaries?

Currently, buyers must research this separately on GreatSchools, SchoolDigger, or district websites.

## Requirements

### School Data Display
For each address, show:
- **Elementary School** serving this address
- **Middle School** serving this address
- **High School** serving this address

### Information Per School
- School name and address
- **Rating** (1-10 scale from GreatSchools)
- Distance from home address
- Public vs Private vs Charter
- Student-teacher ratio
- Test scores (state proficiency percentages)
- Enrollment size
- Link to school's profile page

### Visual Indicators
- Color-coded ratings:
  - 8-10: Green (Excellent)
  - 6-7: Gold (Good)
  - 4-5: Orange (Average)
  - 1-3: Red (Below Average)
- School boundary overlay on map (optional enhancement)

### Report Section
New section: "Schools" 🏫
- Appears after "Things to Know" or "Additional Services"
- Three subsections: Elementary, Middle, High
- Each shows rating badge, key stats, and distance

## Implementation Notes

### API Options

**Option 1: GreatSchools API** (Recommended)
- Free tier: 2,500 requests/day
- Provides ratings, reviews, test scores
- Well-documented API
- Data for US schools

**Endpoint example:**
```javascript
// Find schools near location
GET https://api.greatschools.org/schools/nearby?lat=LAT&lon=LON&distance=5&limit=10

// Get school details
GET https://api.greatschools.org/school/CA/1234
```

**Option 2: Niche API**
- More detailed rankings
- Paid API (pricing varies)
- Includes student reviews

**Option 3: School Digger API**
- Free for non-commercial use
- Good data coverage
- State rankings available

---

### GreatSchools API Integration

```javascript
const GREATSCHOOLS_API_KEY = process.env.GREATSCHOOLS_API_KEY;
const GREATSCHOOLS_BASE = 'https://api.greatschools.org';

async function findSchoolsNearAddress(lat, lng) {
  try {
    // Search for schools within 5 miles
    const response = await fetch(
      `${GREATSCHOOLS_BASE}/schools/nearby?` +
      `lat=${lat}&lon=${lng}&distance=5&limit=30&` +
      `api_key=${GREATSCHOOLS_API_KEY}`
    );
    
    const schools = await response.json();
    
    // Separate by level
    const elementary = schools.filter(s => 
      s.levelCode === 'e' || s.levelCode === 'p' // elementary or primary
    ).sort((a, b) => a.distance - b.distance)[0];
    
    const middle = schools.filter(s => 
      s.levelCode === 'm' // middle school
    ).sort((a, b) => a.distance - b.distance)[0];
    
    const high = schools.filter(s => 
      s.levelCode === 'h' // high school
    ).sort((a, b) => a.distance - b.distance)[0];
    
    return {
      elementary: elementary ? await getSchoolDetails(elementary.id) : null,
      middle: middle ? await getSchoolDetails(middle.id) : null,
      high: high ? await getSchoolDetails(high.id) : null
    };
  } catch (error) {
    console.error('GreatSchools API error:', error);
    return { elementary: null, middle: null, high: null };
  }
}

async function getSchoolDetails(schoolId) {
  const response = await fetch(
    `${GREATSCHOOLS_BASE}/school/${schoolId}?api_key=${GREATSCHOOLS_API_KEY}`
  );
  
  const school = await response.json();
  
  return {
    name: school.name,
    address: school.address,
    rating: school.rating || 'N/A',
    ratingOutOf: 10,
    distance: school.distance,
    type: school.type, // Public, Charter, Private
    students: school.enrollment,
    studentTeacherRatio: school.studentTeacherRatio,
    testScores: school.testScores,
    gradesServed: school.gradesServed,
    link: school.url
  };
}
```

### HTML Template

```html
<section class="schools-section">
  <h2>Schools 🏫</h2>
  <p class="section-intro">
    Schools serving this address based on district boundaries and proximity.
  </p>
  
  ${renderSchoolCard('Elementary School', schools.elementary)}
  ${renderSchoolCard('Middle School', schools.middle)}
  ${renderSchoolCard('High School', schools.high)}
</section>

<script>
function renderSchoolCard(level, school) {
  if (!school) {
    return `
      <div class="school-card">
        <h3>${level}</h3>
        <p class="school-unavailable">School data not available for this area.</p>
      </div>
    `;
  }
  
  const ratingClass = getRatingClass(school.rating);
  
  return `
    <div class="school-card">
      <div class="school-header">
        <h3>${level}</h3>
        <div class="school-rating rating-${ratingClass}">
          ${school.rating}/10
        </div>
      </div>
      
      <div class="school-name">${school.name}</div>
      <div class="school-address">${school.address}</div>
      <div class="school-distance">${school.distance} miles away</div>
      
      <div class="school-stats">
        <div class="stat">
          <span class="stat-label">Type</span>
          <span class="stat-value">${school.type}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Students</span>
          <span class="stat-value">${school.students}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Student/Teacher</span>
          <span class="stat-value">${school.studentTeacherRatio}:1</span>
        </div>
      </div>
      
      ${school.testScores ? `
        <div class="test-scores">
          <strong>Test Scores:</strong>
          <span>${school.testScores.reading}% Reading</span>
          <span>${school.testScores.math}% Math</span>
        </div>
      ` : ''}
      
      <a href="${school.link}" target="_blank" class="school-link">View full profile →</a>
    </div>
  `;
}

function getRatingClass(rating) {
  if (rating >= 8) return 'excellent';
  if (rating >= 6) return 'good';
  if (rating >= 4) return 'average';
  return 'below-average';
}
</script>
```

### CSS

```css
.schools-section {
  margin: 3rem 0;
}

.school-card {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.school-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid var(--border);
}

.school-header h3 {
  font-family: var(--font-serif);
  font-size: 1.3rem;
  margin: 0;
}

.school-rating {
  font-size: 1.5rem;
  font-weight: 700;
  padding: 0.5rem 1rem;
  border-radius: 8px;
}

.rating-excellent {
  background: rgba(40, 167, 69, 0.1);
  color: #28a745;
}

.rating-good {
  background: rgba(212, 175, 55, 0.1);
  color: var(--gold);
}

.rating-average {
  background: rgba(253, 126, 20, 0.1);
  color: #fd7e14;
}

.rating-below-average {
  background: rgba(220, 53, 69, 0.1);
  color: #dc3545;
}

.school-name {
  font-weight: 600;
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
}

.school-address {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}

.school-distance {
  color: var(--gold);
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.school-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin: 1rem 0;
  padding: 1rem;
  background: var(--cream);
  border-radius: 4px;
}

.stat {
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.stat-value {
  display: block;
  font-weight: 600;
  font-size: 1rem;
}

.test-scores {
  margin: 1rem 0;
  padding: 0.75rem;
  background: #f0f8ff;
  border-radius: 4px;
  font-size: 0.9rem;
}

.test-scores span {
  margin-left: 1rem;
}

.school-link {
  display: inline-block;
  margin-top: 1rem;
  color: var(--gold);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
}

.school-link:hover {
  text-decoration: underline;
}

.school-unavailable {
  color: var(--text-secondary);
  font-style: italic;
  padding: 1rem 0;
}

@media (max-width: 768px) {
  .school-stats {
    grid-template-columns: 1fr;
  }
}
```

## Acceptance Criteria
- [ ] Report shows elementary, middle, and high schools
- [ ] Each school displays rating (1-10), distance, and key stats
- [ ] Ratings color-coded (green/gold/orange/red)
- [ ] Student-teacher ratio displayed
- [ ] Test scores shown when available
- [ ] Link to full school profile
- [ ] Graceful handling when school data unavailable
- [ ] Works for addresses nationwide
- [ ] Tested with urban, suburban, and rural addresses
- [ ] Mobile responsive

## Optional Enhancements (Future)
- [ ] School boundary overlay on map
- [ ] Multiple school options (show top 3 per level)
- [ ] Private school alternatives
- [ ] Charter school information
- [ ] School comparison table
- [ ] Historical rating trends
- [ ] Parent reviews/testimonials
- [ ] Extracurricular programs info

## API Considerations

### Rate Limits
- GreatSchools Free: 2,500 requests/day
- 3 API calls per report (elementary, middle, high details)
- With caching (FR-014), can support ~800 reports/day

### Cost
- GreatSchools: Free for basic data
- Premium data requires partnership/licensing

### Data Quality
- Coverage: Excellent for public schools, limited for private
- Freshness: Updated annually (test scores lag 1-2 years)
- Accuracy: Generally reliable, but verify with district websites

## Privacy & Compliance

- GreatSchools Terms: Must display "Powered by GreatSchools" attribution
- FERPA compliance: Don't display individual student data
- Fair Housing: Don't use school ratings as primary selling point (legal gray area)

## Dependencies

```bash
npm install node-fetch  # If not already installed
```

Or use native `fetch` in Node 18+

## Environment Variables

Add to `.env`:
```
GREATSCHOOLS_API_KEY=your_key_here
```

Sign up at: https://www.greatschools.org/api/

## Estimated Effort
**Medium-High** — 5-6 hours
- GreatSchools API integration
- Three school level searches
- School details fetching
- HTML template for school cards
- CSS styling with color-coded ratings
- Error handling for missing data
- Testing across different locations
- Attribution requirements
