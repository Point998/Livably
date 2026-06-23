'use strict';

// FR-078 — Headless report contract: the single, machine-checked source of schema truth.
//
// Every chapter serializes its logic output into a ChapterContract validated here. The schema
// is the boundary between the headless backend and the (separately built) frontend — so drift
// between the two codebases is caught at serialize time, not in production. `.strict()` on every
// object is deliberate: an unknown field (a stray `color`, a `score`, a demographic-character
// key) THROWS, turning CONSTRAINT-001 (no scoring), -002 (Fair Housing), and -008 (no design in
// data) from "review 14 templates" into "structurally impossible to emit".
//
// Durable payload is the structured CLAIM (subject/measure/comparison + bucket/tone/provenance),
// never prose and never color. `defaultCopy` is TRANSITIONAL scaffolding for build-out only —
// it is deleted once the frontend owns voice (see FR-078 spec AC-9).

const { z } = require('zod');
const { zodToJsonSchema } = require('zod-to-json-schema');
const { logError } = require('../logger');
const { recordDegradation } = require('../shared/degradationLedger');

// CONSTRAINT-001 — the three-bucket framing is the ONLY evaluation system. No scores.
const Bucket = z.enum(['consider', 'check', 'cool']);
// Semantic tone — NOT a color. The frontend maps tone -> visual treatment.
const Tone = z.enum(['favorable', 'neutral', 'caution']);

const MeasureSchema = z.object({
  value: z.number(),
  unit: z.string(),         // machine token, e.g. 'cents_per_kwh' — frontend formats the label
}).strict();

const ComparisonSchema = z.object({
  basis: z.string(),        // e.g. 'state_average', 'national_median'
  referenceValue: z.number().nullable(),
  direction: z.enum(['below', 'near', 'above']),
  deltaPct: z.number().nullable(),
  region: z.string().nullable(),
}).strict();

const ProvenanceSchema = z.object({
  source: z.string(),       // named source (NREL, HIFLD, Census ACS, …)
  asOf: z.string(),         // research/vintage date
  modeled: z.boolean(),     // honest-provenance: modeled vs measured
}).strict();

const FallbackActionSchema = z.object({
  type: z.enum(['url', 'phone', 'instruction']),
  label: z.string(),
  value: z.string(),
}).strict();

// FR-080 — located-facility payload (name + address). Optional + .strict() = additive,
// non-breaking (schemaVersion stays '1.0'); existing chapters that don't set it validate
// unchanged. Durable home for the recurring located-facility shape (health, schools,
// safety, reachability). Coordinates deliberately excluded until a real FE map consumer
// exists — they'd be a non-breaking optional add later.
const PlaceSchema = z.object({
  name: z.string(),
  address: z.string(),
}).strict();

const ClaimSchema = z.object({
  subject: z.string(),
  measure: MeasureSchema.nullable(),
  comparison: ComparisonSchema.nullable(),
  place: PlaceSchema.nullable().optional(),
}).strict();

const FindingSchema = z.object({
  id: z.string(),
  bucket: Bucket,
  tone: Tone,
  claim: ClaimSchema,
  provenance: ProvenanceSchema,
  fallbackAction: FallbackActionSchema.nullable(),   // present whenever a datum is missing (CONSTRAINT-015)
  defaultCopy: z.string().optional(),                // TRANSITIONAL — frontend overrides/owns voice
}).strict();

const ChapterContractSchema = z.object({
  schemaVersion: z.literal('1.0'),
  chapterId: z.string(),
  findings: z.array(FindingSchema),
  degraded: z.boolean(),                             // from the FR-068 degradation ledger
  provenanceSummary: z.array(
    z.object({ source: z.string(), asOf: z.string() }).strict()
  ),
}).strict();

// JSON Schema export for the future frontend's type generation (single source of truth).
const chapterContractJsonSchema = zodToJsonSchema(ChapterContractSchema, 'ChapterContract');

// Crash-safety is the contract: serializing a chapter must NEVER break a report. safeBuild runs
// the builder, validates, and on any throw (schema drift, bad mapping) logs + records degradation
// and returns null so the chapter is omitted rather than crashing the response.
function safeBuild(chapterId, buildFn) {
  try {
    const candidate = buildFn();
    return ChapterContractSchema.parse(candidate);
  } catch (err) {
    logError(`contract:${chapterId}`, chapterId, err);
    recordDegradation({ label: `contract-${chapterId}`, source: null, kind: 'error', reason: err?.message });
    return null;
  }
}

module.exports = {
  Bucket,
  Tone,
  MeasureSchema,
  ComparisonSchema,
  ProvenanceSchema,
  FallbackActionSchema,
  PlaceSchema,
  ClaimSchema,
  FindingSchema,
  ChapterContractSchema,
  chapterContractJsonSchema,
  safeBuild,
};
