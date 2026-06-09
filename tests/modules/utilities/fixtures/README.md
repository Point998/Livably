# NREL response fixtures (FR-032)

These JSON files reproduce the **documented NREL v3 response shapes**, not live
captures — `developer.nrel.gov` was unreachable from the build environment, so
these are schema-derived. They exist to harden the parser against real-world
quirks (nested `utility_info[].ownership`, `"no data"` rates, `null` EVSE counts,
empty station lists) ahead of first live contact.

**On first live verification, re-capture one or two real responses and diff the
shapes against these.** If NREL's field names/structure differ, update the
fixtures + parser together.

- `utility-rates-iou.json` — investor-owned, full `utility_info[].ownership`.
- `utility-rates-coop.json` — cooperative.
- `utility-rates-no-data.json` — `residential: "no data"` (real NREL sentinel).
- `alt-fuel-stations-mixed.json` — L2 + DC-fast with `null` counts interspersed.
- `alt-fuel-stations-empty.json` — no stations in range.
