import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import { adminService } from '../services/api';
import { Flame, RefreshCw, Car, Package, Clock } from 'lucide-react';

const DAKAR_CENTER = [14.7167, -17.4677];

// HeatLayer is rendered as a child of MapContainer so we can grab the map via
// useMap() and attach an L.heatLayer to it. Removed + re-added when the points
// or styling change, which is fine at the volumes we expect (hundreds, not
// hundreds of thousands).
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

  async function load(silent) {
    if (!silent) setLoading(true);
    try {
      const res = await adminService.getHeatmap({ period, type });
      if (res && res.data && res.data.success) {
        setData({ points: res.data.points || [], count: res.data.count || 0, since: res.data.since });
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

        {/* Legend */}
        <div className="absolute bottom-4 left-4 rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(0,20,14,0.85)', border: '1px solid rgba(255,255,255,0.1)' }}>
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
