var express = require('express');
var router = express.Router();
var jwt = require('jsonwebtoken');
var Restaurant = require('../models/Restaurant');
var ctrl = require('../controllers/restaurantController');

function restaurantAuth(req, res, next) {
  var token = req.headers.authorization;
  if (!token || !token.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Non autorise' });
  }

  try {
    var decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
    if (decoded.role !== 'restaurant') {
      return res.status(403).json({ success: false, message: 'Acces restaurant requis' });
    }

    Restaurant.findById(decoded.id)
      .then(function(restaurant) {
        if (!restaurant) {
          return res.status(404).json({ success: false, message: 'Restaurant non trouve' });
        }
        req.restaurant = restaurant;
        next();
      })
      .catch(function(err) {
        console.error('Restaurant auth DB error:', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
      });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token invalide' });
  }
}

// Public routes
router.get('/list', ctrl.getRestaurants);
router.get('/slug/:slug', ctrl.getRestaurantBySlug);
router.get('/id/:id', ctrl.getRestaurantById);

// Restaurant auth
router.post('/register', ctrl.register);
router.post('/login', ctrl.login);

// Protected restaurant routes
router.get('/profile', restaurantAuth, ctrl.getProfile);
router.put('/profile', restaurantAuth, ctrl.updateProfile);
router.put('/toggle-open', restaurantAuth, ctrl.toggleOpen);

// Menu management
router.post('/menu', restaurantAuth, ctrl.addMenuItem);
router.put('/menu/:itemId', restaurantAuth, ctrl.updateMenuItem);
router.delete('/menu/:itemId', restaurantAuth, ctrl.deleteMenuItem);
router.put('/menu/:itemId/toggle', restaurantAuth, ctrl.toggleItemAvailability);

// Order management
router.get('/orders', restaurantAuth, ctrl.getOrders);
router.put('/orders/:orderId/accept', restaurantAuth, ctrl.acceptOrder);
router.put('/orders/:orderId/reject', restaurantAuth, ctrl.rejectOrder);
router.put('/orders/:orderId/preparing', restaurantAuth, ctrl.markPreparing);
router.put('/orders/:orderId/ready', restaurantAuth, ctrl.markReady);

// Dashboard
router.get('/dashboard', restaurantAuth, ctrl.getDashboardStats);

module.exports = router;
