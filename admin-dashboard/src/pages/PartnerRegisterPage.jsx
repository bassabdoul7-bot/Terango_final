import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Upload, CheckCircle, ArrowLeft } from 'lucide-react';

var API_URL = 'https://terango-api.fly.dev/api';

export default function PartnerRegisterPage() {
  var [form, setForm] = useState({
    name: '', phone: '', email: '', password: '', confirmPassword: '',
    businessName: '', businessAddress: ''
  });
  var [idPhoto, setIdPhoto] = useState(null);
  var [idPreview, setIdPreview] = useState(null);
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState('');
  var [success, setSuccess] = useState(false);
  var navigate = useNavigate();

  function handleChange(field, value) {
    setForm(function(prev) {
      var next = Object.assign({}, prev);
      next[field] = value;
      return next;
    });
  }

  function handleFileChange(e) {
    var file = e.target.files[0];
    if (file) {
      setIdPhoto(file);
      var reader = new FileReader();
      reader.onload = function(ev) { setIdPreview(ev.target.result); };
      reader.readAsDataURL(file);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (form.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caracteres');
      return;
    }
    if (!idPhoto) {
      setError('Veuillez uploader votre piece d\'identite (CNI)');
      return;
    }

    setLoading(true);

    var formData = new FormData();
    formData.append('name', form.name);
    formData.append('phone', form.phone);
    formData.append('email', form.email);
    formData.append('password', form.password);
    formData.append('businessName', form.businessName || form.name);
    formData.append('businessAddress', form.businessAddress);
    formData.append('idPhoto', idPhoto);

    fetch(API_URL + '/auth/register-partner', {
      method: 'POST',
      body: formData
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.message || 'Erreur lors de l\'inscription');
      }
      setLoading(false);
    })
    .catch(function() {
      setError('Erreur de connexion au serveur');
      setLoading(false);
    });
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-emerald-400" size={32} />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Inscription reussie !</h2>
            <p className="text-gray-400 mb-6">
              Votre compte partenaire est en attente de validation par l'administrateur.
              Vous recevrez un acces des que votre compte sera approuve.
            </p>
            <Link to="/login" className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors">
              Retour a la connexion
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-emerald-400 mb-2">TeranGO</h1>
          <p className="text-gray-500">Inscription Partenaire</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
          <div className="flex items-center gap-2 mb-6">
            <Link to="/login" className="text-gray-400 hover:text-white"><ArrowLeft size={20} /></Link>
            <h2 className="text-xl font-semibold text-white">Creer votre compte</h2>
          </div>

          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-red-400 text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nom complet *</label>
              <input type="text" value={form.name} onChange={function(e) { handleChange('name', e.target.value); }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500" required />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Telephone *</label>
              <input type="tel" value={form.phone} onChange={function(e) { handleChange('phone', e.target.value); }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                placeholder="+221 7X XXX XX XX" required />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email *</label>
              <input type="email" value={form.email} onChange={function(e) { handleChange('email', e.target.value); }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Mot de passe *</label>
                <input type="password" value={form.password} onChange={function(e) { handleChange('password', e.target.value); }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500" required />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Confirmer *</label>
                <input type="password" value={form.confirmPassword} onChange={function(e) { handleChange('confirmPassword', e.target.value); }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500" required />
              </div>
            </div>

            <hr className="border-gray-800" />

            <div>
              <label className="block text-sm text-gray-400 mb-1">Nom de l'entreprise (optionnel)</label>
              <input type="text" value={form.businessName} onChange={function(e) { handleChange('businessName', e.target.value); }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                placeholder="Laissez vide si pas d'entreprise" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Adresse</label>
              <input type="text" value={form.businessAddress} onChange={function(e) { handleChange('businessAddress', e.target.value); }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                placeholder="Dakar, Senegal" />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Piece d'identite (CNI) *</label>
              {idPreview ? (
                <div className="relative">
                  <img src={idPreview} alt="CNI" className="w-full h-40 object-cover rounded-lg border border-gray-700" />
                  <button type="button" onClick={function() { setIdPhoto(null); setIdPreview(null); }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600">X</button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-emerald-500 transition-colors">
                  <Upload className="text-gray-500 mb-2" size={24} />
                  <span className="text-gray-500 text-sm">Cliquez pour uploader</span>
                  <span className="text-gray-600 text-xs mt-1">JPG, PNG (max 5MB)</span>
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              )}
            </div>

            <button type="submit" disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Inscription en cours...' : 'S\'inscrire'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-gray-500 text-sm">
              Deja un compte ?{' '}
              <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
