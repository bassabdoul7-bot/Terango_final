import axios from 'axios';

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
  login: function(email, password) { return api.post('/auth/admin-login', { email: email, password: password }); }
};

export var adminService = {
  getDashboard: function() { return api.get('/admin/dashboard'); },
  getDrivers: function(params) { return api.get('/admin/drivers', { params: params }); },
  verifyDriver: function(id, status, reason) { return api.put('/admin/drivers/' + id + '/verify', { status: status, reason: reason }); },
  getRides: function(params) { return api.get('/admin/rides', { params: params }); },
  getRiders: function(params) { return api.get('/admin/riders', { params: params }); },
  getRevenue: function(params) { return api.get('/admin/revenue', { params: params }); },
  toggleUserStatus: function(id) { return api.put('/admin/users/' + id + '/status'); },
  getPendingPhotos: function() { return api.get('/admin/pending-photos'); },
  approvePhoto: function(id) { return api.put('/admin/users/' + id + '/approve-photo'); },
  rejectPhoto: function(id, reason) { return api.put('/admin/users/' + id + '/reject-photo', { reason: reason }); },
  getPartners: function() { return api.get('/admin/partners'); },
  createPartner: function(data) { return api.post('/admin/partners', data); },
  verifyPartner: function(id, status, reason) { return api.put('/admin/partners/' + id + '/verify', { status: status, reason: reason }); },
  getServiceProviders: function(params) { return api.get('/services/admin/providers', { params: params }); },
  verifyServiceProvider: function(id, status, reason) { return api.put('/services/admin/providers/' + id + '/verify', { status: status, reason: reason }); },
  getServiceRequests: function(params) { return api.get('/services/admin/requests', { params: params }); },
  getServiceStats: function() { return api.get('/services/admin/stats'); }
};

export var partnerService = {
  getDashboard: function() { return api.get('/partners/dashboard'); },
  getDrivers: function() { return api.get('/partners/drivers'); },
  registerDriver: function(data) { return api.post('/partners/register-driver', data); },
  getEarnings: function() { return api.get('/partners/earnings'); },
  getProfile: function() { return api.get('/partners/profile'); }
};

export default api;
