'use strict';

const mockGeocodeAddress = jest.fn();
const mockReverseGeocode = jest.fn();
const mockGetDriveTime = jest.fn();
const mockGetTrafficVariations = jest.fn();
const mockFindNearestGrocery = jest.fn();
const mockFindNearestPharmacy = jest.fn();
const mockFindNearestGasStation = jest.fn();
const mockFindNearestHighwayOnRamp = jest.fn();
const mockFindNearestHospital = jest.fn();
const mockFindNearestUrgentCare = jest.fn();
const mockFindNearestSchool = jest.fn();
const mockFindNearestElementarySchool = jest.fn();
const mockFindNearestPark = jest.fn();
const mockFindNearestCoffeeShop = jest.fn();
const mockFindNearestLibrary = jest.fn();
const mockFindNearestRecreationCenter = jest.fn();
const mockFindNearestPostOffice = jest.fn();
const mockGetChapterData = jest.fn();
const mockSaveReport = jest.fn();
const mockPutArtifact = jest.fn();
const mockLogRequest = jest.fn();
const mockLogError = jest.fn();
const mockLogDegradation = jest.fn();
const mockLogAnalysis = jest.fn();
const mockBuildReportHTML = jest.fn();
const mockBuildChaptersHTML = jest.fn();
const mockGetCensusFIPS = jest.fn();
const mockFetchCensusACS = jest.fn();

jest.mock('../../src/shared/google/geocoding', () => ({ geocodeAddress: mockGeocodeAddress }));
jest.mock('../../src/shared/google/reverseGeocode', () => ({ reverseGeocodeAddress: mockReverseGeocode }));
jest.mock('../../src/shared/google/distanceMatrix', () => ({ getDriveTime: mockGetDriveTime, getTrafficVariations: mockGetTrafficVariations }));
jest.mock('../../src/shared/google/client', () => ({ googleMapsClient: {}, googleMapsApiKey: 'test-key' }));
jest.mock('../../src/modules/reachability/data', () => ({ findNearestGrocery: mockFindNearestGrocery, findNearestPharmacy: mockFindNearestPharmacy, findNearestGasStation: mockFindNearestGasStation }));
jest.mock('../../src/modules/access/data', () => ({ findNearestHighwayOnRamp: mockFindNearestHighwayOnRamp }));
jest.mock('../../src/modules/health/data', () => ({ findNearestHospital: mockFindNearestHospital, findNearestUrgentCare: mockFindNearestUrgentCare }));
jest.mock('../../src/modules/schools/data', () => ({ findNearestSchool: mockFindNearestSchool, findNearestElementarySchool: mockFindNearestElementarySchool }));
jest.mock('../../src/modules/recreation/data', () => ({ findNearestPark: mockFindNearestPark, findNearestCoffeeShop: mockFindNearestCoffeeShop, findNearestLibrary: mockFindNearestLibrary, findNearestRecreationCenter: mockFindNearestRecreationCenter, findNearestPostOffice: mockFindNearestPostOffice }));
jest.mock('../../src/chapters', () => ({ getChapterData: mockGetChapterData, buildChaptersHTML: mockBuildChaptersHTML }));
jest.mock('../../src/services/reportStore', () => ({ saveReport: mockSaveReport, putArtifact: mockPutArtifact }));
jest.mock('../../src/logger', () => ({ logRequest: mockLogRequest, logError: mockLogError, logDegradation: mockLogDegradation, logAnalysis: mockLogAnalysis }));
jest.mock('../../src/templates/pages/reportPage', () => ({ buildReportHTML: mockBuildReportHTML }));
jest.mock('../../src/shared/census', () => ({
  getCensusFIPS: mockGetCensusFIPS,
  fetchCensusACS: mockFetchCensusACS,
}));

const { buildReport, classifyError } = require('../../src/services/reportBuilder');

const defaultOrigin = { lat: 38.3, lng: -84.4 };
const defaultLocationInfo = { city: 'Georgetown', state: 'KY', county: 'Scott', zip: '40324' };

beforeEach(() => {
  jest.clearAllMocks();
  mockGeocodeAddress.mockResolvedValue(defaultOrigin);
  mockReverseGeocode.mockResolvedValue(defaultLocationInfo);
  mockFindNearestGrocery.mockResolvedValue([{ name: 'Kroger', driveTimeMinutes: 8, location: defaultOrigin }]);
  mockFindNearestPharmacy.mockResolvedValue({ name: 'CVS', driveTimeMinutes: 5 });
  mockFindNearestHospital.mockResolvedValue({ name: 'Georgetown Community Hospital', driveTimeMinutes: 12, location: defaultOrigin });
  mockFindNearestUrgentCare.mockResolvedValue(null);
  mockFindNearestHighwayOnRamp.mockResolvedValue({ name: 'I-75', driveTimeMinutes: 6 });
  mockFindNearestSchool.mockResolvedValue({ name: 'Georgetown Middle', driveTimeMinutes: 9 });
  mockFindNearestGasStation.mockResolvedValue({ name: 'Shell', driveTimeMinutes: 3 });
  mockFindNearestPark.mockResolvedValue(null);
  mockFindNearestCoffeeShop.mockResolvedValue(null);
  mockFindNearestElementarySchool.mockResolvedValue(null);
  mockFindNearestLibrary.mockResolvedValue(null);
  mockFindNearestRecreationCenter.mockResolvedValue(null);
  mockFindNearestPostOffice.mockResolvedValue(null);
  mockGetChapterData.mockResolvedValue(null);
  mockGetTrafficVariations.mockResolvedValue(null);
  mockSaveReport.mockResolvedValue('abcd1234');
  mockPutArtifact.mockResolvedValue(undefined);
  mockBuildReportHTML.mockReturnValue('<html>report</html>');
  mockBuildChaptersHTML.mockReturnValue('');
  mockGetCensusFIPS.mockResolvedValue({ state: '21', county: '077', tract: '010101' });
  mockFetchCensusACS.mockResolvedValue(new Map([['B01001_001E', '5200']]));
});

describe('buildReport', () => {
  test('calls geocodeAddress with the provided address', async () => {
    await buildReport('100 Main St, Georgetown, KY');
    expect(mockGeocodeAddress).toHaveBeenCalledWith('100 Main St, Georgetown, KY');
  });

  test('passes originState to findNearestSchool (CONSTRAINT-006)', async () => {
    await buildReport('100 Main St, Georgetown, KY');
    expect(mockFindNearestSchool).toHaveBeenCalledWith(expect.any(String), 'KY');
  });

  test('passes originState and the spatial cell to findNearestHospital (CONSTRAINT-006, FR-058)', async () => {
    await buildReport('100 Main St, Georgetown, KY');
    expect(mockFindNearestHospital).toHaveBeenCalledWith(
      expect.any(String), 'KY', expect.objectContaining({ cellId: expect.any(String) }),
    );
  });

  test('passes originState and the spatial cell to findNearestUrgentCare (CONSTRAINT-006, FR-058)', async () => {
    await buildReport('100 Main St, Georgetown, KY');
    expect(mockFindNearestUrgentCare).toHaveBeenCalledWith(
      expect.any(String), 'KY', expect.objectContaining({ cellId: expect.any(String) }),
    );
  });

  test('passes originState to findNearestElementarySchool (CONSTRAINT-006)', async () => {
    await buildReport('100 Main St, Georgetown, KY');
    expect(mockFindNearestElementarySchool).toHaveBeenCalledWith(expect.any(String), 'KY');
  });

  test('FR-068: does NOT emit a degradation line on a clean report (no fallback)', async () => {
    await buildReport('100 Main St, Georgetown, KY');
    expect(mockLogDegradation).not.toHaveBeenCalled();
  });

  test('FR-068: emits one degradation summary line when a chapter fell back', async () => {
    const { recordDegradation } = require('../../src/shared/degradationLedger');
    // Simulate a chapter that ran on a fallback inside the report's ledger context.
    mockGetChapterData.mockImplementation(async () => {
      recordDegradation({ label: 'walkability', source: 'osm', kind: 'fallback' });
      return null;
    });
    await buildReport('100 Main St, Georgetown, KY');
    expect(mockLogDegradation).toHaveBeenCalledTimes(1);
    const [, summary] = mockLogDegradation.mock.calls[0];
    expect(summary.fallbacks).toBe(1);
    expect(summary.byLabel.walkability.fallback).toBe(1);
  });

  test('returns an object with an html property', async () => {
    const result = await buildReport('100 Main St, Georgetown, KY');
    expect(result).toHaveProperty('html');
    expect(typeof result.html).toBe('string');
  });

  test('handles a data module failure gracefully via allSettled', async () => {
    mockFindNearestGrocery.mockRejectedValue(new Error('API down'));
    const result = await buildReport('100 Main St, Georgetown, KY');
    expect(result).toHaveProperty('html');
  });

  test('calls buildReportHTML with the data from all modules', async () => {
    await buildReport('100 Main St, Georgetown, KY');
    expect(mockBuildReportHTML).toHaveBeenCalledWith(
      '100 Main St, Georgetown, KY',
      expect.objectContaining({ hospital: expect.objectContaining({ name: 'Georgetown Community Hospital' }) }),
    );
  });

  test('passes pre-fetched fips to getChapterData so chapters.js skips getCensusFIPS', async () => {
    const fips = { state: '21', county: '077', tract: '010101' };
    mockGetCensusFIPS.mockResolvedValue(fips);
    mockFetchCensusACS.mockResolvedValue(new Map([['B01001_001E', '5200']]));

    await buildReport('100 Main St, Georgetown, KY');

    expect(mockGetChapterData).toHaveBeenCalledWith(
      expect.objectContaining({ fips })
    );
  });

  test('passes ruralMode to findNearestGrocery based on tract population', async () => {
    mockFetchCensusACS.mockResolvedValue(new Map([['B01001_001E', '6000']]));
    await buildReport('100 Main St, Georgetown, KY');
    expect(mockFindNearestGrocery).toHaveBeenCalledWith(
      expect.any(String),
      'urban',
      expect.objectContaining({ cellId: expect.any(String) }),
    );
  });

  test('passes rural ruralMode for low-population tract', async () => {
    mockFetchCensusACS.mockResolvedValue(new Map([['B01001_001E', '500']]));
    await buildReport('456 Rural Route 1, Harlan, KY');
    expect(mockFindNearestGrocery).toHaveBeenCalledWith(
      expect.any(String),
      'rural',
      expect.objectContaining({ cellId: expect.any(String) }),
    );
  });

  test('falls back to suburban ruralMode when getCensusFIPS throws', async () => {
    mockGetCensusFIPS.mockRejectedValue(new Error('Census API error'));
    await buildReport('100 Main St, Georgetown, KY');
    expect(mockFindNearestGrocery).toHaveBeenCalledWith(
      expect.any(String),
      'suburban',
      expect.objectContaining({ cellId: expect.any(String) }),
    );
  });

  test('falls back to suburban when fetchCensusACS returns null', async () => {
    mockFetchCensusACS.mockResolvedValue(null);
    await buildReport('100 Main St, Georgetown, KY');
    expect(mockFindNearestGrocery).toHaveBeenCalledWith(
      expect.any(String),
      'suburban',
      expect.objectContaining({ cellId: expect.any(String) }),
    );
  });

  test('falls back to suburban when tractPop is 0', async () => {
    mockFetchCensusACS.mockResolvedValue(new Map([['B01001_001E', '0']]));
    await buildReport('100 Main St, Georgetown, KY');
    expect(mockFindNearestGrocery).toHaveBeenCalledWith(
      expect.any(String),
      'suburban',
      expect.objectContaining({ cellId: expect.any(String) }),
    );
  });
});

describe('classifyError', () => {
  test('classifies geocoding failure as ADDRESS_NOT_FOUND', () => {
    const err = new Error('Unable to geocode address');
    const result = classifyError(err);
    expect(result.type).toBe('ADDRESS_NOT_FOUND');
  });

  test('classifies unknown error as SERVER_ERROR', () => {
    const err = new Error('Something unexpected');
    const result = classifyError(err);
    expect(result.type).toBe('SERVER_ERROR');
  });

  test('classifies QuotaExceededError as QUOTA_EXCEEDED', () => {
    const { QuotaExceededError } = require('../../src/rateLimit');
    const result = classifyError(new QuotaExceededError('quota hit'));
    expect(result.type).toBe('QUOTA_EXCEEDED');
  });

  test('classifies RateLimitError as RATE_LIMIT with retryAfter', () => {
    const { RateLimitError } = require('../../src/rateLimit');
    const err = new RateLimitError('rate limit', 60);
    const result = classifyError(err);
    expect(result.type).toBe('RATE_LIMIT');
    expect(result.retryAfter).toBe(60);
  });

  test('classifies HTTP 429 response as RATE_LIMIT', () => {
    const err = new Error('Request failed');
    err.response = { status: 429 };
    const result = classifyError(err);
    expect(result.type).toBe('RATE_LIMIT');
  });
});

describe('buildReport artifact persistence', () => {
  test('persists html + contract for the minted reportId', async () => {
    mockBuildReportHTML.mockReturnValue('<html>report</html>');
    await buildReport('123 Main St, Louisville, KY 40202', {});
    expect(mockSaveReport).toHaveBeenCalledWith('123 Main St, Louisville, KY 40202');
    expect(mockPutArtifact).toHaveBeenCalledTimes(1);
    const [id, artifact] = mockPutArtifact.mock.calls[0];
    expect(id).toBe('abcd1234');
    expect(artifact.html).toBe('<html>report</html>');
    expect(artifact.contract.schemaVersion).toBe('1.0');
  });

  test('skips saveReport and putArtifact when persist is false (I-1)', async () => {
    const result = await buildReport('123 Main St, Louisville, KY 40202', { persist: false });
    expect(mockSaveReport).not.toHaveBeenCalled();
    expect(mockPutArtifact).not.toHaveBeenCalled();
    expect(result.reportId).toBeNull();
    expect(result.contract).toEqual(expect.objectContaining({ schemaVersion: '1.0' }));
  });

  test('CONSTRAINT-015: putArtifact rejection does not break buildReport', async () => {
    mockPutArtifact.mockRejectedValueOnce(new Error('disk full'));
    const result = await buildReport('123 Main St, Louisville, KY 40202', {});
    expect(result).toMatchObject({
      html: expect.any(String),
      contract: expect.objectContaining({ schemaVersion: '1.0' }),
      reportId: 'abcd1234',
    });
  });
});
