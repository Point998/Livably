'use strict';
const { Client } = require('@googlemaps/google-maps-services-js');
const { makeGoogleMapsRequest } = require('../../rateLimit');

const _raw = new Client({});
const googleMapsClient = new Proxy(_raw, {
  get(target, prop) {
    const val = Reflect.get(target, prop);
    if (typeof val === 'function') {
      return (...args) => makeGoogleMapsRequest(() => Reflect.apply(val, target, args), prop);
    }
    return val;
  },
});
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

module.exports = { googleMapsClient, googleMapsApiKey };
