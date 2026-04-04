import { useState, useEffect } from 'react';
import { adminService, suspendDriver, banDriver, warnDriver } from '../services/api';
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
  var [warnMsg, setWarnMsg] = useState("");
  var [showWarnInput, setShowWarnInput] = useState(false);
  var [modLoading, setModLoading] = useState(false);
  var [bigImage, setBigImage] = useState(null);
  var [promptModal, setPromptModal] = useState(null); // { title, placeholder, onConfirm }
  var [promptValue, setPromptValue] = useState("");
  var [commissionFilter, setCommissionFilter] = useState(false);

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
    if (status === 'rejected') {
      setPromptValue("");
      setPromptModal({
        title: "Raison du rejet",
        placeholder: "Raison du rejet...",
        onConfirm: function(reason) {
          if (!reason) return;
          adminService.verifyDriver(id, status, reason).then(function() {
            load();
            setSelected(null);
          });
        }
      });
      return;
    }
    adminService.verifyDriver(id, status, '').then(function() {
      load();
      setSelected(null);
    });
  }

  function markPaid(id, name) {
    if (!confirm('Confirmer le paiement de commission pour ' + name + '?')) return;
    adminService.markCommissionPaid(id).then(function(res) {
      alert('Commission de ' + name + ' marquee comme payee!');
      load();
    }).catch(function() { alert('Erreur'); });
  }

  function handleSuspend(id, action) {
    if (action === "suspend") {
      setPromptValue("");
      setPromptModal({
        title: "Raison de la suspension",
        placeholder: "Raison de la suspension...",
        onConfirm: function(reason) {
          if (!reason) return;
          setModLoading(true);
          suspendDriver(id, "suspend", reason).then(function() {
            alert("Chauffeur suspendu");
            setSelected(null); load();
          }).catch(function() { alert("Erreur"); }).finally(function() { setModLoading(false); });
        }
      });
      return;
    }
    setModLoading(true);
    suspendDriver(id, action, null).then(function() {
      alert("Suspension levee");
      setSelected(null); load();
    }).catch(function() { alert("Erreur"); }).finally(function() { setModLoading(false); });
  }

  function handleBan(id) {
    setPromptValue("");
    setPromptModal({
      title: "Raison du bannissement (irreversible)",
      placeholder: "Raison du bannissement...",
      onConfirm: function(reason) {
        if (!reason) return;
        if (!confirm("ATTENTION: Cette action est irreversible. Bannir ce chauffeur?")) return;
        setModLoading(true);
        banDriver(id, reason).then(function() {
          alert("Chauffeur banni"); setSelected(null); load();
        }).catch(function() { alert("Erreur"); }).finally(function() { setModLoading(false); });
      }
    });
  }

  function handleWarn(id) {
    if (!warnMsg.trim()) return;
    setModLoading(true);
    warnDriver(id, warnMsg).then(function() {
      alert("Avertissement envoye"); setWarnMsg(""); setShowWarnInput(false);
    }).catch(function() { alert("Erreur"); }).finally(function() { setModLoading(false); });
  }

  var filtered = drivers.filter(function(d) {
    if (commissionFilter) {
      if (!d.isBlockedForPayment && !(d.commissionBalance > 0)) return false;
    }
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

      {/* PROMPT MODAL */}
      {promptModal && (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4" onClick={function() { setPromptModal(null); }}>
          <div className="bg-gray-900 rounded-2xl w-full max-w-md border border-gray-700 p-6" onClick={function(e) { e.stopPropagation(); }}>
            <h3 className="text-lg font-bold text-white mb-4">{promptModal.title}</h3>
            <input
              autoFocus
              value={promptValue}
              onChange={function(e) { setPromptValue(e.target.value); }}
              onKeyDown={function(e) { if (e.key === 'Enter' && promptValue.trim()) { var cb = promptModal.onConfirm; setPromptModal(null); cb(promptValue.trim()); } }}
              placeholder={promptModal.placeholder}
              className="w-full bg-gray-800 rounded-lg px-4 py-3 text-white border border-gray-700 focus:outline-none focus:border-emerald-500 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={function() { setPromptModal(null); }}
                className="px-4 py-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-gray-700">Annuler</button>
              <button onClick={function() { var cb = promptModal.onConfirm; setPromptModal(null); cb(promptValue.trim()); }}
                disabled={!promptValue.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 disabled:opacity-30">Confirmer</button>
            </div>
          </div>
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

              {/* Commission */}
              {(selected.commissionBalance || 0) > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Commission</h3>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-gray-800 rounded-lg p-3">
                      <span className="text-xs text-gray-500">Solde du</span>
                      <p className={"text-lg font-bold " + (selected.isBlockedForPayment ? "text-red-400" : "text-yellow-400")}>{(selected.commissionBalance || 0).toLocaleString()} FCFA</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <span className="text-xs text-gray-500">Total paye</span>
                      <p className="text-lg font-bold text-emerald-400">{(selected.totalCommissionPaid || 0).toLocaleString()} FCFA</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <span className="text-xs text-gray-500">Statut</span>
                      <p className={"text-lg font-bold " + (selected.isBlockedForPayment ? "text-red-400" : "text-emerald-400")}>{selected.isBlockedForPayment ? "Bloque" : "OK"}</p>
                    </div>
                  </div>
                  {selected.isBlockedForPayment && (
                    <button onClick={function() { markPaid(selected._id, (selected.userId && selected.userId.name) || 'N/A'); }}
                      className="w-full py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600">
                      Marquer comme paye
                    </button>
                  )}
                </div>
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

              {/* Moderation */}
              {selected.verificationStatus === "approved" && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Moderation</h3>
                  {selected.isSuspended && <div className="mb-3 px-3 py-2 rounded-lg bg-orange-500/10 text-orange-400 text-sm">Suspendu: {selected.suspensionReason}</div>}
                  {selected.isBanned && <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">Banni: {selected.banReason}</div>}
                  {selected.totalWarnings > 0 && <div className="mb-3 px-3 py-2 rounded-lg bg-yellow-500/10 text-yellow-400 text-sm">{selected.totalWarnings} avertissement(s)</div>}
                  <div className="flex gap-2 mb-3">
                    {!selected.isSuspended && !selected.isBanned && <button onClick={function(){handleSuspend(selected._id,"suspend");}} disabled={modLoading} className="flex-1 py-2 rounded-lg bg-orange-500/10 text-orange-400 text-sm font-medium hover:bg-orange-500/20 border border-orange-500/20">Suspendre</button>}
                    {selected.isSuspended && <button onClick={function(){handleSuspend(selected._id,"unsuspend");}} disabled={modLoading} className="flex-1 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 border border-emerald-500/20">Lever suspension</button>}
                    {!selected.isBanned && <button onClick={function(){handleBan(selected._id);}} disabled={modLoading} className="flex-1 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 border border-red-500/20">Bannir</button>}
                  </div>
                  {!showWarnInput ? <button onClick={function(){setShowWarnInput(true);}} className="w-full py-2 rounded-lg bg-yellow-500/10 text-yellow-400 text-sm font-medium hover:bg-yellow-500/20 border border-yellow-500/20">Envoyer un avertissement</button> : (
                    <div className="flex gap-2">
                      <input value={warnMsg} onChange={function(e){setWarnMsg(e.target.value);}} placeholder="Message..." className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white border border-gray-700" />
                      <button onClick={function(){handleWarn(selected._id);}} disabled={modLoading || !warnMsg.trim()} className="px-4 py-2 rounded-lg bg-yellow-500 text-black text-sm font-medium hover:bg-yellow-600 disabled:opacity-30">Envoyer</button>
                      <button onClick={function(){setShowWarnInput(false);setWarnMsg("");}} className="px-3 py-2 rounded-lg bg-gray-800 text-gray-400 text-sm hover:bg-gray-700">X</button>
                    </div>
                  )}
                </div>
              )}
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
                className={'px-4 py-2 rounded-lg text-sm font-medium transition-colors ' + (filter === f && !commissionFilter ? 'bg-emerald-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white')}>
                {f === '' ? 'Tous' : statusLabels[f]}
              </button>
            );
          })}
          <button onClick={function() { setCommissionFilter(!commissionFilter); }}
            className={'px-4 py-2 rounded-lg text-sm font-medium transition-colors ' + (commissionFilter ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white')}>
            Commission due
          </button>
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
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">COMMISSION DUE</th>
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
                    <td className="px-6 py-4 text-white font-medium">
                      <div className="flex items-center gap-2">
                        {name}
                        {d.isBlockedForPayment && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" title="Bloque pour paiement"></span>}
                      </div>
                    </td>
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
                    <td className="px-6 py-4">
                      {(d.commissionBalance || 0) > 0 ? (
                        <div className="flex items-center gap-2">
                          <span className={"text-sm font-bold " + ((d.commissionBalance || 0) >= (d.commissionCap || 2000) ? "text-red-400" : "text-yellow-400")}>{(d.commissionBalance || 0).toLocaleString()} F</span>
                          {d.isBlockedForPayment && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Bloque</span>}
                        </div>
                      ) : <span className="text-gray-600 text-sm">0</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={function(e) { e.stopPropagation(); setSelected(d); }}
                          className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20">
                          <Eye size={18} />
                        </button>
                        {d.isBlockedForPayment && (
                          <button onClick={function(e) { e.stopPropagation(); markPaid(d._id, (d.userId && d.userId.name) || 'N/A'); }}
                            className="py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 text-xs font-bold px-4 shadow-lg shadow-emerald-500/20">
                            Marquer paye
                          </button>
                        )}
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