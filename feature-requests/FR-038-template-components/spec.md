# FR-038 Spec — Template Components
*Phase 4a of the Module Restructure*
*Status: Spec*

---

## What This Is

Extract shared HTML elements used across all chapters into reusable components in `src/templates/components/`. Each component is a pure function: takes data, returns an HTML string. No API calls, no business logic.

This is the prerequisite for FR-039 (chapter templates). Components must exist before individual chapter template files can import them.

---

## Components to Build

### `buckets.js`
Renders the three-bucket finding framework: Things to Consider / Things to Check / Cool Things to Know.

```js
renderBuckets({ consider: [], check: [], know: [] }) → HTML string
```

Each bucket item: `{ icon: string, text: string }`

### `keyTakeaway.js`
Renders the single key takeaway callout at the top of each chapter.

```js
renderKeyTakeaway({ icon: string, text: string }) → HTML string
```

### `badge.js`
Renders the Excellent / Good / Fair / Consider badge used on destinations and findings.

```js
renderBadge({ label: string, level: 'excellent'|'good'|'fair'|'consider' }) → HTML string
```

Level maps to a CSS class, not an inline style (CONSTRAINT-008).

### `checklist.js`
Renders an action item checklist (Things to Check items that need buyer action).

```js
renderChecklist({ items: [{ text: string, url?: string }] }) → HTML string
```

### `destCard.js`
Renders a destination drive-time card — name, address, drive time, optional badge.

```js
renderDestCard({ name: string, address: string, driveTimeMinutes: number, badge?: object }) → HTML string
```

Uses `formatDriveTime` from `src/utils/text.js` for display.

### `footer.js`
Renders the chapter research footer: source name + research date.

```js
renderFooter({ source: string, date: string }) → HTML string
```

---

## What These Components Are NOT

- Not business logic — they do not decide what to show, only how to render what they receive
- Not data fetchers — zero API calls
- Not scoring UI — no numerical ratings (CONSTRAINT-001)
- Not inline-styled — all visual appearance via CSS classes (CONSTRAINT-008)

---

## File Structure

```
src/templates/
  components/
    buckets.js
    keyTakeaway.js
    badge.js
    checklist.js
    destCard.js
    footer.js
    index.js        ← re-exports all components
```

---

## Acceptance Criteria

- [ ] All 6 components exist in `src/templates/components/`
- [ ] Each component is a pure function with no side effects
- [ ] Zero `style=""` attributes in any component output (CONSTRAINT-008)
- [ ] Zero API calls or business rules in any component
- [ ] `index.js` re-exports all components
- [ ] Tests in `tests/templates/components/` for each component
- [ ] Each test asserts: returns string, contains expected class names, handles empty/null inputs gracefully
