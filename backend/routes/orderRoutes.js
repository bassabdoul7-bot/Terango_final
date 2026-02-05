var express = require('express');
var router = express.Router();
var protect = require('../middleware/auth').protect;
var restrictTo = require('../middleware/auth').restrictTo;
var Order = require('../models/Order');
var Restaurant = require('../models/Restaurant');
var Rider = require('../models/Rider');

// Create order
router.post('/', protect, restrictTo('rider'), function(req, res) {
  var body = req.body;

  Restaurant.findById(body.restaurantId).then(function(restaurant) {
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant non trouve' });
    }

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

    if (subtotal < restaurant.minimumOrder) {
      return res.status(400).json({
        success: false,
        message: 'Commande minimum: ' + restaurant.minimumOrder + ' FCFA'
      });
    }

    var deliveryFee = body.deliveryFee || 500;
    var platformFee = Math.round(subtotal * 0.05);
    var total = subtotal + deliveryFee + platformFee;
    var restaurantEarnings = Math.round(subtotal * (1 - restaurant.commissionRate / 100));
    var driverEarnings = deliveryFee;
    var platformCommission = total - restaurantEarnings - driverEarnings;

    Rider.findOne({ userId: req.user.id }).then(function(rider) {
      if (!rider) {
        return res.status(404).json({ success: false, message: 'Rider non trouve' });
      }

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

      order.save().then(function(saved) {
        res.status(201).json({ success: true, order: saved });
      });
    });
  }).catch(function(err) {
    console.error('Create order error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  });
});

// Get my orders
router.get('/my-orders', protect, restrictTo('rider'), function(req, res) {
  Rider.findOne({ userId: req.user.id }).then(function(rider) {
    if (!rider) return res.json({ success: true, orders: [] });
    Order.find({ riderId: rider._id })
      .populate('restaurant', 'name logo slug')
      .sort({ createdAt: -1 })
      .limit(30)
      .then(function(orders) {
        res.json({ success: true, orders: orders });
      });
  }).catch(function(err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  });
});

// Get active order
router.get('/active', protect, restrictTo('rider'), function(req, res) {
  Rider.findOne({ userId: req.user.id }).then(function(rider) {
    if (!rider) return res.json({ success: true, order: null });
    Order.findOne({
      riderId: rider._id,
      status: { $in: ['pending', 'confirmed', 'preparing', 'ready', 'driver_assigned', 'picked_up', 'delivering'] }
    })
      .populate('restaurant', 'name logo slug phone address')
      .then(function(order) {
        res.json({ success: true, order: order });
      });
  }).catch(function(err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  });
});

// Get order by ID
router.get('/:id', protect, function(req, res) {
  Order.findById(req.params.id)
    .populate('restaurant', 'name logo slug phone address')
    .then(function(order) {
      if (!order) return res.status(404).json({ success: false, message: 'Commande non trouvee' });
      res.json({ success: true, order: order });
    })
    .catch(function(err) {
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    });
});

// Cancel order
router.put('/:id/cancel', protect, function(req, res) {
  Order.findById(req.params.id).then(function(order) {
    if (!order) return res.status(404).json({ success: false, message: 'Commande non trouvee' });
    if (['delivered', 'cancelled'].indexOf(order.status) !== -1) {
      return res.status(400).json({ success: false, message: 'Impossible d\'annuler cette commande' });
    }
    order.status = 'cancelled';
    order.cancelledBy = 'rider';
    order.cancellationReason = req.body.reason || 'Annule par le client';
    order.cancelledAt = new Date();
    order.save().then(function(saved) {
      res.json({ success: true, order: saved });
    });
  }).catch(function(err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  });
});

// Rate order
router.put('/:id/rate', protect, function(req, res) {
  Order.findById(req.params.id).then(function(order) {
    if (!order) return res.status(404).json({ success: false, message: 'Commande non trouvee' });
    order.rating = {
      food: req.body.foodRating,
      delivery: req.body.deliveryRating,
      review: req.body.review || ''
    };
    order.save().then(function(saved) {
      res.json({ success: true, order: saved });
    });
  }).catch(function(err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  });
});

module.exports = router;
