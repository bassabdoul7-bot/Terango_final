import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { CheckCircle, XCircle, Clock, Search, ChevronLeft, ChevronRight } from 'lucide-react';

var statusColors = {
  approved: 'text-emerald-400 bg-emerald-400/10',
  pending: 'text-yellow-400 bg-yellow-400/10',
  rejected: 'text-red-400 bg-red-400/10'
};

var statusLabels = {
  approved: 'Approuvé',
  pending: 'En attente',
  rejected: 'Rejeté'
};

export default function DriversPage() {
  var [drivers, setDrivers] = useState([]);
  var [loading, setLoading] = useState(true);
  var [filter, setFilter] = useState('');
  var [page, setPage] = useState(1);
  var [totalPages, setTotalPages] = useState(1);
  var [search, setSearch] = useState('');

  function loadDrivers() {
    setLoading(true);
    var params = { page: page, limit: 15 };
    if (filter) params.status = filter;
    adminService.getDrivers(params).then(function(res) {
      setDrivers(res.drivers || []);
      setTotalPages(res.totalPages || 1);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }

  useEffect(function() { loadDrivers(); }, [filter, page]);

  function handleVerify(driverId, status) {
    var reason = status === 'rejected' ? prompt('Raison du rejet:') : '';
    if (status === 'rejected' && !reason) return;
    adminService.verifyDriver(driverId, status, reason).then(function() {
      loadDrivers();
    });
  }

  var filtered = drivers.filter(function(d) {
    if (!search) return true;
    var name = (d.userId && d.userId.name) || '';
    var phone = (d.userId && d.userId.phone) || '';
    return name.toLowerCase().includes(search.toLowerCase()) || phone.includes(search);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Chauffeurs</h1>
        <div className="flex gap-2">
          {['', 'pending', 'approved', 'rejected'].map(function(f) {
            return (
              <button key={f} onClick={function() { setFilter(f); setPage(1); }}
                className={'px-4 py-2 rounded-lg text-sm font-medium transition-colors ' + (filter === f ? 'bg-emerald-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white')}>
                {f === '' ? 'Tous' : statusLabels[f]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-3 text-gray-500" />
        <input value={search} onChange={function(e) { setSearch(e.target.value); }}
          className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
          placeholder="Rechercher par nom ou téléphone..." />
      </div>

      {loading ? <div className="text-gray-500 text-center py-10">Chargement...</div> : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">CHAUFFEUR</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">TÉLÉPHONE</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">VÉHICULE</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">STATUT</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">NOTE</th>
                <th className="text-right text-xs text-gray-500 font-medium px-6 py-4">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(function(driver) {
                var name = (driver.userId && driver.userId.name) || 'N/A';
                var phone = (driver.userId && driver.userId.phone) || 'N/A';
                var rating = (driver.userId && driver.userId.rating) ? driver.userId.rating.toFixed(1) : '-';
                var vehicle = driver.vehicle ? (driver.vehicle.make || '') + ' ' + (driver.vehicle.model || '') : 'N/A';
                var status = driver.verificationStatus || 'pending';
                return (
                  <tr key={driver._id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-6 py-4 text-white font-medium">{name}</td>
                    <td className="px-6 py-4 text-gray-400">{phone}</td>
                    <td className="px-6 py-4 text-gray-400">{vehicle}</td>
                    <td className="px-6 py-4">
                      <span className={'px-3 py-1 rounded-full text-xs font-medium ' + (statusColors[status] || '')}>{statusLabels[status] || status}</span>
                    </td>
                    <td className="px-6 py-4 text-yellow-400">{rating}</td>
                    <td className="px-6 py-4 text-right">
                      {status === 'pending' && (
                        <div className="flex gap-2 justify-end">
                          <button onClick={function() { handleVerify(driver._id, 'approved'); }} className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                            <CheckCircle size={18} />
                          </button>
                          <button onClick={function() { handleVerify(driver._id, 'rejected'); }} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                            <XCircle size={18} />
                          </button>
                        </div>
                      )}
                      {status === 'approved' && <span className="text-xs text-gray-600">Actif</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-8 text-gray-500">Aucun chauffeur trouvé</div>}
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
