import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

var API_URL = 'http://192.168.1.184:5000/api';

var api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async function(config) {
    var token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = 'Bearer ' + token;
    }
    return config;
  },
  function(error) {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  function(response) { return response.data; },
  function(error) {
    if (error.response && error.response.status === 401) {
      AsyncStorage.removeItem('token');
      AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export var authService = {
  sendOTP: function(phone) { return api.post('/auth/send-otp', { phone: phone }); },
  verifyOTP: function(phone, otp, name, role) {
    return api.post('/auth/verify-otp', { phone: phone, otp: otp, name: name || 'Rider', role: role || 'rider' });
  },
  getMe: function() { return api.get('/auth/me'); },
  updateProfile: function(data) { return api.put('/auth/profile', data); },
};

export var rideService = {
  createRide: function(rideData) { return api.post('/rides', rideData); },
  getRide: function(rideId) { return api.get('/rides/' + rideId); },
  getMyRides: function() { return api.get('/rides/my-rides'); },
  cancelRide: function(rideId, reason) { return api.put('/rides/' + rideId + '/cancel', { reason: reason }); },
  rateRide: function(rideId, rating, review) { return api.put('/rides/' + rideId + '/rate', { rating: rating, review: review }); },
};

export var driverService = {
  getNearbyDrivers: function(latitude, longitude, radius) {
    var r = radius || 10;
    return api.get('/drivers/nearby?latitude=' + latitude + '&longitude=' + longitude + '&radius=' + r);
  },
};

export default api;