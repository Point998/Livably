# FR-063 - Source-Verification Harness: Summary

Phase 4 complete. June 15 2026. Branch FR-063-source-verification-harness.
Designed as Track A item 2 (NR-004 / IMPLEMENTATION_ROADMAP). Built via subagent-driven development (per-task spec plus two-stage quality review), sequenced behind Hardening Stage 0 per the roadmap.

## What shipped

A standalone self-discovering monitor that proves each live external data source still returns real data, closing the observability gap that let the FCC 405 and NREL DNS failures hide behind graceful degradation.

1. The harness - scripts/verify-sources.js (entry point, npm run verify:sources) plus scripts/lib/:
   - discoverSources.js - globs src/modules/*/data.js, requires each, flattens its SOURCES array tagged with module name. Skips non-directories cleanly (dirent-based loop).
   - resolveContext.js - geocodes the 5 CLAUDE.md test addresses once into context objects (address, lat, lng, state, county, fips).
   - evaluateCell.js - per-cell evaluation: skip rules (deferred / missing key), then flap tolerance (retry-once), then final outcome.
   - pool.js - runWithProviderLimit, bounding concurrency per upstream provider.
   - verdict.js - pure verdict engine (per-source coverage policy plus exit code), unit-testable without I/O.
   - render.js - renders the module by address verdict matrix for human output; --json gives the machine-readable form for CI.
2. The SOURCES descriptor - every one of the 14 modules' data.js files now exports a SOURCES array. 41 descriptors total, real count via discoverSources:

   | Module | Count |
   |---|---|
   | sensory | 9 |
   | climate | 5 |
   | utilities | 5 |
   | growth | 4 |
   | health | 4 |
   | garden | 3 |
   | reachability | 3 |
   | property | 2 |
   | access | 1 |
   | community | 1 |
   | recreation | 1 |
   | safety | 1 |
   | schools | 1 |
   | walkability | 1 |
   | TOTAL | 41 |

3. Structural contract test - tests/verify-sources.test.js (Jest, mocked, no live calls): the verdict engine matrix (coverage all/some by FAIL/INFO/PASS/SKIPPED, flap-tolerance retry-then-OK, rate-limit to SKIPPED) plus a structural pass asserting every module exports a well-formed SOURCES array and every swallow-to-empty source carries a probe.
4. Scheduled workflow - .github/workflows/verify-sources.yml, separate from ci.yml: triggers on schedule (Mondays 06:00 UTC) plus workflow_dispatch only, never push/PR. Runs verify:sources with --json, uploads the JSON as an artifact, and opens/updates/closes a labelled source-health GitHub issue based on verdict.
5. Cache bypass - LIVABLY_VERIFY=1 (set at the top of verify-sources.js before anything else loads) makes src/cache.js get/set short-circuit to a no-op, so every run/probe call hits the network live; a dead source whose last-good payload is cached still reads FAIL.

## The descriptor contract

Each data.js adds, alongside its existing exports, a SOURCES array. Each entry has:

- id - unique within the module
- label - human-readable, for the matrix
- provider - upstream quota domain, drives concurrency grouping
- coverage - 'all' or 'some', drives verdict policy
- requiresKey - optional env var name; blank key means SKIPPED (no key)
- status - optional, defaults 'active'; 'deferred' means SKIPPED (deferred)
- run(ctx) - calls the module's real fetcher with context-mapped args
- isValid(result) - content check
- probe(ctx) - optional reachability check, see below

probe is the targeted fix for swallow-to-empty sources whose fetcher catches its own transport errors and returns the same empty/null value for "genuinely empty" and "endpoint is dead" (for example FEMA declarations). For those, isValid alone cannot tell outage from real emptiness, so the source supplies a lightweight HTTP-status probe built from the same constants.js URL the real fetcher uses. When present, a cell is OK only if the probe is reachable and isValid(run(ctx)) passes.

## Verdict policy

Per source, evaluated across the 5 addresses (SKIPPED cells excluded from the denominator):

- coverage 'all': must be valid everywhere; invalid at one or more addresses means FAIL.
- coverage 'some': legitimately empty somewhere is fine; invalid at all addresses means FAIL; invalid at 1 to 4 means INFO (exit-neutral, surfaced but not alarmed); 0 invalid means PASS.
- All cells SKIPPED (no key / deferred / rate-limited on retry) means source verdict SKIPPED, never counted toward FAIL.

## Four monitor-grade properties

A naive "call it once and check the result" script would be noisy and easy to ignore. Four properties make this a monitor instead of a flaky script:

1. Flap tolerance - every cell gets run/probe once, and on any failure (throw, timeout, unreachable probe, isValid false) waits a short backoff and retries once before scoring FAIL. A single dropped request self-heals; only sustained failure alarms.
2. Per-provider concurrency cap - runWithProviderLimit bounds concurrent calls per upstream provider (cap 2) so the harness's own parallelism never trips a host's rate limit. A 429 on both attempts reads as SKIPPED (rate-limited), never FAIL; throttling is not an outage.
3. Cache bypass (liveness, not cached) - LIVABLY_VERIFY=1 forces every cell to hit the network, so a dead source can't hide behind a stale cached success.
4. GitHub-issue alerting on FAIL - the scheduled workflow opens/updates a single de-duped source-health issue listing the failing module/source pairs on a red run, and comments plus closes it on the next green run. A monitor nobody sees is decorative; this is the visible alert path (cron-failure email is the fallback, not the primary).

## Test delta

- Main was 1,406 tests (76 suites) before this branch.
- Full suite is now 1,470 tests, 77 suites, all green (+64).
- tests/verify-sources.test.js alone: 63 tests, all mocked, no live network calls, runs under Jest like any other suite.

## Known limitations / follow-ups

1. Google key is IP-restricted, not CI-usable. The project's GOOGLE_MAPS_API_KEY is IP-restricted and will NOT geocode from GitHub's dynamic runner IPs. The scheduled workflow needs a separate CI-usable Google key supplied as a repo secret, or Google-provider sources will only ever verify on local/allowlisted runs. This also blocked a live end-to-end smoke run in the dev sandbox during this build; the harness was validated with synthetic contexts in the test suite, and all non-Google live upstreams returned real OK.
2. Granularity is per (provider + endpoint), not per query variant. Same-endpoint calls were deliberately collapsed to one representative descriptor per module, for example iNaturalist's roughly 10 species/season query variants collapsed to one descriptor, and repeated Google Places nearby-search calls collapsed to one descriptor per module. This catches total-outage detection correctly, but a single variant silently failing while its siblings succeed is not individually monitored. Deliberate v1 scope.
3. Swallow-to-empty without a probe is still a blind spot. Every known swallow-to-empty source (FEMA, etc.) carries a probe in this FR. But the contract does not enforce that every future swallow-to-empty source adds one; a new source written the same way without a probe would read OK while dead. The generalized fix is the NR-004 Stage 2 observability layer; this FR is the targeted down-payment, not the full fix.
4. FCC broadband is status: deferred. The live endpoint exists but its repair is tracked separately by FR-062 (FCC BDC token, human-in-the-loop). Deferred here so a source already known to be dead does not make the monitor permanently red; it reports SKIPPED (deferred), not FAIL.

## Post-merge human step

Before the scheduled workflow can run for real, add these as GitHub Actions repo secrets: GOOGLE_MAPS_API_KEY (must be a CI-usable key, not the IP-restricted production one, see limitation 1), NOAA_CDO_API_KEY, NREL_API_KEY, EIA_API_KEY, CENSUS_API_KEY, AIRNOW_API_KEY, OPENCHARGEMAP_API_KEY. Then trigger Actions, Source Health, Run workflow once to confirm the matrix renders and the issue-alerting path works end to end.

## 4-phase workflow

All four phases done: discovery (discovery.md), spec (spec.md, including the locked descriptor contract and verdict policy), plan (implementation-plan.md, plus sources-inventory.md cataloguing every endpoint up front), and implementation (this summary). Built task-by-task via subagent-driven TDD with a two-stage spec-conformance plus quality review per task. The Part A cleanup in this final task (dirent-based directory filtering in discoverSources.js) was a deferred finding from the Task 5 review, closed out here alongside the roadmap update.

## 5-address rule (CONSTRAINT-011)

The harness's entire purpose is verifying live behavior against the 5 CLAUDE.md test addresses (Georgetown KY, Harlan KY, Louisville KY, Bozeman MT, Jeffersonville IN); they are baked into scripts/lib/testAddresses.js and resolved into contexts on every run.
