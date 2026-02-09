var express = require('express');
var router = express.Router();
var { body } = require('express-validator');
var { validate } = require('../middleware/validation');
var protect = require('../middleware/auth').protect;
var restrictTo = require('../middleware/auth').restrictTo;
var Order = require('../models/Order');
var Restaurant = require('../models/Restaurant');
var Rider = require('../models/Rider');

// Helper: get rider from user
async function getRiderFromUser(userId) {
  return await Rider.findOne({ userId: userId });
}

// Helper: verify order ownership
async function verifyOrderOwnership(orderId, userId) {
  var rider = await getRiderFromUser(userId);
  if (!rider) return { error: 'Rider non trouve', status: 404 };

  var order = await Order.findById(orderId);
  if (!order) return { error: 'Commande non trouvee', status: 404 };

  if (order.riderId.toString() !== rider._id.toString()) {
    return { error: 'Non autorise', status: 403 };
  }

  return { order: order, rider: rider };
}

// Create order
router.post(
  '/',
  protect,
  restrictTo('rider'),
  [
    body('restaurantId').notEmpty().withMessage('Restaurant requis'),
    body('items').isArray({ min: 1 }).withMessage('Au moins un article requis'),
    body('items.*.menuItemId').notEmpty().withMessage('ID article requis'),
    body('items.*.name').notEmpty().withMessage('Nom article requis'),
    body('items.*.price').isFloat({ min: 0 }).withMessage('Prix invalide'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantite invalide'),
    body('dropoffAddress').notEmpty().withMessage('Adresse de livraison requise'),
    body('dropoffLat').isFloat().withMessage('Latitude invalide'),
    body('dropoffLng').isFloat().withMessage('Longitude invalide'),
    body('paymentMethod').optional().isIn(['orange_money', 'wave', 'free_money', 'cash']).withMessage('Methode de paiement invalide')
  ],
  validate,
  async function(req, res) {
    try {
      var body = req.body;

      var restaurant = await Restaurant.findById(body.restaurantId);
      if (!restaurant) {
        return res.status(404).json({ success: false, message: 'Restaurant non trouve' });
      }

      var rider = await getRiderFromUser(req.user.id);
      if (!rider) {
        return res.status(404).json({ success: false, message: 'Rider non trouve' });
      }

      // Calculate totals server-side (NEVER trust client prices for final calc)
      var subtotal = 0;
      var orderItems = body.items.map(function(item) {
        var optionsTotal = 0;
        if (item.options) {
          item.options.forEach(function(opt) { optionsTotal += opt.priceAdd || 0; });
        }
        var itemSubtotal = (item.price + optionsTotal) * item.quantity;
        subtotal += itemSubtotal;
        return {
          menuItemId: item.menuItemId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          options: item.options || [],
          subtotal: itemSubtotal
        };
      });

      if (subtotal < (restaurant.minimumOrder || 0)) {
        return res.status(400).json({
          success: false,
          message: 'Commande minimum: ' + restaurant.minimumOrder + ' FCFA'
        });
      }

      var deliveryFee = body.deliveryFee || 500;
      var platformFee = Math.round(subtotal * 0.05);
      var total = subtotal + deliveryFee + platformFee;
      var restaurantEarnings = Math.round(subtotal * (1 - (restaurant.commissionRate || 12) / 100));
      var driverEarnings = deliveryFee;
      var platformCommission = total - restaurantEarnings - driverEarnings;

      var order = new Order({
        restaurant: restaurant._id,
        riderId: rider._id,
        items: orderItems,
        subtotal: subtotal,
        deliveryFee: deliveryFee,
        platformFee: platformFee,
        total: total,
        restaurantEarnings: restaurantEarnings,
        driverEarnings: driverEarnings,
        platformCommission: platformCommission,
        pickup: {
          address: restaurant.address.street + ', ' + restaurant.address.city,
          coordinates: restaurant.address.coordinates
        },
        dropoff: {
          address: body.dropoffAddress,
          coordinates: { latitude: body.dropoffLat, longitude: body.dropoffLng }
        },
        distance: body.distance || 0,
        estimatedDeliveryTime: restaurant.estimatedDeliveryTime || 30,
        specialInstructions: body.specialInstructions || '',
        paymentMethod: body.paymentMethod || 'cash'
      });

      var saved = await order.save();
      res.status(201).json({ success: true, order: saved });
    } catch (err) {
      console.error('Create order error:', err);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

// Get my orders
router.get('/my-orders', protect, restrictTo('rider'), async function(req, res) {
  try {
    var rider = await getRiderFromUser(req.user.id);
    if (!rider) return res.json({ success: true, orders: [] });

    var orders = await Order.find({ riderId: rider._id })
      .populate('restaurant', 'name logo slug')
      .sort({ createdAt: -1 })
      .limit(30);

    res.json({ success: true, orders: orders });
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get active order
router.get('/active', protect, restrictTo('rider'), async function(req, res) {
  try {
    var rider = await getRiderFromUser(req.user.id);
    if (!rider) return res.json({ success: true, order: null });

    var order = await Order.findOne({
      riderId: rider._id,
      status: { $in: ['pending', 'confirmed', 'preparing', 'ready', 'driver_assigned', 'picked_up', 'delivering'] }
    }).populate('restaurant', 'name logo slug phone address');

    res.json({ success: true, order: order });
  } catch (err) {
    console.error('Get active order error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Get order by ID (with ownership check)
router.get('/:id', protect, async function(req, res) {
  try {
    var result = await verifyOrderOwnership(req.params.id, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ success: false, message: result.error });
    }

    // Re-fetch with populate
    var order = await Order.findById(req.params.id)
      .populate('restaurant', 'name logo slug phone address');

    res.json({ success: true, order: order });
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Cancel order (with ownership check)
router.put('/:id/cancel', protect, async function(req, res) {
  try {
    var result = await verifyOrderOwnership(req.params.id, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ success: false, message: result.error });
    }

    var order = result.order;
    if (['delivered', 'cancelled'].indexOf(order.status) !== -1) {
      return res.status(400).json({ success: false, message: "Impossible d'annuler cette commande" });
    }

    order.status = 'cancelled';
    order.cancelledBy = 'rider';
    order.cancellationReason = req.body.reason || 'Annule par le client';
    order.cancelledAt = new Date();

    var saved = await order.save();
    res.json({ success: true, order: saved });
  } catch (err) {
    console.error('Cancel order error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Rate order (with ownership check + validation)
router.put(
  '/:id/rate',
  protect,
  [
    body('foodRating').isInt({ min: 1, max: 5 }).withMessage('Note nourriture entre 1 et 5'),
    body('deliveryRating').isInt({ min: 1, max: 5 }).withMessage('Note livraison entre 1 et 5'),
    body('review').optional().isString().isLength({ max: 500 }).withMessage('Avis trop long')
  ],
  validate,
  async function(req, res) {
    try {
      var result = await verifyOrderOwnership(req.params.id, req.user.id);
      if (result.error) {
        return res.status(result.status).json({ success: false, message: result.error });
      }

      var order = result.order;
      if (order.status !== 'delivered') {
        return res.status(400).json({ success: false, message: 'Commande pas encore livree' });
      }

      order.rating = {
        food: req.body.foodRating,
        delivery: req.body.deliveryRating,
        review: req.body.review || ''
      };

      var saved = await order.save();
      res.json({ success: true, order: saved });
    } catch (err) {
      console.error('Rate order error:', err);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
  }
);

module.exports = router;
