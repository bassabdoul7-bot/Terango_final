import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import { adminService } from '../services/api';
import { Flame, RefreshCw, Car, Package, Clock, Phone, MapPin, X } from 'lucide-react';

// Click-radius for the "rides near this spot" side panel. 750m = ~3 city
// blocks in Dakar, tight enough to surface a real cluster, loose enough to
// catch the rides at the edge of a heat blob.
const CLICK_RADIUS_M = 750;

function haversineMeters(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180;
  const la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const DAKAR_CENTER = [14.7167, -17.4677];

// HeatLayer is rendered as a child of MapContainer so we can grab the map via
// useMap() and attach an L.heatLayer to it. Removed + re-added when the points
// or styling change, which is fine at the volumes we expect (hundreds, not
// hundreds of thousands).
// Captures clicks anywhere on the map and feeds back the lat/lng so the page
// can compute which points fall within CLICK_RADIUS_M and show them in a
// side panel. Separate component because useMapEvents must live inside the
// MapContainer subtree.
function MapClick({ onClick }) {
  useMapEvents({ click: function(e) { onClick({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
  return null;
}

function HeatLayer({ points, radius, blur, max }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return undefined;
    const layer = L.heatLayer(points, {
      radius: radius || 28,
      blur: blur || 22,
      max: max || 1,
      minOpacity: 0.35,
      gradient: { 0.2: '#3b82f6', 0.4: '#22c55e', 0.6: '#eab308', 0.8: '#f97316', 1.0: '#ef4444' }
    });
    layer.addTo(map);
    return () => { map.removeLayer(layer); };
  }, [map, points, radius, blur, max]);
  return null;
}

const PERIODS = [
  { value: '1h', label: '1h' },
  { value: '6h', label: '6h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7j' }
];

const TYPES = [
  { value: 'all', label: 'Tout', icon: Flame },
  { value: 'rides', label: 'Courses', icon: Car },
  { value: 'deliveries', label: 'Livraisons', icon: Package }
];

export default function HeatmapPage() {
  const [period, setPeriod] = useState('24h');
  const [type, setType] = useState('all');
  const [data, setData] = useState({ points: [], count: 0, since: null });
  const [loading, setLoading] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);
  const refreshTimer = useRef(null);
  const [clickedAt, setClickedAt] = useState(null);     // { lat, lng } of last map click
  const [nearbyRides, setNearbyRides] = useState([]);   // points within CLICK_RADIUS_M, sorted newest first

  // Compute nearby rides whenever a click lands OR the underlying data refreshes.
  useEffect(() => {
    if (!clickedAt) { setNearbyRides([]); return; }
    const filtered = (data.points || [])
      .map((p) => ({ ...p, _dist: haversineMeters(clickedAt, p) }))
      .filter((p) => p._dist <= CLICK_RADIUS_M)
      .sort((a, b) => new Date(b.at) - new Date(a.at));
    setNearbyRides(filtered);
  }, [clickedAt, data.points]);

  async function load(silent) {
    if (!silent) setLoading(true);
    try {
      const res = await adminService.getHeatmap({ period, type });
      // axios interceptor unwraps res.data, so `res` IS the payload here.
      if (res && res.success) {
        setData({ points: res.points || [], count: res.count || 0, since: res.since });
        setLastFetchedAt(new Date());
      }
    } catch (e) {
      console.error('Heatmap load error:', e);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => { load(false); }, [period, type]);

  // Auto-refresh every 30s in the background — close to live without hammering.
  useEffect(() => {
    if (refreshTimer.current) clearInterval(refreshTimer.current);
    refreshTimer.current = setInterval(() => { load(true); }, 30000);
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [period, type]);

  // Latlngs for leaflet.heat: [lat, lng, weight]. Weight scales with fare so
  // higher-value trips burn brighter. Capped to keep one outlier from washing
  // the map.
  const heatPoints = useMemo(() => {
    const cap = 5000; // fare cap for normalisation
    return (data.points || []).map((p) => {
      const w = Math.min(1, (p.fare || 1000) / cap);
      return [p.lat, p.lng, Math.max(0.2, w)];
    });
  }, [data.points]);

  // KPI strip
  const stats = useMemo(() => {
    const pts = data.points || [];
    let totalFare = 0;
    let rides = 0;
    let deliveries = 0;
    pts.forEach((p) => {
      totalFare += p.fare || 0;
      if (p.kind === 'ride') rides += 1; else if (p.kind === 'delivery') deliveries += 1;
    });
    return {
      total: pts.length,
      rides: rides,
      deliveries: deliveries,
      totalFare: totalFare,
      avgFare: pts.length ? Math.round(totalFare / pts.length) : 0
    };
  }, [data.points]);

  const fmtSince = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  const fmtUpdated = (d) => {
    if (!d) return '';
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 flex flex-col" style={{ height: 'calc(100vh - 4px)' }}>
      {/* TOP CONTROL BAR */}
      <div className="px-6 py-4 flex flex-wrap items-center gap-4" style={{ background: 'rgba(0,20,14,0.85)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 text-white">
          <Flame size={22} className="text-orange-400" />
          <h1 className="text-lg font-bold">Carte de demande</h1>
        </div>

        {/* PERIOD */}
        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-md transition-all"
              style={{
                background: period === p.value ? 'rgba(0,133,63,0.5)' : 'transparent',
                color: period === p.value ? '#fff' : 'rgba(255,255,255,0.55)'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* TYPE */}
        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {TYPES.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className="px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5"
                style={{
                  background: type === t.value ? 'rgba(212,175,55,0.4)' : 'transparent',
                  color: type === t.value ? '#fff' : 'rgba(255,255,255,0.55)'
                }}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {lastFetchedAt && (
            <span className="flex items-center gap-1.5">
              <Clock size={12} />
              MAJ {fmtUpdated(lastFetchedAt)}
            </span>
          )}
          <button
            onClick={() => load(false)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white font-semibold"
            style={{ background: 'rgba(0,133,63,0.4)', border: '1px solid rgba(0,133,63,0.5)' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {/* KPI STRIP */}
      <div className="px-6 py-3 flex flex-wrap gap-4 text-xs" style={{ background: 'rgba(0,15,10,0.75)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="rounded-lg px-4 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)' }}>Requêtes</div>
          <div className="text-lg font-bold text-white">{stats.total}</div>
        </div>
        <div className="rounded-lg px-4 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)' }}>Courses</div>
          <div className="text-lg font-bold text-white">{stats.rides}</div>
        </div>
        <div className="rounded-lg px-4 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)' }}>Livraisons</div>
          <div className="text-lg font-bold text-white">{stats.deliveries}</div>
        </div>
        <div className="rounded-lg px-4 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)' }}>Volume FCFA</div>
          <div className="text-lg font-bold text-white">{stats.totalFare.toLocaleString('fr-FR')}</div>
        </div>
        <div className="rounded-lg px-4 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)' }}>Panier moyen</div>
          <div className="text-lg font-bold text-white">{stats.avgFare.toLocaleString('fr-FR')} FCFA</div>
        </div>
        <div className="rounded-lg px-4 py-2 ml-auto" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)' }}>Depuis</div>
          <div className="text-sm font-bold text-white">{fmtSince(data.since)}</div>
        </div>
      </div>

      {/* MAP */}
      <div className="flex-1 relative">
        <MapContainer
          center={DAKAR_CENTER}
          zoom={12}
          style={{ height: '100%', width: '100%', background: '#0a0f0d' }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {heatPoints.length > 0 && <HeatLayer points={heatPoints} />}
          <MapClick onClick={setClickedAt} />
          {clickedAt && (
            <CircleMarker
              center={[clickedAt.lat, clickedAt.lng]}
              radius={6}
              pathOptions={{ color: '#FFF', weight: 2, fillColor: '#22c55e', fillOpacity: 0.9 }}
            />
          )}
        </MapContainer>

        {/* Empty-state overlay when no data */}
        {!loading && heatPoints.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-xl px-6 py-4 backdrop-blur-md text-center" style={{ background: 'rgba(0,20,14,0.85)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="text-white font-bold mb-1">Aucune requête sur la période</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>Essayez une plage plus large.</div>
            </div>
          </div>
        )}

        {/* Click hint when no spot has been clicked yet */}
        {!clickedAt && heatPoints.length > 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-xs backdrop-blur-md pointer-events-none" style={{ background: 'rgba(0,20,14,0.85)', border: '1px solid rgba(255,255,255,0.12)', zIndex: 1000 }}>
            <span className="text-white font-semibold">Cliquez sur une zone</span>
            <span className="ml-2" style={{ color: 'rgba(255,255,255,0.55)' }}>pour voir les courses dans un rayon de {CLICK_RADIUS_M}m</span>
          </div>
        )}

        {/* Side panel — list of rides within CLICK_RADIUS_M of the last click */}
        {clickedAt && (
          <div className="absolute top-4 right-4 rounded-xl backdrop-blur-md flex flex-col" style={{ width: 360, maxHeight: 'calc(100vh - 220px)', background: 'rgba(0,20,14,0.94)', border: '1px solid rgba(255,255,255,0.12)', zIndex: 1000 }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <div className="text-sm font-bold text-white">{nearbyRides.length} course{nearbyRides.length === 1 ? '' : 's'} dans la zone</div>
                <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.55)' }}>Rayon de {CLICK_RADIUS_M}m</div>
              </div>
              <button onClick={() => setClickedAt(null)} className="rounded-md p-1 text-white" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {nearbyRides.length === 0 ? (
                <div className="text-xs text-center py-6" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  Aucune course dans cette zone pour la période choisie. Cliquez sur une zone plus chaude.
                </div>
              ) : (
                nearbyRides.map((r) => (
                  <RideRow key={r.id || (r.lat + ',' + r.lng + ',' + r.at)} ride={r} />
                ))
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(0,20,14,0.85)', border: '1px solid rgba(255,255,255,0.1)', zIndex: 1000 }}>
          <div className="text-white font-semibold mb-1">Intensité</div>
          <div className="flex items-center gap-1.5">
            <div style={{ width: 80, height: 8, borderRadius: 4, background: 'linear-gradient(to right, #3b82f6, #22c55e, #eab308, #f97316, #ef4444)' }}></div>
          </div>
          <div className="flex justify-between text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
            <span>Faible</span>
            <span>Forte</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// One ride card inside the click-side-panel.
function RideRow({ ride }) {
  const status = ride.status || 'pending';
  const statusColor = {
    completed: '#22c55e', in_progress: '#22c55e', accepted: '#22c55e', delivered: '#22c55e',
    pending: '#eab308', arrived: '#eab308',
    cancelled: '#ef4444', no_drivers_available: '#ef4444', expired: '#ef4444'
  }[status] || '#94a3b8';
  const fmtTime = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  const kindIcon = ride.kind === 'delivery'
    ? (ride.serviceType === 'colis' ? '📦' : ride.serviceType === 'commande' ? '🛒' : '🍽️')
    : '🚗';
  const callTel = ride.riderPhone ? 'tel:' + String(ride.riderPhone).replace(/[^0-9+]/g, '') : null;
  return (
    <div className="rounded-lg p-3 mb-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-start justify-between mb-1">
        <div className="text-xs font-bold text-white truncate flex-1">{kindIcon} {ride.riderName || 'Anonyme'}</div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: statusColor + '22', color: statusColor, border: '1px solid ' + statusColor + '55' }}>{status}</span>
      </div>
      <div className="text-[11px] mb-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{fmtTime(ride.at)} · {(ride.fare || 0).toLocaleString('fr-FR')} FCFA · {ride.paymentMethod === 'wave' ? 'Wave' : 'Espèces'}</div>
      {ride.pickup && (
        <div className="flex gap-1.5 items-start text-[11px] mb-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
          <MapPin size={10} className="mt-0.5 flex-shrink-0 text-emerald-400" />
          <span className="truncate">{ride.pickup}</span>
        </div>
      )}
      {ride.dropoff && (
        <div className="flex gap-1.5 items-start text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
          <MapPin size={10} className="mt-0.5 flex-shrink-0 text-red-400" />
          <span className="truncate">{ride.dropoff}</span>
        </div>
      )}
      {callTel && (
        <a href={callTel} className="mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white no-underline" style={{ background: 'rgba(0,133,63,0.5)', border: '1px solid rgba(0,133,63,0.65)' }}>
          <Phone size={11} /> {ride.riderPhone}
        </a>
      )}
    </div>
  );
}
