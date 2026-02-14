import { useState, useEffect } from 'react';
import { partnerService } from '../services/api';
import { Car, Plus, X, CheckCircle, Clock, XCircle, Upload, FileText } from 'lucide-react';

var API_URL = 'https://terango-api.fly.dev/api';

export default function PartnerDriversPage() {
  var [drivers, setDrivers] = useState([]);
  var [loading, setLoading] = useState(true);
  var [showModal, setShowModal] = useState(false);
  var [showUploadModal, setShowUploadModal] = useState(null);
  var [creating, setCreating] = useState(false);
  var [uploading, setUploading] = useState(false);
  var [error, setError] = useState('');
  var [success, setSuccess] = useState('');
  var [form, setForm] = useState({ name: '', phone: '', pin: '', vehicleType: 'car' });
  var [docForm, setDocForm] = useState({
    vehicleType: 'car', vehicleMake: '', licensePlate: '',
    selfie: null, nationalId: null, driverLicense: null, vehicleRegistration: null
  });
  var [previews, setPreviews] = useState({ selfie: null, nationalId: null, driverLicense: null, vehicleRegistration: null });

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

  function handleDocChange(field, value) {
    setDocForm(function(prev) {
      var next = Object.assign({}, prev);
      next[field] = value;
      return next;
    });
  }

  function handleFileSelect(field, e) {
    var file = e.target.files[0];
    if (file) {
      handleDocChange(field, file);
      var reader = new FileReader();
      reader.onload = function(ev) {
        setPreviews(function(prev) {
          var next = Object.assign({}, prev);
          next[field] = ev.target.result;
          return next;
        });
      };
      reader.readAsDataURL(file);
    }
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

  function handleUploadDocs(e) {
    e.preventDefault();
    if (!docForm.selfie && !docForm.nationalId && !docForm.driverLicense) {
      setError('Veuillez selectionner au moins un document');
      return;
    }
    setUploading(true);
    setError('');

    var formData = new FormData();
    formData.append('vehicleType', docForm.vehicleType);
    if (docForm.vehicleMake) formData.append('vehicleMake', docForm.vehicleMake);
    if (docForm.licensePlate) formData.append('licensePlate', docForm.licensePlate);
    if (docForm.selfie) formData.append('selfie', docForm.selfie);
    if (docForm.nationalId) formData.append('nationalId', docForm.nationalId);
    if (docForm.driverLicense) formData.append('driverLicense', docForm.driverLicense);
    if (docForm.vehicleRegistration) formData.append('vehicleRegistration', docForm.vehicleRegistration);

    var token = localStorage.getItem('admin_token');
    fetch(API_URL + '/partners/drivers/' + showUploadModal.id + '/upload-documents', {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + token },
      body: formData
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) {
        setSuccess('Documents soumis avec succes');
        setShowUploadModal(null);
        setDocForm({ vehicleType: 'car', vehicleMake: '', licensePlate: '', selfie: null, nationalId: null, driverLicense: null, vehicleRegistration: null });
        setPreviews({ selfie: null, nationalId: null, driverLicense: null, vehicleRegistration: null });
        loadDrivers();
      } else {
        setError(data.message || 'Erreur upload');
      }
      setUploading(false);
    })
    .catch(function() {
      setError('Erreur de connexion');
      setUploading(false);
    });
  }

  function statusBadge(status) {
    if (status === 'approved') return <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle size={14} /> Approuve</span>;
    if (status === 'pending') return <span className="flex items-center gap-1 text-yellow-400 text-xs"><Clock size={14} /> En attente</span>;
    return <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle size={14} /> Rejete</span>;
  }

  function fileInput(label, field, required) {
    return (
      <div>
        <label className="block text-sm text-gray-400 mb-1">{label} {required && '*'}</label>
        {previews[field] ? (
          <div className="relative">
            <img src={previews[field]} alt={label} className="w-full h-32 object-cover rounded-lg border border-gray-700" />
            <button type="button" onClick={function() { handleDocChange(field, null); setPreviews(function(p) { var n = Object.assign({}, p); n[field] = null; return n; }); }}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">X</button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-emerald-500 transition-colors">
            <Upload className="text-gray-500 mb-1" size={18} />
            <span className="text-gray-500 text-xs">Cliquez pour uploader</span>
            <input type="file" accept="image/*" onChange={function(e) { handleFileSelect(field, e); }} className="hidden" />
          </label>
        )}
      </div>
    );
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
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Actions</th>
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
                    <td className="p-4">
                      {d.verificationStatus !== 'approved' && (
                        <button onClick={function() { setShowUploadModal(d); setDocForm({ vehicleType: d.vehicleType || 'car', vehicleMake: '', licensePlate: '', selfie: null, nationalId: null, driverLicense: null, vehicleRegistration: null }); setPreviews({ selfie: null, nationalId: null, driverLicense: null, vehicleRegistration: null }); setError(''); }}
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm">
                          <FileText size={14} /> Documents
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Register Driver Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-md max-h-[90vh] overflow-y-auto">
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
              <p className="text-gray-500 text-xs text-center">Apres l'enregistrement, uploadez les documents du chauffeur</p>
            </form>
          </div>
        </div>
      )}

      {/* Upload Documents Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div>
                <h3 className="text-lg font-semibold text-white">Documents du Chauffeur</h3>
                <p className="text-gray-500 text-sm">{showUploadModal.name}</p>
              </div>
              <button onClick={function() { setShowUploadModal(null); }} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleUploadDocs} className="p-6 space-y-4">
              {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{error}</div>}

              <div>
                <label className="block text-sm text-gray-400 mb-1">Type de vehicule</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={function() { handleDocChange('vehicleType', 'car'); }}
                    className={'p-3 rounded-lg border text-center transition-colors ' + (docForm.vehicleType === 'car' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-gray-700 text-gray-400')}>
                    Voiture
                  </button>
                  <button type="button" onClick={function() { handleDocChange('vehicleType', 'moto'); }}
                    className={'p-3 rounded-lg border text-center transition-colors ' + (docForm.vehicleType === 'moto' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-gray-700 text-gray-400')}>
                    Moto
                  </button>
                </div>
              </div>

              <hr className="border-gray-800" />
              <p className="text-gray-400 text-sm font-medium">Photos requises</p>

              <div className="grid grid-cols-2 gap-3">
                {fileInput('Selfie', 'selfie', true)}
                {fileInput('CNI (Carte Nationale)', 'nationalId', true)}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {fileInput('Permis de conduire', 'driverLicense', true)}
                {docForm.vehicleType === 'car' && fileInput('Carte grise', 'vehicleRegistration', false)}
              </div>

              <hr className="border-gray-800" />
              <p className="text-gray-400 text-sm font-medium">Informations vehicule</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Marque / Modele</label>
                  <input type="text" value={docForm.vehicleMake} onChange={function(e) { handleDocChange('vehicleMake', e.target.value); }}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Ex: Toyota Corolla" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Plaque {docForm.vehicleType === 'moto' && '(optionnel)'}</label>
                  <input type="text" value={docForm.licensePlate} onChange={function(e) { handleDocChange('licensePlate', e.target.value); }}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                    placeholder="AA-1234-BB" />
                </div>
              </div>

              <button type="submit" disabled={uploading} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50">
                {uploading ? 'Envoi en cours...' : 'Soumettre les Documents'}
              </button>
              <p className="text-gray-500 text-xs text-center">L'administrateur examinera les documents</p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
