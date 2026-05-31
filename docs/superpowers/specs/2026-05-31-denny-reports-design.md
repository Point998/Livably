# Denny Reports — Design Spec
*2026-05-31*

---

## Overview

Denny Reports (DR-NNN) are periodic architectural briefs for Denny — Nathan's brother-in-law, Senior Software Engineer at The Home Depot, and one of the company's leaders on AI strategy and enterprise architecture. They are the architectural mirror of Nathan Reports: same project, opposite audience.

Where Nathan Reports translate engineering work into plain business language for a non-technical project owner, Denny Reports translate the same work into peer-level architectural language for a senior engineer who has no day-to-day context on the build.

**The two purposes this serves:**
1. Give Denny an accurate, honest picture of the architectural state of Livably without requiring him to read code or follow the feature request queue
2. Create a structured pull channel for Denny's input — rather than a general knowledge dump from occasional conversations, the report gives him a specific view to respond to, so his feedback stays Livably-targeted

Nathan is the translator. He ingests Denny's feedback from their conversations and brings it back to Claude Code as directional guidance. The report is a shared agenda for those conversations, not a formal request-for-answers.

---

## Audience

**Denny** — Senior SWE at The Home Depot (enterprise scale). One of the engineering leaders defining the company's AI strategy and use cases. Has enterprise architecture background, domain-driven design exposure, and opinionated views on what "built right" looks like at scale.

He is not following the project day-to-day. He has no context on recent FRs, the constraint list, or the module structure. The report must be self-contained enough to be useful without prior briefing.

**Voice:** Peer-to-peer technical. Not jargon-dumping, but not dumbed down. The way one senior engineer briefs another: honest signal, no spin, no celebration, no hedging uncomfortable truths.

---

## Trigger

Manual invocation only. Nathan says one of:
- "denny report" / "DR report" / "write a DR"
- "brief Denny" / "update Denny" / "send Denny a report"
- After completing FRs: "let's write a DR" / "denny update"

Nathan controls cadence entirely. No automatic nudge or count-based trigger. Revisit if a scheduling convention becomes useful later.

---

## Report Sections

### Header Metadata
DR number, date, FRs covered since last report, PR links.

### TL;DR
2–3 sentences. The architectural state right now — not product features. What's holding, what's not, what's the headline. Written so Denny can understand the project's engineering situation in 30 seconds.

### What Was Built
Recent FRs translated architecturally. Not a product changelog — each entry is one architectural observation. Example framing: not "we added a garden chapter" but "we proved the bounded module pattern scales beyond the original four chapters — garden was the first greenfield module built under the new structure."

One observation per FR or logical group of FRs. Architectural significance only; skip FRs that are purely cosmetic or additive with no structural implication.

### Architectural Health
Candid snapshot of the foundation. Covers:
- Module coverage (N of 14 chapters extracted to proper modules)
- Constraint count (current number in CLAUDE.md, any added since last DR)
- Test suite depth (test file count, what's covered, what's not)
- Layer separation adherence (any violations found or fixed)
- Known technical debt (honest, not exhaustive)
- Recent postmortems (PM-NNN slug and one-line description if any since last DR)

Uses a status table with `●` dots (green/amber/red) for glanceable reading.

### How the Build Is Being Directed
The section Nathan Reports doesn't have. An honest assessment of:
- How Nathan's prompting and direction is shaping architectural decisions
- Where Claude Code's interpretation has been on target
- Where it has drifted or required correction
- What patterns are emerging in how feature requests translate to architecture

Written for Denny to understand the human-AI collaboration dynamic on this project. This section is what makes DR reports useful as a feedback mechanism — it gives Denny specific, honest signal about the direction quality, not just the output quality.

### Open Architectural Questions
2–3 questions the project is implicitly answering right now. Not demands for Denny's input — conversation starters. Framed as "these are the live forks in the road" so Nathan and Denny have something concrete to discuss.

Examples of the kind of question this section asks:
- "The depth slider system creates four rendering modes per chapter. That works across 14 chapters today. At what point does that become a maintenance surface problem?"
- "The validate.js shared layer owns all cross-module coherence rules. That was the right call at current scale. When does a single shared validator become a bottleneck?"

These questions come from real decisions in the recent build, not hypotheticals.

### What's Coming
Next 2–3 FRs on deck. What they mean architecturally. Any upcoming FR that has a structural implication Denny should be aware of before it's built.

---

## File Output

`docs/denny-reports/DR-NNN-{slug}.md`

Slug is kebab-case, outcome-focused, readable as a directory scan. Example: `module-extraction-complete`, `depth-slider-architecture`, `test-suite-foundation`.

Number increments from highest existing DR in the directory.

---

## Email Delivery

**Delivery:** Gmail draft to Nathan (nathan.a.borders@gmail.com). Nathan reviews and forwards to Denny. Not sent directly to Denny.

**Subject:** `[Livably] DR-NNN: {Title}`

**Format:** Clean dark email — same color family as Nathan Reports (amber/dark palette) but stripped down. No step-cards, no Mermaid diagrams, no inline code snippets. Sections, a TL;DR callout box, and the Architectural Health status table. Signals "peer technical brief" not "executive newsletter."

**Email structure:**
```
Header bar:   Livably — Architecture Brief  |  DR-NNN · {date}
H1:           {Report title}
Meta-line:    FRs covered · PRs merged · status dot

TL;DR box:    Amber left-border callout

Sections:     What Was Built
              Architectural Health  (status table)
              How the Build Is Being Directed
              Open Architectural Questions
              What's Coming

Footer:       Livably · Denny Report · Generated {date}
```

**Two-phase delivery:**
1. Skill generates the `.md` file and Gmail draft
2. Shows Nathan the TL;DR and Architectural Health table inline
3. Waits for approval
4. Nathan approves → draft ready in Gmail to forward

---

## What the Skill Reads

In order of priority:

| Source | Purpose |
|--------|---------|
| `git log --oneline` since last DR commit | What changed |
| `feature-requests/FR-NNN/summary.md` files newer than last DR | Completed FRs |
| `docs/denny-reports/` last file | DR number + gap calculation |
| `CLAUDE.md` constraints section | Constraint count, new constraints |
| `docs/postmortems/` | New PMs since last DR |
| `src/modules/` directory structure | Module count and coverage |
| `tests/` directory | Test file count as coverage proxy |

Does **not** read: full codebase, FR spec files, old implementation plans. Denny needs architectural signal, not implementation detail.

---

## Skill File Location

`~/.claude/skills/denny-report/SKILL.md`

Single file, everything inline. No supporting files needed — the email template is simpler than Nathan Reports and fits within a single SKILL.md.

---

## Design Principles

- **Honest over polished.** If something is structurally weak, say so. Denny will notice hedging.
- **Architectural lens, not product lens.** Every finding is framed as "what does this mean for the structure" not "what can users do now."
- **Nathan is the relay.** The report gives Nathan and Denny a shared accurate view. Nathan translates Denny's response back to Claude Code. The report is not asking Denny to do anything.
- **Self-contained.** Denny has no project context. The report must be readable without knowing the FR queue or module history.
- **Short enough to read.** Target: under 2 minutes. If it runs long, trim "What's Coming" first, then trim "What Was Built."

---

## Out of Scope

- Scheduling / automatic trigger (Approach B — deferred indefinitely, revisit if cadence convention becomes useful)
- Phase 6 workflow integration (Approach C — deferred to separate session on 6-phase skill)
- Direct email to Denny (always goes to Nathan first)
- Project-level skills for constraint enforcement and 6-phase workflow (separate session)
