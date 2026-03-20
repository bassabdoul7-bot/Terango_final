// API Configuration
export const API_URL = 'https://terango-api.fly.dev/api';

export const ENDPOINTS = {
  // Auth
  SEND_OTP: '/auth/send-otp',
  VERIFY_OTP: '/auth/verify-otp',
  GET_ME: '/auth/me',
  UPDATE_PROFILE: '/auth/profile',
  
  // Rides
  CREATE_RIDE: '/rides',
  GET_RIDE: '/rides',
  MY_RIDES: '/rides/my-rides',
  CANCEL_RIDE: '/rides',
  RATE_RIDE: '/rides',
};

export default { API_URL, ENDPOINTS };
