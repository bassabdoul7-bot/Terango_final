import { DeviceEventEmitter } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

var API_URL = 'https://api.terango.sn/api';
var ALLOWED_HOSTS = ['api.terango.sn'];

var api = axios.create({ baseURL: API_URL, timeout: 60000, headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use(
  async function(config) {
    var token = await SecureStore.getItemAsync('token');
    if (token) { config.headers.Authorization = 'Bearer ' + token; }

    // Enforce HTTPS and allowed domain on every request
    var fullURL = config.baseURL ? config.baseURL + config.url : config.url;
    if (fullURL && !fullURL.startsWith('https://')) {
      return Promise.reject(new Error('SSL_VIOLATION: Only HTTPS requests are allowed'));
    }
    try {
      var urlHost = new URL(fullURL).hostname;
      if (ALLOWED_HOSTS.indexOf(urlHost) === -1) {
        return Promise.reject(new Error('DOMAIN_VIOLATION: Request to untrusted host: ' + urlHost));
      }
    } catch (e) {
      return Promise.reject(new Error('URL_PARSE_ERROR: Could not parse request URL'));
    }

    return config;
  },
  function(error) { return Promise.reject(error); }
);

api.interceptors.response.use(
  function(response) {
    // Verify the response came from an allowed host (detect unexpected redirects)
    var responseURL = response.request && response.request.responseURL;
    if (responseURL) {
      try {
        var respHost = new URL(responseURL).hostname;
        if (ALLOWED_HOSTS.indexOf(respHost) === -1) {
          return Promise.reject(new Error('REDIRECT_VIOLATION: Response from untrusted host: ' + respHost));
        }
        if (!responseURL.startsWith('https://')) {
          return Promise.reject(new Error('SSL_VIOLATION: Response received over non-HTTPS connection'));
        }
      } catch (e) { /* URL parsing failed, allow response */ }
    }
    return response.data;
  },
  function(error) {
    if (error.response && error.response.status === 401) {
      SecureStore.deleteItemAsync('token');
      AsyncStorage.removeItem('user');
      DeviceEventEmitter.emit('force-logout');
    }
    return Promise.reject(error);
  }
);

export var authService = {
  sendOTP: function(phone, mode) { return api.post('/auth/send-otp', { phone: phone, mode: mode }); },
  register: (phone, name, email, pin, role) => api.post('/auth/register', { phone, name, email, pin, role }),
  loginWithPin: (phone, pin) => api.post('/auth/login', { phone, pin }),
  forgotPin: (phone) => api.post('/auth/forgot-pin', { phone }),
  resetPin: (phone, otp, newPin) => api.post('/auth/reset-pin', { phone, otp, newPin }),
  verifyOTP: function(phone, otp, name, role) { return api.post('/auth/verify-otp', { phone: phone, otp: otp, name: name, role: role }); },
  getMe: function() { return api.get('/auth/me'); },
  updateProfile: function(data) { return api.put('/auth/profile', data); },
  registerPushToken: function(token) { return api.put('/auth/push-token', { pushToken: token }); },
  deleteAccount: function() { return api.delete('/auth/account'); },
  updateEmergencyContacts: function(contacts) { return api.put('/auth/emergency-contacts', { contacts: contacts }); },
};

export var rideService = {
  createRide: function(rideData) { return api.post('/rides', rideData); },
  getRide: function(rideId) { return api.get('/rides/' + rideId); },
  updateSecurityPin: function(enabled) { return api.put('/auth/security-pin', { securityPinEnabled: enabled }); },
  getActiveRide: function() { return api.get('/rides/active-ride'); },
  getMyRides: function() { return api.get('/rides/my-rides'); },
  cancelRide: function(rideId, reason) { return api.put('/rides/' + rideId + '/cancel', { reason: reason }); },
  rateRide: function(rideId, rating, review) { return api.put('/rides/' + rideId + '/rate', { rating: rating, review: review }); },
  getUnpaidRide: function() { return api.get('/rides/unpaid'); },
  getScheduledRides: function() { return api.get('/rides/scheduled'); },
  shareRide: function(rideId) { return api.put('/rides/' + rideId + '/share'); },
  triggerSOS: function(rideId) { return api.post('/rides/' + rideId + '/sos'); },
  uploadEmergencyRecording: function(rideId, videoUri, duration) {
    var formData = new FormData();
    formData.append('media', { uri: videoUri, name: 'emergency-' + Date.now() + '.mp4', type: 'video/mp4' });
    if (duration) formData.append('duration', String(Math.round(duration)));
    return api.put('/rides/' + rideId + '/emergency-recording', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 });
  },
};

export var driverService = {
  getNearbyDrivers: function(latitude, longitude, radius) { var r = radius || 10; return api.get('/drivers/nearby?latitude=' + latitude + '&longitude=' + longitude + '&radius=' + r); },
};

export var deliveryService = {
  getEstimate: function(serviceType, distance, size) { return api.post('/deliveries/estimate', { serviceType: serviceType, distance: distance, size: size }); },
  createDelivery: function(data) { return api.post('/deliveries/create', data); },
  getMyDeliveries: function() { return api.get('/deliveries/my-deliveries'); },
  getActiveDelivery: function() { return api.get('/deliveries/active'); },
  getDeliveryById: function(deliveryId) { return api.get('/deliveries/' + deliveryId); },
  cancelDelivery: function(deliveryId, reason) { return api.put('/deliveries/' + deliveryId + '/cancel', { reason: reason }); },
  uploadEmergencyRecording: function(deliveryId, videoUri, duration) {
    var formData = new FormData();
    formData.append('media', { uri: videoUri, name: 'emergency-' + Date.now() + '.mp4', type: 'video/mp4' });
    if (duration) formData.append('duration', String(Math.round(duration)));
    return api.put('/deliveries/' + deliveryId + '/emergency-recording', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 });
  },
};

export var orderService = {
  createOrder: function(data) { return api.post('/orders', data); },
  getMyOrders: function() { return api.get('/orders/my-orders'); },
  getActiveOrder: function() { return api.get('/orders/active'); },
  getOrder: function(id) { return api.get('/orders/' + id); },
  cancelOrder: function(id) { return api.put('/orders/' + id + '/cancel'); },
  rateOrder: function(id, data) { return api.put('/orders/' + id + '/rate', data); },
};

export var restaurantService = {
  getRestaurants: function() { return api.get('/restaurants/list'); },
  getRestaurantBySlug: function(slug) { return api.get('/restaurants/slug/' + slug); },
  getRestaurantById: function(id) { return api.get('/restaurants/id/' + id); },
};

export default api;