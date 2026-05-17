var express = require('express');
var router = express.Router();
var { protect, restrictTo } = require('../middleware/auth');
var fc = require('../controllers/fleetController');

// All fleet routes require authentication. Browse is gated to keep listings
// out of public scrapers; if we ever want public discovery we can carve out
// a separate /public/listings later.
router.use(protect);

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
