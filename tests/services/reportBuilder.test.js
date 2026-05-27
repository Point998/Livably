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
const mockGetPremiumData = jest.fn();
const mockSaveReport = jest.fn();
const mockLogRequest = jest.fn();
const mockLogError = jest.fn();
const mockLogAnalysis = jest.fn();
const mockBuildReportHTML = jest.fn();
const mockBuildPremiumSectionsHTML = jest.fn();

jest.mock('../../src/shared/google/geocoding', () => ({ geocodeAddress: mockGeocodeAddress }));
jest.mock('../../src/shared/google/reverseGeocode', () => ({ reverseGeocodeAddress: mockReverseGeocode }));
jest.mock('../../src/shared/google/distanceMatrix', () => ({ getDriveTime: mockGetDriveTime, getTrafficVariations: mockGetTrafficVariations }));
jest.mock('../../src/shared/google/client', () => ({ googleMapsClient: {}, googleMapsApiKey: 'test-key' }));
jest.mock('../../src/modules/reachability/data', () => ({ findNearestGrocery: mockFindNearestGrocery, findNearestPharmacy: mockFindNearestPharmacy, findNearestGasStation: mockFindNearestGasStation }));
jest.mock('../../src/modules/access/data', () => ({ findNearestHighwayOnRamp: mockFindNearestHighwayOnRamp }));
jest.mock('../../src/modules/health/data', () => ({ findNearestHospital: mockFindNearestHospital, findNearestUrgentCare: mockFindNearestUrgentCare }));
jest.mock('../../src/modules/schools/data', () => ({ findNearestSchool: mockFindNearestSchool, findNearestElementarySchool: mockFindNearestElementarySchool }));
jest.mock('../../src/modules/recreation/data', () => ({ findNearestPark: mockFindNearestPark, findNearestCoffeeShop: mockFindNearestCoffeeShop }));
jest.mock('../../src/premium', () => ({ getPremiumData: mockGetPremiumData, buildPremiumSectionsHTML: mockBuildPremiumSectionsHTML }));
jest.mock('../../src/services/reportStore', () => ({ saveReport: mockSaveReport }));
jest.mock('../../src/logger', () => ({ logRequest: mockLogRequest, logError: mockLogError, logAnalysis: mockLogAnalysis }));
jest.mock('../../src/templates/pages/reportPage', () => ({ buildReportHTML: mockBuildReportHTML }));

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
  mockGetPremiumData.mockResolvedValue(null);
  mockGetTrafficVariations.mockResolvedValue(null);
  mockSaveReport.mockReturnValue('abc12345');
  mockBuildReportHTML.mockReturnValue('<html>report</html>');
  mockBuildPremiumSectionsHTML.mockReturnValue('');
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

  test('passes originState to findNearestHospital (CONSTRAINT-006)', async () => {
    await buildReport('100 Main St, Georgetown, KY');
    expect(mockFindNearestHospital).toHaveBeenCalledWith(expect.any(String), 'KY');
  });

  test('passes originState to findNearestUrgentCare (CONSTRAINT-006)', async () => {
    await buildReport('100 Main St, Georgetown, KY');
    expect(mockFindNearestUrgentCare).toHaveBeenCalledWith(expect.any(String), 'KY');
  });

  test('passes originState to findNearestElementarySchool (CONSTRAINT-006)', async () => {
    await buildReport('100 Main St, Georgetown, KY');
    expect(mockFindNearestElementarySchool).toHaveBeenCalledWith(expect.any(String), 'KY');
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
});
