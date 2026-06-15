// netlify/functions/_cors.js
// Shared CORS handling — reflects an allowed origin from a whitelist.
//
// NOTE: CORS is enforced by browsers only. It is defence-in-depth that limits
// casual cross-site browser abuse; it is NOT an auth boundary (curl/Postman
// ignore it). Real protection comes from the JWT checks in _auth.js and the
// server-side payment binding in confirm-booking.js.

const ALLOWED_ORIGINS = [
  'https://spearfishingfundamentals.com',
  'https://www.spearfishingfundamentals.com',
  'https://fundees.netlify.app'
];

function corsHeaders(event) {
  const origin = (event && (event.headers?.origin || event.headers?.Origin)) || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
    'Content-Type': 'application/json'
  };
}

module.exports = { corsHeaders, ALLOWED_ORIGINS };
