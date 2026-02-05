const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const {
  getProfile,
  completeProfile,
  toggleOnlineStatus,
  updateLocation,
  getActiveRide,
  getEarnings,
  getRideHistory,
  getNearbyDrivers,
  getOnlineCount,
  uploadProfilePhoto
} = require('../controllers/driverController');

// Configure multer for profile photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `driver-${req.user.id}-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Seules les images sont acceptées'), false);
  }
});

// Public/stats routes
router.get('/online-count', protect, getOnlineCount);

// Get nearby drivers (for riders) - must be before /:id routes
router.get('/nearby', protect, getNearbyDrivers);

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

// Upload profile photo
router.put('/profile-photo', protect, restrictTo('driver'), upload.single('photo'), uploadProfilePhoto);

module.exports = router;