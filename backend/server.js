require('dotenv').config({ override: false });
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');
const { protect } = require('./middleware/auth');
const RideMatchingService = require('./services/rideMatchingService');
const driverLocationService = require('./services/driverLocationService');

const app = express();
const server = http.createServer(app);

// CORS whitelist
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['https://admin.terango.sn', 'https://terango.sn'];

const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV !== 'production' ? '*' : allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

connectDB();

const matchingService = new RideMatchingService(io);
matchingService.setDriverLocationService(driverLocationService);

// Trust the Hetzner reverse proxy (Caddy/nginx) so req.ip reflects the real
// client IP from X-Forwarded-For instead of the proxy's loopback. Without
// this every request appears to come from a single IP and the rate limiter
// nukes everyone at once.
app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.NODE_ENV !== 'production'
    ? true
    : function(origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
  credentials: true
}));

// Security headers
app.use(helmet());

// Per-user rate limit when a JWT is present, IP-bucket otherwise. Senegal
// carrier NAT (Orange/Free/Expresso) puts many drivers behind one public IP,
// so an IP-only bucket means active drivers collectively trip the limit and
// can't go online. We only DECODE the JWT here (not verify) — real auth is
// later via `protect`. A forged token just lands in its own bucket; the
// fallback to IP keeps unauthenticated traffic accounted for.
function rateLimitKey(req) {
  var auth = req.headers && req.headers.authorization;
  if (auth && auth.indexOf('Bearer ') === 0) {
    try {
      var decoded = jwt.decode(auth.slice(7));
      if (decoded && decoded.id) return 'u:' + decoded.id;
    } catch (e) {}
  }
  // ipKeyGenerator normalises IPv6 addresses to a /56 prefix so rotating
  // addresses can't bypass the limit (raw req.ip would let them).
  return 'ip:' + ipKeyGenerator(req.ip);
}

// General API rate limit (skip /api/logs — has its own limiter)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  skip: function(req) { return req.path.startsWith('/logs'); },
  message: { success: false, message: 'Trop de requetes, veuillez reessayer plus tard.' }
});
app.use('/api', generalLimiter);

// Auth endpoints rate limit — keep IP-only here on purpose. The whole point
// is to slow brute-force login from a single attacker; per-user keying would
// defeat that since the attacker controls the credentials being tried. The
// trade-off is that legitimate users behind shared carrier NAT may hit it
// during a wave of failed logins from someone else on the same carrier IP;
// 30 in 15min is generous enough that real users rarely notice.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Trop de tentatives, veuillez reessayer plus tard.' }
});
app.use('/api/auth', authLimiter);

// Body size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static('uploads'));
app.use('/recordings', express.static(process.env.RECORDINGS_DIR || '/var/www/recordings'));

app.set('io', io);
app.set('matchingService', matchingService);
app.set('driverLocationService', driverLocationService);

// Routes
const authRoutes = require('./routes/authRoutes');
const rideRoutes = require('./routes/rideRoutes');
const driverRoutes = require('./routes/driverRoutes');
const adminRoutes = require('./routes/adminRoutes');
const restaurantRoutes = require('./routes/restaurantRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const partnerRoutes = require('./routes/partnerRoutes');
const logRoutes = require('./routes/logRoutes');

app.get('/', function(req, res) { res.json({ app: 'TeranGO API', status: 'running' }); });

// Mandatory version check served from env vars so a force-update can ship
// without redeploying code — bump DRIVER_MIN_VERSION_CODE / RIDER_MIN_VERSION_
// CODE in .env and `pm2 restart`. The app reads this on every launch and
// blocks with a full-screen "Mettre à jour" modal if its baked-in version
// is below the minimum. No "Later" — that's the product call.
app.get('/api/app-version/:role', function(req, res) {
  var role = req.params.role;
  if (role !== 'driver' && role !== 'rider') return res.status(400).json({ ok: false });
  var prefix = role === 'driver' ? 'DRIVER' : 'RIDER';
  var pkg = role === 'driver' ? 'com.terango.driver' : 'com.terango.rider';
  res.json({
    ok: true,
    minVersionCode: parseInt(process.env[prefix + '_MIN_VERSION_CODE'] || '0', 10),
    latestVersionCode: parseInt(process.env[prefix + '_LATEST_VERSION_CODE'] || '0', 10),
    playStoreUrl: 'https://play.google.com/store/apps/details?id=' + pkg,
    marketUrl: 'market://details?id=' + pkg,
    message: process.env[prefix + '_UPDATE_MESSAGE'] || 'Une nouvelle version de TeranGO est disponible. Mettez à jour pour continuer.'
  });
});

// ========== SHARE MY RIDE — Public page ==========
// JSON status poll for the share page. Mobile in-app browsers (WhatsApp
// webview especially) kill idle WebSockets to save battery, so the socket
// `share-status-update` push reaches no-one when the contact has the tab
// in the background. The client polls this every ~10s as a safety net —
// socket stays the fast path, polling guarantees freshness within 10s.
app.get('/share/:token/state', async function(req, res) {
  try {
    var Ride = require('./models/Ride');
    var ride = await Ride.findOne({ shareToken: req.params.token, shareEnabled: true })
      .select('status driver shareToken')
      .populate({ path: 'driver', select: 'currentLocation' });
    if (!ride) return res.status(404).json({ ok: false });
    var loc = ride.driver && ride.driver.currentLocation && ride.driver.currentLocation.coordinates
      ? { lat: ride.driver.currentLocation.coordinates.latitude, lng: ride.driver.currentLocation.coordinates.longitude }
      : null;
    res.json({ ok: true, status: ride.status, driver: loc });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

app.get('/share/:token', async function(req, res) {
  // The default helmet() applied above sets a strict CSP + COEP/CORP that
  // blocks the Leaflet JS, OSM tiles, inline script, and Cloudinary images
  // this page needs. Strip those for the public share page only — the rest
  // of the API keeps its security headers.
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('Cross-Origin-Embedder-Policy');
  res.removeHeader('Cross-Origin-Opener-Policy');
  res.removeHeader('Cross-Origin-Resource-Policy');
  // Force fresh fetch every time so an updated map/script/HTML reaches the
  // viewer without them having to clear cache. Especially important inside
  // WhatsApp's in-app browser, which caches aggressively.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  try {
    var Ride = require('./models/Ride');
    var ride = await Ride.findOne({ shareToken: req.params.token, shareEnabled: true })
      .populate({ path: 'riderId', populate: { path: 'userId', select: 'name phone' } })
      .populate({ path: 'driver', populate: { path: 'userId', select: 'name phone profilePhoto rating' } });

    if (!ride) {
      return res.status(404).send('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TeranGO</title></head><body style="background:#001A12;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1>Lien invalide</h1><p>Ce lien de partage n\'existe pas ou a expire.</p></div></body></html>');
    }

    var riderName = (ride.riderId && ride.riderId.userId && ride.riderId.userId.name) ? ride.riderId.userId.name : 'Passager';
    var driverUser = ride.driver && ride.driver.userId ? ride.driver.userId : null;
    var driverName = driverUser && driverUser.name ? driverUser.name : 'Chauffeur';
    var driverPhoto = driverUser && driverUser.profilePhoto ? driverUser.profilePhoto : '';
    var driverPhone = driverUser && driverUser.phone ? driverUser.phone : '';
    var driverRating = driverUser && driverUser.rating != null ? Number(driverUser.rating).toFixed(1) : '';
    var vehicleFrontPhoto = ride.driver && ride.driver.vehicleFrontPhoto ? ride.driver.vehicleFrontPhoto : '';
    var licensePlate = ride.driver && ride.driver.vehicle && ride.driver.vehicle.licensePlate ? ride.driver.vehicle.licensePlate : '';
    var vehicleInfo = '';
    if (ride.driver && ride.driver.vehicle) {
      vehicleInfo = (ride.driver.vehicle.make || '') + ' ' + (ride.driver.vehicle.model || '');
      if (ride.driver.vehicle.color) vehicleInfo += ' - ' + ride.driver.vehicle.color;
    }
    vehicleInfo = vehicleInfo.trim();

    var isFinished = ['completed', 'cancelled'].indexOf(ride.status) !== -1;
    var statusLabel = { pending: 'En attente', accepted: 'Chauffeur en route', arrived: 'Chauffeur arrive', in_progress: 'Course demarree', completed: 'Course terminee', cancelled: 'Course annulee' }[ride.status] || ride.status;

    var pickupLat = ride.pickup.coordinates.latitude;
    var pickupLng = ride.pickup.coordinates.longitude;
    var dropoffLat = ride.dropoff.coordinates.latitude;
    var dropoffLng = ride.dropoff.coordinates.longitude;
    var driverLat = (ride.driver && ride.driver.currentLocation && ride.driver.currentLocation.coordinates) ? ride.driver.currentLocation.coordinates.latitude : pickupLat;
    var driverLng = (ride.driver && ride.driver.currentLocation && ride.driver.currentLocation.coordinates) ? ride.driver.currentLocation.coordinates.longitude : pickupLng;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Suivre ma course - TeranGO</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css" crossorigin="anonymous" />
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#001A12; color:#fff; }
  #map { width:100%; height:55vh; min-height:300px; }
  .info-panel { padding:16px; max-width:600px; margin:0 auto; }
  .status-badge { display:inline-block; background:rgba(212,175,55,0.15); color:#D4AF37; padding:6px 14px; border-radius:20px; font-weight:600; font-size:14px; margin-bottom:12px; border:1px solid rgba(212,175,55,0.3); }
  .status-badge.finished { background:rgba(255,59,48,0.15); color:#FF3B30; border-color:rgba(255,59,48,0.3); }
  .status-badge.in-progress { background:rgba(0,133,63,0.15); color:#00853F; border-color:rgba(0,133,63,0.3); }
  .card { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); border-radius:14px; padding:14px; margin-bottom:12px; }
  .card-title { font-size:12px; color:rgba(255,255,255,0.5); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; }
  .driver-row { display:flex; align-items:center; gap:12px; }
  .driver-photos { display:flex; flex-direction:column; gap:6px; align-items:center; flex-shrink:0; }
  .driver-avatar { width:54px; height:54px; border-radius:27px; background:#00853F; display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:700; color:#fff; overflow:hidden; border:2px solid #D4AF37; }
  .driver-avatar img { width:100%; height:100%; object-fit:cover; }
  .vehicle-thumb { width:72px; height:48px; border-radius:10px; background:#FFFFFF; border:1px solid rgba(255,255,255,0.1); overflow:hidden; }
  .vehicle-thumb img { width:100%; height:100%; object-fit:cover; }
  .driver-info { flex:1; min-width:0; }
  .driver-name { font-size:16px; font-weight:700; }
  .driver-meta { font-size:12px; color:rgba(255,255,255,0.55); margin-top:2px; }
  .vehicle-info { font-size:13px; color:rgba(255,255,255,0.7); margin-top:4px; }
  .plate-badge { display:inline-block; margin-top:6px; padding:3px 10px; border-radius:8px; background:rgba(212,175,55,0.12); border:1px solid rgba(212,175,55,0.35); color:#D4AF37; font-weight:700; font-size:13px; letter-spacing:1px; }
  .verified-pill { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; background:rgba(0,133,63,0.15); color:#22c55e; border-radius:12px; font-size:11px; font-weight:600; margin-top:4px; border:1px solid rgba(34,197,94,0.35); }
  .address-row { display:flex; align-items:center; gap:10px; padding:8px 0; }
  .dot-green { width:12px; height:12px; border-radius:6px; background:#00853F; flex-shrink:0; }
  .dot-red { width:12px; height:12px; background:#FF3B30; flex-shrink:0; }
  .address-text { font-size:14px; color:rgba(255,255,255,0.8); }
  .divider { height:20px; margin-left:5px; border-left:2px dashed rgba(255,255,255,0.1); }
  .fare-row { display:flex; justify-content:space-between; align-items:center; margin-top:8px; }
  .fare-amount { font-size:20px; font-weight:700; color:#D4AF37; }
  .fare-label { font-size:13px; color:rgba(255,255,255,0.5); }
  .footer { text-align:center; padding:20px 16px 30px; }
  .footer-text { font-size:13px; color:rgba(255,255,255,0.4); }
  .footer a { color:#00853F; text-decoration:none; font-weight:600; }
  .finished-overlay { position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(0,26,18,0.85); display:flex; align-items:center; justify-content:center; z-index:1000; flex-direction:column; }
  .finished-overlay h2 { font-size:24px; margin-top:12px; }
  .finished-overlay p { color:rgba(255,255,255,0.6); margin-top:8px; }
  .eta-line { font-size:14px; color:rgba(255,255,255,0.75); margin:6px 0 12px; min-height:18px; }
  .eta-line strong { color:#D4AF37; font-weight:700; }
</style>
</head>
<body>
${isFinished ? '<div class="finished-overlay"><div style="font-size:48px">' + (ride.status === 'completed' ? '&#x2705;' : '&#x274C;') + '</div><h2>Course terminee</h2><p>' + (ride.status === 'completed' ? 'Le passager est arrive a destination.' : 'Cette course a ete annulee.') + '</p></div>' : ''}
<div id="map"></div>
<div class="info-panel">
  <div id="status-badge" class="status-badge ${isFinished ? 'finished' : (ride.status === 'in_progress' ? 'in-progress' : '')}">${statusLabel}</div>
  <div id="eta-line" class="eta-line"></div>

  <div class="card">
    <div class="card-title">Chauffeur v&eacute;rifi&eacute; TeranGO</div>
    <div class="driver-row">
      <div class="driver-photos">
        <div class="driver-avatar">${driverPhoto ? '<img src="' + driverPhoto + '" alt="">' : driverName.charAt(0)}</div>
        ${vehicleFrontPhoto ? '<div class="vehicle-thumb"><img src="' + vehicleFrontPhoto + '" alt=""></div>' : ''}
      </div>
      <div class="driver-info">
        <div class="driver-name">${driverName}</div>
        ${driverRating ? '<div class="driver-meta">&#9733; ' + driverRating + ' &middot; ' + (driverPhone || '') + '</div>' : (driverPhone ? '<div class="driver-meta">' + driverPhone + '</div>' : '')}
        ${vehicleInfo ? '<div class="vehicle-info">' + vehicleInfo + '</div>' : ''}
        ${licensePlate ? '<div class="plate-badge">' + licensePlate + '</div>' : ''}
        <div class="verified-pill">&#10003; V&eacute;rifi&eacute;</div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Trajet de ${riderName}</div>
    <div class="address-row"><div class="dot-green"></div><div class="address-text">${ride.pickup.address}</div></div>
    <div class="divider"></div>
    <div class="address-row"><div class="dot-red"></div><div class="address-text">${ride.dropoff.address}</div></div>
  </div>
</div>

<div class="footer">
  <p class="footer-text">Powered by <strong style="color:#00853F">TeranGO</strong> &mdash; <a href="https://play.google.com/store/apps/details?id=com.terango.rider" target="_blank">T&eacute;l&eacute;chargez l'app</a></p>
</div>

<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js" crossorigin="anonymous"><\/script>
<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"><\/script>
<script>
(function() {
  var isFinished = ${isFinished ? 'true' : 'false'};
  var shareToken = '${ride.shareToken}';
  var pickupLat = ${pickupLat}, pickupLng = ${pickupLng};
  var dropoffLat = ${dropoffLat}, dropoffLng = ${dropoffLng};
  var driverLat = ${driverLat}, driverLng = ${driverLng};

  // Defensive guard: if Leaflet didn't load (CDN blocked / slow network), show
  // a graceful fallback so the page is still useful instead of an empty box.
  if (typeof L === 'undefined') {
    var mapEl = document.getElementById('map');
    if (mapEl) {
      mapEl.style.display = 'flex';
      mapEl.style.alignItems = 'center';
      mapEl.style.justifyContent = 'center';
      mapEl.style.padding = '20px';
      mapEl.style.textAlign = 'center';
      mapEl.innerHTML = '<div style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.5">Carte indisponible<br/><span style="font-size:12px;color:rgba(255,255,255,0.4)">Connexion lente — les informations du chauffeur restent visibles ci-dessous.</span></div>';
    }
    return;
  }
  var map = L.map('map', { zoomControl: false }).setView([driverLat, driverLng], 14);
  // CartoDB dark tiles via Cloudfront — much more reliable in West Africa than
  // tile.openstreetmap.org which throttles foreign traffic. Tiles fall back
  // through a/b/c/d subdomains automatically inside Leaflet.
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19
  }).addTo(map);

  var greenIcon = L.divIcon({ className: '', html: '<div style="width:16px;height:16px;border-radius:8px;background:#00853F;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
  var redIcon = L.divIcon({ className: '', html: '<div style="width:16px;height:16px;background:#FF3B30;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
  var driverIcon = L.divIcon({ className: '', html: '<div style="width:36px;height:36px;border-radius:18px;background:#D4AF37;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:18px">&#x1F697;</div>', iconSize: [36, 36], iconAnchor: [18, 18] });

  L.marker([pickupLat, pickupLng], { icon: greenIcon }).addTo(map).bindPopup('Depart');
  L.marker([dropoffLat, dropoffLng], { icon: redIcon }).addTo(map).bindPopup('Destination');
  var driverMarker = L.marker([driverLat, driverLng], { icon: driverIcon }).addTo(map).bindPopup('Chauffeur');

  // Fit bounds to show all markers
  var bounds = L.latLngBounds([[pickupLat, pickupLng], [dropoffLat, dropoffLng], [driverLat, driverLng]]);
  map.fitBounds(bounds, { padding: [40, 40] });

  // ETA via OSRM — driver → pickup before in_progress, → dropoff after.
  // Refreshes on a 15s interval, on every status change, and on first load.
  // Throttled (not per-location) to spare OSRM and battery.
  var currentStatus = '${ride.status}';
  var etaEl = document.getElementById('eta-line');
  var etaTimer = null;
  var etaFetching = false;
  function etaTarget() {
    if (currentStatus === 'in_progress') return [dropoffLat, dropoffLng, 'Arrivée à destination dans'];
    return [pickupLat, pickupLng, 'Chauffeur arrive dans'];
  }
  function refreshEta() {
    if (!etaEl) return;
    if (currentStatus === 'arrived') { etaEl.innerHTML = 'Chauffeur arrivé au point de départ'; return; }
    if (currentStatus === 'pending' || currentStatus === 'completed' || currentStatus === 'cancelled') { etaEl.textContent = ''; return; }
    if (etaFetching) return;
    etaFetching = true;
    var t = etaTarget();
    var url = 'https://osrm.terango.sn/route/v1/driving/' + driverLng + ',' + driverLat + ';' + t[1] + ',' + t[0] + '?overview=false&steps=false';
    fetch(url).then(function(r) { return r.json(); }).then(function(d) {
      if (d && d.code === 'Ok' && d.routes && d.routes[0]) {
        var min = Math.max(1, Math.round(d.routes[0].duration / 60));
        var meters = d.routes[0].distance;
        var distStr = meters < 1000 ? Math.round(meters) + ' m' : (meters / 1000).toFixed(1) + ' km';
        etaEl.innerHTML = t[2] + ' <strong>~' + min + ' min</strong> · ' + distStr;
      }
    }).catch(function() {}).then(function() { etaFetching = false; });
  }

  // Apply a status change from either source (socket or polling). De-duped
  // so a status the page is already showing doesn't trigger a needless DOM
  // write or ETA refresh.
  function applyStatus(newStatus) {
    if (!newStatus || newStatus === currentStatus) return;
    currentStatus = newStatus;
    var badge = document.getElementById('status-badge');
    if (badge) {
      var labels = { pending: 'En attente', accepted: 'Chauffeur en route', arrived: 'Chauffeur arrive', in_progress: 'Course demarree' };
      badge.textContent = labels[newStatus] || newStatus;
      badge.className = 'status-badge' + (newStatus === 'in_progress' ? ' in-progress' : '');
    }
    refreshEta();
    if (newStatus === 'completed' || newStatus === 'cancelled') {
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;background:#001A12;color:#fff;font-family:sans-serif"><div style="font-size:48px">' + (newStatus === 'completed' ? '&#x2705;' : '&#x274C;') + '</div><h2 style="margin-top:12px">Course terminee</h2><p style="color:rgba(255,255,255,0.6);margin-top:8px">' + (newStatus === 'completed' ? 'Le passager est arrive a destination.' : 'Cette course a ete annulee.') + '</p></div>';
    }
  }

  // Polling fallback for mobile browsers that kill idle WebSockets.
  // Cheap (single Mongo lookup, no populates besides driver.currentLocation).
  function pollState() {
    fetch('/share/' + shareToken + '/state').then(function(r) { return r.json(); }).then(function(d) {
      if (!d || !d.ok) return;
      applyStatus(d.status);
      if (d.driver && typeof d.driver.lat === 'number' && typeof d.driver.lng === 'number') {
        driverLat = d.driver.lat; driverLng = d.driver.lng;
        try { driverMarker.setLatLng([driverLat, driverLng]); } catch(e) {}
      }
    }).catch(function() {});
  }

  if (!isFinished) {
    refreshEta();
    etaTimer = setInterval(refreshEta, 15000);
    setInterval(pollState, 10000);
    try {
      var socket = io(window.location.origin + '/share', { transports: ['websocket', 'polling'] });
      socket.on('connect', function() {
        socket.emit('join-share-room', shareToken);
      });
      socket.on('share-location-update', function(data) {
        if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          driverLat = data.latitude; driverLng = data.longitude;
          driverMarker.setLatLng([driverLat, driverLng]);
          map.panTo([driverLat, driverLng]);
        }
      });
      socket.on('share-status-update', function(data) {
        if (data && data.status) applyStatus(data.status);
      });
      socket.on('share-ride-ended', function(data) {
        if (etaTimer) { clearInterval(etaTimer); etaTimer = null; }
        applyStatus(data && data.status ? data.status : 'completed');
      });
    } catch(e) { console.log('Socket error:', e); }
  }
})();
<\/script>
</body>
</html>`);
  } catch (error) {
    console.error('Share page error:', error);
    res.status(500).send('Erreur serveur');
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/services', require('./routes/serviceRoutes'));
app.use('/api/geocode', require('./routes/geocodeRoutes'));
app.use('/api/google', require('./routes/googleProxyRoutes'));
app.use('/api/fleet', require('./routes/fleetRoutes'));

// Feedback endpoint (authenticated)
app.post('/api/errors/feedback', protect, async (req, res) => {
  try {
    var db = require('mongoose').connection.db;
    await db.collection('feedbacks').insertOne({
      message: req.body.message,
      screen: req.body.screen,
      userId: req.body.userId,
      userName: req.body.userName,
      userPhone: req.body.userPhone,
      app: req.body.app || 'rider',
      createdAt: new Date()
    });
    res.json({ success: true });
  } catch (e) {
    console.error('Feedback error:', e);
    res.status(500).json({ success: false });
  }
});

// Health check
async function healthCheck(req, res) {
  var checks = { redis: 'down', mongo: 'down', onlineDrivers: 0 };
  try { checks.onlineDrivers = await driverLocationService.getOnlineDriversCount(); checks.redis = 'ok'; } catch (e) {}
  try { var state = require('mongoose').connection.readyState; checks.mongo = state === 1 ? 'ok' : 'connecting'; } catch (e) {}
  var healthy = checks.redis === 'ok' && checks.mongo === 'ok';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    version: '1.0.0',
    uptime: Math.floor(process.uptime()) + 's',
    checks: checks,
    timestamp: new Date().toISOString()
  });
}
app.get('/health', healthCheck);
app.get('/api/health', healthCheck);

// ========== TELEGRAM ALERTS ==========
var TELEGRAM_BOT = process.env.TELEGRAM_BOT_TOKEN || '';
var TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '';
var lastAlertStatus = { redis: 'ok', mongo: 'ok' };

function sendTelegramAlert(msg) {
  var https = require('https');
  var data = JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg });
  var opts = { hostname: 'api.telegram.org', path: '/bot' + TELEGRAM_BOT + '/sendMessage', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
  var r = https.request(opts, function() {});
  r.on('error', function(e) { console.log('Telegram error:', e.message); });
  r.write(data);
  r.end();
}

setInterval(async function() {
  try {
    var mongoOk = require('mongoose').connection.readyState === 1;
    var redisOk = true;
    try { await driverLocationService.getOnlineDriversCount(); } catch(e) { redisOk = false; }

    if (!mongoOk && lastAlertStatus.mongo === 'ok') sendTelegramAlert('🚨 TeranGO: MongoDB is DOWN! ' + new Date().toISOString());
    if (mongoOk && lastAlertStatus.mongo === 'down') sendTelegramAlert('✅ TeranGO: MongoDB recovered! ' + new Date().toISOString());
    if (!redisOk && lastAlertStatus.redis === 'ok') sendTelegramAlert('🚨 TeranGO: Redis is DOWN! ' + new Date().toISOString());
    if (redisOk && lastAlertStatus.redis === 'down') sendTelegramAlert('✅ TeranGO: Redis recovered! ' + new Date().toISOString());

    lastAlertStatus = { redis: redisOk ? 'ok' : 'down', mongo: mongoOk ? 'ok' : 'down' };
  } catch(e) { console.log('Monitor error:', e.message); }
}, 2 * 60 * 1000);

setTimeout(function() { sendTelegramAlert('🚀 TeranGO Server Started!\nRedis: ok\nMongo: ok\nTime: ' + new Date().toISOString()); }, 8000);

// Self-ping every 4 minutes to prevent Fly auto-stop
setInterval(function() {
  require('http').get('http://localhost:5000/health', function(res) {
    console.log('Self-ping: ' + res.statusCode);
  }).on('error', function() {});
}, 4 * 60 * 1000);

// Global error handler
app.use(function(err, req, res, next) {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// ========== Auto-expire stale rides (every 5 min) ==========
setInterval(function() {
  var RideModel = require("./models/Ride");
  var cutoff = new Date(Date.now() - 10 * 60 * 1000);
  RideModel.updateMany(
    { status: { "\u0024in": ["pending", "accepted"] }, createdAt: { "\u0024lt": cutoff } },
    { "\u0024set": { status: "cancelled", cancellationReason: "Auto-expired after 10 minutes" } }
  ).then(function(r) { if (r.modifiedCount > 0) console.log("Auto-expired", r.modifiedCount, "stale rides"); }).catch(function() {});

  // ========== Auto-complete zombie in_progress rides (3+ hours) ==========
  (async function() {
    try {
      var ZombieRide = require('./models/Ride');
      var threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      var zombieRides = await ZombieRide.find({ status: 'in_progress', startedAt: { $lt: threeHoursAgo } });
      for (var i = 0; i < zombieRides.length; i++) {
        var ride = zombieRides[i];
        ride.status = 'completed';
        ride.completedAt = new Date();
        // Calculate earnings from the fare already on the ride if not set
        if (!ride.driverEarnings && ride.fare) {
          ride.platformCommission = Math.round(ride.fare * 0.15);
          ride.driverEarnings = ride.fare - ride.platformCommission;
        }
        await ride.save();
        console.log('Auto-completed zombie ride ' + ride._id + ' (started ' + ride.startedAt + ')');
      }
    } catch (e) {
      console.error('Zombie ride cleanup error:', e.message);
    }
  })();
}, 5 * 60 * 1000);


// ========== Scheduled Ride Matcher (every 60 seconds) ==========
setInterval(async function() {
  try {
    var ScheduledRide = require('./models/Ride');
    var ScheduledRider = require('./models/Rider');
    var { sendPushNotification } = require('./services/pushService');
    var fifteenMinFromNow = new Date(Date.now() + 15 * 60 * 1000);
    var scheduledRides = await ScheduledRide.find({
      isScheduled: true,
      status: 'scheduled',
      scheduledNotified: false,
      scheduledTime: { $lte: fifteenMinFromNow }
    });
    for (var i = 0; i < scheduledRides.length; i++) {
      var ride = scheduledRides[i];
      ride.status = 'pending';
      ride.scheduledNotified = true;
      await ride.save();
      console.log('Scheduled ride ' + ride._id + ' activated (was scheduled for ' + ride.scheduledTime + ')');

      // Trigger matching
      var rideData = {
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        fare: ride.fare,
        distance: ride.distance,
        estimatedDuration: ride.estimatedDuration,
        rideType: ride.rideType,
        paymentMethod: ride.paymentMethod,
        platformCommission: ride.platformCommission,
        driverEarnings: ride.driverEarnings
      };
      matchingService.offerRideToDrivers(ride._id, ride.pickup.coordinates, rideData).catch(function(err) { console.error('Scheduled matching error:', err); });

      // Send push notification to rider
      var rider = await ScheduledRider.findById(ride.riderId);
      if (rider) {
        sendPushNotification(rider.userId, 'Course programmée', 'Votre course programmée démarre bientôt! Recherche de chauffeur...', { type: 'scheduled-ride-activated', rideId: ride._id.toString() });
      }
    }
  } catch (e) {
    console.error('Scheduled ride matcher error:', e.message);
  }
}, 60 * 1000);

// ========== Smart Ride Safety Monitor (every 60 seconds) ==========
setInterval(async function() {
  try {
    var SafetyAlertModel = require('./models/SafetyAlert');
    var SafetyRide = require('./models/Ride');
    var SafetyRider = require('./models/Rider');
    var SafetyDriver = require('./models/Driver');
    var { sendPushNotification: safetyPush } = require('./services/pushService');
    var { calculateDistance: safetyCalcDist } = require('./utils/distance');

    var activeRides = await SafetyRide.find({ status: 'in_progress' }).populate('riderId').populate('driver');
    for (var i = 0; i < activeRides.length; i++) {
      var ride = activeRides[i];
      var rideIdStr = ride._id.toString();
      var riderUserId = (ride.riderId && ride.riderId.userId) ? ride.riderId.userId : null;
      var driverUserId = (ride.driver && ride.driver.userId) ? ride.driver.userId : null;

      // Helper: create alert if not already exists for this ride + type
      async function createSafetyAlert(rideObj, alertType, details) {
        var exists = await SafetyAlertModel.findOne({ rideId: rideObj._id, type: alertType });
        if (exists) return;
        await SafetyAlertModel.create({ rideId: rideObj._id, type: alertType, details: details });
        // Push to rider
        if (riderUserId) {
          safetyPush(riderUserId, 'Securite', 'Tout va bien? Si vous avez besoin d\'aide, appuyez sur le bouton SOS', { type: 'safety_alert', rideId: rideIdStr });
        }
        // Telegram
        var rName = 'Inconnu'; var dName = 'Inconnu';
        try { var ru = await require('./models/User').findById(riderUserId); if (ru) rName = ru.name; } catch(e) {}
        try { var du = await require('./models/User').findById(driverUserId); if (du) dName = du.name; } catch(e) {}
        sendTelegramAlert('\u26A0\uFE0F Alerte securite — Course #' + rideIdStr.slice(-6) + '\nType: ' + alertType + '\nPassager: ' + rName + '\nChauffeur: ' + dName + '\nDetails: ' + details);
      }

      // (a) Route deviation detection
      if (ride.driver && ride.dropoff && ride.dropoff.coordinates) {
        var driverLoc = await driverLocationService.getDriverLocation(ride.driver._id.toString());
        if (driverLoc && driverLoc.location) {
          var distToDropoff = safetyCalcDist(
            driverLoc.location.latitude, driverLoc.location.longitude,
            ride.dropoff.coordinates.latitude, ride.dropoff.coordinates.longitude
          );
          // Update minDistToDropoff
          if (ride.minDistToDropoff === null || distToDropoff < ride.minDistToDropoff) {
            ride.minDistToDropoff = distToDropoff;
            await SafetyRide.updateOne({ _id: ride._id }, { minDistToDropoff: distToDropoff });
          }
          // If current distance is 3km+ more than minimum, deviation
          if (ride.minDistToDropoff !== null && distToDropoff > ride.minDistToDropoff + 3) {
            await createSafetyAlert(ride, 'route_deviation', 'Distance actuelle: ' + distToDropoff.toFixed(1) + 'km, minimum: ' + ride.minDistToDropoff.toFixed(1) + 'km');
          }
        }
      }

      // (b) Duration anomaly
      if (ride.startedAt && ride.estimatedDuration > 10) {
        var elapsedMin = (Date.now() - new Date(ride.startedAt).getTime()) / 60000;
        if (elapsedMin > ride.estimatedDuration * 3) {
          await createSafetyAlert(ride, 'duration_anomaly', 'Duree: ' + Math.round(elapsedMin) + 'min, estimee: ' + ride.estimatedDuration + 'min');
        }
      }

      // (d) Driver offline during ride
      if (ride.driver) {
        var isOnline = await driverLocationService.isDriverOnline(ride.driver._id.toString());
        if (!isOnline) {
          await createSafetyAlert(ride, 'driver_offline', 'Chauffeur deconnecte pendant la course');
        }
      }
    }
  } catch (e) {
    console.error('Safety monitor error:', e.message);
  }
}, 60 * 1000);

// ========== Socket.io Authentication ==========
io.use(function(socket, next) {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId || decoded.id;
    socket.userType = decoded.userType;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

// ========== Rate Limiter for Location Updates ==========
const lastLocationUpdate = new Map();
const lastLocationPosition = new Map(); // For speed calculation
const LOCATION_UPDATE_INTERVAL = 3000; // 3 seconds minimum

// ========== Socket.io Events ==========
io.on('connection', function(socket) {
    console.log('Socket connected: ' + socket.id + ' (user: ' + socket.userId + ')');

  socket.on('driver-online', function(data) {
    const driverId = data.driverId;
    const latitude = data.latitude;
    const longitude = data.longitude;
    const vehicle = data.vehicle;
    const rating = data.rating;

    // Verify driver identity
    var DriverModel = require('./models/Driver');
    DriverModel.findById(driverId).then(function(drv) {
      if (!drv) {
        socket.emit('error', { message: 'Driver not found' });
        return;
      }
      if (drv.userId.toString() !== socket.userId) {
        socket.emit('error', { message: 'Driver identity mismatch' });
        return;
      }

      // Check commission debt before allowing online
      if (drv.isBlockedForPayment) {
        socket.emit('blocked-for-payment', {
          balance: drv.commissionBalance,
          cap: drv.commissionCap || 2000,
          message: 'Veuillez payer votre solde de commission pour continuer'
        });
      }

      socket.join('driver-' + driverId);
      socket.join('online-drivers');
      socket.driverId = driverId;

      require('./models/Driver').findByIdAndUpdate(driverId, { lastLocationUpdate: new Date(), isOnline: true }).catch(function(){});
      driverLocationService.setDriverOnline(driverId, latitude, longitude, { vehicle: vehicle, rating: rating })
        .then(function() {
          io.to('riders-watching').emit('driver-came-online', {
            driverId: driverId,
            location: { latitude: latitude, longitude: longitude }
          });
          // Poke the matching service so any pending ride waiting on supply
          // re-runs its dispatch immediately instead of after the next 30s
          // retry tick. No-op when no rides are pending.
          try {
            var ms = app.get('matchingService');
            if (ms && typeof ms.onDriverCameOnline === 'function') {
              ms.onDriverCameOnline(driverId).catch(function(){});
            }
          } catch (e) {}
        })
        .catch(function(err) {
          console.error('Driver online failed for ' + driverId + ':', err.message);
          socket.emit('error', { message: 'Failed to go online' });
        });
    }).catch(function(err) {
      console.error('Driver identity check failed:', err.message);
      socket.emit('error', { message: 'Failed to verify driver identity' });
    });
  });

  socket.on('driver-offline', function(driverId) {

    socket.leave('driver-' + driverId);
    socket.leave('online-drivers');

    driverLocationService.setDriverOffline(driverId)
      .then(function() {
        io.to('riders-watching').emit('driver-went-offline', { driverId: driverId });
      })
      .catch(function(err) {
        console.error(`Driver offline failed for ${driverId}:`, err.message);
      });
  });

  socket.on('driver-location-update', function(data) {
    const driverId = data.driverId;
    const latitude = data.latitude;
    const longitude = data.longitude;
    const rideId = data.rideId;
    const vehicle = data.vehicle;
    const rating = data.rating;

    // Verify identity

    // Rate limit: max once per 3 seconds per driver
    const now = Date.now();
    const last = lastLocationUpdate.get(driverId) || 0;
    if (now - last < LOCATION_UPDATE_INTERVAL) return;
    lastLocationUpdate.set(driverId, now);

    // ===== Speed detection =====
    var prevPos = lastLocationPosition.get(driverId);
    if (prevPos && rideId) {
      var timeDiffHours = (now - prevPos.time) / 3600000;
      if (timeDiffHours > 0) {
        var { calculateDistance: calcDist } = require('./utils/distance');
        var distKm = calcDist(prevPos.lat, prevPos.lng, latitude, longitude);
        var speedKmh = distKm / timeDiffHours;
        if (speedKmh > 130) {
          var SafetyAlertSpeed = require('./models/SafetyAlert');
          SafetyAlertSpeed.findOne({ rideId: rideId, type: 'speed_alert' }).then(function(existing) {
            if (!existing) {
              SafetyAlertSpeed.create({ rideId: rideId, type: 'speed_alert', details: 'Vitesse detectee: ' + Math.round(speedKmh) + ' km/h' });
              sendTelegramAlert('\u26A0\uFE0F Vitesse excessive — Course #' + String(rideId).slice(-6) + ' — ' + Math.round(speedKmh) + ' km/h');
              var RiderForSpeed = require('./models/Rider');
              var RideForSpeed = require('./models/Ride');
              RideForSpeed.findById(rideId).populate('riderId').then(function(speedRide) {
                if (speedRide && speedRide.riderId && speedRide.riderId.userId) {
                  var { sendPushNotification: pushSpeed } = require('./services/pushService');
                  pushSpeed(speedRide.riderId.userId, 'Securite', 'Tout va bien? Si vous avez besoin d\'aide, appuyez sur le bouton SOS', { type: 'safety_alert', rideId: rideId });
                }
              }).catch(function() {});
            }
          }).catch(function() {});
        }
      }
    }
    lastLocationPosition.set(driverId, { lat: latitude, lng: longitude, time: now });

    driverLocationService.updateDriverLocation(driverId, latitude, longitude, { vehicle: vehicle, rating: rating })
      .then(function() {
        require('./models/Driver').findByIdAndUpdate(driverId, { lastLocationUpdate: new Date() }).catch(function(){});
        if (rideId) {
          io.to(rideId).emit('driver-location-update', {
            driverId: driverId,
            location: { latitude: latitude, longitude: longitude },
            timestamp: now
          });

          // Emit to share room if ride sharing is enabled
          var RideShareModel = require('./models/Ride');
          RideShareModel.findById(rideId).then(function(shareRide) {
            if (shareRide && shareRide.shareEnabled && shareRide.shareToken) {
              var shareRoom = 'share-' + shareRide.shareToken;
              io.to(shareRoom).emit('share-location-update', {
                latitude: latitude,
                longitude: longitude,
                timestamp: now
              });
              // Also emit to the /share namespace for unauthenticated viewers
              io.of('/share').to(shareRoom).emit('share-location-update', {
                latitude: latitude,
                longitude: longitude,
                timestamp: now
              });
            }
          }).catch(function() {});
        }
        io.to('riders-watching').emit('nearby-driver-location', {
          driverId: driverId,
          location: { latitude: latitude, longitude: longitude },
          timestamp: now
        });
      })
      .catch(function(err) {
        console.error(`Location update failed for ${driverId}:`, err.message);
      });
  });

  socket.on('rider-watching-drivers', function() {
    socket.join('riders-watching');
    console.log(`Rider ${socket.id} watching for drivers`);
  });

  socket.on('rider-stop-watching', function() {
    socket.leave('riders-watching');
  });

  socket.on('join-ride-room', async function(rideId) {
    try {
      var Ride = require('./models/Ride');
      var Rider = require('./models/Rider');
      var Driver = require('./models/Driver');
      var ride = await Ride.findById(rideId);
      if (!ride) return socket.emit('error', { message: 'Ride not found' });

      // Check if user is the rider or the driver for this ride
      var rider = await Rider.findOne({ _id: ride.riderId, userId: socket.userId });
      var driver = ride.driver ? await Driver.findOne({ _id: ride.driver, userId: socket.userId }) : null;
      if (!rider && !driver) {
        return socket.emit('error', { message: 'Not authorized to join this ride room' });
      }

      socket.join(rideId);
      console.log(`Socket ${socket.id} joined ride: ${rideId}`);
    } catch (err) {
      console.error('join-ride-room error:', err.message);
      socket.emit('error', { message: 'Failed to join ride room' });
    }
  });

  socket.on('leave-ride-room', function(rideId) {
    socket.leave(rideId);
  });

  // Delivery rooms
  socket.on('join-delivery-room', async function(deliveryId) {
    try {
      var Delivery = require('./models/Delivery');
      var Rider = require('./models/Rider');
      var Driver = require('./models/Driver');
      var delivery = await Delivery.findById(deliveryId);
      if (!delivery) return socket.emit('error', { message: 'Delivery not found' });

      var rider = await Rider.findOne({ _id: delivery.riderId, userId: socket.userId });
      var driver = delivery.driver ? await Driver.findOne({ _id: delivery.driver, userId: socket.userId }) : null;
      if (!rider && !driver) {
        return socket.emit('error', { message: 'Not authorized to join this delivery room' });
      }

      socket.join(deliveryId);
      console.log(`Socket ${socket.id} joined delivery: ${deliveryId}`);
    } catch (err) {
      console.error('join-delivery-room error:', err.message);
      socket.emit('error', { message: 'Failed to join delivery room' });
    }
  });

  socket.on('leave-delivery-room', function(deliveryId) {
    socket.leave(deliveryId);
  });

  // Order rooms
  socket.on('join-order-room', async function(orderId) {
    try {
      var Order = require('./models/Order');
      var Rider = require('./models/Rider');
      var Driver = require('./models/Driver');
      var order = await Order.findById(orderId);
      if (!order) return socket.emit('error', { message: 'Order not found' });

      var rider = await Rider.findOne({ _id: order.riderId, userId: socket.userId });
      var driver = order.driver ? await Driver.findOne({ _id: order.driver, userId: socket.userId }) : null;
      if (!rider && !driver) {
        return socket.emit('error', { message: 'Not authorized to join this order room' });
      }

      socket.join(orderId);
      console.log(`Socket ${socket.id} joined order: ${orderId}`);
    } catch (err) {
      console.error('join-order-room error:', err.message);
      socket.emit('error', { message: 'Failed to join order room' });
    }
  });

  socket.on('leave-order-room', function(orderId) {
    socket.leave(orderId);
  });

  // Share ride room (public — no auth required for the share page, but socket still needs auth)
  // The share page uses a separate unauthenticated connection — see below
  socket.on('join-share-room', function(shareToken) {
    if (shareToken) {
      socket.join('share-' + shareToken);
      console.log('Socket ' + socket.id + ' joined share room: share-' + shareToken);
    }
  });

  // ========== CHAT ==========
  var Message = require("./models/Message");

  socket.on('chat-message', function(data) {
    if (!data.text || !data.text.trim()) return;
    var roomId = data.rideId || data.deliveryId;
    if (!roomId) return;

    var msg = new Message({
      rideId: data.rideId || null,
      deliveryId: data.deliveryId || null,
      senderId: socket.userId,
      senderRole: data.senderRole,
      text: data.text.trim().substring(0, 500),
    });

    msg.save().then(function(saved) {
      io.to(roomId).emit('new-chat-message', {
        _id: saved._id,
        rideId: saved.rideId,
        deliveryId: saved.deliveryId,
        senderId: saved.senderId,
        senderRole: saved.senderRole,
        text: saved.text,
        createdAt: saved.createdAt,
      });
    }).catch(function(err) {
      console.log('Chat save error:', err.message);
    });
  });

  socket.on('chat-history', function(data) {
    var query = {};
    if (data.rideId) query.rideId = data.rideId;
    else if (data.deliveryId) query.deliveryId = data.deliveryId;
    else return;

    Message.find(query).sort({ createdAt: 1 }).limit(100).then(function(messages) {
      socket.emit('chat-history-response', messages);
    }).catch(function(err) {
      console.log('Chat history error:', err.message);
    });
  });

  socket.on('disconnect', function() {
    console.log('Socket disconnected: ' + socket.id);
    if (socket.driverId) {
      var dId = socket.driverId;
      lastLocationUpdate.delete(dId);
      setTimeout(async function() {
        var activeSocket = Array.from(io.sockets.sockets.values()).find(function(s) { return s.driverId === dId; });
        if (!activeSocket) {
          // Respect background foreground-service heartbeat: if the driver's
          // lastLocationUpdate in Mongo is recent (<90s), they're still alive
          // via HTTP heartbeat even though the socket dropped. Don't wipe them.
          try {
            var Driver = require('./models/Driver');
            var drv = await Driver.findById(dId).select('lastLocationUpdate');
            if (drv && drv.lastLocationUpdate && (Date.now() - new Date(drv.lastLocationUpdate).getTime() < 90000)) {
              console.log('Driver ' + dId + ' has recent heartbeat, skipping offline-on-disconnect');
              return;
            }
          } catch (e) { /* fall through and offline as normal */ }

          driverLocationService.setDriverOffline(dId)
            .then(function() {
              io.to('riders-watching').emit('driver-went-offline', { driverId: dId });
              console.log('Driver ' + dId + ' set offline after 60s timeout');
            })
            .catch(function(err) {
              console.error('Disconnect cleanup failed for ' + dId + ':', err.message);
            });

          // Check if driver has an active ride and notify rider
          var RideModelDc = require('./models/Ride');
          RideModelDc.findOne({ driver: dId, status: { $in: ['accepted', 'arrived', 'in_progress'] } })
            .then(function(activeRide) {
              if (!activeRide) return;
              io.to(activeRide._id.toString()).emit('driver-disconnected', {
                rideId: activeRide._id,
                driverId: dId,
                message: 'Le chauffeur a été déconnecté'
              });
              console.log('Notified rider of driver disconnect for ride ' + activeRide._id);

              // Second timeout: 5 minutes total (4 more minutes from now) — cancel ride if driver still absent
              setTimeout(function() {
                var stillConnected = Array.from(io.sockets.sockets.values()).find(function(s) { return s.driverId === dId; });
                if (stillConnected) {
                  console.log('Driver ' + dId + ' reconnected before ride cancellation');
                  return;
                }
                RideModelDc.findById(activeRide._id).then(function(ride) {
                  if (!ride || !['accepted', 'arrived', 'in_progress'].includes(ride.status)) return;
                  ride.status = 'cancelled';
                  ride.cancellationReason = 'Chauffeur déconnecté';
                  ride.cancelledAt = new Date();
                  return ride.save().then(function() {
                    io.to(ride._id.toString()).emit('ride-cancelled', {
                      rideId: ride._id,
                      reason: 'Chauffeur déconnecté'
                    });
                    console.log('Auto-cancelled ride ' + ride._id + ' due to driver disconnect');
                    // Notify rider via push
                    var RiderModelDc = require('./models/Rider');
                    RiderModelDc.findById(ride.riderId).then(function(rider) {
                      if (rider) {
                        var { sendPushNotification } = require('./services/pushService');
                        sendPushNotification(rider.userId, 'Course annulée', 'Votre course a été annulée car le chauffeur a été déconnecté.', { type: 'ride-cancelled', rideId: ride._id.toString() });
                      }
                    }).catch(function() {});
                  });
                }).catch(function(err) {
                  console.error('Ride cancel after disconnect failed:', err.message);
                });
              }, 4 * 60 * 1000); // 4 more minutes (5 total from disconnect)
            })
            .catch(function(err) {
              console.error('Active ride check on disconnect failed:', err.message);
            });
        } else {
          console.log('Driver ' + dId + ' reconnected, skipping offline');
        }
      }, 60000);
    }
  });
});

// ========== Share Namespace (unauthenticated, for share page viewers) ==========
var shareNamespace = io.of('/share');
shareNamespace.on('connection', function(socket) {
  socket.on('join-share-room', function(shareToken) {
    if (shareToken && typeof shareToken === 'string' && shareToken.length === 32) {
      socket.join('share-' + shareToken);
      console.log('Share viewer ' + socket.id + ' joined share-' + shareToken);
    }
  });
  socket.on('disconnect', function() {});
});

// ========== Process Error Logging ==========
process.on('uncaughtException', function(err) {
  console.error('UNCAUGHT EXCEPTION:', err);
  try {
    var AppLog = require('./models/AppLog');
    AppLog.create({
      level: 'error', source: 'backend', screen: 'uncaughtException',
      message: (err.message || 'Unknown').substring(0, 2000),
      stack: (err.stack || '').substring(0, 5000),
      metadata: { type: 'uncaughtException' }
    }).catch(function() {});
    sendTelegramAlert('🔴 UNCAUGHT EXCEPTION\n' + (err.message || '').substring(0, 300) + '\n' + new Date().toISOString());
  } catch(e) {}
});

process.on('unhandledRejection', function(reason) {
  console.error('UNHANDLED REJECTION:', reason);
  try {
    var AppLog = require('./models/AppLog');
    var msg = reason instanceof Error ? reason.message : String(reason);
    var stack = reason instanceof Error ? reason.stack : '';
    AppLog.create({
      level: 'error', source: 'backend', screen: 'unhandledRejection',
      message: (msg || 'Unknown').substring(0, 2000),
      stack: (stack || '').substring(0, 5000),
      metadata: { type: 'unhandledRejection' }
    }).catch(function() {});
    sendTelegramAlert('🟡 UNHANDLED REJECTION\n' + (msg || '').substring(0, 300) + '\n' + new Date().toISOString());
  } catch(e) {}
});

// ========== Graceful Shutdown ==========
const gracefulShutdown = async function(signal) {
    console.log(signal + ' received. Shutting down gracefully...');

  // Close socket connections
  io.close();

  // Disconnect Redis
  await driverLocationService.disconnect();

  // Close HTTP server
  server.close(function() {
    console.log('Server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(function() {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', function() { gracefulShutdown('SIGTERM'); });
process.on('SIGINT', function() { gracefulShutdown('SIGINT'); });

const PORT = process.env.PORT || 5000;
// Auto-offline stale drivers every 5 minutes.
// Threshold: 30 min (was 10 min) — gives OEM-paused foreground services
// time to come back. Only flips isOnline=false; isAvailable stays as-is so
// a recovering driver doesn't have to manually re-tap "ready for rides".
var staleDriverCleanup = setInterval(async function() {
  try {
    var Driver = require('./models/Driver');
    var staleCutoff = new Date(Date.now() - 30 * 60 * 1000);
    var result = await Driver.updateMany(
      { isOnline: true, lastLocationUpdate: { $lt: staleCutoff } },
      { isOnline: false }
    );
    if (result.modifiedCount > 0) console.log('Auto-offlined ' + result.modifiedCount + ' stale drivers');
  } catch(e) {}
}, 5 * 60 * 1000);

// ========== Driver document expiration daily reminders (8 AM Dakar) ==========
require('./services/docExpiryReminder').scheduleDailyCheck();

// ========== Midnight commission blocking (Senegal time UTC+0) ==========
function scheduleMidnightCommissionCheck() {
  var now = new Date();
  var nextMidnight = new Date(now);
  nextMidnight.setUTCHours(24, 0, 0, 0); // next midnight UTC
  var msUntilMidnight = nextMidnight.getTime() - now.getTime();

  setTimeout(function() {
    runCommissionBlockCheck();
    // Then repeat every 24 hours
    setInterval(runCommissionBlockCheck, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);

  console.log('Commission check scheduled in ' + Math.round(msUntilMidnight / 60000) + ' minutes (midnight UTC)');
}

async function runCommissionBlockCheck() {
  try {
    var DriverModel = require('./models/Driver');
    var { sendPushNotification } = require('./services/pushService');
    var drivers = await DriverModel.find({ commissionBalance: { $gt: 0 }, isBlockedForPayment: false });
    console.log('Midnight commission check: ' + drivers.length + ' drivers with unpaid commission');
    for (var i = 0; i < drivers.length; i++) {
      var drv = drivers[i];
      drv.isBlockedForPayment = true;
      await drv.save();
      sendPushNotification(drv.userId, 'Commission due', 'Votre commission de ' + drv.commissionBalance + ' FCFA est due. Payez pour reprendre les courses demain.', { type: 'commission-blocked' });
    }
  } catch (e) {
    console.error('Midnight commission check error:', e.message);
  }
}

scheduleMidnightCommissionCheck();

server.listen(PORT, '0.0.0.0', function() {
    console.log('\nTeranGO Backend Running on port ' + PORT);
    console.log('   Redis: Upstash (Production)');
    console.log('   WebSocket: Active (Authenticated)');
    console.log('   Driver TTL: 60 seconds');
    console.log('   Thiak Thiak: Colis + Commande + Resto');

    // ========== Startup Recovery: clean up stale rides & deliveries from crash ==========
    (async function startupRecovery() {
      try {
        var RideRecover = require('./models/Ride');
        var DeliveryRecover = require('./models/Delivery');
        var twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

        // Cancel stale rides (active but not updated in 2+ hours)
        var rideResult = await RideRecover.updateMany(
          { status: { $in: ['accepted', 'arrived', 'in_progress'] }, updatedAt: { $lt: twoHoursAgo } },
          { $set: { status: 'cancelled', cancellationReason: 'Course expirée - redémarrage serveur', cancelledAt: new Date() } }
        );
        if (rideResult.modifiedCount > 0) {
          console.log('Startup recovery: cancelled ' + rideResult.modifiedCount + ' stale rides');
        }

        // Cancel stale deliveries (active but not updated in 2+ hours)
        var deliveryResult = await DeliveryRecover.updateMany(
          { status: { $in: ['accepted', 'at_pickup', 'picked_up', 'at_dropoff'] }, updatedAt: { $lt: twoHoursAgo } },
          { $set: { status: 'cancelled', cancellationReason: 'Livraison expirée - redémarrage serveur', cancelledAt: new Date() } }
        );
        if (deliveryResult.modifiedCount > 0) {
          console.log('Startup recovery: cancelled ' + deliveryResult.modifiedCount + ' stale deliveries');
        }
      } catch (e) {
        console.error('Startup recovery error:', e.message);
      }
    })();
});



