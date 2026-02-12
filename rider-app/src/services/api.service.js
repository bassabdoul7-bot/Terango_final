import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

var API_URL = 'https://terango-api.fly.dev/api';

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
  sendOTP: function(phone, mode) { return api.post('/auth/send-otp', { phone: phone, mode: mode }); },
  register: (phone, name, email, pin, role) => api.post('/auth/register', { phone, name, email, pin, role }),
  loginWithPin: (phone, pin) => api.post('/auth/login', { phone, pin }),
  forgotPin: (phone) => api.post('/auth/forgot-pin', { phone }),
  resetPin: (phone, otp, newPin) => api.post('/auth/reset-pin', { phone, otp, newPin }),
  verifyOTP: function(phone, otp, name, role) {
    return api.post('/auth/verify-otp', { phone: phone, otp: otp, name: name, role: role });
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

export var deliveryService = {
  getEstimate: function(serviceType, distance, size) {
    return api.post('/deliveries/estimate', { serviceType: serviceType, distance: distance, size: size });
  },
  createDelivery: function(data) { return api.post('/deliveries/create', data); },
  getMyDeliveries: function() { return api.get('/deliveries/my-deliveries'); },
  getActiveDelivery: function() { return api.get('/deliveries/active'); },
  getDeliveryById: function(deliveryId) { return api.get('/deliveries/' + deliveryId); },
  cancelDelivery: function(deliveryId, reason) {
    return api.put('/deliveries/' + deliveryId + '/cancel', { reason: reason });
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



