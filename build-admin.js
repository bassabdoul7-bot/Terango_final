var fs = require('fs');
var base = 'C:/Users/bassa/Projects/terango-final/admin-dashboard/src';

// Create directories
['pages','components','services','context'].forEach(function(d) {
  var p = base + '/' + d;
  if (!fs.existsSync(p)) fs.mkdirSync(p, {recursive:true});
});

// 1. API Service
fs.writeFileSync(base + '/services/api.js',
`import axios from 'axios';

const API_URL = 'https://terango-api.fly.dev/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(function(config) {
  var token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = 'Bearer ' + token;
  return config;
});

api.interceptors.response.use(
  function(res) { return res.data; },
  function(err) {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(err.response ? err.response.data : err);
  }
);

export var authService = {
  login: function(phone, otp) { return api.post('/auth/verify-otp', { phone: phone, otp: otp }); },
  sendOTP: function(phone) { return api.post('/auth/send-otp', { phone: phone, mode: 'login' }); }
};

export var adminService = {
  getDashboard: function() { return api.get('/admin/dashboard'); },
  getDrivers: function(params) { return api.get('/admin/drivers', { params: params }); },
  verifyDriver: function(id, status, reason) { return api.put('/admin/drivers/' + id + '/verify', { status: status, reason: reason }); },
  getRides: function(params) { return api.get('/admin/rides', { params: params }); },
  getRiders: function(params) { return api.get('/admin/riders', { params: params }); },
  getRevenue: function(params) { return api.get('/admin/revenue', { params: params }); },
  toggleUserStatus: function(id) { return api.put('/admin/users/' + id + '/status'); },
  approvePhoto: function(id) { return api.put('/admin/users/' + id + '/approve-photo'); },
  rejectPhoto: function(id, reason) { return api.put('/admin/users/' + id + '/reject-photo', { reason: reason }); }
};

export default api;
`, 'utf8');

// 2. Auth Context
fs.writeFileSync(base + '/context/AuthContext.jsx',
`import { createContext, useContext, useState, useEffect } from 'react';

var AuthContext = createContext(null);

export function AuthProvider({ children }) {
  var [token, setToken] = useState(localStorage.getItem('admin_token'));
  var [user, setUser] = useState(null);

  useEffect(function() {
    if (token) {
      try {
        var payload = JSON.parse(atob(token.split('.')[1]));
        setUser(payload);
      } catch(e) {
        setToken(null);
        localStorage.removeItem('admin_token');
      }
    }
  }, [token]);

  function login(t, u) {
    localStorage.setItem('admin_token', t);
    setToken(t);
    setUser(u);
  }

  function logout() {
    localStorage.removeItem('admin_token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
`, 'utf8');

// 3. App.jsx with routing
fs.writeFileSync(base + '/App.jsx',
`import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DriversPage from './pages/DriversPage';
import RidersPage from './pages/RidersPage';
import RidesPage from './pages/RidesPage';
import RevenuePage from './pages/RevenuePage';

function ProtectedRoute({ children }) {
  var { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return children;
}

function AppRoutes() {
  var { isAuthenticated } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="riders" element={<RidersPage />} />
        <Route path="rides" element={<RidesPage />} />
        <Route path="revenue" element={<RevenuePage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
`, 'utf8');

// 4. Layout with sidebar
fs.writeFileSync(base + '/components/Layout.jsx',
`import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Car, Users, MapPin, DollarSign, LogOut } from 'lucide-react';

var links = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/drivers', icon: Car, label: 'Chauffeurs' },
  { to: '/riders', icon: Users, label: 'Passagers' },
  { to: '/rides', icon: MapPin, label: 'Courses' },
  { to: '/revenue', icon: DollarSign, label: 'Revenus' },
];

export default function Layout() {
  var { logout, user } = useAuth();
  var navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-gray-950">
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-2xl font-bold text-emerald-400">TeranGO</h1>
          <p className="text-xs text-gray-500 mt-1">Administration</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {links.map(function(link) {
            var Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={function({ isActive }) {
                  return 'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ' +
                    (isActive ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-400 hover:text-white hover:bg-gray-800');
                }}
              >
                <Icon size={20} />
                {link.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-gray-800 w-full transition-colors">
            <LogOut size={20} />
            D\\u00e9connexion
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
`, 'utf8');

// 5. Login Page
fs.writeFileSync(base + '/pages/LoginPage.jsx',
`import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';

export default function LoginPage() {
  var [phone, setPhone] = useState('+221');
  var [otp, setOtp] = useState('');
  var [step, setStep] = useState('phone');
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState('');
  var { login } = useAuth();
  var navigate = useNavigate();

  function handleSendOTP(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    authService.sendOTP(phone).then(function() {
      setStep('otp');
      setLoading(false);
    }).catch(function(err) {
      setError(err.message || 'Erreur lors de l\\u2019envoi du code');
      setLoading(false);
    });
  }

  function handleVerifyOTP(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    authService.login(phone, otp).then(function(res) {
      if (res.user && res.user.role !== 'admin') {
        setError('Acc\\u00e8s r\\u00e9serv\\u00e9 aux administrateurs');
        setLoading(false);
        return;
      }
      login(res.token, res.user);
      navigate('/');
    }).catch(function(err) {
      setError(err.message || 'Code invalide');
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
          {step === 'phone' ? (
            <form onSubmit={handleSendOTP}>
              <label className="block text-sm text-gray-400 mb-2">Num\\u00e9ro de t\\u00e9l\\u00e9phone</label>
              <input
                type="tel"
                value={phone}
                onChange={function(e) { setPhone(e.target.value); }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white mb-4 focus:outline-none focus:border-emerald-500"
                placeholder="+221 7X XXX XX XX"
              />
              <button type="submit" disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50">
                {loading ? 'Envoi...' : 'Envoyer le code'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP}>
              <p className="text-sm text-gray-400 mb-4">Code envoy\\u00e9 au {phone}</p>
              <input
                type="text"
                value={otp}
                onChange={function(e) { setOtp(e.target.value); }}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-center text-2xl tracking-widest mb-4 focus:outline-none focus:border-emerald-500"
                placeholder="000000"
                maxLength={6}
              />
              <button type="submit" disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50">
                {loading ? 'V\\u00e9rification...' : 'V\\u00e9rifier'}
              </button>
              <button type="button" onClick={function() { setStep('phone'); setOtp(''); }} className="w-full text-gray-500 text-sm mt-3 hover:text-white">
                Changer de num\\u00e9ro
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
`, 'utf8');

// 6. Dashboard Page
fs.writeFileSync(base + '/pages/DashboardPage.jsx',
`import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { Users, Car, MapPin, DollarSign, AlertCircle, Activity } from 'lucide-react';

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <span className={'p-2 rounded-lg bg-opacity-10 ' + color}><Icon size={22} className={color.replace('bg-','text-')} /></span>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-emerald-400 mt-2">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  var [stats, setStats] = useState(null);
  var [loading, setLoading] = useState(true);

  useEffect(function() {
    adminService.getDashboard().then(function(res) {
      setStats(res.stats);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }, []);

  if (loading) return <div className="text-gray-500 text-center mt-20">Chargement...</div>;
  if (!stats) return <div className="text-red-400 text-center mt-20">Erreur de chargement</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Tableau de bord</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard icon={Users} label="Passagers" value={stats.totalRiders} color="bg-blue-500" />
        <StatCard icon={Car} label="Chauffeurs" value={stats.totalDrivers} color="bg-emerald-500" sub={stats.activeDrivers + ' en ligne'} />
        <StatCard icon={MapPin} label="Courses totales" value={stats.totalRides} color="bg-purple-500" sub={stats.todayRides + " aujourd'hui"} />
        <StatCard icon={DollarSign} label="Revenus (FCFA)" value={stats.totalRevenue.toLocaleString()} color="bg-yellow-500" sub={stats.todayRevenue.toLocaleString() + " aujourd'hui"} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={18} className="text-orange-400" />
            <h2 className="text-lg font-semibold text-white">V\\u00e9rifications en attente</h2>
          </div>
          <p className="text-4xl font-bold text-orange-400">{stats.pendingVerifications}</p>
          <p className="text-sm text-gray-500 mt-2">chauffeurs en attente d'approbation</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Activit\\u00e9 en temps r\\u00e9el</h2>
          </div>
          <p className="text-4xl font-bold text-emerald-400">{stats.activeDrivers}</p>
          <p className="text-sm text-gray-500 mt-2">chauffeurs connect\\u00e9s maintenant</p>
        </div>
      </div>
    </div>
  );
}
`, 'utf8');

// 7. Drivers Page
fs.writeFileSync(base + '/pages/DriversPage.jsx',
`import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { CheckCircle, XCircle, Clock, Search, ChevronLeft, ChevronRight } from 'lucide-react';

var statusColors = {
  approved: 'text-emerald-400 bg-emerald-400/10',
  pending: 'text-yellow-400 bg-yellow-400/10',
  rejected: 'text-red-400 bg-red-400/10'
};

var statusLabels = {
  approved: 'Approuv\\u00e9',
  pending: 'En attente',
  rejected: 'Rejet\\u00e9'
};

export default function DriversPage() {
  var [drivers, setDrivers] = useState([]);
  var [loading, setLoading] = useState(true);
  var [filter, setFilter] = useState('');
  var [page, setPage] = useState(1);
  var [totalPages, setTotalPages] = useState(1);
  var [search, setSearch] = useState('');

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
    });
  }

  var filtered = drivers.filter(function(d) {
    if (!search) return true;
    var name = (d.userId && d.userId.name) || '';
    var phone = (d.userId && d.userId.phone) || '';
    return name.toLowerCase().includes(search.toLowerCase()) || phone.includes(search);
  });

  return (
    <div>
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
          placeholder="Rechercher par nom ou t\\u00e9l\\u00e9phone..." />
      </div>

      {loading ? <div className="text-gray-500 text-center py-10">Chargement...</div> : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">CHAUFFEUR</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">T\\u00c9L\\u00c9PHONE</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">V\\u00c9HICULE</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">STATUT</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">NOTE</th>
                <th className="text-right text-xs text-gray-500 font-medium px-6 py-4">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(function(driver) {
                var name = (driver.userId && driver.userId.name) || 'N/A';
                var phone = (driver.userId && driver.userId.phone) || 'N/A';
                var rating = (driver.userId && driver.userId.rating) ? driver.userId.rating.toFixed(1) : '-';
                var vehicle = driver.vehicle ? (driver.vehicle.make || '') + ' ' + (driver.vehicle.model || '') : 'N/A';
                var status = driver.verificationStatus || 'pending';
                return (
                  <tr key={driver._id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-6 py-4 text-white font-medium">{name}</td>
                    <td className="px-6 py-4 text-gray-400">{phone}</td>
                    <td className="px-6 py-4 text-gray-400">{vehicle}</td>
                    <td className="px-6 py-4">
                      <span className={'px-3 py-1 rounded-full text-xs font-medium ' + (statusColors[status] || '')}>{statusLabels[status] || status}</span>
                    </td>
                    <td className="px-6 py-4 text-yellow-400">{rating}</td>
                    <td className="px-6 py-4 text-right">
                      {status === 'pending' && (
                        <div className="flex gap-2 justify-end">
                          <button onClick={function() { handleVerify(driver._id, 'approved'); }} className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                            <CheckCircle size={18} />
                          </button>
                          <button onClick={function() { handleVerify(driver._id, 'rejected'); }} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                            <XCircle size={18} />
                          </button>
                        </div>
                      )}
                      {status === 'approved' && <span className="text-xs text-gray-600">Actif</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-8 text-gray-500">Aucun chauffeur trouv\\u00e9</div>}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800">
              <button disabled={page <= 1} onClick={function() { setPage(page-1); }} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30"><ChevronLeft size={16} /> Pr\\u00e9c\\u00e9dent</button>
              <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={function() { setPage(page+1); }} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30">Suivant <ChevronRight size={16} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
`, 'utf8');

// 8. Riders Page
fs.writeFileSync(base + '/pages/RidersPage.jsx',
`import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { Search, ChevronLeft, ChevronRight, UserX, UserCheck } from 'lucide-react';

export default function RidersPage() {
  var [riders, setRiders] = useState([]);
  var [loading, setLoading] = useState(true);
  var [page, setPage] = useState(1);
  var [totalPages, setTotalPages] = useState(1);
  var [search, setSearch] = useState('');

  function loadRiders() {
    setLoading(true);
    adminService.getRiders({ page: page, limit: 15 }).then(function(res) {
      setRiders(res.riders || []);
      setTotalPages(res.totalPages || 1);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }

  useEffect(function() { loadRiders(); }, [page]);

  function handleToggle(userId) {
    adminService.toggleUserStatus(userId).then(function() { loadRiders(); });
  }

  var filtered = riders.filter(function(r) {
    if (!search) return true;
    var name = (r.userId && r.userId.name) || '';
    var phone = (r.userId && r.userId.phone) || '';
    return name.toLowerCase().includes(search.toLowerCase()) || phone.includes(search);
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Passagers</h1>
      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-3 text-gray-500" />
        <input value={search} onChange={function(e) { setSearch(e.target.value); }}
          className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
          placeholder="Rechercher par nom ou t\\u00e9l\\u00e9phone..." />
      </div>
      {loading ? <div className="text-gray-500 text-center py-10">Chargement...</div> : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">NOM</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">T\\u00c9L\\u00c9PHONE</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">EMAIL</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">NOTE</th>
                <th className="text-right text-xs text-gray-500 font-medium px-6 py-4">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(function(rider) {
                var name = (rider.userId && rider.userId.name) || 'N/A';
                var phone = (rider.userId && rider.userId.phone) || 'N/A';
                var email = (rider.userId && rider.userId.email) || '-';
                var rating = (rider.userId && rider.userId.rating) ? rider.userId.rating.toFixed(1) : '-';
                var userId = rider.userId && rider.userId._id;
                return (
                  <tr key={rider._id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-6 py-4 text-white font-medium">{name}</td>
                    <td className="px-6 py-4 text-gray-400">{phone}</td>
                    <td className="px-6 py-4 text-gray-400">{email}</td>
                    <td className="px-6 py-4 text-yellow-400">{rating}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={function() { handleToggle(userId); }} className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition-colors">
                        <UserX size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-8 text-gray-500">Aucun passager trouv\\u00e9</div>}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800">
              <button disabled={page <= 1} onClick={function() { setPage(page-1); }} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30"><ChevronLeft size={16} /> Pr\\u00e9c\\u00e9dent</button>
              <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={function() { setPage(page+1); }} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30">Suivant <ChevronRight size={16} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
`, 'utf8');

// 9. Rides Page
fs.writeFileSync(base + '/pages/RidesPage.jsx',
`import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

var statusColors = {
  pending: 'text-yellow-400 bg-yellow-400/10',
  accepted: 'text-blue-400 bg-blue-400/10',
  arrived: 'text-purple-400 bg-purple-400/10',
  in_progress: 'text-emerald-400 bg-emerald-400/10',
  completed: 'text-green-400 bg-green-400/10',
  cancelled: 'text-red-400 bg-red-400/10'
};

var statusLabels = {
  pending: 'En attente',
  accepted: 'Accept\\u00e9e',
  arrived: 'Arriv\\u00e9',
  in_progress: 'En cours',
  completed: 'Termin\\u00e9e',
  cancelled: 'Annul\\u00e9e'
};

export default function RidesPage() {
  var [rides, setRides] = useState([]);
  var [loading, setLoading] = useState(true);
  var [filter, setFilter] = useState('');
  var [page, setPage] = useState(1);
  var [totalPages, setTotalPages] = useState(1);

  function loadRides() {
    setLoading(true);
    var params = { page: page, limit: 15 };
    if (filter) params.status = filter;
    adminService.getRides(params).then(function(res) {
      setRides(res.rides || []);
      setTotalPages(res.totalPages || 1);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }

  useEffect(function() { loadRides(); }, [filter, page]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Courses</h1>
        <div className="flex gap-2 flex-wrap">
          {['', 'pending', 'in_progress', 'completed', 'cancelled'].map(function(f) {
            return (
              <button key={f} onClick={function() { setFilter(f); setPage(1); }}
                className={'px-3 py-2 rounded-lg text-xs font-medium transition-colors ' + (filter === f ? 'bg-emerald-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white')}>
                {f === '' ? 'Toutes' : statusLabels[f]}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? <div className="text-gray-500 text-center py-10">Chargement...</div> : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">ID</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">D\\u00c9PART</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">ARRIV\\u00c9E</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">TARIF</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">STATUT</th>
                <th className="text-left text-xs text-gray-500 font-medium px-6 py-4">DATE</th>
              </tr>
            </thead>
            <tbody>
              {rides.map(function(ride) {
                var pickup = (ride.pickupLocation && ride.pickupLocation.address) || 'N/A';
                var dropoff = (ride.dropoffLocation && ride.dropoffLocation.address) || 'N/A';
                var status = ride.status || 'pending';
                var date = ride.createdAt ? new Date(ride.createdAt).toLocaleDateString('fr-FR') : '-';
                return (
                  <tr key={ride._id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-6 py-4 text-gray-500 text-xs font-mono">{ride._id.slice(-6)}</td>
                    <td className="px-6 py-4 text-white text-sm">{pickup.length > 30 ? pickup.substring(0,30) + '...' : pickup}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{dropoff.length > 30 ? dropoff.substring(0,30) + '...' : dropoff}</td>
                    <td className="px-6 py-4 text-yellow-400 font-medium">{(ride.fare || 0).toLocaleString()} FCFA</td>
                    <td className="px-6 py-4">
                      <span className={'px-3 py-1 rounded-full text-xs font-medium ' + (statusColors[status] || '')}>{statusLabels[status] || status}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">{date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rides.length === 0 && <div className="text-center py-8 text-gray-500">Aucune course trouv\\u00e9e</div>}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800">
              <button disabled={page <= 1} onClick={function() { setPage(page-1); }} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30"><ChevronLeft size={16} /> Pr\\u00e9c\\u00e9dent</button>
              <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={function() { setPage(page+1); }} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30">Suivant <ChevronRight size={16} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
`, 'utf8');

// 10. Revenue Page
fs.writeFileSync(base + '/pages/RevenuePage.jsx',
`import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { DollarSign, TrendingUp, Car, PieChart } from 'lucide-react';

export default function RevenuePage() {
  var [analytics, setAnalytics] = useState(null);
  var [loading, setLoading] = useState(true);
  var [startDate, setStartDate] = useState('');
  var [endDate, setEndDate] = useState('');

  function loadRevenue() {
    setLoading(true);
    var params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    adminService.getRevenue(params).then(function(res) {
      setAnalytics(res.analytics);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }

  useEffect(function() { loadRevenue(); }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Revenus</h1>

      <div className="flex gap-4 mb-6 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date d\\u00e9but</label>
          <input type="date" value={startDate} onChange={function(e) { setStartDate(e.target.value); }}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date fin</label>
          <input type="date" value={endDate} onChange={function(e) { setEndDate(e.target.value); }}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
        </div>
        <button onClick={loadRevenue} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Filtrer
        </button>
      </div>

      {loading ? <div className="text-gray-500 text-center py-10">Chargement...</div> : !analytics ? <div className="text-red-400 text-center py-10">Erreur</div> : (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <DollarSign size={22} className="text-yellow-400 mb-3" />
              <p className="text-3xl font-bold text-white">{analytics.totalFare.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">Total courses (FCFA)</p>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <TrendingUp size={22} className="text-emerald-400 mb-3" />
              <p className="text-3xl font-bold text-emerald-400">{analytics.totalCommission.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">Commission TeranGO (FCFA)</p>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <Car size={22} className="text-blue-400 mb-3" />
              <p className="text-3xl font-bold text-white">{analytics.totalDriverEarnings.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">Gains chauffeurs (FCFA)</p>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <PieChart size={22} className="text-purple-400 mb-3" />
              <p className="text-3xl font-bold text-white">{Math.round(analytics.averageFare).toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">Tarif moyen (FCFA)</p>
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">R\\u00e9partition par type</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                <p className="text-2xl font-bold text-white">{analytics.ridesByType.standard}</p>
                <p className="text-sm text-gray-500">Standard</p>
              </div>
              <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                <p className="text-2xl font-bold text-white">{analytics.ridesByType.comfort}</p>
                <p className="text-sm text-gray-500">Confort</p>
              </div>
              <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                <p className="text-2xl font-bold text-white">{analytics.ridesByType.xl}</p>
                <p className="text-sm text-gray-500">XL</p>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">Total courses analys\\u00e9es: {analytics.totalRides}</p>
          </div>
        </div>
      )}
    </div>
  );
}
`, 'utf8');

console.log('All admin dashboard files created!');
console.log('Files: api.js, AuthContext.jsx, App.jsx, Layout.jsx, LoginPage.jsx, DashboardPage.jsx, DriversPage.jsx, RidersPage.jsx, RidesPage.jsx, RevenuePage.jsx');
