const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');
const { protect, restrictTo } = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const waveScreenshotStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'terango-wave-screenshots',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 1200, height: 1200, crop: 'limit' }]
  }
});

const waveUpload = multer({
  storage: waveScreenshotStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Seules les images sont acceptees'), false);
  }
});
const {
  createRide,
  getRide,
  getMyRides,
  getActiveRide,
  acceptRide,
  rejectRide,
  updateRideStatus,
  cancelRide,
  rateRide,
  startRide,
  completeRide,
  verifyPin,
  uploadWaveScreenshot,
  verifyWavePayment
} = require('../controllers/rideController');

// Create new ride (Rider only)
router.post(
  '/',
  protect,
  restrictTo('rider'),
  [
    body('pickup.address').notEmpty().withMessage('Adresse de départ requise'),
    body('pickup.coordinates.latitude').isFloat().withMessage('Latitude de départ invalide'),
    body('pickup.coordinates.longitude').isFloat().withMessage('Longitude de départ invalide'),
    body('dropoff.address').notEmpty().withMessage('Adresse d\'arrivée requise'),
    body('dropoff.coordinates.latitude').isFloat().withMessage('Latitude d\'arrivée invalide'),
    body('dropoff.coordinates.longitude').isFloat().withMessage('Longitude d\'arrivée invalide'),
    body('rideType').isIn(['standard', 'comfort', 'xl']).withMessage('Type de course invalide'),
    body('paymentMethod').isIn(['cash', 'wave_upfront', 'wave']).withMessage('Méthode de paiement invalide')
  ],
  validate,
  createRide
);

// Get my rides
router.get('/active-ride', protect, getActiveRide);
router.get('/my-rides', protect, getMyRides);

// Get ride by ID
router.get('/:id', protect, getRide);

// Accept ride (Driver only)
router.put('/:id/accept', protect, restrictTo('driver'), acceptRide);

// Reject ride (Driver only)
router.put(
  '/:id/reject',
  protect,
  restrictTo('driver'),
  rejectRide
);

// Update ride status (Driver only) - generic
router.put(
  '/:id/status',
  protect,
  restrictTo('driver'),
  [
    body('status').isIn(['arrived', 'in_progress', 'completed']).withMessage('Statut invalide')
  ],
  validate,
  updateRideStatus
);

// Start ride (Driver only) - shortcut
router.put('/:id/verify-pin', protect, restrictTo('driver'), verifyPin);
router.put('/:id/start', protect, restrictTo('driver'), startRide);

// Complete ride (Driver only) - shortcut
router.put('/:id/complete', protect, restrictTo('driver'), completeRide);

// Wave screenshot upload (Rider only)
router.put('/:id/wave-screenshot', protect, restrictTo('rider'), waveUpload.single('screenshot'), uploadWaveScreenshot);

// Driver verifies Wave payment
router.put('/:id/verify-wave-payment', protect, restrictTo('driver'), verifyWavePayment);

// Cancel ride
router.put(
  '/:id/cancel',
  protect,
  cancelRide
);

// Rate ride
router.put(
  '/:id/rate',
  protect,
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Note doit être entre 1 et 5'),
    body('review').optional().isString()
  ],
  validate,
  rateRide
);

module.exports = router;


