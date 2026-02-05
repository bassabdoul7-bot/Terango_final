var express = require('express');
var multer = require('multer');
var path = require('path');
var router = express.Router();
var auth = require('../middleware/auth');
var protect = auth.protect;
var restrictTo = auth.restrictTo;
var ctrl = require('../controllers/driverController');

var storage = multer.diskStorage({
  destination: function(req, file, cb) { cb(null, 'uploads/'); },
  filename: function(req, file, cb) { cb(null, 'driver-' + req.user.id + '-' + Date.now() + path.extname(file.originalname)); }
});
var upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Seules les images sont acceptées'), false);
  }
});

router.get('/online-count', protect, ctrl.getOnlineCount);
router.get('/nearby', protect, ctrl.getNearbyDrivers);
router.get('/profile', protect, restrictTo('driver'), ctrl.getProfile);
router.put('/complete-profile', protect, restrictTo('driver'), ctrl.completeProfile);
router.put('/toggle-online', protect, restrictTo('driver'), ctrl.toggleOnlineStatus);
router.put('/location', protect, restrictTo('driver'), ctrl.updateLocation);
router.get('/active-ride', protect, restrictTo('driver'), ctrl.getActiveRide);
router.get('/earnings', protect, restrictTo('driver'), ctrl.getEarnings);
router.get('/ride-history', protect, restrictTo('driver'), ctrl.getRideHistory);
router.put('/profile-photo', protect, restrictTo('driver'), upload.single('photo'), ctrl.uploadProfilePhoto);
router.get('/service-preferences', protect, restrictTo('driver'), ctrl.getServicePreferences);
router.put('/service-preferences', protect, restrictTo('driver'), ctrl.updateServicePreferences);

module.exports = router;