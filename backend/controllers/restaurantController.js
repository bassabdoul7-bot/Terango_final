var Restaurant = require('../models/Restaurant');
var Order = require('../models/Order');
var Delivery = require('../models/Delivery');
var Driver = require('../models/Driver');
var Rider = require('../models/Rider');
var { sendPushNotification } = require('../services/pushService');
var jwt = require('jsonwebtoken');
var bcrypt = require('bcryptjs');

// ========== PUBLIC ==========

exports.getRestaurants = function(req, res) {
  var query = { isActive: true };
  
  Restaurant.find(query)
    .select('-owner.password -bankInfo')
    .sort({ isFeatured: -1, rating: -1 })
    .then(function(restaurants) {
      res.json({ success: true, restaurants: restaurants });
    })
    .catch(function(err) {
      console.error('Get restaurants error:', err);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    });
};

exports.getRestaurantBySlug = function(req, res) {
  Restaurant.findOne({ slug: req.params.slug, isActive: true })
    .select('-owner.password -bankInfo')
    .then(function(restaurant) {
      if (!restaurant) {
        return res.status(404).json({ success: false, message: 'Restaurant non trouve' });
      }
      res.json({ success: true, restaurant: restaurant });
    })
    .catch(function(err) {
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    });
};

exports.getRestaurantById = function(req, res) {
  Restaurant.findById(req.params.id)
    .select('-owner.password -bankInfo')
    .then(function(restaurant) {
      if (!restaurant) {
        return res.status(404).json({ success: false, message: 'Restaurant non trouve' });
      }
      res.json({ success: true, restaurant: restaurant });
    })
    .catch(function(err) {
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    });
};

// ========== RESTAURANT AUTH ==========

exports.register = function(req, res) {
  var body = req.body;

  var restaurant = new Restaurant({
    name: body.name,
    description: body.description || '',
    phone: body.phone,
    email: body.email || '',
    address: {
      street: body.street,
      city: body.city || 'Dakar',
      coordinates: {
        latitude: body.latitude,
        longitude: body.longitude
      }
    },
    categories: body.categories || [],
    cuisine: body.cuisine || [],
    owner: {
      name: body.ownerName,
      phone: body.ownerPhone || body.phone,
      password: body.password
    }
  });

  restaurant.save().then(function(saved) {
    var token = jwt.sign(
      { id: saved._id, role: 'restaurant' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.status(201).json({ success: true, token: token, restaurant: { _id: saved._id, name: saved.name, slug: saved.slug } });
  }).catch(function(err) {
    console.error('Register restaurant error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  });
};

exports.login = function(req, res) {
  Restaurant.findOne({ phone: req.body.phone }).then(function(restaurant) {
    if (!restaurant) {
      return res.status(404).json({ success: false, message: 'Restaurant non trouve' });
    }

    bcrypt.compare(req.body.password, restaurant.owner.password).then(function(match) {
      if (!match) {
        return res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
      }

      var token = jwt.sign(
        { id: restaurant._id, role: 'restaurant' },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      res.json({ success: true, token: token, restaurant: { _id: restaurant._id, name: restaurant.name, slug: restaurant.slug } });
    });
  }).catch(function(err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  });
};

// ========== RESTAURANT PROFILE ==========

exports.getProfile = function(req, res) {
  res.json({ success: true, restaurant: req.restaurant });
};

exports.updateProfile = function(req, res) {
  var updates = req.body;
  var allowed = ['name', 'description', 'phone', 'email', 'address', 'categories', 'cuisine', 'hours', 'minimumOrder', 'estimatedDeliveryTime', 'deliveryRadius'];
  
  allowed.forEach(function(field) {
    if (updates[field] !== undefined) {
      req.restaurant[field] = updates[field];
    }
  });

  req.restaurant.save().then(function(saved) {
    res.json({ success: true, restaurant: saved });
  }).catch(function(err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  });
};

exports.toggleOpen = function(req, res) {
  req.restaurant.isOpen = !req.restaurant.isOpen;
  req.restaurant.save().then(function(saved) {
    res.json({ success: true, isOpen: saved.isOpen });
  }).catch(function(err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  });
};

// ========== MENU MANAGEMENT ==========

exports.addMenuItem = function(req, res) {
  req.restaurant.menu.push(req.body);
  req.restaurant.save().then(function(saved) {
    var item = saved.menu[saved.menu.length - 1];
    res.status(201).json({ success: true, item: item });
  }).catch(function(err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  });
};

exports.updateMenuItem = function(req, res) {
  var item = req.restaurant.menu.id(req.params.itemId);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Item non trouve' });
  }

  Object.keys(req.body).forEach(function(key) {
    item[key] = req.body[key];
  });

  req.restaurant.save().then(function(saved) {
    res.json({ success: true, item: saved.menu.id(req.params.itemId) });
  }).catch(function(err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  });
};

exports.deleteMenuItem = function(req, res) {
  req.restaurant.menu.pull({ _id: req.params.itemId });
  req.restaurant.save().then(function() {
    res.json({ success: true, message: 'Item supprime' });
  }).catch(function(err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  });
};

exports.toggleItemAvailability = function(req, res) {
  var item = req.restaurant.menu.id(req.params.itemId);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Item non trouve' });
  }

  item.isAvailable = !item.isAvailable;
  req.restaurant.save().then(function(saved) {
    res.json({ success: true, isAvailable: saved.menu.id(req.params.itemId).isAvailable });
  }).catch(function(err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  });
};

// ========== ORDER MANAGEMENT ==========

exports.getOrders = function(req, res) {
  var status = req.query.status;
  var query = { restaurant: req.restaurant._id };
  if (status) query.status = status;

  Order.find(query)
    .populate({ path: 'riderId', populate: { path: 'userId', select: 'name phone' } })
    .sort({ createdAt: -1 })
    .limit(50)
    .then(function(orders) {
      res.json({ success: true, orders: orders });
    })
    .catch(function(err) {
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    });
};

exports.acceptOrder = function(req, res) {
  var io = req.app.get('io');
  var driverLocationService = req.app.get('driverLocationService');

  Order.findOneAndUpdate(
    { _id: req.params.orderId, restaurant: req.restaurant._id, status: 'pending' },
    { status: 'confirmed', confirmedAt: new Date() },
    { new: true }
  ).then(function(order) {
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande non trouvee' });
    }

    // Calculate delivery pricing (same formula as deliveryController)
    var PRICING_COMMANDE = { base: 1000, perKm: 150 };
    var COMMISSION_RATE = 0.05;
    var distance = order.distance || 3; // fallback 3km if not set
    var baseFare = PRICING_COMMANDE.base;
    var distanceFare = Math.ceil(distance) * PRICING_COMMANDE.perKm;
    var fare = Math.round((baseFare + distanceFare) / 100) * 100;
    var commission = Math.round(fare * COMMISSION_RATE);
    var driverEarnings = fare - commission;

    // Build items description for commandeDetails
    var itemsList = order.items.map(function(item) {
      return item.quantity + 'x ' + item.name;
    }).join(', ');

    // Create a Delivery record linked to this order
    var delivery = new Delivery({
      orderId: order._id,
      riderId: order.riderId,
      serviceType: 'commande',
      pickup: {
        address: order.pickup.address || '',
        coordinates: {
          latitude: order.pickup.coordinates.latitude,
          longitude: order.pickup.coordinates.longitude
        },
        contactName: req.restaurant.name,
        contactPhone: req.restaurant.phone || ''
      },
      dropoff: {
        address: order.dropoff.address,
        coordinates: {
          latitude: order.dropoff.coordinates.latitude,
          longitude: order.dropoff.coordinates.longitude
        },
        contactName: '',
        contactPhone: ''
      },
      commandeDetails: {
        storeName: req.restaurant.name,
        storeType: 'restaurant',
        itemsList: itemsList,
        estimatedItemsCost: order.subtotal
      },
      distance: distance,
      estimatedDuration: order.estimatedDeliveryTime || 20,
      fare: fare,
      deliveryFee: baseFare + distanceFare,
      sizeSurcharge: 0,
      platformCommission: commission,
      driverEarnings: driverEarnings,
      paymentMethod: order.paymentMethod || 'cash'
    });

    return delivery.save().then(function(savedDelivery) {
      // Link delivery back to the order
      order.deliveryId = savedDelivery._id;
      return order.save().then(function() {
        // Notify rider that order was confirmed
        io.to(order._id.toString()).emit('order-status', {
          orderId: order._id,
          status: 'confirmed'
        });

        // Push notify rider
        Rider.findById(order.riderId).then(function(rider) {
          if (rider) {
            sendPushNotification(
              rider.userId,
              'Commande confirmee!',
              'Le restaurant ' + req.restaurant.name + ' prepare votre commande.',
              { type: 'order-confirmed', orderId: order._id.toString() }
            );
          }
        }).catch(function() {});

        // Find nearby drivers and broadcast the delivery
        driverLocationService.getNearbyDrivers(
          savedDelivery.pickup.coordinates.latitude,
          savedDelivery.pickup.coordinates.longitude,
          10
        ).then(function(nearbyDrivers) {
          if (nearbyDrivers.length === 0) {
            console.log('Restaurant order ' + order._id + ': no nearby drivers found');
            savedDelivery.status = 'no_drivers_available';
            savedDelivery.save();
            return;
          }

          var driverIds = nearbyDrivers.map(function(d) { return d.driverId; });

          Driver.find({
            _id: { $in: driverIds },
            isAvailable: true,
            isOnline: true
          }).then(function(drivers) {
            // Filter drivers who accept 'resto' or 'commande' service type
            var acceptingDrivers = drivers.filter(function(d) {
              return d.acceptedServices && (d.acceptedServices.resto || d.acceptedServices.commande);
            });

            if (acceptingDrivers.length === 0) {
              console.log('Restaurant order ' + order._id + ': no drivers accept resto/commande');
              savedDelivery.status = 'no_drivers_available';
              savedDelivery.save();
              return;
            }

            // Emit new-delivery to each accepting driver
            acceptingDrivers.forEach(function(driver) {
              io.to('driver-' + driver._id.toString()).emit('new-delivery', {
                deliveryId: savedDelivery._id,
                serviceType: savedDelivery.serviceType,
                pickup: savedDelivery.pickup,
                dropoff: savedDelivery.dropoff,
                fare: savedDelivery.fare,
                driverEarnings: savedDelivery.driverEarnings,
                distance: savedDelivery.distance,
                commandeDetails: savedDelivery.commandeDetails,
                orderId: order._id
              });
            });

            console.log('Restaurant order ' + order._id + ': broadcasted to ' + acceptingDrivers.length + ' drivers');

            // Auto-cancel after 60 seconds if no driver accepts
            setTimeout(function() {
              Delivery.findById(savedDelivery._id).then(function(d) {
                if (d && d.status === 'pending') {
                  d.status = 'no_drivers_available';
                  d.save();
                  io.to(d._id.toString()).emit('delivery-expired', { deliveryId: d._id });
                  console.log('Restaurant delivery ' + d._id + ' expired (no driver accepted in 60s)');
                }
              });
            }, 60000);
          });
        }).catch(function(err) {
          console.error('Find drivers for restaurant order error:', err);
        });

        res.json({ success: true, order: order, deliveryId: savedDelivery._id });
      });
    });
  }).catch(function(err) {
    console.error('Accept order error:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  });
};

exports.rejectOrder = function(req, res) {
  Order.findOneAndUpdate(
    { _id: req.params.orderId, restaurant: req.restaurant._id, status: 'pending' },
    { status: 'cancelled', cancelledBy: 'restaurant', cancellationReason: req.body.reason || 'Refuse par le restaurant', cancelledAt: new Date() },
    { new: true }
  ).then(function(order) {
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande non trouvee' });
    }
    res.json({ success: true, order: order });
  }).catch(function(err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  });
};

exports.markPreparing = function(req, res) {
  Order.findOneAndUpdate(
    { _id: req.params.orderId, restaurant: req.restaurant._id, status: 'confirmed' },
    { status: 'preparing', preparingAt: new Date() },
    { new: true }
  ).then(function(order) {
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande non trouvee' });
    }
    res.json({ success: true, order: order });
  }).catch(function(err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  });
};

exports.markReady = function(req, res) {
  Order.findOneAndUpdate(
    { _id: req.params.orderId, restaurant: req.restaurant._id, status: 'preparing' },
    { status: 'ready', readyAt: new Date() },
    { new: true }
  ).then(function(order) {
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande non trouvee' });
    }
    res.json({ success: true, order: order });
  }).catch(function(err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  });
};

// ========== DASHBOARD ==========

exports.getDashboardStats = function(req, res) {
  var restaurantId = req.restaurant._id;

  Promise.all([
    Order.countDocuments({ restaurant: restaurantId }),
    Order.countDocuments({ restaurant: restaurantId, status: 'delivered' }),
    Order.countDocuments({ restaurant: restaurantId, status: { $in: ['pending', 'confirmed', 'preparing', 'ready'] } }),
    Order.aggregate([
      { $match: { restaurant: restaurantId, status: 'delivered' } },
      { $group: { _id: null, total: { $sum: '$restaurantEarnings' } } }
    ])
  ]).then(function(results) {
    res.json({
      success: true,
      stats: {
        totalOrders: results[0],
        completedOrders: results[1],
        activeOrders: results[2],
        totalRevenue: results[3].length > 0 ? results[3][0].total : 0
      }
    });
  }).catch(function(err) {
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  });
};
