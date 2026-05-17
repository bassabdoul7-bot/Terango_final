var express = require('express');
var multer = require('multer');
var cloudinary = require('cloudinary').v2;
var { CloudinaryStorage } = require('multer-storage-cloudinary');
var router = express.Router();
var { protect, restrictTo } = require('../middleware/auth');
var fc = require('../controllers/fleetController');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Vehicle/document photos for FleetListing + private-renter ID/license/selfie.
// Separate folder so we can tighten access policies on these later without
// touching driver docs.
var fleetStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'terango-fleet',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1600, height: 1600, crop: 'limit' }]
  }
});
var fleetUpload = multer({
  storage: fleetStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Seules les images sont acceptees'), false);
  }
});

// All fleet routes require authentication. Browse is gated to keep listings
// out of public scrapers; if we ever want public discovery we can carve out
// a separate /public/listings later.
router.use(protect);

// Generic photo upload — used by both listings (vehicle photos, carte grise,
// assurance) and private-renter docs (ID, permis, selfie). Returns the
// Cloudinary URL; the caller persists it on the listing/application.
router.post('/upload-photo', fleetUpload.single('photo'), function(req, res) {
  if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier' });
  res.json({ success: true, url: req.file.path });
});

// --- Public / renter side ---
router.get('/listings', fc.browseListings);
router.get('/listings/:id', fc.getListing);
router.post('/listings/:id/apply', fc.applyToListing);
router.get('/my-applications', fc.getMyApplications);
router.post('/applications/:id/pay-fee', fc.payClosingFee);
router.get('/agreements/:id', fc.getAgreement);

// --- Owner side ---
router.post('/listings', fc.createListing);
router.get('/my-listings', fc.getMyListings);
router.put('/listings/:id', fc.updateListing);
router.delete('/listings/:id', fc.deleteListing);
router.get('/listings/:id/applications', fc.getApplicationsForListing);
router.put('/applications/:id/accept', fc.acceptApplication);
router.put('/applications/:id/reject', fc.rejectApplication);

module.exports = router;
