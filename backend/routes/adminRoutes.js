const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');
const { protect, restrictTo } = require('../middleware/auth');
const {
  getDashboardStats,
  getAllDrivers,
  verifyDriver,
  getAllRides,
  getAllRiders,
  getRevenueAnalytics,
  toggleUserStatus,
  getPendingPhotos,
  approvePhoto,
  rejectPhoto,
  createPartner,
  getAllPartners,
  verifyPartner
} = require('../controllers/adminController');

// All routes are admin-only
router.use(protect, restrictTo('admin'));

// Dashboard statistics
router.get('/dashboard', getDashboardStats);

// Driver management
router.get('/drivers', getAllDrivers);
router.put(
  '/drivers/:id/verify',
  [
    body('status').isIn(['approved', 'rejected']).withMessage('Statut invalide')
  ],
  validate,
  verifyDriver
);

// Ride management
router.get('/rides', getAllRides);
router.get('/rides/:id', require('../controllers/adminController').getRideDetails);

// Rider management
router.get('/riders', getAllRiders);

// Revenue analytics
router.get('/revenue', getRevenueAnalytics);

// User status toggle
router.put('/users/:id/status', toggleUserStatus);

// Photo verification
router.get('/pending-photos', getPendingPhotos);
router.put('/users/:id/approve-photo', approvePhoto);
router.put('/users/:id/reject-photo', rejectPhoto);

// Partner management
router.post('/partners', createPartner);
router.get('/partners', getAllPartners);
router.put('/partners/:id/verify', verifyPartner);
router.put('/partners/:id/verify', verifyPartner);

// Monitoring / Observability
router.get('/logs', require('../controllers/adminController').getLogs);
router.get('/logs/stats', require('../controllers/adminController').getLogStats);
router.get('/health', require('../controllers/adminController').getHealth);

// Commission management
router.put('/drivers/:id/commission-paid', require('../controllers/adminController').markCommissionPaid);

// Wave payout management
router.get('/wave-payouts', require('../controllers/adminController').getWavePayouts);
router.put('/drivers/:id/wave-payout-sent', require('../controllers/adminController').markWavePayoutSent);

// Live operations
router.get('/live/rides', require('../controllers/adminController').getActiveRides);
router.get('/live/deliveries', require('../controllers/adminController').getActiveDeliveries);
router.get('/live/drivers', require('../controllers/adminController').getOnlineDrivers);

router.put('/drivers/:id/suspend', require('../controllers/adminController').suspendDriver);
router.put('/drivers/:id/ban', require('../controllers/adminController').banDriver);
router.post('/drivers/:id/warn', require('../controllers/adminController').warnDriver);

module.exports = router;