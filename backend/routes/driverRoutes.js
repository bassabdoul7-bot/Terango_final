var express = require('express');
var multer = require('multer');
var cloudinary = require('cloudinary').v2;
var { CloudinaryStorage } = require('multer-storage-cloudinary');
var path = require('path');
var router = express.Router();
var auth = require('../middleware/auth');
var protect = auth.protect;
var restrictTo = auth.restrictTo;
var ctrl = require('../controllers/driverController');
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
var storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'terango-drivers',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }]
  }
});
var upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Seules les images sont acceptees'), false);
  }
});

// Document upload storage (no face crop, larger size)
var docStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'terango-documents',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 1200, height: 1200, crop: 'limit' }]
  }
});
var docUpload = multer({
  storage: docStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Seules les images sont acceptees'), false);
  }
});

router.get('/online-count', protect, ctrl.getOnlineCount);
router.get('/nearby', protect, ctrl.getNearbyDrivers);
router.get('/profile', protect, restrictTo('driver'), ctrl.getProfile);
router.get('/verification-status', protect, restrictTo('driver'), ctrl.getVerificationStatus);
router.put('/complete-profile', protect, restrictTo('driver'), ctrl.completeProfile);
router.put('/toggle-online', protect, restrictTo('driver'), ctrl.toggleOnlineStatus);
router.put('/location', protect, restrictTo('driver'), ctrl.updateLocation);
router.get('/active-ride', protect, restrictTo('driver'), ctrl.getActiveRide);
router.get('/earnings', protect, restrictTo('driver'), ctrl.getEarnings);
router.get('/ride-history', protect, restrictTo('driver'), ctrl.getRideHistory);
router.put('/profile-photo', protect, restrictTo('driver'), upload.single('photo'), ctrl.uploadProfilePhoto);
router.get('/service-preferences', protect, restrictTo('driver'), ctrl.getServicePreferences);
router.put('/service-preferences', protect, restrictTo('driver'), ctrl.updateServicePreferences);
router.put('/upload-documents', protect, restrictTo('driver'),
  docUpload.fields([
    { name: 'nationalId', maxCount: 1 },
    { name: 'driverLicense', maxCount: 1 },
    { name: 'vehicleRegistration', maxCount: 1 }
  ]),
  ctrl.uploadDocuments
);
module.exports = router;