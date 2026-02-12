var express = require('express');
var router = express.Router();
var { protect } = require('../middleware/auth');
var deliveryController = require('../controllers/deliveryController');

router.post('/estimate', protect, deliveryController.getEstimate);
router.post('/create', protect, deliveryController.createDelivery);
router.put('/:deliveryId/accept', protect, deliveryController.acceptDelivery);
router.put('/:deliveryId/status', protect, deliveryController.updateDeliveryStatus);
router.get('/my-deliveries', protect, deliveryController.getMyDeliveries);
router.get('/active', protect, deliveryController.getActiveDelivery);
router.get('/driver-active', protect, deliveryController.getDriverActiveDelivery);
router.get('/:deliveryId', protect, deliveryController.getDeliveryById);
router.put('/:deliveryId/cancel', protect, deliveryController.cancelDelivery);

module.exports = router;