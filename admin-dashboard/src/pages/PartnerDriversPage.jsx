import { useState, useEffect } from 'react';
import { partnerService } from '../services/api';
import { Car, Plus, X, CheckCircle, Clock, XCircle } from 'lucide-react';

export default function PartnerDriversPage() {
  var [drivers, setDrivers] = useState([]);
  var [loading, setLoading] = useState(true);
  var [showModal, setShowModal] = useState(false);
  var [creating, setCreating] = useState(false);
  var [error, setError] = useState('');
  var [success, setSuccess] = useState('');
  var [form, setForm] = useState({ name: '', phone: '', pin: '', vehicleType: 'car' });

  useEffect(function() { loadDrivers(); }, []);

  function loadDrivers() {
    setLoading(true);
    partnerService.getDrivers().then(function(res) {
      if (res.success) setDrivers(res.drivers);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }

  function handleChange(field, value) {
    setForm(function(prev) {
      var next = Object.assign({}, prev);
      next[field] = value;
      return next;
    });
  }

  function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    setSuccess('');
    partnerService.registerDriver(form).then(function(res) {
      if (res.success) {
        setSuccess('Chauffeur enregistre avec succes');
        setShowModal(false);
        setForm({ name: '', phone: '', pin: '', vehicleType: 'car' });
        loadDrivers();
      }
      setCreating(false);
    }).catch(function(err) {
      setError(err.message || 'Erreur');
      setCreating(false);
    });
  }

  function statusBadge(status) {
    if (status === 'approved') return <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle size={14} /> Approuve</span>;
    if (status === 'pending') return <span className="flex items-center gap-1 text-yellow-400 text-xs"><Clock size={14} /> En attente</span>;
    return <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle size={14} /> Rejete</span>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Mes Chauffeurs</h1>
          <p className="text-gray-500 mt-1">{drivers.length} chauffeur{drivers.length !== 1 ? 's' : ''} enregistre{drivers.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={function() { setShowModal(true); setError(''); setSuccess(''); }} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors">
          <Plus size={18} />
          Ajouter un Chauffeur
        </button>
      </div>

      {success && <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-4 text-emerald-400 text-sm">{success}</div>}

      <div className="bg-gray-900 rounded-xl border border-gray-800">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : drivers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucun chauffeur. Ajoutez votre premier chauffeur.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Chauffeur</th>
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Vehicule</th>
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Statut</th>
                <th className="text-left p-4 text-gray-400 text-sm font-medium">En ligne</th>
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Courses</th>
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Revenus</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map(function(d) {
                return (
                  <tr key={d.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="p-4">
                      <p className="text-white font-medium">{d.name}</p>
                      <p className="text-gray-500 text-xs">{d.phone}</p>
                    </td>
                    <td className="p-4">
                      <span className="text-gray-300 text-sm">{d.vehicleType === 'car' ? 'Voiture' : 'Moto'}</span>
                    </td>
                    <td className="p-4">{statusBadge(d.verificationStatus)}</td>
                    <td className="p-4">
                      <span className={'w-2 h-2 rounded-full inline-block ' + (d.isOnline ? 'bg-emerald-400' : 'bg-gray-600')}></span>
                    </td>
                    <td className="p-4 text-gray-300">{d.totalRides || 0}</td>
                    <td className="p-4 text-emerald-400 font-medium">{(d.totalEarnings || 0).toLocaleString()} FCFA</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h3 className="text-lg font-semibold text-white">Nouveau Chauffeur</h3>
              <button onClick={function() { setShowModal(false); }} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nom complet *</label>
                <input type="text" value={form.name} onChange={function(e) { handleChange('name', e.target.value); }} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500" required />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Telephone *</label>
                <input type="tel" value={form.phone} onChange={function(e) { handleChange('phone', e.target.value); }} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500" placeholder="+221 7X XXX XX XX" required />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Code PIN (4 chiffres) *</label>
                <input type="text" maxLength={4} value={form.pin} onChange={function(e) { handleChange('pin', e.target.value); }} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 tracking-widest text-center text-xl" placeholder="****" required />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Type de vehicule</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={function() { handleChange('vehicleType', 'car'); }}
                    className={'p-3 rounded-lg border text-center transition-colors ' + (form.vehicleType === 'car' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-gray-700 text-gray-400 hover:border-gray-600')}>
                    Voiture
                  </button>
                  <button type="button" onClick={function() { handleChange('vehicleType', 'moto'); }}
                    className={'p-3 rounded-lg border text-center transition-colors ' + (form.vehicleType === 'moto' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-gray-700 text-gray-400 hover:border-gray-600')}>
                    Moto
                  </button>
                </div>
              </div>
              <button type="submit" disabled={creating} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 mt-2">
                {creating ? 'Enregistrement...' : 'Enregistrer le Chauffeur'}
              </button>
              <p className="text-gray-500 text-xs text-center">Le chauffeur devra completer ses documents dans l'application</p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
