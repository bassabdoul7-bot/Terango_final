const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');
const { protect, restrictTo } = require('../middleware/auth');
const {
  completeProfile,
  toggleOnlineStatus,
  updateLocation,
  getMyRides,
  getEarnings,
  getStats,
  findNearbyDrivers
} = require('../controllers/driverController');

// Complete driver profile
router.put(
  '/complete-profile',
  protect,
  restrictTo('driver'),
  [
    body('nationalId').notEmpty().withMessage('CNI requise'),
    body('nationalIdPhoto').notEmpty().withMessage('Photo CNI requise'),
    body('driverLicense').notEmpty().withMessage('Permis de conduire requis'),
    body('driverLicensePhoto').notEmpty().withMessage('Photo permis requise'),
    body('vehicle.make').notEmpty().withMessage('Marque du véhicule requise'),
    body('vehicle.model').notEmpty().withMessage('Modèle du véhicule requis'),
    body('vehicle.licensePlate').notEmpty().withMessage('Plaque d\'immatriculation requise')
  ],
  validate,
  completeProfile
);

// Toggle online/offline
router.put('/toggle-online', protect, restrictTo('driver'), toggleOnlineStatus);

// Update location
router.put(
  '/location',
  protect,
  restrictTo('driver'),
  [
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude invalide'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude invalide')
  ],
  validate,
  updateLocation
);

// Get driver's rides
router.get('/my-rides', protect, restrictTo('driver'), getMyRides);

// Get earnings
router.get('/earnings', protect, restrictTo('driver'), getEarnings);

// Get statistics
router.get('/stats', protect, restrictTo('driver'), getStats);

// Find nearby drivers (internal)
router.post('/nearby', protect, findNearbyDrivers);

module.exports = router;