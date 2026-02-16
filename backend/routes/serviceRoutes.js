var express = require('express');
var router = express.Router();
var { protect } = require('../middleware/auth');
var svc = require('../controllers/serviceController');

// ===== Provider routes =====
router.post('/providers/register', protect, svc.registerProvider);
router.get('/providers/profile', protect, svc.getProviderProfile);
router.put('/providers/profile', protect, svc.updateProviderProfile);
router.post('/providers/toggle-online', protect, svc.toggleOnline);
router.get('/providers/available-requests', protect, svc.getAvailableRequests);
router.post('/providers/accept/:id', protect, svc.acceptRequest);
router.put('/providers/status/:id', protect, svc.updateRequestStatus);

// ===== Search providers (public) =====
router.get('/providers/search', svc.searchProviders);

// ===== Customer routes =====
router.post('/requests', protect, svc.createRequest);
router.get('/requests/mine', protect, svc.getMyRequests);
router.get('/requests/:id', protect, svc.getRequest);
router.post('/requests/:id/accept-quote', protect, svc.acceptQuote);
router.post('/requests/:id/rate', protect, svc.rateService);
router.post('/requests/:id/cancel', protect, svc.cancelRequest);

// ===== Admin routes =====
router.get('/admin/providers', protect, svc.getAllProviders);
router.put('/admin/providers/:id/verify', protect, svc.verifyProvider);
router.get('/admin/requests', protect, svc.getAllRequests);
router.get('/admin/stats', protect, svc.getServiceStats);

module.exports = router;
