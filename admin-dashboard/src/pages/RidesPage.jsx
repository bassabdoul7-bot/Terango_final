import { useState, useEffect, useRef } from 'react';
import { adminService } from '../services/api';
import { Search, ChevronLeft, ChevronRight, Smartphone, X, MapPin, Navigation, AlertTriangle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

var statusColors = {
  pending: 'text-yellow-400 bg-yellow-400/10',
  accepted: 'text-blue-400 bg-blue-400/10',
  arrived: 'text-purple-400 bg-purple-400/10',
  in_progress: 'text-emerald-400 bg-emerald-400/10',
  completed: 'text-green-400 bg-green-400/10',
  cancelled: 'text-red-400 bg-red-400/10'
};

var statusLabels = {
  pending: 'En attente',
  accepted: 'Acceptee',
  arrived: 'Arrive',
  in_progress: 'En cours',
  completed: 'Terminee',
  cancelled: 'Annulee'
};

var pickupIcon = new L.DivIcon({
  className: '',
  html: '<div style="width:28px;height:28px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center"><div style="width:8px;height:8px;border-radius:50%;background:#fff"></div></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

var dropoffIcon = new L.DivIcon({
  className: '',
  html: '<div style="width:28px;height:28px;border-radius:50%;background:#ef4444;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center"><div style="width:8px;height:8px;border-radius:50%;background:#fff"></div></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

function FitBounds({ bounds }) {
  var map = useMap();
  useEffect(function() {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [bounds, map]);
  return null;
}

function RideDetailModal({ rideId, onClose }) {
  var [ride, setRide] = useState(null);
  var [loading, setLoading] = useState(true);
  var [error, setError] = useState(null);

  useEffect(function() {
    setLoading(true);
    setError(null);
    adminService.getRideDetails(rideId).then(function(res) {
      setRide(res.ride);
      setLoading(false);
    }).catch(function(err) {
      setError('Erreur lors du chargement');
      setLoading(false);
    });
  }, [rideId]);

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  var hasTrail = ride && ride.routeTrail && ride.routeTrail.length > 1;
  var hasRecordings = ride && ride.emergencyRecordings && ride.emergencyRecordings.length > 0;

  var pickupCoords = ride && ride.pickup && ride.pickup.coordinates
    ? [ride.pickup.coordinates.latitude, ride.pickup.coordinates.longitude]
    : null;
  var dropoffCoords = ride && ride.dropoff && ride.dropoff.coordinates
    ? [ride.dropoff.coordinates.latitude, ride.dropoff.coordinates.longitude]
    : null;

  var trailPositions = hasTrail
    ? ride.routeTrail.map(function(p) { return [p.latitude, p.longitude]; })
    : [];

  var allPoints = [];
  if (pickupCoords) allPoints.push(pickupCoords);
  if (dropoffCoords) allPoints.push(dropoffCoords);
  if (trailPositions.length > 0) allPoints = allPoints.concat(trailPositions);

  var mapCenter = pickupCoords || [14.7167, -17.4677]; // Default: Dakar

  var driverName = 'N/A';
  var driverPhone = '';
  if (ride && ride.driver) {
    if (ride.driver.userId) {
      driverName = ride.driver.userId.name || 'N/A';
      driverPhone = ride.driver.userId.phone || '';
    }
  }
  var riderName = 'N/A';
  var riderPhone = '';
  if (ride && ride.riderId) {
    if (ride.riderId.userId) {
      riderName = ride.riderId.userId.name || 'N/A';
      riderPhone = ride.riderId.userId.phone || '';
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={handleBackdropClick}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-[95vw] max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">
            Details de la course {ride ? '- ...' + ride._id.slice(-6) : ''}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="text-gray-500 text-center py-16">Chargement...</div>}
          {error && <div className="text-red-400 text-center py-16">{error}</div>}
          {ride && !loading && (
            <div className="flex flex-col lg:flex-row">
              {/* Map Section */}
              <div className="lg:w-3/5 w-full h-[400px] lg:h-[520px] relative">
                {(pickupCoords || dropoffCoords) ? (
                  <MapContainer
                    center={mapCenter}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={true}
                    zoomControl={true}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {pickupCoords && <Marker position={pickupCoords} icon={pickupIcon} />}
                    {dropoffCoords && <Marker position={dropoffCoords} icon={dropoffIcon} />}
                    {hasTrail && (
                      <Polyline
                        positions={trailPositions}
                        pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.8 }}
                      />
                    )}
                    {allPoints.length > 0 && <FitBounds bounds={allPoints} />}
                  </MapContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500 bg-gray-800">
                    Coordonnees non disponibles
                  </div>
                )}
                {!hasTrail && (pickupCoords || dropoffCoords) && (
                  <div className="absolute bottom-3 left-3 right-3 bg-gray-900/90 text-yellow-400 text-xs px-3 py-2 rounded-lg border border-yellow-800 flex items-center gap-2">
                    <AlertTriangle size={14} />
                    Aucun trace GPS disponible
                  </div>
                )}
              </div>

              {/* Info Section */}
              <div className="lg:w-2/5 w-full p-5 space-y-4 border-t lg:border-t-0 lg:border-l border-gray-800">
                {/* Locations */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 mt-1.5 rounded-full bg-green-500 flex-shrink-0"></div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase font-medium">Depart</div>
                      <div className="text-sm text-white">{(ride.pickup && ride.pickup.address) || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 mt-1.5 rounded-full bg-red-500 flex-shrink-0"></div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase font-medium">Arrivee</div>
                      <div className="text-sm text-white">{(ride.dropoff && ride.dropoff.address) || 'N/A'}</div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-800 pt-3 space-y-2">
                  <InfoRow label="Tarif" value={(ride.fare || 0).toLocaleString() + ' FCFA'} valueClass="text-yellow-400 font-semibold" />
                  <InfoRow label="Statut" value={statusLabels[ride.status] || ride.status} valueClass={statusColors[ride.status] ? statusColors[ride.status].split(' ')[0] : 'text-white'} />
                  <InfoRow label="Type" value={(ride.rideType || 'standard').charAt(0).toUpperCase() + (ride.rideType || 'standard').slice(1)} />
                  <InfoRow label="Distance" value={(ride.distance || 0).toFixed(1) + ' km'} />
                  <InfoRow label="Duree estimee" value={(ride.estimatedDuration || 0) + ' min'} />
                  <InfoRow label="Paiement" value={ride.paymentMethod === 'wave' || ride.paymentMethod === 'wave_upfront' ? 'Wave' : ride.paymentMethod === 'cash' ? 'Especes' : (ride.paymentMethod || '-')} />
                  <InfoRow label="Commission" value={(ride.platformCommission || 0).toLocaleString() + ' FCFA'} />
                </div>

                <div className="border-t border-gray-800 pt-3 space-y-2">
                  <InfoRow label="Passager" value={riderName + (riderPhone ? ' (' + riderPhone + ')' : '')} />
                  <InfoRow label="Chauffeur" value={driverName + (driverPhone ? ' (' + driverPhone + ')' : '')} />
                </div>

                <div className="border-t border-gray-800 pt-3 space-y-1 text-xs text-gray-500">
                  {ride.requestedAt && <div>Demande: {new Date(ride.requestedAt).toLocaleString('fr-FR')}</div>}
                  {ride.acceptedAt && <div>Acceptee: {new Date(ride.acceptedAt).toLocaleString('fr-FR')}</div>}
                  {ride.startedAt && <div>Demarree: {new Date(ride.startedAt).toLocaleString('fr-FR')}</div>}
                  {ride.completedAt && <div>Terminee: {new Date(ride.completedAt).toLocaleString('fr-FR')}</div>}
                  {ride.cancelledAt && <div className="text-red-400">Annulee: {new Date(ride.cancelledAt).toLocaleString('fr-FR')}{ride.cancellationReason ? ' - ' + ride.cancellationReason : ''}</div>}
                </div>

                {hasTrail && (
                  <div className="border-t border-gray-800 pt-3">
                    <div className="text-xs text-gray-500 uppercase font-medium mb-1">Trace GPS</div>
                    <div className="text-sm text-blue-400">{ride.routeTrail.length} points enregistres</div>
                  </div>
                )}

                {/* Emergency Recordings */}
                {hasRecordings && (
                  <div className="border-t border-gray-800 pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={14} className="text-red-400" />
                      <div className="text-xs text-red-400 uppercase font-medium">Enregistrements d'urgence</div>
                    </div>
                    <div className="space-y-2">
                      {ride.emergencyRecordings.map(function(rec, idx) {
                        return (
                          <div key={idx} className="bg-red-950/30 border border-red-900/50 rounded-lg p-3">
                            <div className="text-xs text-gray-400 mb-1">
                              {rec.recordedBy || 'Inconnu'} - {rec.recordedAt ? new Date(rec.recordedAt).toLocaleString('fr-FR') : ''}
                              {rec.duration ? ' (' + rec.duration + 's)' : ''}
                            </div>
                            {rec.audioUrl ? (
                              <audio controls preload="none" className="w-full h-8" style={{ filter: 'invert(1) hue-rotate(180deg)' }}>
                                <source src={rec.audioUrl} />
                              </audio>
                            ) : (
                              <div className="text-xs text-gray-500">Audio non disponible</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, valueClass }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={'text-sm ' + (valueClass || 'text-white')}>{value}</span>
    </div>
  );
}

export default function RidesPage() {
  var [rides, setRides] = useState([]);
  var [loading, setLoading] = useState(true);
  var [filter, setFilter] = useState('');
  var [page, setPage] = useState(1);
  var [totalPages, setTotalPages] = useState(1);
  var [confirmingId, setConfirmingId] = useState(null);
  var [selectedRideId, setSelectedRideId] = useState(null);

  function loadRides() {
    setLoading(true);
    var params = { page: page, limit: 15 };
    if (filter && filter !== 'wave_pending') params.status = filter;
    if (filter === 'wave_pending') params.paymentStatus = 'awaiting_payment';
    adminService.getRides(params).then(function(res) {
      setRides(res.rides || []);
      setTotalPages(res.totalPages || 1);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }

  useEffect(function() { loadRides(); }, [filter, page]);

  function handleConfirmPayment(rideId) {
    setConfirmingId(rideId);
    adminService.confirmWavePayment(rideId).then(function() {
      loadRides();
      setConfirmingId(null);
    }).catch(function() { setConfirmingId(null); });
  }

  var filterTabs = ['', 'pending', 'in_progress', 'completed', 'cancelled', 'wave_pending'];
  var filterLabels = { '': 'Toutes', pending: 'En attente', in_progress: 'En cours', completed: 'Terminee', cancelled: 'Annulee', wave_pending: 'Wave en attente' };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Courses</h1>
        <div className="flex gap-2 flex-wrap">
          {filterTabs.map(function(f) {
            var isWave = f === 'wave_pending';
            return (
              <button key={f} onClick={function() { setFilter(f); setPage(1); }}
                className={'px-3 py-2 rounded-lg text-xs font-medium transition-colors ' +
                  (filter === f
                    ? (isWave ? 'bg-indigo-500 text-white' : 'bg-emerald-500 text-white')
                    : (isWave ? 'bg-indigo-900/40 text-indigo-400 hover:text-white border border-indigo-800' : 'bg-gray-800 text-gray-400 hover:text-white'))}>
                {isWave && <Smartphone size={12} className="inline mr-1 -mt-0.5" />}
                {filterLabels[f]}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? <div className="text-gray-500 text-center py-10">Chargement...</div> : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">ID</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">DEPART</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">ARRIVEE</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">TARIF</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">STATUT</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">PAIEMENT</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">DATE</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {rides.map(function(ride) {
                var pickup = (ride.pickupLocation && ride.pickupLocation.address) || (ride.pickup && ride.pickup.address) || 'N/A';
                var dropoff = (ride.dropoffLocation && ride.dropoffLocation.address) || (ride.dropoff && ride.dropoff.address) || 'N/A';
                var status = ride.status || 'pending';
                var date = ride.createdAt ? new Date(ride.createdAt).toLocaleDateString('fr-FR') : '-';
                var isWavePending = ride.paymentMethod === 'wave' && ride.paymentStatus === 'awaiting_payment';
                var waveClaimed = ride.wavePaymentClaimed;
                return (
                  <tr key={ride._id}
                    onClick={function() { setSelectedRideId(ride._id); }}
                    className={'border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer' + (isWavePending ? ' bg-indigo-950/20' : '')}>
                    <td className="px-6 py-4 text-gray-500 text-xs font-mono">{ride._id.slice(-6)}</td>
                    <td className="px-6 py-4 text-white text-sm">{pickup.length > 30 ? pickup.substring(0,30) + '...' : pickup}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{dropoff.length > 30 ? dropoff.substring(0,30) + '...' : dropoff}</td>
                    <td className="px-6 py-4 text-yellow-400 font-medium">{(ride.fare || 0).toLocaleString()} FCFA</td>
                    <td className="px-6 py-4">
                      <span className={'px-3 py-1 rounded-full text-xs font-medium ' + (statusColors[status] || '')}>{statusLabels[status] || status}</span>
                    </td>
                    <td className="px-6 py-4">
                      {ride.paymentMethod === 'wave' && (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-indigo-400 font-medium"><Smartphone size={11} className="inline mr-1 -mt-0.5" />Wave</span>
                          {ride.paymentStatus === 'awaiting_payment' && <span className="text-xs text-yellow-400">En attente</span>}
                          {ride.paymentStatus === 'confirmed' && <span className="text-xs text-green-400">Confirme</span>}
                          {waveClaimed && ride.paymentStatus !== 'confirmed' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/20 text-orange-400 w-fit">Declare paye</span>
                          )}
                        </div>
                      )}
                      {ride.paymentMethod === 'cash' && <span className="text-xs text-gray-500">Especes</span>}
                      {!ride.paymentMethod && <span className="text-xs text-gray-600">-</span>}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">{date}</td>
                    <td className="px-6 py-4">
                      {isWavePending && (
                        <button
                          disabled={confirmingId === ride._id}
                          onClick={function(e) { e.stopPropagation(); handleConfirmPayment(ride._id); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50">
                          {confirmingId === ride._id ? '...' : 'Confirmer paiement'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rides.length === 0 && <div className="text-center py-8 text-gray-500">Aucune course trouvee</div>}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800">
              <button disabled={page <= 1} onClick={function() { setPage(page-1); }} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30"><ChevronLeft size={16} /> Precedent</button>
              <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={function() { setPage(page+1); }} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30">Suivant <ChevronRight size={16} /></button>
            </div>
          )}
        </div>
      )}

      {selectedRideId && (
        <RideDetailModal rideId={selectedRideId} onClose={function() { setSelectedRideId(null); }} />
      )}
    </div>
  );
}
