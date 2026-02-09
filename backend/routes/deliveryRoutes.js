var express = require('express');
var router = express.Router();
var protect = require('../middleware/auth').protect;
var restrictTo = require('../middleware/auth').restrictTo;
var ctrl = require('../controllers/deliveryController');

// Rider routes
router.post('/estimate', protect, ctrl.getEstimate);
router.post('/create', protect, restrictTo('rider'), ctrl.createDelivery);
router.get('/my-deliveries', protect, restrictTo('rider'), ctrl.getMyDeliveries);
router.get('/active', protect, restrictTo('rider'), ctrl.getActiveDelivery);
router.get('/:deliveryId', protect, restrictTo('rider'), ctrl.getDeliveryById);
router.put('/:deliveryId/cancel', protect, restrictTo('rider', 'driver'), ctrl.cancelDelivery);

// Driver routes
router.put('/:deliveryId/accept', protect, restrictTo('driver'), ctrl.acceptDelivery);
router.put('/:deliveryId/status', protect, restrictTo('driver'), ctrl.updateDeliveryStatus);
router.get('/driver-active', protect, restrictTo('driver'), ctrl.getDriverActiveDelivery);

module.exports = router;
