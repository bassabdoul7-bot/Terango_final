import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';

export default function LoginPage() {
  var [email, setEmail] = useState('');
  var [password, setPassword] = useState('');
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState('');
  var { login } = useAuth();
  var navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    authService.login(email, password).then(function(res) {
      if (res.success) {
        login(res.token, res.user);
        navigate('/');
      } else {
        setError(res.message || 'Erreur de connexion');
        setLoading(false);
      }
    }).catch(function(err) {
      setError(err.message || 'Identifiants invalides');
      setLoading(false);
    });
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-emerald-400 mb-2">TeranGO</h1>
          <p className="text-gray-500">Panneau d'administration</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
          <h2 className="text-xl font-semibold text-white mb-6">Connexion</h2>
          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-red-400 text-sm">{error}</div>}
          <form onSubmit={handleSubmit}>
            <label className="block text-sm text-gray-400 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={function(e) { setEmail(e.target.value); }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white mb-4 focus:outline-none focus:border-emerald-500"
              placeholder="admin@terango.sn"
              required
            />
            <label className="block text-sm text-gray-400 mb-2">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={function(e) { setPassword(e.target.value); }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white mb-6 focus:outline-none focus:border-emerald-500"
              placeholder="••••••••"
              required
            />
            <button type="submit" disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
