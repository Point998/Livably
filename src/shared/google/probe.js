'use strict';
const { GOOGLE_PLACES_NEARBY_URL } = require('../../utils/constants');
const { googleMapsApiKey } = require('./client');

// FR-063: reachability probe for Google-Places-SDK-backed sources that swallow
// failures to an empty/null value (their fetchers use Promise.allSettled and
// return a well-formed-but-empty result even when Places is down, so isValid
// alone can't tell a dead endpoint from a genuinely empty area). Returns the
// HTTP status number the harness's evaluateCell uses to gate reachability.
async function googlePlacesProbe(ctx) {
  const url =
    `${GOOGLE_PLACES_NEARBY_URL}?location=${ctx.lat},${ctx.lng}` +
    `&radius=1000&type=restaurant&key=${googleMapsApiKey}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
  return resp.status;
}

module.exports = { googlePlacesProbe };
