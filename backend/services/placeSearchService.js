/**
 * placeSearchService.js — Cascading place search for the rider app.
 *
 * Riders kept getting empty dropdowns when searching for Senegalese SMBs that
 * don't exist on OpenStreetMap (which is the bulk of them). Single-source
 * search is structurally broken in this market.
 *
 * Cascade order (each layer feeds the next only if it returns too few hits):
 *   1. PARTNER DB        — Restaurant collection (and future Shop/Store).
 *                          Instant, free, perfect for delivery + commande.
 *                          Today this returns nothing because the catalogue
 *                          is empty, but the layer is wired so it kicks in
 *                          the day a partner is onboarded.
 *   2. NOMINATIM (OSM)   — same call we already had. Strong for landmarks
 *                          (Aéroport AIBD, Place de l'Indépendance, big
 *                          markets, neighbourhoods) but blind to most SMBs.
 *   3. GOOGLE PLACES     — fallback when 1+2 give <3 results. Full SN
 *                          coverage. Cached 24h to keep cost predictable
 *                          (riders search the same 200 spots over and over).
 *
 * Cost is dominated by Google. With the 24h LRU cache and the gating
 * (only fires when other sources are weak), real-world cost lands in
 * the $20-50/mo range at 1000 rides/day — trivial vs revenue.
 */

var Restaurant = require('../models/Restaurant');

var SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;          // 24h — Google cache
var SEARCH_CACHE_MAX = 2000;                            // distinct queries kept
var GOOGLE_TRIGGER_THRESHOLD = 3;                       // call Google only if combined results < 3
var PARTNER_RESULT_LIMIT = 5;
var GOOGLE_RESULT_LIMIT = 8;
var SENEGAL_BIAS = '14.6928,-17.4467';                  // Dakar centroid
var SENEGAL_BBOX = { minLat: 12.30, maxLat: 16.70, minLon: -17.55, maxLon: -11.35 };

var googleCache = new Map();

function lruGet(map, key) {
  if (!map.has(key)) return null;
  var entry = map.get(key);
  if (Date.now() > entry.expiresAt) { map.delete(key); return null; }
  map.delete(key); map.set(key, entry);
  return entry.value;
}
function lruSet(map, key, value, ttl, max) {
  if (map.has(key)) map.delete(key);
  map.set(key, { value: value, expiresAt: Date.now() + ttl });
  while (map.size > max) {
    var firstKey = map.keys().next().value;
    map.delete(firstKey);
  }
}

function inSenegal(lat, lon) {
  return lat >= SENEGAL_BBOX.minLat && lat <= SENEGAL_BBOX.maxLat &&
         lon >= SENEGAL_BBOX.minLon && lon <= SENEGAL_BBOX.maxLon;
}

function distanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lat2 == null) return Infinity;
  var R = 6371;
  var toRad = function(d) { return d * Math.PI / 180; };
  var dLat = toRad(lat2 - lat1);
  var dLon = toRad(lon2 - lon1);
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Normalise text for fuzzy compare (strip accents + lowercase).
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/* -------------------------------------------------------------------- */
/* Layer 1 — Partner DB (Restaurant collection)                         */
/* -------------------------------------------------------------------- */

exports.searchPartners = async function(query, userLat, userLng) {
  var q = norm(query).trim();
  if (q.length < 2) return [];

  // Tokenise so "pizza inn" matches "Pizza Inn Dakar" — Mongo text search
  // doesn't get used here because the restaurants collection is small and
  // we want substring matches, not just word stems.
  var safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp(safe, 'i');

  try {
    var docs = await Restaurant.find({
      isActive: true,
      $or: [
        { name: re },
        { slug: re },
        { categories: re },
        { cuisine: re },
        { 'address.street': re },
      ],
    })
    .select('name slug address categories cuisine logo')
    .limit(PARTNER_RESULT_LIMIT * 2)
    .lean();

    return docs
      .filter(function(r) {
        return r.address && r.address.coordinates &&
               typeof r.address.coordinates.latitude === 'number';
      })
      .map(function(r) {
        var lat = r.address.coordinates.latitude;
        var lon = r.address.coordinates.longitude;
        var dist = (userLat != null && userLng != null) ? distanceKm(userLat, userLng, lat, lon) : null;
        return {
          source: 'partner',
          lat: lat, lng: lon,
          display_name: r.name + ', ' + (r.address.street || 'Dakar'),
          address: { road: r.address.street, city: 'Dakar' },
          name: r.name,
          class: 'partner',
          type: (r.categories && r.categories[0]) || 'restaurant',
          confidence: 'exact',
          importance: 1.0,                                // partner trumps OSM in scoring
          distance_km: dist,
          partner_id: String(r._id),
          partner_slug: r.slug,
          partner_logo: r.logo || '',
        };
      })
      .slice(0, PARTNER_RESULT_LIMIT);
  } catch (err) {
    console.error('placeSearchService.searchPartners error:', err);
    return [];
  }
};

/* -------------------------------------------------------------------- */
/* Layer 3 — Google Places fallback                                     */
/* -------------------------------------------------------------------- */

exports.searchGoogle = async function(query, userLat, userLng) {
  var apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];                                // silently disabled
  var q = String(query || '').trim();
  if (q.length < 2) return [];

  var cacheKey = norm(q) + '|' + (userLat != null ? Math.round(userLat * 100) + ',' + Math.round(userLng * 100) : 'nogps');
  var cached = lruGet(googleCache, cacheKey);
  if (cached) return cached;

  // Places API (New) — Text Search endpoint. POST JSON, FieldMask required.
  // We bias to Dakar (50km radius) AND restrict country=SN, so the model
  // doesn't propose Paris cafés when riders type ambiguous names.
  var body = {
    textQuery: q + ' Sénégal',                          // suffix helps disambiguation
    languageCode: 'fr',
    regionCode: 'SN',
    maxResultCount: GOOGLE_RESULT_LIMIT,
    locationBias: {
      circle: {
        center: {
          latitude: userLat != null ? userLat : 14.6928,
          longitude: userLng != null ? userLng : -17.4467,
        },
        radius: 50000,                                  // 50 km — covers Dakar metro + Thiès
      },
    },
  };

  try {
    var resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.shortFormattedAddress',
          'places.location',
          'places.types',
          'places.primaryType',
        ].join(','),
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      var text = await resp.text();
      console.error('Google Places error', resp.status, text.slice(0, 300));
      return [];
    }
    var data = await resp.json();
    var places = (data && data.places) || [];

    var results = places
      .map(function(p) {
        var loc = p.location || {};
        var lat = loc.latitude, lon = loc.longitude;
        if (typeof lat !== 'number' || typeof lon !== 'number') return null;
        if (!inSenegal(lat, lon)) return null;
        var name = (p.displayName && p.displayName.text) || p.shortFormattedAddress || '';
        var addr = p.shortFormattedAddress || p.formattedAddress || '';
        return {
          source: 'google',
          lat: lat, lng: lon,
          display_name: addr || name,
          address: { road: addr },
          name: name,
          class: 'place',
          type: p.primaryType || (p.types && p.types[0]) || 'place',
          confidence: 'exact',
          importance: 0.7,                              // ranks below partner, above osm-approximate
          google_place_id: p.id,
        };
      })
      .filter(Boolean);

    lruSet(googleCache, cacheKey, results, SEARCH_CACHE_TTL_MS, SEARCH_CACHE_MAX);
    return results;
  } catch (err) {
    console.error('placeSearchService.searchGoogle error:', err);
    return [];
  }
};

/* -------------------------------------------------------------------- */
/* Cascade orchestrator                                                 */
/* -------------------------------------------------------------------- */

/**
 * Run the cascade. `osmResults` is whatever the existing Nominatim search
 * produced (passed in so the controller stays the single source of truth
 * for OSM filtering/scoring).
 *
 * Returns the merged + de-duped + scored array, capped to 10. Google is only
 * called when the combined (partner + OSM) result count is below threshold.
 */
exports.merge = async function(query, userLat, userLng, osmResults) {
  var hasGps = typeof userLat === 'number' && typeof userLng === 'number';

  var partnerResults = await exports.searchPartners(query, hasGps ? userLat : null, hasGps ? userLng : null);

  var combined = partnerResults.concat(osmResults || []);
  var googleResults = [];
  if (combined.length < GOOGLE_TRIGGER_THRESHOLD) {
    googleResults = await exports.searchGoogle(query, hasGps ? userLat : null, hasGps ? userLng : null);
  }

  // Dedup by geohash-ish coords + name
  var seen = {};
  var deduped = [];
  partnerResults.concat(osmResults || []).concat(googleResults).forEach(function(r) {
    var key = (r.name || r.display_name || '').toLowerCase().slice(0, 24) + '|' +
              Math.round(r.lat * 1000) + ',' + Math.round(r.lng * 1000);
    if (seen[key]) return;
    seen[key] = true;
    deduped.push(r);
  });

  // Sort: partner first, then OSM exact, then Google, then OSM approximate.
  deduped.sort(function(a, b) {
    var rank = function(r) {
      if (r.source === 'partner') return 0;
      if (r.source === 'google') return 1;
      if (r.confidence === 'exact') return 1;
      return 2;
    };
    var ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    // Within tier, sort by distance if we have GPS, else by importance.
    if (hasGps) {
      var da = a.distance_km != null ? a.distance_km : distanceKm(userLat, userLng, a.lat, a.lng);
      var db = b.distance_km != null ? b.distance_km : distanceKm(userLat, userLng, b.lat, b.lng);
      return da - db;
    }
    return (b.importance || 0) - (a.importance || 0);
  });

  return deduped.slice(0, 10);
};
