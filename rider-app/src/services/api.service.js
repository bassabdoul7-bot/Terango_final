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
    if (error.response?.status === 401) {
      AsyncStorage.removeItem('token');
      AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export const authService = {
  sendOTP: (phone) => api.post('/auth/send-otp', { phone }),
  verifyOTP: (phone, otp, name = 'Rider', role = 'rider') => 
    api.post('/auth/verify-otp', { phone, otp, name, role }),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

export const rideService = {
  createRide: (rideData) => api.post('/rides', rideData),
  getRide: (rideId) => api.get(`/rides/${rideId}`),
  getMyRides: () => api.get('/rides/my-rides'),
  cancelRide: (rideId, reason) => api.put(`/rides/${rideId}/cancel`, { reason }),
  rateRide: (rideId, rating, review) => api.put(`/rides/${rideId}/rate`, { rating, review }),
};

export default api;
