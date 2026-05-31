'use strict';

// Checks whether a geocoder-returned formatted_address actually refers to the
// expected highway. Google's geocoder sometimes returns unrelated results for
// obscure interstates. We verify the address string contains the highway name
// in one of the formats Google uses: "I-64", "I 64", "INTERSTATE 64", or the
// full original name (e.g. "I-64").
// See CONSTRAINT-005 and BUG-005.
function isValidHighwayName(formattedAddress, highwayName) {
  const returned = (formattedAddress || '').toUpperCase();
  const num = highwayName.replace('I-', '');
  return (
    returned.includes(highwayName.toUpperCase()) ||
    returned.includes(`INTERSTATE ${num}`) ||
    returned.includes(`I-${num}`) ||
    returned.includes(`I ${num}`)
  );
}

module.exports = { isValidHighwayName };
