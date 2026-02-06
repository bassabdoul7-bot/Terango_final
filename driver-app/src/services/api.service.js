import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://192.168.1.184:5000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error.response?.status);
    console.error('API Error Data:', error.response?.data);
    console.error('API Error Config:', error.config?.url);
    if (error.response?.status === 401) {
      AsyncStorage.removeItem('token');
      AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export const authService = {
  sendOTP: (phone) => api.post('/auth/send-otp', { phone }),
  verifyOTP: (phone, otp, name = 'Driver', role = 'driver') =>
    api.post('/auth/verify-otp', { phone, otp, name, role }),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

export const driverService = {
  getProfile: () => api.get('/drivers/profile'),
  completeProfile: (data) => api.put('/drivers/complete-profile', data),
  
  updateLocation: (latitude, longitude) =>
    api.put('/drivers/location', { latitude, longitude }),
  
  toggleOnlineStatus: (isOnline, latitude, longitude) =>
    api.put('/drivers/toggle-online', { isOnline, latitude, longitude }),
  
  acceptRide: (rideId) => api.put(`/rides/${rideId}/accept`),
  
  rejectRide: (rideId, reason = 'Non disponible') =>
    api.put(`/rides/${rideId}/reject`, { reason }),
  
  cancelRide: (rideId, reason) =>
    api.put(`/rides/${rideId}/cancel`, { reason }),
  
  startRide: (rideId) => api.put(`/rides/${rideId}/start`),
  
  completeRide: (rideId) => api.put(`/rides/${rideId}/complete`),
  
  updateRideStatus: (rideId, status) =>
    api.put(`/rides/${rideId}/status`, { status }),
  
  getActiveRide: () => api.get('/drivers/active-ride'),
  
  getEarnings: () => api.get('/drivers/earnings'),
  
  getRideHistory: () => api.get('/drivers/ride-history'),
  uploadProfilePhoto: (formData) => api.put('/drivers/profile-photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),

  getServicePreferences: () => api.get('/drivers/service-preferences'),

  updateServicePreferences: (prefs) => api.put('/drivers/service-preferences', prefs),
};

export const deliveryService = {
  getActiveDelivery: function() { return api.get('/deliveries/driver-active'); },
  acceptDelivery: function(deliveryId) { return api.put('/deliveries/' + deliveryId + '/accept'); },
  updateDeliveryStatus: function(deliveryId, status) { return api.put('/deliveries/' + deliveryId + '/status', { status: status }); },
};

export const orderService = {
  getActiveOrder: function() { return api.get('/orders/active'); },
  getOrder: function(id) { return api.get('/orders/' + id); },
};

export default api;




