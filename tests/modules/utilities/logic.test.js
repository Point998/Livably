'use strict';
const {
  getElectricRateContext,
  getUtilityType,
  getOutageContext,
  getServiceInference,
  getEvChargingCost,
  getInternetContext,
  assembleUtilities,
} = require('../../../src/modules/utilities/logic');

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
  test('bare "Kentucky Utilities" (no Company suffix) is investor-owned, not municipal', () => {
    // Regression: an "...Utilities" suffix must not by itself imply municipal —
    // Kentucky Utilities (the real EIA name, Georgetown KY) is an IOU.
    expect(getUtilityType('Kentucky Utilities').type).toBe('investor-owned');
  });
  test('a name containing "utilities" without a municipal keyword is investor-owned', () => {
    expect(getUtilityType('Midwest Utilities and Services').type).toBe('investor-owned');
  });
  test('label is hedged (inference, not authoritative)', () => {
    expect(getUtilityType('Kentucky Utilities Company').label.toLowerCase()).toMatch(/appears to be/);
  });
  test('returns null for empty name', () => {
    expect(getUtilityType('')).toBeNull();
    expect(getUtilityType(null)).toBeNull();
  });
});

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

describe('getEvChargingCost', () => {
  test('cost = 60 kWh * rate, rounded to cents', () => {
    const r = getEvChargingCost(0.128);
    expect(r.fullChargeCost).toBe(7.68); // 60 * 0.128, already rounded to cents
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

describe('assembleUtilities', () => {
  const raw = { electric: { utilityName: 'Kentucky Utilities', residentialRate: 0.131 },
                evCharging: { level2: null, dcFast: null } };
  const loc = { state: 'KY', county: 'Scott', city: 'Georgetown' };

  test('derives rateContext, utilityType, outage, services, evCost', () => {
    const u = assembleUtilities(raw, 'suburban', loc);
    expect(u.rateContext.deltaLabel).toMatch(/average/);
    expect(u.utilityType.type).toBe('investor-owned');
    expect(u.outage.saidiHours).toBe(2.4);
    expect(u.services.water).toMatch(/municipal/i);
    expect(u.evCost.batteryKwh).toBe(60);
    expect(u.locationInfo).toBe(loc);
  });

  test('handles null electric (no rate) without throwing', () => {
    const u = assembleUtilities({ electric: null, evCharging: null }, 'rural', loc);
    expect(u.rateContext).toBeNull();
    expect(u.utilityType).toBeNull();
    expect(u.evCost).toBeNull();
    expect(u.services.water).toMatch(/well/i); // rural inference still present
    expect(u.outage).not.toBeNull();           // state-level, independent of electric
  });

  test('returns null when raw is null', () => {
    expect(assembleUtilities(null, 'urban', loc)).toBeNull();
  });
});

describe('assembleUtilities — FR-060 source + state-avg threading', () => {
  const loc = { state: 'KY', county: 'Scott' };
  test('threads electricSource/evSource and stateAvgRate', () => {
    const raw = {
      electric: { utilityName: 'Kentucky Utilities', residentialRate: null, ownership: 'INVESTOR OWNED', source: 'HIFLD' },
      evCharging: { level2: null, dcFast: null, source: 'OpenChargeMap' },
    };
    const u = assembleUtilities(raw, 'suburban', loc);
    expect(u.electricSource).toBe('HIFLD');
    expect(u.evSource).toBe('OpenChargeMap');
    expect(u.stateAvgRate).toBe(0.128);
    expect(u.rateContext).toBeNull();
    expect(u.utilityType.type).toBe('investor-owned');
  });
  test('sources null when raw lacks them', () => {
    const u = assembleUtilities({ electric: null, evCharging: null }, 'rural', loc);
    expect(u.electricSource).toBeNull();
    expect(u.evSource).toBeNull();
    expect(u.stateAvgRate).toBe(0.128);
  });
});

describe('getInternetContext — FR-061 felt band', () => {
  const bb = (over) => ({ providers: [{ name: 'X', tech: 'Cable' }], maxDownloadMbps: 0, hasFiber: false, ...over });

  test('null in -> null out', () => {
    expect(getInternetContext(null, 'suburban')).toBeNull();
  });
  test('fiber -> gigabit-class green', () => {
    const r = getInternetContext(bb({ hasFiber: true, maxDownloadMbps: 1000 }), 'suburban');
    expect(r.band).toEqual({ label: 'Gigabit-class (fiber)', color: 'green' });
    expect(r.satelliteFloor).toBe(false);
  });
  test('>=940 without fiber flag still gigabit-class', () => {
    expect(getInternetContext(bb({ maxDownloadMbps: 940 }), 'suburban').band.color).toBe('green');
  });
  test('>=200 -> fast wired lightgreen', () => {
    expect(getInternetContext(bb({ maxDownloadMbps: 300 }), 'suburban').band.color).toBe('lightgreen');
  });
  test('>=25 -> standard gold', () => {
    expect(getInternetContext(bb({ maxDownloadMbps: 50 }), 'suburban').band.color).toBe('gold');
  });
  test('>0 -> limited orange, satelliteFloor true', () => {
    const r = getInternetContext(bb({ maxDownloadMbps: 10 }), 'suburban');
    expect(r.band.color).toBe('orange');
    expect(r.satelliteFloor).toBe(true);
  });
  test('0 -> unconfirmed muted, satelliteFloor true', () => {
    const r = getInternetContext(bb({ maxDownloadMbps: 0 }), 'suburban');
    expect(r.band.color).toBe('muted');
    expect(r.satelliteFloor).toBe(true);
  });
  test('rural mode forces satelliteFloor even on fast wired', () => {
    expect(getInternetContext(bb({ maxDownloadMbps: 300 }), 'rural').satelliteFloor).toBe(true);
    expect(getInternetContext(bb({ maxDownloadMbps: 300 }), 'remote').satelliteFloor).toBe(true);
  });
  test('providerCount reflects providers length', () => {
    const r = getInternetContext(bb({ maxDownloadMbps: 300, providers: [{ name: 'A', tech: 'Fiber' }, { name: 'B', tech: 'Cable' }] }), 'suburban');
    expect(r.providerCount).toBe(2);
  });
  test('199 -> standard gold (just below the fast-wired fence)', () => {
    expect(getInternetContext(bb({ maxDownloadMbps: 199 }), 'suburban').band.color).toBe('gold');
  });
  test('200 -> fast wired lightgreen (at the fence)', () => {
    expect(getInternetContext(bb({ maxDownloadMbps: 200 }), 'suburban').band.color).toBe('lightgreen');
  });
  test('24 -> limited orange (just below the broadband fence)', () => {
    expect(getInternetContext(bb({ maxDownloadMbps: 24 }), 'suburban').band.color).toBe('orange');
  });
  test('25 -> standard gold (at the fence)', () => {
    expect(getInternetContext(bb({ maxDownloadMbps: 25 }), 'suburban').band.color).toBe('gold');
  });
  // Documents a deliberate product choice: the FCC fiber flag is trusted even if
  // no advertised download speed was on the row. We do NOT downgrade a fiber
  // address just because the speed field was missing.
  test('hasFiber true with max 0 still returns gigabit-class (fiber flag trusted), satelliteFloor false', () => {
    const r = getInternetContext(bb({ hasFiber: true, maxDownloadMbps: 0 }), 'suburban');
    expect(r.band.color).toBe('green');
    expect(r.satelliteFloor).toBe(false);
  });
});

describe('assembleUtilities threads internet (FR-061)', () => {
  test('internet present when raw.internet present', () => {
    const u = assembleUtilities(
      { electric: null, evCharging: null, internet: { providers: [], maxDownloadMbps: 1000, hasFiber: true } },
      'suburban',
      { state: 'KY' },
    );
    expect(u.internet.band.color).toBe('green');
  });
  test('internet null when raw lacks it', () => {
    const u = assembleUtilities({ electric: null, evCharging: null }, 'suburban', { state: 'KY' });
    expect(u.internet).toBeNull();
  });
});
