'use strict';

// FR-078 — the contract schema is the structural guard. `.strict()` turns CONSTRAINT-001
// (no scoring), -002 (Fair Housing), and -008 (no design in data) into parse-time errors.

const {
  FindingSchema, ChapterContractSchema, safeBuild,
} = require('../../src/contract/schema');
const { runWithLedger, getLedger } = require('../../src/shared/degradationLedger');

const validFinding = {
  id: 'electric-rate',
  bucket: 'consider',
  tone: 'caution',
  claim: { subject: 'Residential electric rate', measure: { value: 13, unit: 'cents_per_kwh' }, comparison: null },
  provenance: { source: 'NREL', asOf: '2026-06', modeled: false },
  fallbackAction: null,
};

const validContract = {
  schemaVersion: '1.0',
  chapterId: 'utilities',
  findings: [validFinding],
  degraded: false,
  provenanceSummary: [{ source: 'NREL', asOf: '2026-06' }],
};

describe('FindingSchema', () => {
  test('accepts a well-formed finding', () => {
    expect(FindingSchema.safeParse(validFinding).success).toBe(true);
  });

  test('rejects a stray color field (CONSTRAINT-008 — no design in data)', () => {
    expect(FindingSchema.safeParse({ ...validFinding, color: 'green' }).success).toBe(false);
  });

  test('rejects a numeric score/grade field (CONSTRAINT-001 — no scoring)', () => {
    expect(FindingSchema.safeParse({ ...validFinding, score: 87 }).success).toBe(false);
    expect(FindingSchema.safeParse({ ...validFinding, grade: 'B+' }).success).toBe(false);
  });

  test('enforces the bucket and tone enums', () => {
    expect(FindingSchema.safeParse({ ...validFinding, bucket: 'amazing' }).success).toBe(false);
    expect(FindingSchema.safeParse({ ...validFinding, tone: 'green' }).success).toBe(false);
  });
});

describe('ChapterContractSchema', () => {
  test('accepts a valid chapter contract', () => {
    expect(ChapterContractSchema.safeParse(validContract).success).toBe(true);
  });

  test('rejects an unknown top-level field', () => {
    expect(ChapterContractSchema.safeParse({ ...validContract, theme: 'dark' }).success).toBe(false);
  });

  test('pins schemaVersion to 1.0', () => {
    expect(ChapterContractSchema.safeParse({ ...validContract, schemaVersion: '2.0' }).success).toBe(false);
  });
});

describe('safeBuild — crash-safety', () => {
  test('returns the parsed contract when the builder is valid', () => {
    expect(safeBuild('utilities', () => validContract)).toEqual(validContract);
  });

  test('returns null (no throw) when the builder emits an invalid shape', () => {
    const bad = { ...validContract, findings: [{ ...validFinding, color: 'green' }] };
    expect(() => safeBuild('utilities', () => bad)).not.toThrow();
    expect(safeBuild('utilities', () => bad)).toBeNull();
  });

  test('records a contract-* degradation event when validation fails inside a ledger', () => {
    const bad = { ...validContract, schemaVersion: '9.9' };
    const ledger = runWithLedger(() => {
      safeBuild('utilities', () => bad);
      return getLedger();
    });
    expect(ledger.find((e) => e.label === 'contract-utilities' && e.kind === 'error')).toBeTruthy();
  });
});
