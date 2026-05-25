# NR-001 — Architecture Review & Strategic Reset
*Nathan Borders — May 2026*

## The Honest Assessment

Livably was built as a sponge, not concrete. Fast visible progress, impressive demos, real data rendering — but the foundation was never right. Two files doing everything. No tests. No module boundaries. No validation layer. Bugs like the Jeffersonville school were inevitable and there will be more like it.

The project did not suffer from lack of vision or wrong product decisions. The product instincts throughout have been correct:
- No scoring (right)
- Three buckets not grades (right)  
- What Will Grow Here as differentiator (right)
- Eclectic chapter color system (right)
- The Livably Sketch concept (right)

The project suffered from building on an unexamined foundation. Features were added to a structure that was never designed to support them. Every new chapter made the structural problem worse.

## The Decision

Rebuild the bones. Not the product — the bones. The chapters stay. The data stays. The design direction stays. The module structure, the logic layer, the test suite — these get rebuilt properly.

This is the right time to do it:
- Before monetization
- Before launch
- Before a second developer touches the code
- Before the codebase is 10x larger

## The Sponge vs Concrete Principle

A sponge grows fast and looks impressive. It collapses under real weight. Concrete rises slower but can support anything built on top of it.

The next several sessions are concrete work. The product will look the same to a buyer. The foundation underneath will be completely different. Every feature after the rebuild will be faster, more reliable, and more maintainable than anything built before it.

## What Changes

1. Modular architecture — one folder per chapter, each with data/logic/template
2. Logic Layer — validate.js catches coherence errors before buyers see them
3. Test suite — every business rule is testable and tested
4. Numbered constraints in CLAUDE.md — every bug becomes a rule
5. Postmortems — every bug is documented so it never recurs
6. Docs folder — engineering decisions are recorded, not just features

## What Stays the Same

- The product vision
- The chapter content
- The design direction (LIVABLY-DESIGN-BRIEF.md)
- The feature request queue
- GitHub workflow

## Success Criteria for the Rebuild

The rebuild is complete when:
- Running the report for any US address produces coherent, jurisdictionally correct results
- Every business rule has a corresponding test
- Adding a new chapter takes less than 2 hours (one module folder, four files)
- A bug fix touches exactly one file
- Claude Design output slots directly into a template file with no other changes needed
