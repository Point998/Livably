'use strict';
const { getElectricRateContext } = require('../../../src/modules/utilities/logic');

describe('getElectricRateContext', () => {
  test('rate well below state avg -> below', () => {
    const r = getElectricRateContext(0.10, 'KY'); // avg 0.128
    expect(r.deltaLabel).toBe('below state average');
    expect(r.color).toBe('green');
    expect(r.stateAvg).toBe(0.128);
  });
  test('rate within +/-7% -> near', () => {
    const r = getElectricRateContext(0.128, 'KY');
    expect(r.deltaLabel).toBe('near state average');
    expect(r.color).toBe('gold');
  });
  test('rate well above state avg -> above', () => {
    const r = getElectricRateContext(0.20, 'KY');
    expect(r.deltaLabel).toBe('above state average');
    expect(r.color).toBe('orange');
  });
  test('returns null when rate missing', () => {
    expect(getElectricRateContext(null, 'KY')).toBeNull();
    expect(getElectricRateContext(0, 'KY')).toBeNull();
  });
  test('returns null when state has no average', () => {
    expect(getElectricRateContext(0.12, 'ZZ')).toBeNull();
  });
  test('narrative is a non-empty string with no numeric grade words', () => {
    const r = getElectricRateContext(0.10, 'KY');
    expect(typeof r.narrative).toBe('string');
    expect(r.narrative.length).toBeGreaterThan(0);
    expect(r.narrative.toLowerCase()).not.toMatch(/score|grade|rating|out of/);
  });
});

const { getUtilityType } = require('../../../src/modules/utilities/logic');

describe('getUtilityType', () => {
  test('cooperative names', () => {
    expect(getUtilityType('Blue Grass Energy Cooperative').type).toBe('cooperative');
    expect(getUtilityType('Owen Electric Co-op').type).toBe('cooperative');
    expect(getUtilityType('Jackson Energy EMC').type).toBe('cooperative');
  });
  test('municipal names', () => {
    expect(getUtilityType('City of Tallahassee Utilities').type).toBe('municipal');
    expect(getUtilityType('Frankfort Plant Board').type).toBe('municipal');
  });
  test('investor-owned fallback', () => {
    expect(getUtilityType('Kentucky Utilities Company').type).toBe('investor-owned');
    expect(getUtilityType('NorthWestern Energy').type).toBe('investor-owned');
  });
  test('label is hedged (inference, not authoritative)', () => {
    expect(getUtilityType('Kentucky Utilities Company').label.toLowerCase()).toMatch(/appears to be/);
  });
  test('returns null for empty name', () => {
    expect(getUtilityType('')).toBeNull();
    expect(getUtilityType(null)).toBeNull();
  });
});

const { getOutageContext } = require('../../../src/modules/utilities/logic');

describe('getOutageContext', () => {
  test('known state returns its values', () => {
    const r = getOutageContext('MT'); // saidiHours 2.7, saifiEvents 1.3
    expect(r.saidiHours).toBe(2.7);
    expect(r.saifiEvents).toBe(1.3);
    expect(r.narrative.toLowerCase()).toMatch(/state-level|statewide|state average/);
  });
  test('unknown state falls back to NATIONAL', () => {
    const r = getOutageContext('ZZ');
    expect(r.saidiHours).toBe(2.2);
    expect(r.isNationalFallback).toBe(true);
  });
  test('returns null when no state given', () => {
    expect(getOutageContext(null)).toBeNull();
  });
  test('narrative makes clear it is not parcel-specific', () => {
    expect(getOutageContext('KY').narrative.toLowerCase()).toMatch(/not specific|state-level|statewide/);
  });
});

const { getServiceInference } = require('../../../src/modules/utilities/logic');

describe('getServiceInference', () => {
  test('rural -> well/septic/propane', () => {
    const r = getServiceInference('rural');
    expect(r.water).toMatch(/well/i);
    expect(r.sewer).toMatch(/septic/i);
    expect(r.gas).toMatch(/propane|electric/i);
    expect(r.verify).toBe(true);
  });
  test('remote behaves like rural', () => {
    expect(getServiceInference('remote').water).toMatch(/well/i);
  });
  test('suburban -> municipal', () => {
    const r = getServiceInference('suburban');
    expect(r.water).toMatch(/municipal/i);
    expect(r.sewer).toMatch(/municipal/i);
    expect(r.verify).toBe(true);
  });
  test('urban -> municipal', () => {
    expect(getServiceInference('urban').water).toMatch(/municipal/i);
  });
  test('always carries a verify action string', () => {
    expect(getServiceInference('urban').verifyAction).toMatch(/seller|county|disclosure/i);
  });
  test('unknown mode defaults to suburban/municipal framing', () => {
    expect(getServiceInference(undefined).water).toMatch(/municipal/i);
  });
});

const { getEvChargingCost } = require('../../../src/modules/utilities/logic');

describe('getEvChargingCost', () => {
  test('cost = 60 kWh * rate, rounded to cents', () => {
    const r = getEvChargingCost(0.128);
    expect(r.fullChargeCost).toBeCloseTo(7.68, 2); // 60 * 0.128
    expect(r.batteryKwh).toBe(60);
  });
  test('includes a home-charging note', () => {
    expect(getEvChargingCost(0.128).homeNote.length).toBeGreaterThan(0);
  });
  test('returns null when rate missing', () => {
    expect(getEvChargingCost(null)).toBeNull();
    expect(getEvChargingCost(0)).toBeNull();
  });
});
