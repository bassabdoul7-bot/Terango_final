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

module.exports = router;