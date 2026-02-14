var express = require('express');
var router = express.Router();
var { protect, restrictTo } = require('../middleware/auth');
var partnerController = require('../controllers/partnerController');

var multer = require('multer');
var cloudinary = require('cloudinary').v2;
var { CloudinaryStorage } = require('multer-storage-cloudinary');
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
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
    else cb(new Error('Only images allowed'), false);
  }
});



router.get('/dashboard', protect, restrictTo('partner'), partnerController.getDashboard);
router.get('/drivers', protect, restrictTo('partner'), partnerController.getDrivers);
router.post('/register-driver', protect, restrictTo('partner'), partnerController.registerDriver);
router.get('/earnings', protect, restrictTo('partner'), partnerController.getEarnings);
router.get('/profile', protect, restrictTo('partner'), partnerController.getProfile);

router.put('/drivers/:driverId/upload-documents', protect, restrictTo('partner'),
  docUpload.fields([
    { name: 'nationalId', maxCount: 1 },
    { name: 'driverLicense', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
    { name: 'vehicleRegistration', maxCount: 1 }
  ]),
  partnerController.uploadDriverDocuments
);

module.exports = router;
