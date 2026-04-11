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
  resetPin,
  updateSecurityPin,
  updateEmergencyContacts
} = require('../controllers/authController');

// Send OTP
router.post(
  '/send-otp',
  [
    body('phone')
      .isString().withMessage('Le téléphone doit être une chaîne')
      .notEmpty().withMessage('Numéro de téléphone requis')
      .isLength({ max: 20 }).withMessage('Numéro de téléphone trop long')
  ],
  validate,
  sendOTP
);

// Verify OTP & Login/Register
router.post(
  '/verify-otp',
  [
    body('phone')
      .isString().withMessage('Le téléphone doit être une chaîne')
      .notEmpty().withMessage('Numéro de téléphone requis'),
    body('otp')
      .notEmpty().withMessage('Code OTP requis')
      .isLength({ min: 6, max: 6 }).withMessage('Code OTP invalide')
  ],
  validate,
  verifyOTP
);

// Get current user
router.get('/me', protect, getMe);

// Update profile
router.put(
  '/profile',
  protect,
  [
    body('name')
      .optional()
      .isString().withMessage('Le nom doit être une chaîne')
      .isLength({ min: 2, max: 100 }).withMessage('Le nom doit contenir entre 2 et 100 caractères'),
    body('email')
      .optional()
      .isEmail().withMessage('Format email invalide')
  ],
  validate,
  updateProfile
);

// Register with PIN
router.post(
  '/register',
  [
    body('phone')
      .isString().withMessage('Le téléphone doit être une chaîne')
      .notEmpty().withMessage('Numéro de téléphone requis'),
    body('name')
      .isString().withMessage('Le nom doit être une chaîne')
      .notEmpty().withMessage('Nom requis')
      .isLength({ min: 2, max: 100 }).withMessage('Le nom doit contenir entre 2 et 100 caractères'),
    body('pin')
      .notEmpty().withMessage('PIN requis')
      .matches(/^\d{6}$/).withMessage('Le PIN doit contenir exactement 6 chiffres'),
    body('role')
      .notEmpty().withMessage('Rôle requis')
      .isIn(['rider', 'driver']).withMessage('Rôle invalide')
  ],
  validate,
  register
);

// Login with PIN
router.post(
  '/login',
  [
    body('phone')
      .isString().withMessage('Le téléphone doit être une chaîne')
      .notEmpty().withMessage('Numéro de téléphone requis'),
    body('pin')
      .notEmpty().withMessage('PIN requis')
  ],
  validate,
  loginWithPin
);

// Forgot PIN
router.post(
  '/forgot-pin',
  [
    body('phone')
      .isString().withMessage('Le téléphone doit être une chaîne')
      .notEmpty().withMessage('Numéro de téléphone requis')
  ],
  validate,
  forgotPin
);

// Reset PIN
router.post(
  '/reset-pin',
  [
    body('phone')
      .isString().withMessage('Le téléphone doit être une chaîne')
      .notEmpty().withMessage('Numéro de téléphone requis'),
    body('otp')
      .notEmpty().withMessage('Code OTP requis'),
    body('newPin')
      .notEmpty().withMessage('Nouveau PIN requis')
      .matches(/^\d{6}$/).withMessage('Le PIN doit contenir exactement 6 chiffres')
  ],
  validate,
  resetPin
);

// Push token
router.put('/push-token', protect, registerPushToken);

// Admin login
router.post(
  '/admin-login',
  [
    body('email')
      .notEmpty().withMessage('Email requis')
      .isEmail().withMessage('Format email invalide'),
    body('password')
      .notEmpty().withMessage('Mot de passe requis')
  ],
  validate,
  adminLogin
);


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


// Security PIN toggle
router.put('/security-pin', protect, updateSecurityPin);

// Emergency contacts
router.put('/emergency-contacts', protect, updateEmergencyContacts);

// Delete account
var { deleteAccount } = require('../controllers/authController');
router.delete('/account', protect, deleteAccount);

module.exports = router;
