var express = require('express');
var router = express.Router();
var ctrl = require('../controllers/geocodeController');

// Public — used by rider app (and could be by driver app later) without auth.
// Upstream provider is hidden; we filter, score, and cache.
router.get('/search', ctrl.search);
router.post('/search', ctrl.search);
router.get('/reverse', ctrl.reverse);
router.post('/reverse', ctrl.reverse);

module.exports = router;
