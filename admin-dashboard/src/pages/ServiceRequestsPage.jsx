import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { Search, Eye, X, Clock, CheckCircle, XCircle, MapPin, Phone, MessageSquare } from 'lucide-react';

var statusColors = {
  pending: 'text-yellow-400 bg-yellow-400/10',
  accepted: 'text-blue-400 bg-blue-400/10',
  en_route: 'text-purple-400 bg-purple-400/10',
  arrived: 'text-indigo-400 bg-indigo-400/10',
  in_progress: 'text-orange-400 bg-orange-400/10',
  completed: 'text-emerald-400 bg-emerald-400/10',
  cancelled: 'text-red-400 bg-red-400/10',
  no_providers: 'text-gray-400 bg-gray-400/10'
};

var statusLabels = {
  pending: 'En attente', accepted: 'Accepte', en_route: 'En route',
  arrived: 'Arrive', in_progress: 'En cours', completed: 'Termine',
  cancelled: 'Annule', no_providers: 'Pas de prestataire'
};

var categoryLabels = {
  plomberie: 'Plomberie', electricite: 'Electricite', climatisation: 'Climatisation',
  menuiserie: 'Menuiserie', peinture: 'Peinture', maconnerie: 'Maconnerie',
  carrelage: 'Carrelage', serrurerie: 'Serrurerie', nettoyage: 'Nettoyage',
  jardinage: 'Jardinage', informatique: 'Informatique', electromenager: 'Electromenager',
  demenagement: 'Demenagement', autre: 'Autre'
};

var urgencyLabels = { normal: 'Normal', urgent: 'Urgent', planifie: 'Planifie' };
var urgencyColors = { normal: 'text-gray-400', urgent: 'text-red-400', planifie: 'text-blue-400' };

export default function ServiceRequestsPage() {
  var [requests, setRequests] = useState([]);
  var [loading, setLoading] = useState(true);
  var [filter, setFilter] = useState('');
  var [catFilter, setCatFilter] = useState('');
  var [search, setSearch] = useState('');
  var [selected, setSelected] = useState(null);
  var [stats, setStats] = useState(null);

  function load() {
    setLoading(true);
    var params = {};
    if (filter) params.status = filter;
    if (catFilter) params.category = catFilter;
    adminService.getServiceRequests(params).then(function(res) {
      setRequests(res.data || []);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }

  function loadStats() {
    adminService.getServiceStats().then(function(res) {
      setStats(res.data);
    }).catch(function() {});
  }

  useEffect(function() { load(); loadStats(); }, [filter, catFilter]);

  function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  var filtered = requests.filter(function(r) {
    if (!search) return true;
    var num = r.requestNumber || '';
    var rider = (r.riderId && r.riderId.firstName) || '';
    var provider = (r.provider && r.provider.fullName) || '';
    var q = search.toLowerCase();
    return num.toLowerCase().includes(q) || rider.toLowerCase().includes(q) || provider.toLowerCase().includes(q);
  });

  return (
    <div>
      {/* DETAIL MODAL */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={function() { setSelected(null); }}>
          <div className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={function(e) { e.stopPropagation(); }}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">{selected.requestNumber}</h2>
                <p className="text-gray-400 text-sm">{categoryLabels[selected.category] || selected.category}</p>
              </div>
              <button onClick={function() { setSelected(null); }} className="p-2 rounded-lg hover:bg-gray-800">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400">Statut</p>
                <span className={'inline-block px-3 py-1 rounded-full text-xs font-medium mt-1 ' + (statusColors[selected.status] || '')}>
                  {statusLabels[selected.status] || selected.status}
                </span>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400">Urgence</p>
                <p className={'font-medium mt-1 ' + (urgencyColors[selected.urgency] || '')}>{urgencyLabels[selected.urgency] || selected.urgency}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400">Prix final</p>
                <p className="text-emerald-400 font-medium mt-1">{(selected.finalPrice || selected.quotedPrice || 0).toLocaleString()} FCFA</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400">Commission</p>
                <p className="text-white font-medium mt-1">{(selected.platformCommission || 0).toLocaleString()} FCFA</p>
              </div>
            </div>

            {/* Client info */}
            {selected.riderId && (
              <div className="bg-gray-800 rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-400 mb-2">Client</p>
                <p className="text-white text-sm">{selected.riderId.firstName} {selected.riderId.lastName || ''}</p>
                {selected.riderId.phone && <p className="text-gray-400 text-xs flex items-center gap-1 mt-1"><Phone size={12} />{selected.riderId.phone}</p>}
              </div>
            )}

            {/* Provider info */}
            {selected.provider && (
              <div className="bg-gray-800 rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-400 mb-2">Prestataire</p>
                <p className="text-white text-sm">{selected.provider.fullName}</p>
                {selected.provider.phone && <p className="text-gray-400 text-xs flex items-center gap-1 mt-1"><Phone size={12} />{selected.provider.phone}</p>}
              </div>
            )}

            {/* Location */}
            {selected.location && (
              <div className="bg-gray-800 rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-400 mb-2">Adresse</p>
                <p className="text-white text-sm flex items-center gap-1"><MapPin size={14} />{selected.location.address}</p>
                {selected.location.quartier && <p className="text-gray-400 text-xs mt-1">{selected.location.quartier}</p>}
              </div>
            )}

            {/* Description */}
            <div className="bg-gray-800 rounded-xl p-4 mb-4">
              <p className="text-xs text-gray-400 mb-2">Description du probleme</p>
              <p className="text-gray-300 text-sm flex items-start gap-2">
                <MessageSquare size={14} className="mt-0.5 flex-shrink-0" />
                {selected.description}
              </p>
            </div>

            {/* Photos */}
            {selected.photos && selected.photos.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-400 mb-2">Photos du probleme</p>
                <div className="flex gap-2 flex-wrap">
                  {selected.photos.map(function(url, i) {
                    return <img key={i} src={url} alt="" className="w-24 h-24 object-cover rounded-lg" />;
                  })}
                </div>
              </div>
            )}

            {/* Completion photos */}
            {selected.completionPhotos && selected.completionPhotos.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-400 mb-2">Photos apres intervention</p>
                <div className="flex gap-2 flex-wrap">
                  {selected.completionPhotos.map(function(url, i) {
                    return <img key={i} src={url} alt="" className="w-24 h-24 object-cover rounded-lg" />;
                  })}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="bg-gray-800 rounded-xl p-4 mb-4">
              <p className="text-xs text-gray-400 mb-3">Chronologie</p>
              <div className="space-y-2">
                {[
                  { label: 'Demande', date: selected.requestedAt },
                  { label: 'Accepte', date: selected.acceptedAt },
                  { label: 'En route', date: selected.enRouteAt },
                  { label: 'Arrive', date: selected.arrivedAt },
                  { label: 'Debut', date: selected.startedAt },
                  { label: 'Termine', date: selected.completedAt },
                  { label: 'Annule', date: selected.cancelledAt }
                ].filter(function(t) { return t.date; }).map(function(t) {
                  return (
                    <div key={t.label} className="flex items-center gap-3">
                      <Clock size={14} className="text-gray-500" />
                      <span className="text-gray-400 text-xs w-20">{t.label}</span>
                      <span className="text-gray-300 text-xs">{formatDate(t.date)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rating */}
            {selected.rating && selected.rating.rating && (
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-2">Evaluation</p>
                <p className="text-yellow-400">{'★'.repeat(selected.rating.rating)}{'☆'.repeat(5 - selected.rating.rating)}</p>
                {selected.rating.review && <p className="text-gray-300 text-sm mt-1">{selected.rating.review}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Demandes de Services</h1>
          <p className="text-gray-400 text-sm mt-1">Suivi des interventions</p>
        </div>
      </div>

      {/* STATS */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-gray-400 text-xs">Total demandes</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.requests.total}</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-gray-400 text-xs">En attente</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.requests.pending}</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-gray-400 text-xs">Terminees</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.requests.completed}</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-gray-400 text-xs">Annulees</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{stats.requests.cancelled}</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-gray-400 text-xs">Commission totale</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{(stats.revenue.commission || 0).toLocaleString()}</p>
            <p className="text-gray-500 text-xs">FCFA</p>
          </div>
        </div>
      )}

      {/* FILTERS */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder="Rechercher par numero, client, prestataire..." value={search} onChange={function(e) { setSearch(e.target.value); }}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none" />
        </div>
        <select value={filter} onChange={function(e) { setFilter(e.target.value); }}
          className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none">
          <option value="">Tous les statuts</option>
          {Object.keys(statusLabels).map(function(k) {
            return <option key={k} value={k}>{statusLabels[k]}</option>;
          })}
        </select>
        <select value={catFilter} onChange={function(e) { setCatFilter(e.target.value); }}
          className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none">
          <option value="">Toutes categories</option>
          {Object.keys(categoryLabels).map(function(k) {
            return <option key={k} value={k}>{categoryLabels[k]}</option>;
          })}
        </select>
      </div>

      {/* TABLE */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-500">Aucune demande trouvee</div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase">N°</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase">Categorie</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase">Client</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase">Prestataire</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase">Prix</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase">Statut</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase">Date</th>
                <th className="text-right px-6 py-4 text-xs font-medium text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(function(r) {
                return (
                  <tr key={r._id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 text-white text-sm font-mono">{r.requestNumber}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded text-xs bg-gray-800 text-gray-300">{categoryLabels[r.category] || r.category}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-300 text-sm">
                      {r.riderId ? (r.riderId.firstName || '') + ' ' + (r.riderId.lastName || '') : '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-300 text-sm">
                      {r.provider ? r.provider.fullName : <span className="text-gray-600">Non assigne</span>}
                    </td>
                    <td className="px-6 py-4 text-emerald-400 text-sm font-medium">
                      {(r.finalPrice || r.quotedPrice || 0).toLocaleString()} F
                    </td>
                    <td className="px-6 py-4">
                      <span className={'inline-block px-3 py-1 rounded-full text-xs font-medium ' + (statusColors[r.status] || '')}>
                        {statusLabels[r.status] || r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-xs">{formatDate(r.requestedAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={function() { setSelected(r); }}
                        className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
