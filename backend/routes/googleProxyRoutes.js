var express = require('express');
var router = express.Router();
var ctrl = require('../controllers/googleProxyController');

// Public — used by mobile apps to call Google Maps APIs without the key
// being baked into the JS bundle. Inputs are validated (Senegal bbox).
router.get('/directions', ctrl.directions);
router.post('/directions', ctrl.directions);
router.get('/speedLimit', ctrl.speedLimit);

module.exports = router;
