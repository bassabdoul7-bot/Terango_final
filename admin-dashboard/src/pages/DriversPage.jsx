import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { CheckCircle, XCircle, Search, ChevronLeft, ChevronRight, Eye, X } from 'lucide-react';

var statusColors = {
  approved: 'text-emerald-400 bg-emerald-400/10',
  pending: 'text-yellow-400 bg-yellow-400/10',
  rejected: 'text-red-400 bg-red-400/10'
};
var statusLabels = { approved: 'Approuve', pending: 'En attente', rejected: 'Rejete' };

export default function DriversPage() {
  var [drivers, setDrivers] = useState([]);
  var [loading, setLoading] = useState(true);
  var [filter, setFilter] = useState('');
  var [page, setPage] = useState(1);
  var [totalPages, setTotalPages] = useState(1);
  var [search, setSearch] = useState('');
  var [selected, setSelected] = useState(null);
  var [bigImage, setBigImage] = useState(null);

  function load() {
    setLoading(true);
    var params = { page: page, limit: 15 };
    if (filter) params.status = filter;
    adminService.getDrivers(params).then(function(res) {
      setDrivers(res.drivers || []);
      setTotalPages(res.totalPages || 1);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }

  useEffect(function() { load(); }, [filter, page]);

  function verify(id, status) {
    var reason = status === 'rejected' ? prompt('Raison du rejet:') : '';
    if (status === 'rejected' && !reason) return;
    adminService.verifyDriver(id, status, reason).then(function() {
      load();
      setSelected(null);
    });
  }

  var filtered = drivers.filter(function(d) {
    if (!search) return true;
    var n = (d.userId && d.userId.name) || '';
    var p = (d.userId && d.userId.phone) || '';
    return n.toLowerCase().includes(search.toLowerCase()) || p.includes(search);
  });

  function DocImage({ label, url }) {
    return (
      <div className="bg-gray-800 rounded-xl p-3">
        <p className="text-xs text-gray-400 mb-2">{label}</p>
        {url ? (
          <img src={url} alt={label} className="w-full h-44 object-cover rounded-lg cursor-pointer hover:opacity-80 transition"
            onClick={function() { setBigImage(url); }} />
        ) : (
          <div className="w-full h-44 rounded-lg bg-gray-700 flex items-center justify-center">
            <span className="text-gray-500 text-sm">Non soumis</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* FULL IMAGE VIEWER */}
      {bigImage && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={function() { setBigImage(null); }}>
          <img src={bigImage} alt="Doc" className="max-w-full max-h-full object-contain rounded-lg" />
          <button onClick={function() { setBigImage(null); }} className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20">
            <X size={24} className="text-white" />
          </button>
        </div>
      )}

      {/* DRIVER DETAIL MODAL */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={function() { setSelected(null); }}>
          <div className="bg-gray-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-700" onClick={function(e) { e.stopPropagation(); }}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selected.vehicleType === 'moto' ? '🏍️' : '🚗'}</span>
                <div>
                  <h2 className="text-xl font-bold text-white">{(selected.userId && selected.userId.name) || 'N/A'}</h2>
                  <p className="text-gray-400 text-sm">{(selected.userId && selected.userId.phone) || ''} | {selected.vehicleType === 'moto' ? 'Moto / Jakarta' : 'Voiture'}</p>
                </div>
              </div>
              <button onClick={function() { setSelected(null); }} className="p-2 rounded-lg hover:bg-gray-800">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="p-6">
              {/* Identity check: selfie vs CNI side by side */}
              <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Verification d'identite</h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <DocImage label="Selfie" url={selected.selfiePhoto} />
                <DocImage label="Carte d'Identite (CNI)" url={selected.nationalIdPhoto} />
              </div>

              {/* License */}
              <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Permis de conduire</h3>
              <div className="grid grid-cols-1 mb-6">
                <DocImage label="Permis" url={selected.driverLicensePhoto} />
              </div>

              {/* Vehicle */}
              <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Vehicule</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-800 rounded-lg p-3">
                  <span className="text-xs text-gray-500">Type</span>
                  <p className="text-white">{selected.vehicleType === 'moto' ? 'Moto / Jakarta' : 'Voiture'}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <span className="text-xs text-gray-500">Marque</span>
                  <p className="text-white">{(selected.vehicle && selected.vehicle.make) || '-'}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <span className="text-xs text-gray-500">Plaque</span>
                  <p className="text-white font-mono">{(selected.vehicle && selected.vehicle.licensePlate) || 'Non fournie'}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <span className="text-xs text-gray-500">Carte grise</span>
                  <p className="text-white">{(selected.vehicle && selected.vehicle.registrationPhoto) ? 'Soumise' : 'Non soumise'}</p>
                </div>
              </div>
              {selected.vehicle && selected.vehicle.registrationPhoto && (
                <DocImage label="Carte grise" url={selected.vehicle.registrationPhoto} />
              )}

              {/* Actions */}
              <div className="mt-6 pt-4 border-t border-gray-800">
                {selected.verificationStatus === 'pending' && (
                  <div className="flex gap-3">
                    <button onClick={function() { verify(selected._id, 'approved'); }}
                      className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 flex items-center justify-center gap-2">
                      <CheckCircle size={18} /> Approuver
                    </button>
                    <button onClick={function() { verify(selected._id, 'rejected'); }}
                      className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 flex items-center justify-center gap-2">
                      <XCircle size={18} /> Rejeter
                    </button>
                  </div>
                )}
                {selected.verificationStatus === 'approved' && (
                  <div className="text-center">
                    <span className="px-4 py-2 rounded-full bg-emerald-400/10 text-emerald-400 font-medium">Approuve</span>
                  </div>
                )}
                {selected.verificationStatus === 'rejected' && (
                  <div className="flex items-center gap-3">
                    <span className="px-4 py-2 rounded-full bg-red-400/10 text-red-400 font-medium">Rejete</span>
                    <button onClick={function() { verify(selected._id, 'approved'); }}
                      className="ml-auto px-6 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 font-medium hover:bg-emerald-500/20">
                      Reapprouver
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAGE HEADER */}
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

      {/* SEARCH */}
      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-3 text-gray-500" />
        <input value={search} onChange={function(e) { setSearch(e.target.value); }}
          className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
          placeholder="Rechercher par nom ou telephone..." />
      </div>

      {/* TABLE */}
      {loading ? <div className="text-gray-500 text-center py-10">Chargement...</div> : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">CHAUFFEUR</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">TELEPHONE</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">TYPE</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">VEHICULE</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">DOCS</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">STATUT</th>
                <th className="text-right text-xs text-gray-500 font-medium px-6 py-4">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(function(d) {
                var name = (d.userId && d.userId.name) || 'N/A';
                var phone = (d.userId && d.userId.phone) || 'N/A';
                var veh = d.vehicle ? (d.vehicle.make || '') : '-';
                var st = d.verificationStatus || 'pending';
                var docs = (d.selfiePhoto ? 1 : 0) + (d.nationalIdPhoto ? 1 : 0) + (d.driverLicensePhoto ? 1 : 0);

                return (
                  <tr key={d._id} className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                    onClick={function() { setSelected(d); }}>
                    <td className="px-6 py-4 text-white font-medium">{name}</td>
                    <td className="px-6 py-4 text-gray-400">{phone}</td>
                    <td className="px-6 py-4">
                      <span className="text-lg">{d.vehicleType === 'moto' ? '🏍️' : '🚗'}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-400">{veh}</td>
                    <td className="px-6 py-4">
                      <span className={'text-xs font-medium ' + (docs >= 3 ? 'text-emerald-400' : docs > 0 ? 'text-yellow-400' : 'text-gray-500')}>
                        {docs}/3
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={'px-3 py-1 rounded-full text-xs font-medium ' + (statusColors[st] || '')}>{statusLabels[st] || st}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={function(e) { e.stopPropagation(); setSelected(d); }}
                          className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20">
                          <Eye size={18} />
                        </button>
                        {st === 'pending' && (
                          <>
                            <button onClick={function(e) { e.stopPropagation(); verify(d._id, 'approved'); }}
                              className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
                              <CheckCircle size={18} />
                            </button>
                            <button onClick={function(e) { e.stopPropagation(); verify(d._id, 'rejected'); }}
                              className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20">
                              <XCircle size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-8 text-gray-500">Aucun chauffeur trouve</div>}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800">
              <button disabled={page <= 1} onClick={function() { setPage(page-1); }}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30">
                <ChevronLeft size={16} /> Precedent
              </button>
              <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={function() { setPage(page+1); }}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30">
                Suivant <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}