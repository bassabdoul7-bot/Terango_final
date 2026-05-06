var fetch = global.fetch;

var UPSTREAM = process.env.GEOCODE_UPSTREAM || 'https://geocode.terango.sn';
var DEFAULT_VIEWBOX = '-17.60,14.85,-17.10,14.55'; // Dakar metro
var DEFAULT_VIEWBOX_WIDE = '-17.60,14.90,-17.10,14.55'; // includes Keur Massar / Rufisque buffer
var SN_BBOX = { minLat: 12.30, maxLat: 16.70, minLon: -17.55, maxLon: -11.35 };

var SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 min
var SEARCH_CACHE_MAX = 500;
var REVERSE_CACHE_TTL = 30 * 60 * 1000; // 30 min — reverse hits the same spot a lot
var REVERSE_CACHE_MAX = 1000;

var searchCache = new Map();
var reverseCache = new Map();

function lruGet(map, key) {
  if (!map.has(key)) return null;
  var entry = map.get(key);
  if (Date.now() > entry.expiresAt) { map.delete(key); return null; }
  // touch — move to end (Map preserves insertion order)
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

function distanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lat2 == null) return Infinity;
  var R = 6371;
  var toRad = function(d) { return d * Math.PI / 180; };
  var dLat = toRad(lat2 - lat1);
  var dLon = toRad(lon2 - lon1);
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isAdminOnly(item) {
  if (!item) return true;
  var cls = (item.class || '').toLowerCase();
  var typ = (item.type || '').toLowerCase();
  if (cls === 'boundary') return true;
  if (typ === 'administrative') return true;
  // Place results without a road or specific subtype are commune/city centroids
  var addr = item.address || {};
  var hasStreetSignal = !!(addr.road || addr.house_number || addr.tourism || addr.amenity || addr.shop || addr.building || addr.aeroway || addr.leisure || addr.railway);
  if (cls === 'place' && (typ === 'city' || typ === 'town' || typ === 'village' || typ === 'suburb' || typ === 'quarter' || typ === 'neighbourhood') && !hasStreetSignal) {
    // keep neighbourhood-level only as a low-confidence approximate; mark and continue
    return false;
  }
  return false;
}

function classifyConfidence(item) {
  var addr = item.address || {};
  var cls = (item.class || '').toLowerCase();
  var typ = (item.type || '').toLowerCase();
  if (addr.road || addr.house_number) return 'exact';
  if (cls === 'amenity' || cls === 'shop' || cls === 'tourism' || cls === 'leisure' || cls === 'aeroway') return 'exact';
  if (cls === 'place' && (typ === 'suburb' || typ === 'neighbourhood' || typ === 'quarter')) return 'approximate';
  if (cls === 'place' && (typ === 'city' || typ === 'town' || typ === 'village')) return 'approximate';
  return 'approximate';
}

function buildViewbox(lat, lng, radiusKm) {
  if (lat == null || lng == null) return DEFAULT_VIEWBOX_WIDE;
  // 1 deg lat ~= 111km; 1 deg lon at 14.7° ~= 107km
  var dLat = radiusKm / 111;
  var dLon = radiusKm / 107;
  var minLon = lng - dLon, maxLon = lng + dLon;
  var minLat = lat - dLat, maxLat = lat + dLat;
  // Nominatim viewbox is "left,top,right,bottom" = "minLon,maxLat,maxLon,minLat"
  return [minLon.toFixed(4), maxLat.toFixed(4), maxLon.toFixed(4), minLat.toFixed(4)].join(',');
}

exports.search = async function(req, res) {
  try {
    var q = (req.body && req.body.q) || (req.query && req.query.q) || '';
    q = String(q).trim();
    if (q.length < 2) return res.json({ success: true, results: [] });

    var lat = parseFloat((req.body && req.body.lat) || (req.query && req.query.lat));
    var lng = parseFloat((req.body && req.body.lng) || (req.query && req.query.lng));
    var hasGps = !isNaN(lat) && !isNaN(lng);

    var cacheKey = q.toLowerCase() + '|' + (hasGps ? Math.round(lat * 100) + ',' + Math.round(lng * 100) : 'nogps');
    var cached = lruGet(searchCache, cacheKey);
    if (cached) return res.json({ success: true, results: cached, cached: true });

    var viewbox = hasGps ? buildViewbox(lat, lng, 25) : DEFAULT_VIEWBOX_WIDE;
    var url = UPSTREAM + '/search?q=' + encodeURIComponent(q) +
      '&format=json&limit=15&accept-language=fr&countrycodes=sn&addressdetails=1' +
      '&viewbox=' + viewbox + '&bounded=0';

    var response = await fetch(url, { headers: { 'User-Agent': 'TeranGO/1.0 (api.terango.sn)' } });
    if (!response.ok) {
      return res.status(502).json({ success: false, message: 'Geocode upstream error', results: [] });
    }
    var raw = await response.json();
    if (!Array.isArray(raw)) raw = [];

    // Filter — keep results inside Senegal, drop pure admin-boundary entries
    var filtered = raw.filter(function(item) {
      if (!item || item.lat == null || item.lon == null) return false;
      var rlat = parseFloat(item.lat), rlon = parseFloat(item.lon);
      if (rlat < SN_BBOX.minLat || rlat > SN_BBOX.maxLat || rlon < SN_BBOX.minLon || rlon > SN_BBOX.maxLon) return false;
      if (isAdminOnly(item)) return false;
      return true;
    });

    // Score: lower = better. Importance from Nominatim, plus distance penalty if GPS provided.
    var scored = filtered.map(function(item) {
      var rlat = parseFloat(item.lat), rlon = parseFloat(item.lon);
      var importance = typeof item.importance === 'number' ? item.importance : 0;
      var distPenalty = hasGps ? distanceKm(lat, lng, rlat, rlon) / 50 : 0; // ~1.0 per 50km
      var confidence = classifyConfidence(item);
      var confPenalty = confidence === 'exact' ? 0 : 0.25;
      var score = -importance + distPenalty + confPenalty;
      return { item: item, rlat: rlat, rlon: rlon, score: score, confidence: confidence };
    });
    scored.sort(function(a, b) { return a.score - b.score; });

    var results = scored.slice(0, 8).map(function(s) {
      return {
        lat: s.rlat, lng: s.rlon,
        display_name: s.item.display_name || '',
        address: s.item.address || {},
        class: s.item.class || '',
        type: s.item.type || '',
        confidence: s.confidence,
        importance: typeof s.item.importance === 'number' ? s.item.importance : 0
      };
    });

    lruSet(searchCache, cacheKey, results, SEARCH_CACHE_TTL, SEARCH_CACHE_MAX);
    return res.json({ success: true, results: results });
  } catch (err) {
    console.error('Geocode search error:', err);
    return res.status(500).json({ success: false, message: 'Erreur de recherche', results: [] });
  }
};

exports.reverse = async function(req, res) {
  try {
    var lat = parseFloat((req.body && req.body.lat) || (req.query && req.query.lat));
    var lng = parseFloat((req.body && req.body.lng) || (req.query && req.query.lng));
    if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ success: false, message: 'lat/lng requis' });

    // Cache by ~50m grid (5 decimals = 1.1m, 4 decimals = 11m, 3 decimals = 111m)
    var cacheKey = lat.toFixed(4) + ',' + lng.toFixed(4);
    var cached = lruGet(reverseCache, cacheKey);
    if (cached) return res.json({ success: true, result: cached, cached: true });

    var url = UPSTREAM + '/reverse?lat=' + lat + '&lon=' + lng + '&format=json&addressdetails=1&accept-language=fr&zoom=18';
    var response = await fetch(url, { headers: { 'User-Agent': 'TeranGO/1.0 (api.terango.sn)' } });
    if (!response.ok) return res.status(502).json({ success: false, message: 'Geocode upstream error' });
    var data = await response.json();

    var addr = (data && data.address) || {};
    var name = addr.tourism || addr.amenity || addr.shop || addr.building || addr.aeroway || '';
    var road = addr.road || '';
    var houseNumber = addr.house_number || '';
    var neighbourhood = addr.neighbourhood || addr.suburb || '';
    var city = addr.city || addr.town || addr.village || '';
    var primary = '';
    if (name) primary = name;
    else if (houseNumber && road) primary = houseNumber + ' ' + road;
    else if (road) primary = road;
    else if (data && data.display_name) primary = data.display_name.split(', ')[0] || '';

    var secondaryParts = [];
    if (road && road !== primary) secondaryParts.push(road);
    if (neighbourhood && neighbourhood !== primary) secondaryParts.push(neighbourhood);
    if (city && city !== primary) secondaryParts.push(city);

    var fullAddress = primary + (secondaryParts.length ? ', ' + secondaryParts.join(', ') : '');
    var confidence = (road || houseNumber || name) ? 'exact' : 'approximate';

    var result = {
      lat: lat, lng: lng,
      address: fullAddress.trim() || (data && data.display_name) || '',
      primary: primary,
      secondary: secondaryParts.join(', '),
      raw: addr,
      confidence: confidence
    };
    lruSet(reverseCache, cacheKey, result, REVERSE_CACHE_TTL, REVERSE_CACHE_MAX);
    return res.json({ success: true, result: result });
  } catch (err) {
    console.error('Geocode reverse error:', err);
    return res.status(500).json({ success: false, message: 'Erreur reverse geocode' });
  }
};
