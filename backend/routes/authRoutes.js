const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');
const { protect } = require('../middleware/auth');
const {
  sendOTP,
  verifyOTP,
  getMe,
  updateProfile,
  adminLogin,
  registerPushToken,
  register,
  loginWithPin,
  forgotPin,
  resetPin
} = require('../controllers/authController');

// Send OTP
router.post(
  '/send-otp',
  [
    body('phone').notEmpty().withMessage('Numéro de téléphone requis')
  ],
  validate,
  sendOTP
);

// Verify OTP & Login/Register
router.post(
  '/verify-otp',
  [
    body('phone').notEmpty().withMessage('Numéro de téléphone requis'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('Code OTP invalide')
  ],
  validate,
  verifyOTP
);

// Get current user
router.get('/me', protect, getMe);

// Update profile
router.put('/profile', protect, updateProfile);

// Register with PIN
router.post('/register', register);

// Login with PIN
router.post('/login', loginWithPin);

// Forgot PIN
router.post('/forgot-pin', forgotPin);

// Reset PIN
router.post('/reset-pin', resetPin);

// Push token
router.put('/push-token', protect, registerPushToken);

// Admin login
router.post('/admin-login', adminLogin);

module.exports = router;