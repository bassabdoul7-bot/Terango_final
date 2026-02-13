import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { CheckCircle, XCircle, Search, ChevronLeft, ChevronRight, Eye, X, AlertTriangle } from 'lucide-react';

var statusColors = {
  approved: 'text-emerald-400 bg-emerald-400/10',
  pending: 'text-yellow-400 bg-yellow-400/10',
  rejected: 'text-red-400 bg-red-400/10'
};

var statusLabels = {
  approved: 'Approuve',
  pending: 'En attente',
  rejected: 'Rejete'
};

export default function DriversPage() {
  var [drivers, setDrivers] = useState([]);
  var [loading, setLoading] = useState(true);
  var [filter, setFilter] = useState('');
  var [page, setPage] = useState(1);
  var [totalPages, setTotalPages] = useState(1);
  var [search, setSearch] = useState('');
  var [selectedDriver, setSelectedDriver] = useState(null);
  var [viewingImage, setViewingImage] = useState(null);

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
      setSelectedDriver(null);
    });
  }

  var filtered = drivers.filter(function(d) {
    if (!search) return true;
    var name = (d.userId && d.userId.name) || '';
    var phone = (d.userId && d.userId.phone) || '';
    return name.toLowerCase().includes(search.toLowerCase()) || phone.includes(search);
  });

  function isExpired(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    var d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR');
  }

  function renderDocumentModal() {
    if (!selectedDriver) return null;
    var d = selectedDriver;
    var name = (d.userId && d.userId.name) || 'N/A';
    var phone = (d.userId && d.userId.phone) || 'N/A';
    var email = (d.userId && d.userId.email) || 'N/A';
    var vehicle = d.vehicle || {};
    var expired = isExpired(d.licenseExpiryDate);

    return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={function() { setSelectedDriver(null); }}>
        <div className="bg-gray-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-700" onClick={function(e) { e.stopPropagation(); }}>
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <div>
              <h2 className="text-xl font-bold text-white">{name}</h2>
              <p className="text-gray-400 text-sm">{phone} | {email}</p>
            </div>
            <button onClick={function() { setSelectedDriver(null); }} className="p-2 rounded-lg hover:bg-gray-800">
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          <div className="p-6">
            {(d.selfiePhoto || d.nationalIdPhoto) && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Verification d'identite</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-2">Selfie</p>
                    {d.selfiePhoto ? (
                      <img src={d.selfiePhoto} alt="Selfie" className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-80"
                        onClick={function() { setViewingImage(d.selfiePhoto); }} />
                    ) : (
                      <div className="w-full h-48 rounded-lg bg-gray-700 flex items-center justify-center">
                        <span className="text-gray-500 text-sm">Non soumis</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-gray-800 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-2">Carte d'Identite (CNI)</p>
                    {d.nationalIdPhoto ? (
                      <img src={d.nationalIdPhoto} alt="CNI" className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-80"
                        onClick={function() { setViewingImage(d.nationalIdPhoto); }} />
                    ) : (
                      <div className="w-full h-48 rounded-lg bg-gray-700 flex items-center justify-center">
                        <span className="text-gray-500 text-sm">Non soumis</span>
                      </div>
                    )}
                  </div>
                </div>
                {d.nationalId && (
                  <div className="mt-2 bg-gray-800 rounded-lg p-3">
                    <span className="text-xs text-gray-500">Numero CNI: </span>
                    <span className="text-white font-mono">{d.nationalId}</span>
                  </div>
                )}
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Permis de conduire</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-xl p-3">
                  {d.driverLicensePhoto ? (
                    <img src={d.driverLicensePhoto} alt="Permis" className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-80"
                      onClick={function() { setViewingImage(d.driverLicensePhoto); }} />
                  ) : (
                    <div className="w-full h-48 rounded-lg bg-gray-700 flex items-center justify-center">
                      <span className="text-gray-500 text-sm">Non soumis</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="bg-gray-800 rounded-lg p-3">
                    <span className="text-xs text-gray-500">Numero du permis</span>
                    <p className="text-white font-mono">{d.driverLicense || '-'}</p>
                  </div>
                  <div className={'rounded-lg p-3 ' + (expired ? 'bg-red-900/30 border border-red-500/30' : 'bg-gray-800')}>
                    <span className="text-xs text-gray-500">Date d'expiration</span>
                    <div className="flex items-center gap-2">
                      <p className={expired ? 'text-red-400 font-bold' : 'text-white'}>{formatDate(d.licenseExpiryDate)}</p>
                      {expired && <AlertTriangle size={16} className="text-red-400" />}
                    </div>
                    {expired && <p className="text-red-400 text-xs mt-1">PERMIS EXPIRE</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Vehicule</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-gray-800 rounded-lg p-3">
                  <span className="text-xs text-gray-500">Marque</span>
                  <p className="text-white">{vehicle.make || '-'}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <span className="text-xs text-gray-500">Modele</span>
                  <p className="text-white">{vehicle.model || '-'}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <span className="text-xs text-gray-500">Plaque</span>
                  <p className="text-white font-mono">{vehicle.licensePlate || '-'}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <span className="text-xs text-gray-500">Couleur / Annee</span>
                  <p className="text-white">{(vehicle.color || '-') + ' / ' + (vehicle.year || '-')}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-2">Carte grise</p>
                  {vehicle.registrationPhoto ? (
                    <img src={vehicle.registrationPhoto} alt="Carte grise" className="w-full h-40 object-cover rounded-lg cursor-pointer hover:opacity-80"
                      onClick={function() { setViewingImage(vehicle.registrationPhoto); }} />
                  ) : (
                    <div className="w-full h-40 rounded-lg bg-gray-700 flex items-center justify-center">
                      <span className="text-gray-500 text-sm">Non soumis</span>
                    </div>
                  )}
                </div>
                <div className="bg-gray-800 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-2">Assurance</p>
                  {vehicle.insurancePhoto ? (
                    <img src={vehicle.insurancePhoto} alt="Assurance" className="w-full h-40 object-cover rounded-lg cursor-pointer hover:opacity-80"
                      onClick={function() { setViewingImage(vehicle.insurancePhoto); }} />
                  ) : (
                    <div className="w-full h-40 rounded-lg bg-gray-700 flex items-center justify-center">
                      <span className="text-gray-500 text-sm">Non soumis</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {d.verificationStatus === 'pending' && (
              <div className="flex gap-3 pt-4 border-t border-gray-800">
                <button onClick={function() { handleVerify(d._id, 'approved'); }}
                  className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2">
                  <CheckCircle size={18} /> Approuver
                </button>
                <button onClick={function() { handleVerify(d._id, 'rejected'); }}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors flex items-center justify-center gap-2">
                  <XCircle size={18} /> Rejeter
                </button>
              </div>
            )}
            {d.verificationStatus === 'approved' && (
              <div className="pt-4 border-t border-gray-800 text-center">
                <span className="px-4 py-2 rounded-full bg-emerald-400/10 text-emerald-400 font-medium">Chauffeur approuve</span>
              </div>
            )}
            {d.verificationStatus === 'rejected' && (
              <div className="flex gap-3 pt-4 border-t border-gray-800 items-center">
                <span className="px-4 py-2 rounded-full bg-red-400/10 text-red-400 font-medium">Rejete</span>
                {d.rejectionReason && <span className="text-gray-400 text-sm">Raison: {d.rejectionReason}</span>}
                <button onClick={function() { handleVerify(d._id, 'approved'); }}
                  className="ml-auto px-6 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 font-medium hover:bg-emerald-500/20">
                  Reapprouver
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderImageViewer() {
    if (!viewingImage) return null;
    return (
      <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={function() { setViewingImage(null); }}>
        <img src={viewingImage} alt="Document" className="max-w-full max-h-full object-contain rounded-lg" />
        <button onClick={function() { setViewingImage(null); }}
          className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20">
          <X size={24} className="text-white" />
        </button>
      </div>
    );
  }

  return (
    <div>
      {renderDocumentModal()}
      {renderImageViewer()}

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
          placeholder="Rechercher par nom ou telephone..." />
      </div>

      {loading ? <div className="text-gray-500 text-center py-10">Chargement...</div> : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">CHAUFFEUR</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">TELEPHONE</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">VEHICULE</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">DOCS</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">STATUT</th>
                <th className="text-right text-xs text-gray-500 font-medium px-6 py-4">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(function(driver) {
                var name = (driver.userId && driver.userId.name) || 'N/A';
                var phone = (driver.userId && driver.userId.phone) || 'N/A';
                var vehicle = driver.vehicle ? (driver.vehicle.make || '') + ' ' + (driver.vehicle.model || '') : 'N/A';
                var status = driver.verificationStatus || 'pending';
                var hasId = !!driver.nationalIdPhoto;
                var hasLicense = !!driver.driverLicensePhoto;
                var hasSelfie = !!driver.selfiePhoto;
                var docCount = (hasId ? 1 : 0) + (hasLicense ? 1 : 0) + (hasSelfie ? 1 : 0);

                return (
                  <tr key={driver._id} className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                    onClick={function() { setSelectedDriver(driver); }}>
                    <td className="px-6 py-4 text-white font-medium">{name}</td>
                    <td className="px-6 py-4 text-gray-400">{phone}</td>
                    <td className="px-6 py-4 text-gray-400">{vehicle.trim() || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={'text-xs font-medium ' + (docCount >= 3 ? 'text-emerald-400' : docCount > 0 ? 'text-yellow-400' : 'text-gray-500')}>
                        {docCount}/3
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={'px-3 py-1 rounded-full text-xs font-medium ' + (statusColors[status] || '')}>{statusLabels[status] || status}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={function(e) { e.stopPropagation(); setSelectedDriver(driver); }}
                          className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors">
                          <Eye size={18} />
                        </button>
                        {status === 'pending' && (
                          <>
                            <button onClick={function(e) { e.stopPropagation(); handleVerify(driver._id, 'approved'); }}
                              className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                              <CheckCircle size={18} />
                            </button>
                            <button onClick={function(e) { e.stopPropagation(); handleVerify(driver._id, 'rejected'); }}
                              className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
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