# FR-061 — Internet as a Utility — Summary

**Status:** ✅ Built, full suite green (1,384 tests / 73 suites). Branch `FR-061-internet-connectivity`, PR pending.

## What shipped

Internet is now treated as a utility. The FCC National Broadband Map integration moved out of the **Property** chapter and into the **Utilities & Power** chapter, reframed from advertised-Mbps cards into the lightweight bracketed/"felt" treatment used elsewhere in the report. No new data source.

```
Electric  →  Reliability  →  EV  →  Internet     (Utilities deep-dive tabs)
```

## The felt treatment

Instead of presenting an advertised number as a guarantee ("1000 Mbps reliably"), the chapter now shows **who · typical band · what it means**:

- **Who** — provider count + provider list (name + technology).
- **Band** — a qualitative label + color (CONSTRAINT-001: not a score): Gigabit-class (fiber) · Fast wired broadband · Standard broadband · Limited wired options · Wired coverage unconfirmed.
- **What it means** — one plain-language line per band (remote work, simultaneous 4K, a houseful of streaming).
- **Satellite floor** — a quiet, brand-neutral reassurance (≈100–300 Mbps reachable almost anywhere) shown when wired options are thin/unconfirmed **or** the address is rural/remote.

## Layers (three-layer rule preserved)

- **`utilities/data.js`** — `getBroadbandData(lat,lng)` (FCC, keyless) relocated here; rides the existing FR-058 cell cache via `getUtilitiesData`, which now returns `{ electric, evCharging, internet }`. The total-miss cache guard extends to all three. (A dedup hardening was added: availability is sorted by download desc before dedup so a multi-plan provider keeps its highest-tier technology label.)
- **`utilities/logic.js`** — `getInternetContext(broadband, ruralMode)` computes the band + meaning + `satelliteFloor`; threaded into `assembleUtilities` as `internet`. Boundary thresholds (940/200/25/0) are test-pinned.
- **`utilities/template.js`** — Internet L1 section + L3 tab + L4 FCC/ISP research links; null path renders the FCC lookup link + satellite reassurance (never silent). Shared `NO_PROVIDERS_LINE` keeps L1/L3 consistent. (Caught and fixed a latent grammar bug: "1 provider serves".)
- **Property chapter** — broadband fully removed (data/logic/template + tests): `getBroadbandData`, `getBroadbandCategory`, `buildBroadbandTab`, the Internet Providers tab, the L4 provider table, the Internet Availability section, two broadband takeaway branches, the FCC research link, and the "broadband" subtitle word. Soil / era / housing-age / drainage / permits / glance untouched.

## Live verification — FCC endpoint finding (pre-existing)

The 5-address live check returned the **fallback path** for all five. Root cause is upstream, not this change: the FCC `listAvailability` endpoint responds **HTTP 405 "Method Not Available"** to the GET request from this environment (the server is reachable and returns well-formed JSON `{"data":[],"status_code":405,...}`).

This is **pre-existing** — `getBroadbandData` is a verbatim relocation of the fetcher that already lived in Property, so the FCC integration was already degrading to its fallback before FR-061. FR-061's scope is relocate + reframe (no new data work), so fixing the endpoint is deliberately **out of scope**. Graceful degradation (CONSTRAINT-015) is verified working: null → "no providers returned… check broadbandmap.fcc.gov" + the satellite-floor reassurance.

**Follow-up flagged:** a small resilience FR (in the spirit of FR-060) to repair/replace the FCC broadband call — likely a changed method/path/params on the FCC National Broadband Map public API, or a fallback source — and then confirm live providers across the 5 addresses.

## Constraints honored

CONSTRAINT-001 (band is label+color, no score) · CONSTRAINT-004 (FCC query carries no brand names; satellite copy generic) · CONSTRAINT-008/009 (fetch in data, band in logic, HTML in template; no inline styles) · CONSTRAINT-011 (tests + boundary pins; 5-address verify run) · CONSTRAINT-015 (no-data → FCC link + satellite reassurance, never silent) · FR-058 cell cache reused.

## Files

- `src/modules/utilities/{data,logic,template}.js`
- `src/modules/property/{data,logic,template}.js` (removal)
- `tests/modules/utilities/{data,logic,template}.test.js` + `tests/modules/utilities/fixtures/fcc-broadband.json`
- `tests/modules/property/{data,template}.test.js` (removal)

## Dependencies / keys

None. FCC National Broadband Map is keyless. No new npm packages.
