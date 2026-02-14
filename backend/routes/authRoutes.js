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


// Partner registration with ID upload
var multer = require('multer');
var cloudinary = require('cloudinary').v2;
var { CloudinaryStorage } = require('multer-storage-cloudinary');
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
var partnerStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'terango-partners',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    transformation: [{ width: 800, height: 800, crop: 'limit' }]
  }
});
var partnerUpload = multer({
  storage: partnerStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
});
var { registerPartner } = require('../controllers/authController');
router.post('/register-partner', partnerUpload.single('idPhoto'), registerPartner);

module.exports = router;