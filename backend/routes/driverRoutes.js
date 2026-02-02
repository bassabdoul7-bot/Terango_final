const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');
const { protect, restrictTo } = require('../middleware/auth');
const {
  completeProfile,
  toggleOnlineStatus,
  updateLocation,
  getActiveRide,
  getEarnings,
  getRideHistory
} = require('../controllers/driverController');

// Complete profile
router.put(
  '/complete-profile',
  protect,
  restrictTo('driver'),
  [
    body('driverLicenseNumber').notEmpty().withMessage('License number required'),
    body('vehicle.make').notEmpty().withMessage('Vehicle make required'),
    body('vehicle.model').notEmpty().withMessage('Vehicle model required'),
    body('vehicle.year').isInt().withMessage('Valid year required'),
    body('vehicle.licensePlate').notEmpty().withMessage('License plate required')
  ],
  validate,
  completeProfile
);

// Toggle online status
router.put('/toggle-online', protect, restrictTo('driver'), toggleOnlineStatus);

// Update location
router.put(
  '/location',
  protect,
  restrictTo('driver'),
  [
    body('latitude').isFloat().withMessage('Valid latitude required'),
    body('longitude').isFloat().withMessage('Valid longitude required')
  ],
  validate,
  updateLocation
);

// Get active ride
router.get('/active-ride', protect, restrictTo('driver'), getActiveRide);

// Get earnings
router.get('/earnings', protect, restrictTo('driver'), getEarnings);

// Get ride history
router.get('/ride-history', protect, restrictTo('driver'), getRideHistory);

module.exports = router;