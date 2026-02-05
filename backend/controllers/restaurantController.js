var Restaurant = require('../models/Restaurant');
var Order = require('../models/Order');
var Driver = require('../models/Driver');
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
  
  bcrypt.hash(body.password, 10).then(function(hashed) {
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
        password: hashed
      }
    });

    restaurant.save().then(function(saved) {
      var token = jwt.sign(
        { id: saved._id, role: 'restaurant' },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      res.status(201).json({ success: true, token: token, restaurant: { _id: saved._id, name: saved.name, slug: saved.slug } });
    });
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
    .populate('riderId', 'userId')
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
  Order.findOneAndUpdate(
    { _id: req.params.orderId, restaurant: req.restaurant._id, status: 'pending' },
    { status: 'confirmed', confirmedAt: new Date() },
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
