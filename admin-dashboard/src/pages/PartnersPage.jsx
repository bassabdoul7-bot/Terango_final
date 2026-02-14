import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { Handshake, Plus, Users, DollarSign, X } from 'lucide-react';

export default function PartnersPage() {
  var [partners, setPartners] = useState([]);
  var [loading, setLoading] = useState(true);
  var [showModal, setShowModal] = useState(false);
  var [creating, setCreating] = useState(false);
  var [error, setError] = useState('');
  var [success, setSuccess] = useState('');
  var [form, setForm] = useState({
    name: '', phone: '', email: '', pin: '', businessName: '', businessPhone: '', businessAddress: '', commissionRate: 3
  });

  useEffect(function() { loadPartners(); }, []);

  function loadPartners() {
    setLoading(true);
    adminService.getPartners().then(function(res) {
      if (res.success) setPartners(res.partners);
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
    adminService.createPartner(form).then(function(res) {
      if (res.success) {
        setSuccess('Partenaire cree avec succes');
        setShowModal(false);
        setForm({ name: '', phone: '', email: '', pin: '', businessName: '', businessPhone: '', businessAddress: '', commissionRate: 3 });
        loadPartners();
      }
      setCreating(false);
    }).catch(function(err) {
      setError(err.message || 'Erreur lors de la creation');
      setCreating(false);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Partenaires</h1>
          <p className="text-gray-500 mt-1">Gestion des partenaires TeranGO</p>
        </div>
        <button onClick={function() { setShowModal(true); setError(''); setSuccess(''); }} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors">
          <Plus size={18} />
          Nouveau Partenaire
        </button>
      </div>

      {success && <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-4 text-emerald-400 text-sm">{success}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-3 mb-2">
            <Handshake className="text-emerald-400" size={20} />
            <span className="text-gray-400 text-sm">Total Partenaires</span>
          </div>
          <p className="text-2xl font-bold text-white">{partners.length}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-3 mb-2">
            <Users className="text-blue-400" size={20} />
            <span className="text-gray-400 text-sm">Chauffeurs Partenaires</span>
          </div>
          <p className="text-2xl font-bold text-white">{partners.reduce(function(s, p) { return s + (p.totalDrivers || 0); }, 0)}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="text-yellow-400" size={20} />
            <span className="text-gray-400 text-sm">Commission Totale</span>
          </div>
          <p className="text-2xl font-bold text-white">{partners.reduce(function(s, p) { return s + (p.totalEarnings || 0); }, 0).toLocaleString()} FCFA</p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Liste des Partenaires</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : partners.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucun partenaire</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Entreprise</th>
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Contact</th>
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Commission</th>
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Chauffeurs</th>
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Revenus</th>
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {partners.map(function(p) {
                return (
                  <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="p-4">
                      <p className="text-white font-medium">{p.businessName}</p>
                      <p className="text-gray-500 text-xs">{p.name}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-gray-300 text-sm">{p.phone}</p>
                      <p className="text-gray-500 text-xs">{p.email}</p>
                    </td>
                    <td className="p-4 text-yellow-400 font-medium">{p.commissionRate}%</td>
                    <td className="p-4 text-gray-300">{p.totalDrivers || 0}</td>
                    <td className="p-4 text-emerald-400 font-medium">{(p.totalEarnings || 0).toLocaleString()} FCFA</td>
                    <td className="p-4">
                      <span className={'px-2 py-1 rounded-full text-xs font-medium ' + (p.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                        {p.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h3 className="text-lg font-semibold text-white">Nouveau Partenaire</h3>
              <button onClick={function() { setShowModal(false); }} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nom du responsable *</label>
                <input type="text" value={form.name} onChange={function(e) { handleChange('name', e.target.value); }} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500" required />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Telephone *</label>
                <input type="tel" value={form.phone} onChange={function(e) { handleChange('phone', e.target.value); }} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500" placeholder="+221 7X XXX XX XX" required />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input type="email" value={form.email} onChange={function(e) { handleChange('email', e.target.value); }} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Code PIN (4 chiffres) *</label>
                <input type="text" maxLength={4} value={form.pin} onChange={function(e) { handleChange('pin', e.target.value); }} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 tracking-widest text-center text-xl" placeholder="****" required />
              </div>
              <hr className="border-gray-800" />
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nom de l'entreprise *</label>
                <input type="text" value={form.businessName} onChange={function(e) { handleChange('businessName', e.target.value); }} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500" required />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Telephone entreprise</label>
                <input type="tel" value={form.businessPhone} onChange={function(e) { handleChange('businessPhone', e.target.value); }} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Adresse entreprise</label>
                <input type="text" value={form.businessAddress} onChange={function(e) { handleChange('businessAddress', e.target.value); }} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Taux de commission (%)</label>
                <input type="number" min={1} max={10} value={form.commissionRate} onChange={function(e) { handleChange('commissionRate', parseInt(e.target.value) || 3); }} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500" />
              </div>
              <button type="submit" disabled={creating} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 mt-2">
                {creating ? 'Creation...' : 'Creer le Partenaire'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
