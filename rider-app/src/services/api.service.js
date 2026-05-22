import { DeviceEventEmitter } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

var API_URL = 'https://api.terango.sn/api';

var api = axios.create({ baseURL: API_URL, timeout: 60000, headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use(
  async function(config) { var token = await AsyncStorage.getItem('token'); if (token) { config.headers.Authorization = 'Bearer ' + token; } return config; },
  function(error) { return Promise.reject(error); }
);

api.interceptors.response.use(
  function(response) { return response.data; },
  function(error) { if (error.response && error.response.status === 401) { AsyncStorage.removeItem('token'); AsyncStorage.removeItem('user'); DeviceEventEmitter.emit('force-logout'); } return Promise.reject(error); }
);

export var authService = {
  sendOTP: function(phone, mode) { return api.post('/auth/send-otp', { phone: phone, mode: mode }); },
  register: (phone, name, email, pin, role) => api.post('/auth/register', { phone, name, email, pin, role }),
  loginWithPin: (phone, pin) => api.post('/auth/login', { phone, pin, role: 'rider' }),
  forgotPin: (phone) => api.post('/auth/forgot-pin', { phone }),
  resetPin: (phone, otp, newPin) => api.post('/auth/reset-pin', { phone, otp, newPin }),
  verifyOTP: function(phone, otp, name, role) { return api.post('/auth/verify-otp', { phone: phone, otp: otp, name: name, role: role }); },
  getMe: function() { return api.get('/auth/me'); },
  updateProfile: function(data) { return api.put('/auth/profile', data); },
  registerPushToken: function(token) { return api.put('/auth/push-token', { pushToken: token }); },
  deleteAccount: function() { return api.delete('/auth/account'); },
};

export var rideService = {
  createRide: function(rideData) { return api.post('/rides', rideData); },
  getRide: function(rideId) { return api.get('/rides/' + rideId); },
  updateSecurityPin: function(enabled) { return api.put('/auth/security-pin', { securityPinEnabled: enabled }); },
  getActiveRide: function() { return api.get('/rides/active-ride'); },
  getMyRides: function() { return api.get('/rides/my-rides'); },
  cancelRide: function(rideId, reason) { return api.put('/rides/' + rideId + '/cancel', { reason: reason }); },
  rateRide: function(rideId, rating, review) { return api.put('/rides/' + rideId + '/rate', { rating: rating, review: review }); },
  shareRide: function(rideId) { return api.put('/rides/' + rideId + '/share'); },
  getFavoriteDrivers: function() { return api.get('/rides/favorite-drivers'); },
  addFavoriteDriver: function(driverId) { return api.put('/rides/favorite-driver/' + driverId); },
  removeFavoriteDriver: function(driverId) { return api.delete('/rides/favorite-driver/' + driverId); },
  requestDriver: function(driverId, rideData) { return api.post('/rides/request-driver', Object.assign({ driverId: driverId }, rideData)); },
  estimateFares: function(pickup, dropoff, distance, estimatedDuration) {
    return api.post('/rides/estimate', { pickup: pickup, dropoff: dropoff, distance: distance, estimatedDuration: estimatedDuration });
  },
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

export var geocodeService = {
  search: function(q, lat, lng) { return api.get('/geocode/search', { params: { q: q, lat: lat, lng: lng } }); },
  reverse: function(lat, lng) { return api.get('/geocode/reverse', { params: { lat: lat, lng: lng } }); },
};

export var deliveryService = {
  getEstimate: function(serviceType, distance, size) { return api.post('/deliveries/estimate', { serviceType: serviceType, distance: distance, size: size }); },
  createDelivery: function(data) { return api.post('/deliveries/create', data); },
  getMyDeliveries: function() { return api.get('/deliveries/my-deliveries'); },
  getActiveDelivery: function() { return api.get('/deliveries/active'); },
  getDeliveryById: function(deliveryId) { return api.get('/deliveries/' + deliveryId); },
  cancelDelivery: function(deliveryId, reason) { return api.put('/deliveries/' + deliveryId + '/cancel', { reason: reason }); },
  rateDelivery: function(deliveryId, rating, review) { return api.put('/deliveries/' + deliveryId + '/rate', { rating: rating, review: review }); },
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

export var fleetService = {
  // Browse / detail
  browseListings: function(params) { return api.get('/fleet/listings', { params: params }); },
  getListing: function(id) { return api.get('/fleet/listings/' + id); },
  // Renter side
  applyToListing: function(id, data) { return api.post('/fleet/listings/' + id + '/apply', data); },
  getMyApplications: function() { return api.get('/fleet/my-applications'); },
  payClosingFee: function(applicationId, waveRef) { return api.post('/fleet/applications/' + applicationId + '/pay-fee', { waveRef: waveRef }); },
  getAgreement: function(id) { return api.get('/fleet/agreements/' + id); },
  // Owner side (deferred to next slice — keeping the methods here so we don't
  // have to bump versionCode again when we ship the owner UI)
  createListing: function(data) { return api.post('/fleet/listings', data); },
  getMyListings: function() { return api.get('/fleet/my-listings'); },
  updateListing: function(id, data) { return api.put('/fleet/listings/' + id, data); },
  deleteListing: function(id) { return api.delete('/fleet/listings/' + id); },
  getListingApplications: function(id) { return api.get('/fleet/listings/' + id + '/applications'); },
  acceptApplication: function(applicationId) { return api.put('/fleet/applications/' + applicationId + '/accept'); },
  rejectApplication: function(applicationId, reason) { return api.put('/fleet/applications/' + applicationId + '/reject', { reason: reason }); },
  // Photo upload — returns { success, url }. Used for both vehicle photos
  // (owner side, next slice) and renter ID/license/selfie.
  uploadPhoto: function(uri) {
    var formData = new FormData();
    formData.append('photo', { uri: uri, type: 'image/jpeg', name: 'fleet-' + Date.now() + '.jpg' });
    return api.post('/fleet/upload-photo', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
  }
};

export default api;