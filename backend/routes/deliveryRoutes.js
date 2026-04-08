var express = require('express');
var router = express.Router();
var multer = require('multer');
var path = require('path');
var fs = require('fs');
var { protect } = require('../middleware/auth');
var deliveryController = require('../controllers/deliveryController');

// Emergency recording multer config
var recordingsDir = process.env.RECORDINGS_DIR || '/var/www/recordings';
try { fs.mkdirSync(recordingsDir, { recursive: true }); } catch (e) {}
var recordingStorage = multer.diskStorage({
  destination: function(req, file, cb) { cb(null, recordingsDir); },
  filename: function(req, file, cb) {
    cb(null, 'emergency-delivery-' + Date.now() + '-' + req.user._id + path.extname(file.originalname || '.m4a'));
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

router.post('/estimate', protect, deliveryController.getEstimate);
router.post('/create', protect, deliveryController.createDelivery);
router.put('/:deliveryId/accept', protect, deliveryController.acceptDelivery);
router.put('/:deliveryId/status', protect, deliveryController.updateDeliveryStatus);
router.get('/my-deliveries', protect, deliveryController.getMyDeliveries);
router.get('/active', protect, deliveryController.getActiveDelivery);
router.get('/driver-active', protect, deliveryController.getDriverActiveDelivery);
router.get('/:deliveryId', protect, deliveryController.getDeliveryById);
router.put('/:deliveryId/trail', protect, deliveryController.appendDeliveryTrailPoints);
router.put('/:deliveryId/cancel', protect, deliveryController.cancelDelivery);

// Emergency video/audio recording (Rider or Driver)
router.put('/:deliveryId/emergency-recording', protect, recordingUpload.single('media'), deliveryController.uploadEmergencyRecording);

module.exports = router;