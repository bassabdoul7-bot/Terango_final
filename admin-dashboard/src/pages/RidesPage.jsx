import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

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
  accepted: 'Acceptée',
  arrived: 'Arrivé',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée'
};

export default function RidesPage() {
  var [rides, setRides] = useState([]);
  var [loading, setLoading] = useState(true);
  var [filter, setFilter] = useState('');
  var [page, setPage] = useState(1);
  var [totalPages, setTotalPages] = useState(1);

  function loadRides() {
    setLoading(true);
    var params = { page: page, limit: 15 };
    if (filter) params.status = filter;
    adminService.getRides(params).then(function(res) {
      setRides(res.rides || []);
      setTotalPages(res.totalPages || 1);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }

  useEffect(function() { loadRides(); }, [filter, page]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Courses</h1>
        <div className="flex gap-2 flex-wrap">
          {['', 'pending', 'in_progress', 'completed', 'cancelled'].map(function(f) {
            return (
              <button key={f} onClick={function() { setFilter(f); setPage(1); }}
                className={'px-3 py-2 rounded-lg text-xs font-medium transition-colors ' + (filter === f ? 'bg-emerald-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white')}>
                {f === '' ? 'Toutes' : statusLabels[f]}
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
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">DÉPART</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">ARRIVÉE</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">TARIF</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">STATUT</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">DATE</th>
              </tr>
            </thead>
            <tbody>
              {rides.map(function(ride) {
                var pickup = (ride.pickupLocation && ride.pickupLocation.address) || 'N/A';
                var dropoff = (ride.dropoffLocation && ride.dropoffLocation.address) || 'N/A';
                var status = ride.status || 'pending';
                var date = ride.createdAt ? new Date(ride.createdAt).toLocaleDateString('fr-FR') : '-';
                return (
                  <tr key={ride._id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-6 py-4 text-gray-500 text-xs font-mono">{ride._id.slice(-6)}</td>
                    <td className="px-6 py-4 text-white text-sm">{pickup.length > 30 ? pickup.substring(0,30) + '...' : pickup}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{dropoff.length > 30 ? dropoff.substring(0,30) + '...' : dropoff}</td>
                    <td className="px-6 py-4 text-yellow-400 font-medium">{(ride.fare || 0).toLocaleString()} FCFA</td>
                    <td className="px-6 py-4">
                      <span className={'px-3 py-1 rounded-full text-xs font-medium ' + (statusColors[status] || '')}>{statusLabels[status] || status}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">{date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rides.length === 0 && <div className="text-center py-8 text-gray-500">Aucune course trouvée</div>}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800">
              <button disabled={page <= 1} onClick={function() { setPage(page-1); }} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30"><ChevronLeft size={16} /> Précédent</button>
              <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={function() { setPage(page+1); }} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30">Suivant <ChevronRight size={16} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
