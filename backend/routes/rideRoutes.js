const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');
const { protect, restrictTo } = require('../middleware/auth');
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
  appendTrailPoints,
  uploadEmergencyRecording,
  shareRide,
  getScheduledRides,
  triggerSOS,
  requestDriver,
  addFavoriteDriver,
  removeFavoriteDriver,
  getFavoriteDrivers
} = require('../controllers/rideController');

// Emergency recording multer config
var recordingsDir = process.env.RECORDINGS_DIR || '/var/www/recordings';
try { fs.mkdirSync(recordingsDir, { recursive: true }); } catch (e) {}
var recordingStorage = multer.diskStorage({
  destination: function(req, file, cb) { cb(null, recordingsDir); },
  filename: function(req, file, cb) {
    cb(null, 'emergency-' + Date.now() + '-' + req.user._id + path.extname(file.originalname || '.m4a'));
  }
});
var recordingUpload = multer({
  storage: recordingStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    var allowed = ['.m4a', '.mp3', '.wav', '.aac', '.ogg', '.mp4', '.3gp', '.webm', '.mov'];
    var ext = path.extname(file.originalname || '').toLowerCase();
    if (allowed.indexOf(ext) !== -1 || file.mimetype.indexOf('audio') !== -1 || file.mimetype.indexOf('video') !== -1) { cb(null, true); }
    else { cb(new Error('Format media non supporte'), false); }
  }
});

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

// Favorite drivers (Rider only)
router.get('/favorite-drivers', protect, restrictTo('rider'), getFavoriteDrivers);
router.put('/favorite-driver/:driverId', protect, restrictTo('rider'), addFavoriteDriver);
router.delete('/favorite-driver/:driverId', protect, restrictTo('rider'), removeFavoriteDriver);

// Request specific driver (Rider only)
router.post('/request-driver', protect, restrictTo('rider'), requestDriver);

// Get my rides
router.get('/active-ride', protect, getActiveRide);
router.get('/my-rides', protect, getMyRides);
router.get('/scheduled', protect, restrictTo('rider'), getScheduledRides);

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

// Append GPS trail points (Driver only)
router.put('/:id/trail', protect, restrictTo('driver'), appendTrailPoints);

// Share ride (Rider only)
router.put('/:id/share', protect, restrictTo('rider'), shareRide);

// Emergency video/audio recording (Rider or Driver)
router.put('/:id/emergency-recording', protect, recordingUpload.single('media'), uploadEmergencyRecording);

// SOS trigger (Rider or Driver)
router.post('/:id/sos', protect, triggerSOS);

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


