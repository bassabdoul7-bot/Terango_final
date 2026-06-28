/**
 * googleProxyController.js — Backend proxy for Google Maps APIs.
 *
 * The mobile apps (driver-app, rider-app) used to call googleapis.com
 * directly with the API key baked into the JS bundle. Anyone decompiling
 * the APK could rip the key and burn through quota — real money risk now
 * that we're using paid Places API too.
 *
 * Now the apps call these typed endpoints. The key lives only in the
 * backend .env. Inputs are validated so the proxy can't be turned into
 * a generic Google Maps relay by random people on the internet.
 *
 * Endpoints:
 *   POST /api/google/directions  { origin, destination, waypoint? }
 *   GET  /api/google/speedLimit?lat=X&lng=Y
 *
 * Both cache aggressively (Directions: 5 min — routes are time-of-day
 * sensitive; SpeedLimit: 30 days — road speed limits are static).
 */

var fetch = global.fetch;

function getApiKey() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || '';
}

/* -------------------------------------------------------------------- */
/* LRU caches                                                           */
/* -------------------------------------------------------------------- */

var DIRECTIONS_TTL = 5 * 60 * 1000;             // 5 min
var DIRECTIONS_MAX = 1000;
var SPEEDLIMIT_TTL = 30 * 24 * 60 * 60 * 1000;  // 30 days
var SPEEDLIMIT_MAX = 5000;
var directionsCache = new Map();
var speedLimitCache = new Map();

// Defensive cooldown shared with placeSearchService approach — back off when
// Google returns 429/403 so we don't burn quota on a broken state.
var cooldownUntil = 0;
var COOLDOWN_MS = 5 * 60 * 1000;

function lruGet(map, key) {
  var entry = map.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { map.delete(key); return null; }
  map.delete(key); map.set(key, entry);
  return entry.value;
}
function lruSet(map, key, value, ttl, max) {
  if (map.has(key)) map.delete(key);
  map.set(key, { value: value, expiresAt: Date.now() + ttl });
  while (map.size > max) {
    var first = map.keys().next().value;
    map.delete(first);
  }
}

/* -------------------------------------------------------------------- */
/* Input validation                                                     */
/* -------------------------------------------------------------------- */

// Senegal-only safety: refuse coords outside the country so the proxy can't
// be turned into a free worldwide directions API by abuse.
var SN_BBOX = { minLat: 12.30, maxLat: 16.70, minLon: -17.55, maxLon: -11.35 };

function isValidLatLng(lat, lng) {
  return typeof lat === 'number' && typeof lng === 'number' &&
         isFinite(lat) && isFinite(lng) &&
         lat >= SN_BBOX.minLat && lat <= SN_BBOX.maxLat &&
         lng >= SN_BBOX.minLon && lng <= SN_BBOX.maxLon;
}

function parseLatLngPair(s) {
  if (typeof s !== 'string') return null;
  var parts = s.split(',');
  if (parts.length !== 2) return null;
  var lat = parseFloat(parts[0]);
  var lng = parseFloat(parts[1]);
  if (!isValidLatLng(lat, lng)) return null;
  return { lat: lat, lng: lng };
}

/* -------------------------------------------------------------------- */
/* /api/google/directions                                               */
/* -------------------------------------------------------------------- */

exports.directions = async function(req, res) {
  var apiKey = getApiKey();
  if (!apiKey) {
    return res.status(503).json({ status: 'CONFIG_ERROR', error_message: 'Google key missing on server' });
  }
  if (Date.now() < cooldownUntil) {
    return res.status(503).json({ status: 'TEMP_UNAVAILABLE', error_message: 'Google in cooldown' });
  }

  // Accept either GET (query string) or POST (JSON body) for backward compat
  // with apps that already used &origin=lat,lng&destination=lat,lng query format.
  var body = req.body || {};
  var origin = parseLatLngPair(body.origin || req.query.origin);
  var destination = parseLatLngPair(body.destination || req.query.destination);
  var waypoint = parseLatLngPair(body.waypoint || req.query.waypoint);

  if (!origin || !destination) {
    return res.status(400).json({
      status: 'INVALID_REQUEST',
      error_message: 'origin and destination required as "lat,lng" inside Senegal',
    });
  }

  var cacheKey = origin.lat.toFixed(4) + ',' + origin.lng.toFixed(4) + '|' +
                 destination.lat.toFixed(4) + ',' + destination.lng.toFixed(4) +
                 (waypoint ? '|' + waypoint.lat.toFixed(4) + ',' + waypoint.lng.toFixed(4) : '');
  var cached = lruGet(directionsCache, cacheKey);
  if (cached) {
    return res.json(cached);
  }

  var url = 'https://maps.googleapis.com/maps/api/directions/json' +
    '?origin=' + origin.lat + ',' + origin.lng +
    '&destination=' + destination.lat + ',' + destination.lng +
    (waypoint ? '&waypoints=' + waypoint.lat + ',' + waypoint.lng : '') +
    '&mode=driving&language=fr&region=sn&key=' + apiKey;

  try {
    var response = await fetch(url);
    if (!response.ok) {
      if (response.status === 429 || response.status === 403 || response.status >= 500) {
        cooldownUntil = Date.now() + COOLDOWN_MS;
      }
      return res.status(502).json({ status: 'UPSTREAM_ERROR', error_message: 'Google ' + response.status });
    }
    var data = await response.json();
    if (data.status === 'OK') {
      lruSet(directionsCache, cacheKey, data, DIRECTIONS_TTL, DIRECTIONS_MAX);
    }
    return res.json(data);
  } catch (err) {
    console.error('googleProxy.directions error:', err);
    return res.status(500).json({ status: 'PROXY_ERROR', error_message: err.message });
  }
};

/* -------------------------------------------------------------------- */
/* /api/google/speedLimit                                               */
/* -------------------------------------------------------------------- */

exports.speedLimit = async function(req, res) {
  var apiKey = getApiKey();
  if (!apiKey) {
    return res.status(503).json({ error: 'config_error' });
  }
  if (Date.now() < cooldownUntil) {
    // Don't 503 here — speedometer should silently degrade. Return null limit.
    return res.json({ limit_kmh: null, source: 'cooldown' });
  }

  var lat = parseFloat(req.query.lat);
  var lng = parseFloat(req.query.lng);
  if (!isValidLatLng(lat, lng)) {
    return res.status(400).json({ error: 'invalid_lat_lng' });
  }

  // Snap to ~50m grid (~0.0005 deg) so nearby calls share cache. Highway
  // speed limits don't change over short distances; this keeps the cache
  // dense without losing accuracy.
  var cacheKey = lat.toFixed(3) + ',' + lng.toFixed(3);
  var cached = lruGet(speedLimitCache, cacheKey);
  if (cached) return res.json({ limit_kmh: cached, source: 'cache' });

  // Google Roads API — speed limits. Requires "Roads API" enabled on the GCP
  // project and the billing account configured (paid; ~$10 per 1000 calls
  // for speedLimits, but cache hit rate at the 100m grid should be very high).
  var url = 'https://roads.googleapis.com/v1/speedLimits?path=' + lat + ',' + lng + '&key=' + apiKey;

  try {
    var response = await fetch(url);
    if (!response.ok) {
      if (response.status === 429 || response.status === 403 || response.status >= 500) {
        cooldownUntil = Date.now() + COOLDOWN_MS;
      }
      return res.json({ limit_kmh: null, source: 'upstream_error_' + response.status });
    }
    var data = await response.json();
    var limit = null;
    if (data && data.speedLimits && data.speedLimits.length > 0 && data.speedLimits[0].speedLimit) {
      var sl = data.speedLimits[0];
      // Roads API returns MPH by default; we asked nothing, default unit is KPH for non-US.
      // Force conversion to km/h based on unit field.
      if (sl.units === 'MPH') {
        limit = Math.round(sl.speedLimit * 1.60934);
      } else {
        limit = sl.speedLimit;
      }
    }
    if (limit != null) lruSet(speedLimitCache, cacheKey, limit, SPEEDLIMIT_TTL, SPEEDLIMIT_MAX);
    return res.json({ limit_kmh: limit, source: 'fresh' });
  } catch (err) {
    console.error('googleProxy.speedLimit error:', err);
    return res.json({ limit_kmh: null, source: 'proxy_error' });
  }
};
