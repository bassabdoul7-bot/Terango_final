import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { adminService } from '../services/api';
import { Phone, RefreshCw, Car, Package, Users, Clock, ChevronRight } from 'lucide-react';

var DAKAR_CENTER = [14.7167, -17.4677];
var POLL_INTERVAL = 10000;

var STATUS_COLORS = {
  accepted: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', label: 'Acceptee' },
  arrived: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Arrivee' },
  in_progress: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'En cours' },
  at_pickup: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', label: 'Au pickup' },
  picked_up: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30', label: 'Recupere' },
  at_dropoff: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', label: 'Au dropoff' }
};

function createDriverIcon(color) {
  return L.divIcon({
    className: 'custom-driver-icon',
    html: '<div style="width:32px;height:32px;border-radius:50%;background:' + color + ';border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10l-2.7-3.6A2 2 0 0013.7 5H10.3a2 2 0 00-1.6.9L6 9l-2.5 1.1C2.7 10.6 2 11.4 2 12.3V16c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg></div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

var greenIcon = createDriverIcon('#22c55e');
var yellowIcon = createDriverIcon('#eab308');
var blueIcon = createDriverIcon('#3b82f6');

function timeAgo(dateStr) {
  if (!dateStr) return '-';
  var diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return diff + 's';
  if (diff < 3600) return Math.floor(diff / 60) + 'min';
  return Math.floor(diff / 3600) + 'h ' + Math.floor((diff % 3600) / 60) + 'min';
}

function MapFlyTo({ center, zoom }) {
  var map = useMap();
  useEffect(function() {
    if (center) map.flyTo(center, zoom || 14, { duration: 1 });
  }, [center, zoom]);
  return null;
}

function StatusBadge({ status }) {
  var s = STATUS_COLORS[status] || { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', label: status };
  return (
    <span className={'px-2 py-0.5 rounded-full text-xs font-semibold border ' + s.bg + ' ' + s.text + ' ' + s.border}>
      {s.label}
    </span>
  );
}

function CallButton({ phone, label }) {
  if (!phone) return null;
  return (
    <a href={'tel:' + phone} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors" title={'Appeler ' + label}>
      <Phone size={11} />
      <span>{label}</span>
    </a>
  );
}

function getRiderName(ride) {
  if (ride.riderId && ride.riderId.userId && ride.riderId.userId.name) return ride.riderId.userId.name;
  return 'Passager';
}
function getRiderPhone(ride) {
  if (ride.riderId && ride.riderId.userId && ride.riderId.userId.phone) return ride.riderId.userId.phone;
  return null;
}
function getDriverName(item) {
  if (item.driver && item.driver.userId && item.driver.userId.name) return item.driver.userId.name;
  if (item.userId && item.userId.name) return item.userId.name;
  return 'Chauffeur';
}
function getDriverPhone(item) {
  if (item.driver && item.driver.userId && item.driver.userId.phone) return item.driver.userId.phone;
  if (item.userId && item.userId.phone) return item.userId.phone;
  return null;
}
function getDriverLocation(item) {
  var loc = null;
  if (item.driver && item.driver.currentLocation) loc = item.driver.currentLocation;
  else if (item.currentLocation) loc = item.currentLocation;
  if (!loc) return null;
  // GeoJSON array format [lon, lat]
  if (loc.coordinates && Array.isArray(loc.coordinates) && loc.coordinates.length === 2) return [loc.coordinates[1], loc.coordinates[0]];
  // Object format { coordinates: { latitude, longitude } }
  if (loc.coordinates && loc.coordinates.latitude) return [loc.coordinates.latitude, loc.coordinates.longitude];
  // Direct format { latitude, longitude }
  if (loc.latitude) return [loc.latitude, loc.longitude];
  return null;
}

function RideCard({ ride, onSelect }) {
  return (
    <div onClick={function() { onSelect(ride); }} className="p-4 rounded-xl border border-gray-800 bg-gray-900/60 hover:bg-gray-800/60 cursor-pointer transition-all duration-200 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{getRiderName(ride)}</span>
          <ChevronRight size={14} className="text-gray-600" />
          <span className="text-sm text-gray-400">{getDriverName(ride)}</span>
        </div>
        <StatusBadge status={ride.status} />
      </div>
      <div className="text-xs text-gray-500 mb-2 space-y-1">
        <div className="flex items-start gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0"></span>
          <span className="truncate">{ride.pickup && ride.pickup.address}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 mt-1 shrink-0"></span>
          <span className="truncate">{ride.dropoff && ride.dropoff.address}</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white">{(ride.fare || 0).toLocaleString()} F</span>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">{ride.paymentMethod || 'cash'}</span>
          {ride.rideType && <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">{ride.rideType}</span>}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock size={11} />
          <span>{timeAgo(ride.acceptedAt || ride.createdAt)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <CallButton phone={getRiderPhone(ride)} label="Passager" />
        <CallButton phone={getDriverPhone(ride)} label="Chauffeur" />
      </div>
    </div>
  );
}

function DeliveryCard({ delivery, onSelect }) {
  return (
    <div onClick={function() { onSelect(delivery); }} className="p-4 rounded-xl border border-gray-800 bg-gray-900/60 hover:bg-gray-800/60 cursor-pointer transition-all duration-200 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Package size={14} className="text-cyan-400" />
          <span className="text-sm font-semibold text-white">{getRiderName(delivery)}</span>
          <ChevronRight size={14} className="text-gray-600" />
          <span className="text-sm text-gray-400">{getDriverName(delivery)}</span>
        </div>
        <StatusBadge status={delivery.status} />
      </div>
      <div className="text-xs text-gray-500 mb-2 space-y-1">
        <div className="flex items-start gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0"></span>
          <span className="truncate">{delivery.pickup && delivery.pickup.address}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 mt-1 shrink-0"></span>
          <span className="truncate">{delivery.dropoff && delivery.dropoff.address}</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white">{(delivery.fare || 0).toLocaleString()} F</span>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400">{delivery.paymentMethod || 'cash'}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{delivery.serviceType || 'colis'}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock size={11} />
          <span>{timeAgo(delivery.acceptedAt || delivery.createdAt)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <CallButton phone={getRiderPhone(delivery)} label="Client" />
        <CallButton phone={getDriverPhone(delivery)} label="Chauffeur" />
      </div>
    </div>
  );
}

function DriverCard({ driver, onSelect }) {
  var loc = getDriverLocation(driver);
  var available = driver.isAvailable;
  return (
    <div onClick={function() { if (loc) onSelect(loc); }} className="p-4 rounded-xl border border-gray-800 bg-gray-900/60 hover:bg-gray-800/60 cursor-pointer transition-all duration-200 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={'w-2.5 h-2.5 rounded-full ' + (available ? 'bg-emerald-500' : 'bg-yellow-500')}></span>
          <span className="text-sm font-semibold text-white">{getDriverName(driver)}</span>
        </div>
        <span className={'text-xs font-medium px-2 py-0.5 rounded-full ' + (available ? 'bg-emerald-500/15 text-emerald-400' : 'bg-yellow-500/15 text-yellow-400')}>
          {available ? 'Disponible' : 'Occupe'}
        </span>
      </div>
      <div className="text-xs text-gray-500 space-y-1">
        {driver.vehicle && (
          <div>{(driver.vehicle.make || '') + ' ' + (driver.vehicle.model || '') + (driver.vehicle.color ? ' - ' + driver.vehicle.color : '') + (driver.vehicle.licensePlate ? ' (' + driver.vehicle.licensePlate + ')' : '')}</div>
        )}
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">{driver.vehicleType || 'car'}</span>
          {driver.currentRide && <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">En course</span>}
          {driver.currentDelivery && <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">En livraison</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <CallButton phone={getDriverPhone(driver)} label="Appeler" />
      </div>
    </div>
  );
}

export default function OperationsPage() {
  var [rides, setRides] = useState([]);
  var [deliveries, setDeliveries] = useState([]);
  var [drivers, setDrivers] = useState([]);
  var [activeTab, setActiveTab] = useState('rides');
  var [lastUpdated, setLastUpdated] = useState(null);
  var [secondsAgo, setSecondsAgo] = useState(0);
  var [flyTo, setFlyTo] = useState(null);
  var [loading, setLoading] = useState(true);
  var mapRef = useRef(null);

  var fetchData = useCallback(function() {
    Promise.all([
      adminService.getLiveRides().catch(function() { return { rides: [] }; }),
      adminService.getLiveDeliveries().catch(function() { return { deliveries: [] }; }),
      adminService.getOnlineDrivers().catch(function() { return { drivers: [] }; })
    ]).then(function(results) {
      setRides(results[0].rides || []);
      setDeliveries(results[1].deliveries || []);
      setDrivers(results[2].drivers || []);
      setLastUpdated(new Date());
      setLoading(false);
    });
  }, []);

  useEffect(function() {
    fetchData();
    var interval = setInterval(fetchData, POLL_INTERVAL);
    return function() { clearInterval(interval); };
  }, [fetchData]);

  useEffect(function() {
    var timer = setInterval(function() {
      if (lastUpdated) setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return function() { clearInterval(timer); };
  }, [lastUpdated]);

  function handleRideSelect(ride) {
    if (ride.pickup && ride.pickup.coordinates) {
      setFlyTo([ride.pickup.coordinates.latitude, ride.pickup.coordinates.longitude]);
    }
  }

  function handleDriverSelect(loc) {
    setFlyTo(loc);
  }

  function getDriverMarkers() {
    return drivers.map(function(d) {
      var loc = getDriverLocation(d);
      if (!loc) return null;
      var icon = d.isAvailable ? greenIcon : (d.currentDelivery ? blueIcon : yellowIcon);
      var name = getDriverName(d);
      return { id: d._id, loc: loc, icon: icon, name: name, driver: d };
    }).filter(Boolean);
  }

  function getRideMarkers() {
    var markers = [];
    rides.forEach(function(r) {
      if (r.pickup && r.pickup.coordinates) {
        markers.push({ type: 'pickup', lat: r.pickup.coordinates.latitude, lng: r.pickup.coordinates.longitude, ride: r });
      }
      if (r.dropoff && r.dropoff.coordinates) {
        markers.push({ type: 'dropoff', lat: r.dropoff.coordinates.latitude, lng: r.dropoff.coordinates.longitude, ride: r });
      }
    });
    deliveries.forEach(function(d) {
      if (d.pickup && d.pickup.coordinates) {
        markers.push({ type: 'pickup', lat: d.pickup.coordinates.latitude, lng: d.pickup.coordinates.longitude, ride: d });
      }
      if (d.dropoff && d.dropoff.coordinates) {
        markers.push({ type: 'dropoff', lat: d.dropoff.coordinates.latitude, lng: d.dropoff.coordinates.longitude, ride: d });
      }
    });
    return markers;
  }

  var driverMarkers = getDriverMarkers();
  var rideMarkers = getRideMarkers();

  var tabs = [
    { key: 'rides', label: 'Courses', icon: Car, count: rides.length },
    { key: 'deliveries', label: 'Livraisons', icon: Package, count: deliveries.length },
    { key: 'drivers', label: 'Chauffeurs', icon: Users, count: drivers.length }
  ];

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 flex flex-col lg:flex-row" style={{ height: 'calc(100vh - 4px)', marginTop: '-1rem' }}>
      {/* MAP PANEL */}
      <div className="w-full lg:w-[60%] h-[40vh] lg:h-full relative">
        <MapContainer
          center={DAKAR_CENTER}
          zoom={13}
          style={{ height: '100%', width: '100%', background: '#0a0f0d' }}
          ref={mapRef}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {flyTo && <MapFlyTo center={flyTo} zoom={15} />}
          {driverMarkers.map(function(m) {
            return (
              <Marker key={m.id} position={m.loc} icon={m.icon}>
                <Popup>
                  <div style={{ color: '#000', fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                  <div style={{ color: '#555', fontSize: 11 }}>{m.driver.isAvailable ? 'Disponible' : 'Occupe'}</div>
                  {m.driver.vehicle && <div style={{ color: '#555', fontSize: 11 }}>{(m.driver.vehicle.make || '') + ' ' + (m.driver.vehicle.model || '')}</div>}
                </Popup>
              </Marker>
            );
          })}
          {rideMarkers.map(function(m, i) {
            return (
              <CircleMarker
                key={i}
                center={[m.lat, m.lng]}
                radius={6}
                pathOptions={{
                  color: m.type === 'pickup' ? '#22c55e' : '#ef4444',
                  fillColor: m.type === 'pickup' ? '#22c55e' : '#ef4444',
                  fillOpacity: 0.8,
                  weight: 2
                }}
              >
                <Popup>
                  <div style={{ color: '#000', fontSize: 12 }}>
                    <strong>{m.type === 'pickup' ? 'Depart' : 'Arrivee'}</strong><br />
                    {m.type === 'pickup' ? (m.ride.pickup && m.ride.pickup.address) : (m.ride.dropoff && m.ride.dropoff.address)}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* Map overlay stats */}
        <div className="absolute top-4 left-4 z-[1000] flex gap-2">
          <div className="px-3 py-2 rounded-lg backdrop-blur-md text-xs font-semibold flex items-center gap-2" style={{ background: 'rgba(0,20,14,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-emerald-400">{drivers.filter(function(d) { return d.isAvailable; }).length} disponibles</span>
          </div>
          <div className="px-3 py-2 rounded-lg backdrop-blur-md text-xs font-semibold flex items-center gap-2" style={{ background: 'rgba(0,20,14,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
            <span className="text-yellow-400">{rides.length} courses</span>
          </div>
          <div className="px-3 py-2 rounded-lg backdrop-blur-md text-xs font-semibold flex items-center gap-2" style={{ background: 'rgba(0,20,14,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
            <span className="text-cyan-400">{deliveries.length} livraisons</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full lg:w-[40%] h-[60vh] lg:h-full flex flex-col" style={{ background: 'rgba(0,16,10,0.95)', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <h1 className="text-lg font-bold text-white">Centre de controle</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs text-gray-500">Mis a jour il y a {secondsAgo}s</span>
            </div>
          </div>
          <button onClick={fetchData} className="p-2 rounded-lg text-gray-500 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pt-3 gap-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {tabs.map(function(tab) {
            var Icon = tab.icon;
            var isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={function() { setActiveTab(tab.key); }}
                className={'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all duration-200 ' + (isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300')}
                style={isActive ? { background: 'rgba(255,255,255,0.06)', borderBottom: '2px solid #22c55e' } : { borderBottom: '2px solid transparent' }}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                <span className={'ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ' + (isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-800 text-gray-500')}>{tab.count}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-gray-500 text-center mt-20">Chargement...</div>
          ) : (
            <>
              {activeTab === 'rides' && (
                rides.length === 0 ? (
                  <div className="text-gray-600 text-center mt-16 text-sm">Aucune course active</div>
                ) : rides.map(function(ride) {
                  return <RideCard key={ride._id} ride={ride} onSelect={handleRideSelect} />;
                })
              )}
              {activeTab === 'deliveries' && (
                deliveries.length === 0 ? (
                  <div className="text-gray-600 text-center mt-16 text-sm">Aucune livraison active</div>
                ) : deliveries.map(function(delivery) {
                  return <DeliveryCard key={delivery._id} delivery={delivery} onSelect={handleRideSelect} />;
                })
              )}
              {activeTab === 'drivers' && (
                drivers.length === 0 ? (
                  <div className="text-gray-600 text-center mt-16 text-sm">Aucun chauffeur en ligne</div>
                ) : drivers.map(function(driver) {
                  return <DriverCard key={driver._id} driver={driver} onSelect={handleDriverSelect} />;
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
