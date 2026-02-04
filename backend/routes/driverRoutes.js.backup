const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const {
  getProfile,
  completeProfile,
  toggleOnlineStatus,
  updateLocation,
  getActiveRide,
  getEarnings,
  getRideHistory
} = require('../controllers/driverController');

// Get driver profile
router.get('/profile', protect, restrictTo('driver'), getProfile);

// Complete driver profile
router.put('/complete-profile', protect, restrictTo('driver'), completeProfile);

// Toggle online/offline status
router.put('/toggle-online', protect, restrictTo('driver'), toggleOnlineStatus);

// Update driver location
router.put('/location', protect, restrictTo('driver'), updateLocation);

// Get active ride
router.get('/active-ride', protect, restrictTo('driver'), getActiveRide);

// Get earnings
router.get('/earnings', protect, restrictTo('driver'), getEarnings);

// Get ride history
router.get('/ride-history', protect, restrictTo('driver'), getRideHistory);

module.exports = router;