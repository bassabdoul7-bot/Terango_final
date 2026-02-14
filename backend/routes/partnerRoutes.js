var express = require('express');
var router = express.Router();
var { protect, restrictTo } = require('../middleware/auth');
var partnerController = require('../controllers/partnerController');

router.get('/dashboard', protect, restrictTo('partner'), partnerController.getDashboard);
router.get('/drivers', protect, restrictTo('partner'), partnerController.getDrivers);
router.post('/register-driver', protect, restrictTo('partner'), partnerController.registerDriver);
router.get('/earnings', protect, restrictTo('partner'), partnerController.getEarnings);
router.get('/profile', protect, restrictTo('partner'), partnerController.getProfile);

module.exports = router;
