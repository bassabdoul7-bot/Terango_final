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
  rejectPhoto: function(id, reason) { return api.put('/admin/users/' + id + '/reject-photo', { reason: reason }); }
};

export default api;
