import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { Search, ChevronLeft, ChevronRight, UserX, UserCheck } from 'lucide-react';

export default function RidersPage() {
  var [riders, setRiders] = useState([]);
  var [loading, setLoading] = useState(true);
  var [page, setPage] = useState(1);
  var [totalPages, setTotalPages] = useState(1);
  var [search, setSearch] = useState('');

  function loadRiders() {
    setLoading(true);
    adminService.getRiders({ page: page, limit: 15 }).then(function(res) {
      setRiders(res.riders || []);
      setTotalPages(res.totalPages || 1);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }

  useEffect(function() { loadRiders(); }, [page]);

  function handleToggle(userId) {
    adminService.toggleUserStatus(userId).then(function() { loadRiders(); });
  }

  var filtered = riders.filter(function(r) {
    if (!search) return true;
    var name = (r.userId && r.userId.name) || '';
    var phone = (r.userId && r.userId.phone) || '';
    return name.toLowerCase().includes(search.toLowerCase()) || phone.includes(search);
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Passagers</h1>
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
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">NOM</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">TÉLÉPHONE</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">EMAIL</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">NOTE</th>
                <th className="text-right text-xs text-gray-500 font-medium px-6 py-4">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(function(rider) {
                var name = (rider.userId && rider.userId.name) || 'N/A';
                var phone = (rider.userId && rider.userId.phone) || 'N/A';
                var email = (rider.userId && rider.userId.email) || '-';
                var rating = (rider.userId && rider.userId.rating) ? rider.userId.rating.toFixed(1) : '-';
                var userId = rider.userId && rider.userId._id;
                return (
                  <tr key={rider._id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-6 py-4 text-white font-medium">{name}</td>
                    <td className="px-6 py-4 text-gray-400">{phone}</td>
                    <td className="px-6 py-4 text-gray-400">{email}</td>
                    <td className="px-6 py-4 text-yellow-400">{rating}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={function() { handleToggle(userId); }} className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors">
                        <UserX size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-8 text-gray-500">Aucun passager trouvé</div>}
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
