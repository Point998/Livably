# Denny Reports Skill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Claude Code skill that generates architectural briefs (Denny Reports) for Denny — a Senior SWE / enterprise architect — as peer-level technical briefings on the engineering state of Livably.

**Architecture:** Single skill file at `C:\Users\Borde\.claude\skills\denny-report\SKILL.md`. No supporting files. The skill reads git history, FR summaries, CLAUDE.md, and module structure, then generates a DR-NNN.md file and a Gmail draft to Nathan.

**Tech Stack:** Markdown, inline HTML email, Gmail MCP (`mcp__claude_ai_Gmail__gmail_create_draft`), git CLI, PowerShell

**Spec:** `docs/superpowers/specs/2026-05-31-denny-reports-design.md`

---

### Task 1: Create the skill directory

**Files:**
- Create: `C:\Users\Borde\.claude\skills\denny-report\` (directory)

- [ ] **Step 1: Create the directory**

```powershell
New-Item -ItemType Directory -Force "C:\Users\Borde\.claude\skills\denny-report"
```

Expected: `C:\Users\Borde\.claude\skills\denny-report` created.

- [ ] **Step 2: Verify**

```powershell
Test-Path "C:\Users\Borde\.claude\skills\denny-report"
```

Expected: `True`

---

### Task 2: Write the complete SKILL.md

**Files:**
- Create: `C:\Users\Borde\.claude\skills\denny-report\SKILL.md`

- [ ] **Step 1: Write the full SKILL.md**

Write this exact content to `C:\Users\Borde\.claude\skills\denny-report\SKILL.md`:

````markdown
---
name: denny-report
description: >
  Use when Nathan says "denny report", "DR report", "write a DR", "brief Denny",
  "update Denny", "send Denny a report", or "let's write a DR". Generates an
  architectural brief for Denny (Senior SWE / enterprise architect at The Home
  Depot, AI strategy leader) covering recent build decisions, architectural
  health, and the human-AI direction dynamic on the Livably project. Output:
  DR-NNN.md in docs/denny-reports/ plus a Gmail draft to Nathan for review
  and forwarding to Denny.
---

# Denny Report

## Purpose

Denny is Nathan's brother-in-law — Senior Software Engineer at The Home Depot
(enterprise scale) and one of the engineering leaders defining the company's
AI strategy and use cases. He has enterprise architecture background and
domain-driven design exposure.

Denny Reports (DR-NNN) give Denny an accurate, self-contained picture of:
- The engineering state of Livably
- Key architectural decisions made since the last report
- How Nathan's direction and Claude Code's interpretation are shaping the build
- Open architectural questions worth discussing when they talk

Nathan is the relay. He reads the report, discusses it with Denny when they
have time, and brings Denny's feedback back to Claude Code as directional
guidance. The report is a shared agenda for those conversations — it does not
ask Denny to do anything.

**The golden rule:** Denny has no context on FR numbers, module names, or
constraint history. Define things briefly when you reference them. Make every
report self-contained.

**Voice:** Peer-to-peer technical. Honest signal, no spin, no hedging
uncomfortable truths. The way one senior engineer briefs another.

## Step 1: Gather Context

Run these commands to understand what has changed since the last DR:

```bash
# Last DR report — for number and gap calculation
ls docs/denny-reports/ 2>/dev/null | sort -V | tail -1

# Date of last DR commit
git log --oneline --follow -- "docs/denny-reports/" | head -1

# All commits since last DR was written
git log --oneline --since="$(git log --format='%ai' -- docs/denny-reports/ 2>/dev/null | head -1 || echo '60 days ago')"

# FR summaries available
ls feature-requests/FR-*/summary.md 2>/dev/null | sort -V

# Current module structure
ls src/modules/

# Test file count
ls tests/ 2>/dev/null | wc -l

# Constraint count
grep -c "^\*\*CONSTRAINT-" CLAUDE.md 2>/dev/null

# Postmortems
ls docs/postmortems/ 2>/dev/null | sort -V | tail -5
```

Then **read** the content of:
- FR `summary.md` files completed since the last DR
- Any postmortem files newer than the last DR
- CLAUDE.md "Critical Engineering Constraints" section
- `src/modules/` directory to understand module coverage

Do **not** read: full source files, FR spec files, old implementation plans.
Denny needs architectural signal, not implementation detail.

## Step 2: Determine DR Number

```bash
ls docs/denny-reports/DR-*.md 2>/dev/null | sort -V | tail -1
```

If no reports exist, start at DR-001. Otherwise increment from the highest
number found.

Create the directory if needed:
```bash
mkdir -p docs/denny-reports
```

## Step 3: Generate a Slug

Kebab-case. Outcome-focused. Readable as a directory scan entry. Under 50
characters.

Good: `module-extraction-complete`, `depth-slider-architecture`,
      `test-suite-foundation`, `community-module-launch`
Bad:  `fr-040-through-fr-046`, `may-2026-update`, `recent-work`

## Step 4: Write the Report

Save to `docs/denny-reports/DR-{NNN}-{slug}.md`:

```markdown
# DR-{NNN}: {Title — architectural, not product-focused}

**Date:** {YYYY-MM-DD}
**FRs covered:** {FR-NNN, FR-NNN, ...}
**PRs:** {#N, #N}
**Status:** Active Build | Architecture Shift | Foundation Work

---

## TL;DR

{2–3 sentences. The engineering state right now — not product features.
What's solid, what's not, what's the headline. Denny should understand the
project's engineering picture in 30 seconds.}

## What Was Built

{Translate completed FRs into architectural observations. One bullet per FR
or logical group. Frame as what each proves or reveals about the structure,
not what users can do.

Translation guide:
- NOT: "Added a garden deep-dive chapter with 8 content tabs"
- YES: "Proved the bounded module pattern extends to content-heavy chapters —
  garden is the first module with sub-tab rendering, validating that
  template.js can handle arbitrary nesting without touching data or logic
  layers."

Skip FRs that are purely cosmetic or additive with no structural implication.}

## Architectural Health

| Area | Status | Notes |
|------|--------|-------|
| Module coverage | ● {Done/In Progress/Partial} | {N of 14 chapters extracted to bounded modules} |
| Three-layer rule (data/logic/template) | ● {status} | {clean or describe violations} |
| Test suite | ● {status} | {N test files, what's covered, what's missing} |
| Shared validation layer | ● {status} | {validate.js health — cross-module coherence rules} |
| Known technical debt | ● {None flagged/Amber/Red} | {specific items or "none flagged"} |
| Constraint count | ● {status} | {N constraints in CLAUDE.md; N added since last DR} |

{1–2 sentences of honest commentary. What's genuinely solid. What isn't.
No spin. If something is structurally weak, say so.}

{If any postmortems since last DR:}
**Recent PMs:** PM-NNN ({one-line: what broke, what rule it generated})

## How the Build Is Being Directed

{Honest third-person assessment of the human-AI collaboration. Cover all
three:

1. How Nathan's prompting is shaping architectural decisions — what patterns
   have emerged in how feature requests translate to structure.

2. Where Claude Code's interpretation has been on target — name specific
   examples.

3. Where it has drifted or required correction — be specific, no hedging.

This section gives Denny real signal about direction quality, not just output
quality. He is evaluating the whole system: the product, the build process,
and the human-AI loop together.

Example: "Nathan's direction has consistently prioritized foundation over
feature velocity — the module extraction was completed before new chapters
were added, which is the right call at this stage. Claude Code has largely
held the three-layer rule, but has needed correction on template.js scope
twice: business logic crept into HTML generation and was walked back."}

## Open Architectural Questions

{2–3 questions the project is implicitly answering right now. Conversation
starters for when Nathan and Denny talk — not requests for answers. Each
names the actual fork the project is currently navigating.

Format: bold question heading + 2–3 sentences of context showing what
decision the project is already making.}

**{Question title}**
{Context — what's been built, what assumption it's making, what the risk
is at scale or over time.}

## What's Coming

{Next 2–3 FRs in the queue. What they mean architecturally. Flag any that
have a structural implication Denny should be aware of before it's built.}

- **FR-NNN: {name}** — {architectural significance, not the feature
  description}
```

### Writing Guidelines

**Architectural lens only.** Every finding is about structure, not user
capability. "Module coverage is now 8 of 14 chapters" is architectural.
"Users can see flood zone data" is product.

**Define terms in context.** Write "validate.js (the shared coherence layer
that enforces cross-module rules)" not just "validate.js." Denny doesn't
know the codebase internals.

**Honest over polished.** If the test suite is thin, say so. If Claude Code
drifted from a constraint, say so. Denny will spot hedging.

**Short enough to read.** Target: under 2 minutes. If it runs long, trim
"What's Coming" first, then trim "What Was Built." Never trim Architectural
Health or How the Build Is Being Directed.

## Step 5: Draft the Email

After saving the report file, create a Gmail draft:

```
mcp__claude_ai_Gmail__gmail_create_draft
  to: nathan.a.borders@gmail.com
  subject: [Livably] DR-{NNN}: {Title}
  body: (HTML below)
```

Convert the report to this HTML structure. Every element **must** carry
explicit inline `color` and `background-color` — email clients strip
inherited styles.

```html
<body style="margin:0;padding:0;background-color:#0F0E0D;">
<div style="max-width:640px;margin:0 auto;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;background-color:#0F0E0D;color:#FAFAF9;color-scheme:dark only;-webkit-color-scheme:dark only;">

  <!-- Header bar -->
  <div style="background-color:#1C1917;padding:16px 24px;border-radius:8px 8px 0 0;border-bottom:1px solid #292524;">
    <span style="color:#F59E0B;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">Livably — Architecture Brief</span><br>
    <span style="color:#A8A29E;font-size:13px;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">DR-{NNN} · {YYYY-MM-DD}</span>
  </div>

  <!-- Body -->
  <div style="padding:24px;background-color:#1C1917;">

    <h1 style="font-size:26px;font-weight:700;color:#FAFAF9;margin:0 0 12px 0;padding-bottom:12px;border-bottom:3px solid #F59E0B;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">{Title}</h1>

    <!-- Meta-line -->
    <p style="font-size:13px;color:#A8A29E;margin:0 0 24px 0;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
      FRs: {FR-NNN, FR-NNN}
      <span style="color:#57534E;"> · </span>
      PRs: #{N}
      <span style="color:#57534E;"> · </span>
      <span style="color:#10B981;font-weight:600;">● Active Build</span>
    </p>

    <!-- TL;DR callout -->
    <div style="background-color:#292524;border-left:4px solid #F59E0B;padding:16px 20px;border-radius:4px;margin:0 0 32px 0;">
      <span style="font-size:12px;font-weight:600;color:#F59E0B;text-transform:uppercase;letter-spacing:0.5px;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">TL;DR</span>
      <p style="font-size:15px;color:#FAFAF9;line-height:1.6;margin:8px 0 0 0;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">{tldr_text}</p>
    </div>

    <!-- What Was Built -->
    <h2 style="font-size:18px;font-weight:600;color:#FAFAF9;margin:0 0 12px 0;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">What Was Built</h2>
    <ul style="font-size:15px;color:#E7E5E4;line-height:1.7;margin:0 0 32px 0;padding-left:20px;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
      <!-- One <li> per architectural observation -->
      <li style="margin-bottom:10px;">{observation}</li>
    </ul>

    <!-- Architectural Health table -->
    <h2 style="font-size:18px;font-weight:600;color:#FAFAF9;margin:0 0 12px 0;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">Architectural Health</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;font-family:'Inter','Helvetica Neue',Arial,sans-serif;margin-bottom:12px;">
      <thead>
        <tr style="border-bottom:2px solid #44403C;">
          <th style="text-align:left;padding:8px 12px;color:#A8A29E;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;background-color:#1C1917;">Area</th>
          <th style="text-align:left;padding:8px 12px;color:#A8A29E;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;background-color:#1C1917;">Status</th>
          <th style="text-align:left;padding:8px 12px;color:#A8A29E;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;background-color:#1C1917;">Notes</th>
        </tr>
      </thead>
      <tbody>
        <!-- Alternate rows: odd rows bg=#1C1917, even rows bg=#292524 -->
        <!-- Every td must have explicit background-color — Gmail ignores row-level bg -->
        <tr style="border-bottom:1px solid #292524;">
          <td style="padding:9px 12px;color:#E7E5E4;background-color:#1C1917;">Module coverage</td>
          <td style="padding:9px 12px;background-color:#1C1917;"><span style="color:#10B981;font-weight:600;">● Done</span></td>
          <td style="padding:9px 12px;color:#A8A29E;background-color:#1C1917;">{notes}</td>
        </tr>
        <tr style="border-bottom:1px solid #292524;">
          <td style="padding:9px 12px;color:#E7E5E4;background-color:#292524;">Three-layer rule</td>
          <td style="padding:9px 12px;background-color:#292524;"><span style="color:#F59E0B;font-weight:600;">● In Progress</span></td>
          <td style="padding:9px 12px;color:#A8A29E;background-color:#292524;">{notes}</td>
        </tr>
        <tr style="border-bottom:1px solid #292524;">
          <td style="padding:9px 12px;color:#E7E5E4;background-color:#1C1917;">Test suite</td>
          <td style="padding:9px 12px;background-color:#1C1917;"><span style="color:#F59E0B;font-weight:600;">● In Progress</span></td>
          <td style="padding:9px 12px;color:#A8A29E;background-color:#1C1917;">{notes}</td>
        </tr>
        <tr style="border-bottom:1px solid #292524;">
          <td style="padding:9px 12px;color:#E7E5E4;background-color:#292524;">Shared validation layer</td>
          <td style="padding:9px 12px;background-color:#292524;"><span style="color:#10B981;font-weight:600;">● Done</span></td>
          <td style="padding:9px 12px;color:#A8A29E;background-color:#292524;">{notes}</td>
        </tr>
        <tr style="border-bottom:1px solid #292524;">
          <td style="padding:9px 12px;color:#E7E5E4;background-color:#1C1917;">Known technical debt</td>
          <td style="padding:9px 12px;background-color:#1C1917;"><span style="color:#10B981;font-weight:600;">● None flagged</span></td>
          <td style="padding:9px 12px;color:#A8A29E;background-color:#1C1917;">{notes}</td>
        </tr>
        <tr>
          <td style="padding:9px 12px;color:#E7E5E4;background-color:#292524;">Constraint count</td>
          <td style="padding:9px 12px;background-color:#292524;"><span style="color:#10B981;font-weight:600;">● Active</span></td>
          <td style="padding:9px 12px;color:#A8A29E;background-color:#292524;">{N} constraints; {N} added since last DR</td>
        </tr>
      </tbody>
    </table>
    <p style="font-size:14px;color:#A8A29E;line-height:1.6;margin:0 0 32px 0;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">{health_commentary}</p>

    <!-- How the Build Is Being Directed -->
    <h2 style="font-size:18px;font-weight:600;color:#FAFAF9;margin:0 0 12px 0;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">How the Build Is Being Directed</h2>
    <p style="font-size:15px;color:#E7E5E4;line-height:1.6;margin:0 0 32px 0;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">{direction_content}</p>

    <!-- Open Architectural Questions -->
    <h2 style="font-size:18px;font-weight:600;color:#FAFAF9;margin:0 0 12px 0;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">Open Architectural Questions</h2>
    <div style="margin-bottom:32px;">
      <!-- One card per question (2-3 total) -->
      <div style="background-color:#292524;border-radius:6px;padding:14px 18px;margin-bottom:12px;">
        <p style="font-size:14px;font-weight:600;color:#FCD34D;margin:0 0 6px 0;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">{question_title}</p>
        <p style="font-size:14px;color:#D6D3D1;line-height:1.6;margin:0;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">{question_context}</p>
      </div>
    </div>

    <!-- What's Coming -->
    <h2 style="font-size:18px;font-weight:600;color:#FAFAF9;margin:0 0 12px 0;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">What's Coming</h2>
    <ul style="font-size:15px;color:#E7E5E4;line-height:1.7;margin:0;padding-left:20px;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
      <li style="margin-bottom:10px;"><strong style="color:#FAFAF9;">{FR-NNN: name}</strong> — {architectural significance}</li>
    </ul>

  </div>

  <!-- Footer -->
  <div style="padding:16px 24px;border-top:1px solid #292524;background-color:#1C1917;border-radius:0 0 8px 8px;">
    <p style="font-size:12px;color:#78716C;margin:0;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
      Livably · Architecture Brief<br>
      Generated {YYYY-MM-DD}.
    </p>
  </div>

</div>
</body>
```

**Status dot reference:**
- `<span style="color:#10B981;font-weight:600;">● Done</span>` — green
- `<span style="color:#F59E0B;font-weight:600;">● In Progress</span>` — amber
- `<span style="color:#EF4444;font-weight:600;">● Needs Attention</span>` — red
- `<span style="color:#A8A29E;font-weight:600;">● N/A</span>` — gray

## Step 6: Two-Phase Delivery

1. After writing the `.md` file and creating the Gmail draft, show Nathan
   **inline**:
   - The full TL;DR text
   - The Architectural Health table (as markdown)

2. State: "Report drafted at `docs/denny-reports/DR-{NNN}-{slug}.md`.
   Gmail draft ready in your inbox — review and forward to Denny when
   ready. Let me know if anything needs adjusting."

3. **Stop and wait for approval.** Do not mark complete until Nathan
   explicitly approves (e.g., "looks good", "send it", "go ahead").

4. If Nathan requests edits: update both the `.md` file and Gmail draft,
   then re-show the updated TL;DR and health table.

5. Once approved: "Gmail draft is ready in your inbox."

**If Gmail MCP is unavailable:** Save the report file and tell Nathan to
forward `docs/denny-reports/DR-{NNN}-{slug}.md` to Denny manually.
````

- [ ] **Step 2: Verify the file was written**

```powershell
Test-Path "C:\Users\Borde\.claude\skills\denny-report\SKILL.md"
```

Expected: `True`

- [ ] **Step 3: Check file length is reasonable**

```powershell
(Get-Content "C:\Users\Borde\.claude\skills\denny-report\SKILL.md" | Measure-Object -Line).Lines
```

Expected: 200–280 lines. If significantly shorter, the write likely truncated.

---

### Task 3: Validate with DR-001

**Files:**
- Create: `docs/denny-reports/DR-001-{slug}.md` (generated by the skill)

This task validates the skill produces correct output by running it once on the current project state.

- [ ] **Step 1: Invoke the skill**

Say to Claude Code: "denny report"

The skill should activate and begin gathering context automatically.

- [ ] **Step 2: Verify context gathering**

The skill should run these commands and read these files before writing:
- `git log --oneline` (recent commits)
- `ls feature-requests/FR-*/summary.md` (recent FR summaries)
- `ls src/modules/` (module structure)
- `grep -c CONSTRAINT- CLAUDE.md` (constraint count)
- `ls docs/postmortems/` (postmortems)
- Read content of recent FR summaries

If it skips any of these, the skill description may not be loading properly.

- [ ] **Step 3: Review DR-001 output for these quality checks**

**TL;DR check:** Is it architectural (not product)? Does it name the engineering state honestly?

**What Was Built check:** Is each bullet an architectural observation, not a feature description? Do the bullets reference specific architectural decisions (module extraction, three-layer rule, depth slider pattern)?

**Architectural Health check:** Does the table have all 6 rows? Are the status dots accurate vs. current project state? Is the commentary honest (test suite is NOT fully comprehensive yet)?

**How the Build Is Being Directed check:** Is it third person? Does it name specific examples of on-target and off-target interpretation? Does it avoid hedging?

**Open Architectural Questions check:** Are the questions genuinely architectural? Do they reflect real forks the project is navigating right now?

**Voice check:** Could a senior engineer at a large company read this without needing project context? Is every technical term defined briefly?

- [ ] **Step 4: Check Gmail draft was created**

Open Gmail (nathan.a.borders@gmail.com) and verify a draft exists with:
- Subject: `[Livably] DR-001: {title}`
- Dark background renders correctly
- TL;DR callout box visible
- Architectural Health table has alternating row colors
- Footer present

- [ ] **Step 5: If output needs adjustment, note the gap**

Do NOT edit the DR-001 content by hand. Instead, identify which section of
SKILL.md needs clarification and update that section. Then regenerate.

Common gaps to watch for:
- "What Was Built" reads like a changelog → add more examples to the translation guide in the skill
- "How the Build Is Being Directed" is too vague → strengthen the instruction to name specific examples
- Email formatting breaks → check that every `<td>` has explicit `background-color`

- [ ] **Step 6: Commit the skill and first report**

```bash
git add docs/denny-reports/DR-001-*.md
git commit -m "feat: add denny-report skill + generate DR-001"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Trigger keywords — covered in SKILL.md frontmatter description
- ✅ Context gathering (git log, FR summaries, modules, constraints, postmortems) — Step 1
- ✅ DR number determination — Step 2
- ✅ All 6 report sections — Step 4 template
- ✅ Writing guidelines — inline in Step 4
- ✅ Email format (dark theme, simplified) — Step 5 HTML template
- ✅ Status dot reference — Step 5
- ✅ Two-phase delivery — Step 6
- ✅ Fallback if Gmail unavailable — Step 6
- ✅ Manual trigger only (no soft nudge) — spec update applied
- ✅ File location `docs/denny-reports/DR-NNN-{slug}.md` — Step 4
- ✅ Skill location `~/.claude/skills/denny-report/SKILL.md` — Task 2

**No placeholders found.** All steps contain actual content.
