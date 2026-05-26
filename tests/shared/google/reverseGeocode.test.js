'use strict';
const mockClient = { reverseGeocode: jest.fn() };

jest.mock('../../../src/shared/google/client', () => ({
  googleMapsClient: mockClient,
  googleMapsApiKey: 'test-key',
}));

const { reverseGeocodeAddress } = require('../../../src/shared/google/reverseGeocode');

const makeComponent = (type, long, short) => ({
  types: [type],
  long_name: long,
  short_name: short || long,
});

describe('reverseGeocodeAddress', () => {
  beforeEach(() => jest.clearAllMocks());

  test('extracts city, state, county, zip from mock response', async () => {
    mockClient.reverseGeocode.mockResolvedValue({
      data: {
        results: [{
          address_components: [
            makeComponent('locality', 'Georgetown'),
            makeComponent('administrative_area_level_1', 'Kentucky', 'KY'),
            makeComponent('administrative_area_level_2', 'Scott County'),
            makeComponent('postal_code', '40324'),
          ],
        }],
      },
    });
    const result = await reverseGeocodeAddress('38.2,-84.5');
    expect(result).toEqual({
      city: 'Georgetown',
      state: 'KY',
      county: 'Scott County',
      zip: '40324',
    });
  });

  test('returns empty strings for missing components (not null, not throws)', async () => {
    mockClient.reverseGeocode.mockResolvedValue({ data: { results: [{ address_components: [] }] } });
    const result = await reverseGeocodeAddress('0,0');
    expect(result).toEqual({ city: '', state: '', county: '', zip: '' });
  });

  test('returns empty strings on network error', async () => {
    mockClient.reverseGeocode.mockRejectedValue(new Error('network'));
    const result = await reverseGeocodeAddress('0,0');
    expect(result).toEqual({ city: '', state: '', county: '', zip: '' });
  });
});
