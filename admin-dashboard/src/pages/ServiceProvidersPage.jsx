import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { CheckCircle, XCircle, Search, Eye, X, Wrench, Zap, Droplets, Wind, PaintBucket, Hammer, LayoutGrid, Lock, Sparkles, TreePine, Monitor, Settings, Truck, HelpCircle } from 'lucide-react';

var statusColors = {
  approved: 'text-emerald-400 bg-emerald-400/10',
  pending: 'text-yellow-400 bg-yellow-400/10',
  rejected: 'text-red-400 bg-red-400/10'
};
var statusLabels = { approved: 'Approuve', pending: 'En attente', rejected: 'Rejete' };

var categoryLabels = {
  plomberie: 'Plomberie', electricite: 'Electricite', climatisation: 'Climatisation',
  menuiserie: 'Menuiserie', peinture: 'Peinture', maconnerie: 'Maconnerie',
  carrelage: 'Carrelage', serrurerie: 'Serrurerie', nettoyage: 'Nettoyage',
  jardinage: 'Jardinage', informatique: 'Informatique', electromenager: 'Electromenager',
  demenagement: 'Demenagement', autre: 'Autre'
};

var categoryIcons = {
  plomberie: Droplets, electricite: Zap, climatisation: Wind,
  menuiserie: Hammer, peinture: PaintBucket, maconnerie: LayoutGrid,
  carrelage: LayoutGrid, serrurerie: Lock, nettoyage: Sparkles,
  jardinage: TreePine, informatique: Monitor, electromenager: Settings,
  demenagement: Truck, autre: HelpCircle
};

export default function ServiceProvidersPage() {
  var [providers, setProviders] = useState([]);
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
    adminService.getServiceProviders(params).then(function(res) {
      setProviders(res.data || []);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }

  function loadStats() {
    adminService.getServiceStats().then(function(res) {
      setStats(res.data);
    }).catch(function() {});
  }

  useEffect(function() { load(); loadStats(); }, [filter, catFilter]);

  function verify(id, status) {
    var reason = status === 'rejected' ? prompt('Raison du rejet:') : '';
    if (status === 'rejected' && !reason) return;
    adminService.verifyServiceProvider(id, status, reason).then(function() {
      load();
      loadStats();
      setSelected(null);
    });
  }

  var filtered = providers.filter(function(p) {
    if (!search) return true;
    var n = p.fullName || '';
    var ph = p.phone || '';
    return n.toLowerCase().includes(search.toLowerCase()) || ph.includes(search);
  });

  return (
    <div>
      {/* DETAIL MODAL */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={function() { setSelected(null); }}>
          <div className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={function(e) { e.stopPropagation(); }}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">{selected.fullName}</h2>
                <p className="text-gray-400 text-sm">{selected.phone}</p>
                {selected.userId && <p className="text-gray-500 text-xs mt-1">{selected.userId.email}</p>}
              </div>
              <button onClick={function() { setSelected(null); }} className="p-2 rounded-lg hover:bg-gray-800">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400">Statut</p>
                <span className={'inline-block px-3 py-1 rounded-full text-xs font-medium mt-1 ' + (statusColors[selected.verificationStatus] || '')}>
                  {statusLabels[selected.verificationStatus] || selected.verificationStatus}
                </span>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400">Experience</p>
                <p className="text-white font-medium mt-1">{selected.experience} ans</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400">Note</p>
                <p className="text-white font-medium mt-1">{'★'.repeat(Math.round(selected.rating || 5))} {(selected.rating || 5).toFixed(1)}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400">Missions</p>
                <p className="text-white font-medium mt-1">{selected.totalJobs || 0} terminees</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400">Gains totaux</p>
                <p className="text-emerald-400 font-medium mt-1">{(selected.totalEarnings || 0).toLocaleString()} FCFA</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400">Tarification</p>
                <p className="text-white font-medium mt-1">
                  {selected.pricing === 'hourly' ? (selected.hourlyRate || 0).toLocaleString() + ' FCFA/h' :
                   selected.pricing === 'fixed' ? 'Tarif fixe' : 'Sur devis'}
                </p>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-4 mb-4">
              <p className="text-xs text-gray-400 mb-2">Categories</p>
              <div className="flex flex-wrap gap-2">
                {(selected.serviceCategories || []).map(function(cat) {
                  return (
                    <span key={cat} className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-400/10 text-emerald-400">
                      {categoryLabels[cat] || cat}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-4 mb-4">
              <p className="text-xs text-gray-400 mb-2">Zones</p>
              <div className="flex flex-wrap gap-2">
                {(selected.zones || []).map(function(z) {
                  return <span key={z} className="px-3 py-1 rounded-full text-xs bg-gray-700 text-gray-300">{z}</span>;
                })}
                {(!selected.zones || selected.zones.length === 0) && <span className="text-gray-500 text-sm">Aucune zone definie</span>}
              </div>
            </div>

            {selected.description && (
              <div className="bg-gray-800 rounded-xl p-4 mb-6">
                <p className="text-xs text-gray-400 mb-2">Description</p>
                <p className="text-gray-300 text-sm">{selected.description}</p>
              </div>
            )}

            {selected.photo && (
              <div className="bg-gray-800 rounded-xl p-4 mb-6">
                <p className="text-xs text-gray-400 mb-2">Photo</p>
                <img src={selected.photo} alt="Provider" className="w-24 h-24 object-cover rounded-lg" />
              </div>
            )}

            {selected.verificationStatus === 'pending' && (
              <div className="flex gap-3">
                <button onClick={function() { verify(selected._id, 'approved'); }}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-medium transition-colors">
                  <CheckCircle size={18} /> Approuver
                </button>
                <button onClick={function() { verify(selected._id, 'rejected'); }}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-medium transition-colors">
                  <XCircle size={18} /> Rejeter
                </button>
              </div>
            )}

            {selected.verificationStatus === 'approved' && (
              <button onClick={function() { verify(selected._id, 'rejected'); }}
                className="w-full flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 py-3 rounded-xl font-medium transition-colors">
                <XCircle size={18} /> Suspendre
              </button>
            )}

            {selected.verificationStatus === 'rejected' && (
              <button onClick={function() { verify(selected._id, 'approved'); }}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 py-3 rounded-xl font-medium transition-colors">
                <CheckCircle size={18} /> Reactiver
              </button>
            )}
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">TeranGO Services</h1>
          <p className="text-gray-400 text-sm mt-1">Gestion des prestataires</p>
        </div>
      </div>

      {/* STATS */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-gray-400 text-xs">Total Prestataires</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.providers.total}</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-gray-400 text-xs">En attente</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.providers.pending}</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-gray-400 text-xs">Approuves</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.providers.approved}</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <p className="text-gray-400 text-xs">En ligne</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">{stats.providers.online}</p>
          </div>
        </div>
      )}

      {/* FILTERS */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder="Rechercher..." value={search} onChange={function(e) { setSearch(e.target.value); }}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none" />
        </div>
        <select value={filter} onChange={function(e) { setFilter(e.target.value); }}
          className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none">
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="approved">Approuves</option>
          <option value="rejected">Rejetes</option>
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
        <div className="text-center py-20 text-gray-500">Aucun prestataire trouve</div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase">Prestataire</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase">Categories</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase">Zones</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase">Note</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase">Missions</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase">Statut</th>
                <th className="text-right px-6 py-4 text-xs font-medium text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(function(p) {
                return (
                  <tr key={p._id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {p.photo ? (
                          <img src={p.photo} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-emerald-400/10 flex items-center justify-center">
                            <Wrench size={18} className="text-emerald-400" />
                          </div>
                        )}
                        <div>
                          <p className="text-white text-sm font-medium">{p.fullName}</p>
                          <p className="text-gray-500 text-xs">{p.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(p.serviceCategories || []).slice(0, 2).map(function(cat) {
                          return <span key={cat} className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-300">{categoryLabels[cat] || cat}</span>;
                        })}
                        {(p.serviceCategories || []).length > 2 && (
                          <span className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-500">+{p.serviceCategories.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(p.zones || []).slice(0, 2).map(function(z) {
                          return <span key={z} className="text-xs text-gray-400">{z}</span>;
                        })}
                        {(p.zones || []).length > 2 && <span className="text-xs text-gray-500">+{p.zones.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-yellow-400 text-sm">{'★'} {(p.rating || 5).toFixed(1)}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-300 text-sm">{p.totalJobs || 0}</td>
                    <td className="px-6 py-4">
                      <span className={'inline-block px-3 py-1 rounded-full text-xs font-medium ' + (statusColors[p.verificationStatus] || '')}>
                        {statusLabels[p.verificationStatus] || p.verificationStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={function() { setSelected(p); }}
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
