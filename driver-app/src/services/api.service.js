import { DeviceEventEmitter, Alert } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { COMMISSION_WAVE_NUMBER } from '../constants/commission';

const API_URL = 'https://api.terango.sn/api';
const ALLOWED_HOSTS = ['api.terango.sn'];

const api = axios.create({
  baseURL: API_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Enforce HTTPS and allowed domain on every request
    const fullURL = config.baseURL ? config.baseURL + config.url : config.url;
    if (fullURL && !fullURL.startsWith('https://')) {
      return Promise.reject(new Error('SSL_VIOLATION: Only HTTPS requests are allowed'));
    }
    try {
      const urlHost = new URL(fullURL).hostname;
      if (!ALLOWED_HOSTS.includes(urlHost)) {
        return Promise.reject(new Error('DOMAIN_VIOLATION: Request to untrusted host: ' + urlHost));
      }
    } catch (e) {
      return Promise.reject(new Error('URL_PARSE_ERROR: Could not parse request URL'));
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    // Verify the response came from an allowed host (detect unexpected redirects)
    const responseURL = response.request?.responseURL;
    if (responseURL) {
      try {
        const respHost = new URL(responseURL).hostname;
        if (!ALLOWED_HOSTS.includes(respHost)) {
          return Promise.reject(new Error('REDIRECT_VIOLATION: Response from untrusted host: ' + respHost));
        }
        if (!responseURL.startsWith('https://')) {
          return Promise.reject(new Error('SSL_VIOLATION: Response received over non-HTTPS connection'));
        }
      } catch (e) { /* URL parsing failed, allow response */ }
    }
    return response.data;
  },
  (error) => {
    if (error.response?.status === 403) {
      var msg = error.response?.data?.message || '';
      if (msg.toLowerCase().indexOf('commission') !== -1) {
        var amount = error.response?.data?.commissionBalance || '';
        Alert.alert(
          'Commission impay\u00e9e',
          'Votre compte est bloqu\u00e9 pour commission impay\u00e9e.' +
          (amount ? ' Montant d\u00fb : ' + amount + ' FCFA.' : '') +
          '\n\nEnvoyez le paiement par Wave au ' + COMMISSION_WAVE_NUMBER + '.',
          [{ text: 'Compris' }]
        );
      }
    }
    if (error.response?.status === 401) {
      SecureStore.deleteItemAsync('token');
      AsyncStorage.removeItem('user');
      DeviceEventEmitter.emit('force-logout');
    }
    return Promise.reject(error);
  }
);

export const authService = {
  registerPushToken: (pushToken) => api.put('/auth/push-token', { pushToken }),

  register: (phone, name, email, pin, role) => api.post('/auth/register', { phone, name, email, pin, role }),
  loginWithPin: (phone, pin) => api.post('/auth/login', { phone, pin }),
  forgotPin: (phone) => api.post('/auth/forgot-pin', { phone }),
  resetPin: (phone, otp, newPin) => api.post('/auth/reset-pin', { phone, otp, newPin }),
  sendOTP: (phone, mode) => api.post('/auth/send-otp', { phone, mode }),
  verifyOTP: (phone, otp, name, role) =>
    api.post('/auth/verify-otp', { phone, otp, name, role }),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

export const driverService = {
uploadDocuments: (formData) => api.put('/drivers/upload-documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getVerificationStatus: () => api.get('/drivers/verification-status'),
  getProfile: () => api.get('/drivers/profile'),
  completeProfile: (data) => api.put('/drivers/complete-profile', data),
  
  updateLocation: (latitude, longitude) =>
    api.put('/drivers/location', { latitude, longitude }),
  
  toggleOnlineStatus: (isOnline, latitude, longitude) =>
    api.put('/drivers/toggle-online', { isOnline, latitude, longitude }),
  
  acceptRide: (rideId) => api.put(`/rides/${rideId}/accept`),
  
  rejectRide: (rideId, reason = 'Non disponible') =>
    api.put('/rides/' + rideId + '/reject', { reason }),
  
  cancelRide: (rideId, reason) =>
    api.put('/rides/' + rideId + '/cancel', { reason }),
  cancelDelivery: (deliveryId, reason) =>
    api.put('/deliveries/' + deliveryId + '/cancel', { reason }),
  startRide: (rideId) => api.put('/rides/' + rideId + '/start'),
  verifyPin: (rideId, pin) => api.put('/rides/' + rideId + '/verify-pin', { pin }),
  updateSecurityPin: (enabled) => api.put('/auth/security-pin', { securityPinEnabled: enabled }),

  completeRide: (rideId) => api.put('/rides/' + rideId + '/complete'),
  
  updateRideStatus: (rideId, status) =>
    api.put('/rides/' + rideId + '/status', { status }),
  
  getActiveRide: () => api.get('/drivers/active-ride'),
  
  getEarnings: () => api.get('/drivers/earnings'),
  
  getRide: (rideId) => api.get('/rides/' + rideId),
  getRideHistory: () => api.get('/drivers/ride-history'),
  uploadProfilePhoto: (formData) => api.put('/drivers/profile-photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),

  getServicePreferences: () => api.get('/drivers/service-preferences'),

  updateServicePreferences: (prefs) => api.put('/drivers/service-preferences', prefs),
  updateWaveNumber: (waveNumber) => api.put('/drivers/wave-number', { waveNumber }),
  appendRideTrail: (rideId, points) => api.put('/rides/' + rideId + '/trail', { points }),
  uploadEmergencyRecording: function(rideId, audioUri, duration) {
    var formData = new FormData();
    formData.append('audio', { uri: audioUri, name: 'emergency-' + Date.now() + '.m4a', type: 'audio/m4a' });
    if (duration) formData.append('duration', String(Math.round(duration)));
    return api.put('/rides/' + rideId + '/emergency-recording', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
  },
};

export const deliveryService = {
  getActiveDelivery: function() { return api.get('/deliveries/driver-active'); },
  acceptDelivery: function(deliveryId) { return api.put('/deliveries/' + deliveryId + '/accept'); },
  updateDeliveryStatus: function(deliveryId, status, photo) { return api.put('/deliveries/' + deliveryId + '/status', { status: status, photo: photo || null }); },
  appendDeliveryTrail: function(deliveryId, points) { return api.put('/deliveries/' + deliveryId + '/trail', { points: points }); },
  uploadEmergencyRecording: function(deliveryId, audioUri, duration) {
    var formData = new FormData();
    formData.append('audio', { uri: audioUri, name: 'emergency-' + Date.now() + '.m4a', type: 'audio/m4a' });
    if (duration) formData.append('duration', String(Math.round(duration)));
    return api.put('/deliveries/' + deliveryId + '/emergency-recording', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
  },
};

export const orderService = {
  getActiveOrder: function() { return api.get('/orders/active'); },
  getOrder: function(id) { return api.get('/orders/' + id); },
};

export default api;








