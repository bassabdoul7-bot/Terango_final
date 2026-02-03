const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');
const { protect, restrictTo } = require('../middleware/auth');
const {
  createRide,
  getRide,
  getMyRides,
  acceptRide,
  rejectRide,
  updateRideStatus,
  cancelRide,
  rateRide
} = require('../controllers/rideController');

// Create new ride (Rider only)
router.post(
  '/',
  protect,
  restrictTo('rider'),
  [
    body('pickup.address').notEmpty().withMessage('Adresse de départ requise'),
    body('pickup.coordinates.latitude').isFloat().withMessage('Latitude de départ invalide'),
    body('pickup.coordinates.longitude').isFloat().withMessage('Longitude de départ invalide'),
    body('dropoff.address').notEmpty().withMessage('Adresse d\'arrivée requise'),
    body('dropoff.coordinates.latitude').isFloat().withMessage('Latitude d\'arrivée invalide'),
    body('dropoff.coordinates.longitude').isFloat().withMessage('Longitude d\'arrivée invalide'),
    body('rideType').isIn(['standard', 'comfort', 'xl']).withMessage('Type de course invalide'),
    body('paymentMethod').isIn(['orange_money', 'wave', 'free_money', 'cash']).withMessage('Méthode de paiement invalide')
  ],
  validate,
  createRide
);

// Get my rides
router.get('/my-rides', protect, getMyRides);

// Get ride by ID
router.get('/:id', protect, getRide);

// Accept ride (Driver only)
router.put('/:id/accept', protect, restrictTo('driver'), acceptRide);

// Reject ride (Driver only)
router.put(
  '/:id/reject',
  protect,
  restrictTo('driver'),
  [
    body('reason').notEmpty().withMessage('Raison de rejet requise')
  ],
  validate,
  rejectRide
);

// Update ride status (Driver only)
router.put(
  '/:id/status',
  protect,
  restrictTo('driver'),
  [
    body('status').isIn(['arrived', 'in_progress', 'completed']).withMessage('Statut invalide')
  ],
  validate,
  updateRideStatus
);

// Cancel ride
router.put(
  '/:id/cancel',
  protect,
  [
    body('reason').notEmpty().withMessage('Raison d\'annulation requise')
  ],
  validate,
  cancelRide
);

// Rate ride
router.put(
  '/:id/rate',
  protect,
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Note doit être entre 1 et 5'),
    body('review').optional().isString()
  ],
  validate,
  rateRide
);

module.exports = router;