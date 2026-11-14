// Shared test helper (CCD-417): fills the fake API functions with mock data
// in the agreed response shapes (the same shapes as docs/api.md and src/mocks/).
// Only for tests: the app itself never imports this file.
//
// How to use it in a test file:
//   import * as api from '../services/api';
//   import { mockApiSuccess } from '../test/mockApi';
//   vi.mock('../services/api');              // every API function becomes a fake (vi.fn)
//   beforeEach(() => {
//     vi.clearAllMocks();                    // forget calls from the previous test
//     mockApiSuccess(api);                   // the fakes answer with Cork's data
//   });
import { mockCork, mockCorkRows } from '../mocks/countyRows';
import { mockSeaLevelCork } from '../mocks/seaLevel';

// A short county list in the same shape as GET /api/counties/
export const mockCountyList = [
  { id: 4, name: 'Cork', slug: 'cork', has_coastline: true },
  { id: 8, name: 'Kerry', slug: 'kerry', has_coastline: true },
  { id: 10, name: 'Kildare', slug: 'kildare', has_coastline: false },
];

// Every fake answers straight away with mock data, as if the API worked.
// Pass "overrides" to change one answer, e.g. mockApiSuccess(api, { counties: [] }).
export function mockApiSuccess(api, overrides = {}) {
  // "??" means: use the override if one was given, otherwise the default
  api.getCounties.mockResolvedValue(overrides.counties ?? mockCountyList);
  api.getCounty.mockResolvedValue(overrides.county ?? mockCork);
  api.getProjections.mockResolvedValue(overrides.projections ?? mockCorkRows);
  api.getSeaLevel.mockResolvedValue(overrides.seaLevel ?? mockSeaLevelCork);
}

// Every fake never answers, so the page stays on its "Loading…" state.
// Useful for tests that only check routes or headings.
export function mockApiLoading(api) {
  const neverAnswers = () => new Promise(() => {});
  api.getCounties.mockImplementation(neverAnswers);
  api.getCounty.mockImplementation(neverAnswers);
  api.getProjections.mockImplementation(neverAnswers);
  api.getSeaLevel.mockImplementation(neverAnswers);
}

// One fake fails with an HTTP error, the same message services/api.js would give,
// e.g. mockApiError(api, 'getCounty', 404) for "county not found"
export function mockApiError(api, functionName, status = 500) {
  api[functionName].mockRejectedValue(new Error(`API error ${status}`));
}