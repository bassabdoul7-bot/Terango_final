var Delivery = require('../models/Delivery');
var { sendPushNotification } = require('../services/pushService');
var Driver = require('../models/Driver');
var Rider = require('../models/Rider');
var User = require('../models/User');

// Pricing config
var PRICING = {
  colis: {
    base: 500,
    perKm: 150,
    sizeSurcharge: { petit: 0, moyen: 300, grand: 700 }
  },
  commande: {
    base: 1000,
    perKm: 150,
    sizeSurcharge: { petit: 0, moyen: 0, grand: 0 }
  },
  commissionRate: 0.12
};

function calculateDeliveryPrice(serviceType, distance, size) {
  var config = PRICING[serviceType] || PRICING.colis;
  var baseFare = config.base;
  var distanceFare = Math.ceil(distance) * config.perKm;
  var surcharge = config.sizeSurcharge[size] || 0;
  var subtotal = baseFare + distanceFare + surcharge;
  var fare = Math.round(subtotal / 100) * 100;
  var commission = Math.round(fare * PRICING.commissionRate);
  var driverEarnings = fare - commission;

  return {
    fare: fare,
    deliveryFee: baseFare + distanceFare,
    sizeSurcharge: surcharge,
    platformCommission: commission,
    driverEarnings: driverEarnings
  };
}

// ========== GET PRICE ESTIMATE ==========

exports.getEstimate = function(req, res) {
  var serviceType = req.body.serviceType;
  var distance = req.body.distance;
  var size = req.body.size || 'petit';

  if (!serviceType || !distance) {
    return res.status(400).json({ success: false, message: 'Type de service et distance requis' });
  }

  var pricing = calculateDeliveryPrice(serviceType, distance, size);

  res.status(200).json({
    success: true,
    estimate: {
      serviceType: serviceType,
      distance: distance,
      size: size,
      fare: pricing.fare,
      deliveryFee: pricing.deliveryFee,
      sizeSurcharge: pricing.sizeSurcharge,
      currency: 'FCFA'
    }
  });
};

// ========== CREATE DELIVERY ==========

exports.createDelivery = function(req, res) {
  var io = req.app.get('io');
  var driverLocationService = req.app.get('driverLocationService');

  var serviceType = req.body.serviceType;
  var pickup = req.body.pickup;
  var dropoff = req.body.dropoff;
  var distance = req.body.distance;
  var estimatedDuration = req.body.estimatedDuration;
  var paymentMethod = req.body.paymentMethod || 'cash';

  if (!serviceType || !pickup || !dropoff || !distance) {
    return res.status(400).json({ success: false, message: 'DonnÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©es incomplÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¨tes' });
  }

  Rider.findOne({ userId: req.user._id })
    .then(function(rider) {
      if (!rider) {
        return res.status(404).json({ success: false, message: 'Profil passager non trouvÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©' });
      }

      var size = 'petit';
      if (req.body.packageDetails && req.body.packageDetails.size) {
        size = req.body.packageDetails.size;
      }

      var pricing = calculateDeliveryPrice(serviceType, distance, size);

      var delivery = new Delivery({
        riderId: rider._id,
        serviceType: serviceType,
        pickup: pickup,
        dropoff: dropoff,
        distance: distance,
        estimatedDuration: estimatedDuration || 20,
        fare: pricing.fare,
        deliveryFee: pricing.deliveryFee,
        sizeSurcharge: pricing.sizeSurcharge,
        platformCommission: pricing.platformCommission,
        driverEarnings: pricing.driverEarnings,
        paymentMethod: paymentMethod,
        packageDetails: serviceType === 'colis' ? req.body.packageDetails : undefined,
        commandeDetails: serviceType === 'commande' ? req.body.commandeDetails : undefined
      });

      return delivery.save();
    })
    .then(function(delivery) {
      if (!delivery) return;

      // Find nearby drivers who accept this service type
      var serviceKey = delivery.serviceType;

      driverLocationService.getNearbyDrivers(
        delivery.pickup.coordinates.latitude,
        delivery.pickup.coordinates.longitude,
        10
      ).then(function(nearbyDrivers) {
        if (nearbyDrivers.length === 0) {
          delivery.status = 'no_drivers_available';
          return delivery.save().then(function(d) {
            return res.status(200).json({
              success: true,
              message: 'Aucun livreur disponible',
              delivery: d
            });
          });
        }

        // Filter drivers by accepted services
        var driverIds = nearbyDrivers.map(function(d) { return d.driverId; });

        var serviceFilter = {};
        serviceFilter['acceptedServices.' + serviceKey] = true;

        Driver.find({
          _id: { $in: driverIds },
          isAvailable: true
        }).then(function(drivers) {
          var acceptingDrivers = drivers.filter(function(d) {
            return d.acceptedServices && d.acceptedServices[serviceKey];
          });

          if (acceptingDrivers.length === 0) {
            delivery.status = 'no_drivers_available';
            return delivery.save().then(function(d) {
              return res.status(200).json({
                success: true,
                message: 'Aucun livreur accepte ce type de livraison',
                delivery: d
              });
            });
          }

          // Emit to accepting drivers
          acceptingDrivers.forEach(function(driver) {
            io.to('driver-' + driver._id.toString()).emit('new-delivery', {
              deliveryId: delivery._id,
              serviceType: delivery.serviceType,
              pickup: delivery.pickup,
              dropoff: delivery.dropoff,
              fare: delivery.fare,
              driverEarnings: delivery.driverEarnings,
              distance: delivery.distance,
              packageDetails: delivery.packageDetails,
              commandeDetails: delivery.commandeDetails
            });
          });

          // Auto-cancel after 60 seconds if no driver accepts
          setTimeout(function() {
            Delivery.findById(delivery._id).then(function(d) {
              if (d && d.status === 'pending') {
                d.status = 'no_drivers_available';
                d.save();
                io.to(d._id.toString()).emit('delivery-expired', { deliveryId: d._id });
              }
            });
          }, 60000);

          res.status(201).json({
            success: true,
            message: 'Livraison demandÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e',
            delivery: delivery
          });
        });
      });
    })
    .catch(function(error) {
      console.error('Create Delivery Error:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la crÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ation de la livraison' });
    });
};

// ========== DRIVER ACCEPTS DELIVERY ==========

exports.acceptDelivery = function(req, res) {
  var io = req.app.get('io');

  Driver.findOne({ userId: req.user._id })
    .then(function(driver) {
      if (!driver) {
        return res.status(404).json({ success: false, message: 'Profil chauffeur non trouvÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©' });
      }

      return Delivery.findOne({ _id: req.params.deliveryId, status: 'pending' })
        .then(function(delivery) {
          if (!delivery) {
            return res.status(400).json({ success: false, message: 'Livraison non disponible' });
          }

          delivery.driver = driver._id;
          delivery.status = 'accepted';
          delivery.acceptedAt = new Date();
          return delivery.save();
        })
        .then(function(delivery) {
          if (!delivery) return;

          driver.isAvailable = false;
          driver.save();

          // Notify rider
          io.to(delivery._id.toString()).emit('delivery-accepted', {
            deliveryId: delivery._id,
            driver: {
              id: driver._id,
              name: null
            }
          });

          // Get driver user info
          User.findById(driver.userId).then(function(driverUser) {
            io.to(delivery._id.toString()).emit('delivery-accepted', {
              deliveryId: delivery._id,
              driver: {
                id: driver._id,
                name: driverUser ? driverUser.name : 'Livreur',
                phone: driverUser ? driverUser.phone : '',
                vehicle: driver.vehicle
              }
            });
          });

          // Push notify rider
          Delivery.findById(delivery._id).populate('riderId').then(function(d) {
            if (d && d.riderId) {
              sendPushNotification(d.riderId.userId, 'Livreur trouv\u00e9!', 'Un livreur a accept\u00e9 votre livraison.', { type: 'delivery-accepted', deliveryId: delivery._id.toString() });
            }
          });

          res.status(200).json({ success: true, delivery: delivery });
        });
    })
    .catch(function(error) {
      console.error('Accept Delivery Error:', error);
      res.status(500).json({ success: false, message: 'Erreur' });
    });
};

// ========== STATUS UPDATES ==========

exports.updateDeliveryStatus = function(req, res) {
  var io = req.app.get('io');
  var newStatus = req.body.status;
  var validTransitions = {
    'accepted': ['at_pickup'],
    'at_pickup': ['picked_up'],
    'picked_up': ['in_transit'],
    'in_transit': ['at_dropoff'],
    'at_dropoff': ['delivered']
  };

  Driver.findOne({ userId: req.user._id })
    .then(function(driver) {
      if (!driver) {
        return res.status(404).json({ success: false, message: 'Chauffeur non trouvÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©' });
      }

      return Delivery.findOne({ _id: req.params.deliveryId, driver: driver._id });
    })
    .then(function(delivery) {
      if (!delivery) {
        return res.status(404).json({ success: false, message: 'Livraison non trouvÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©e' });
      }

      var allowed = validTransitions[delivery.status];
      if (!allowed || allowed.indexOf(newStatus) === -1) {
        return res.status(400).json({ success: false, message: 'Transition de statut invalide' });
      }

      delivery.status = newStatus;

      if (newStatus === 'at_pickup') delivery.atPickupAt = new Date();
      if (newStatus === 'picked_up') delivery.pickedUpAt = new Date();
      if (newStatus === 'at_dropoff') delivery.atDropoffAt = new Date();
      if (newStatus === 'delivered') {
        delivery.deliveredAt = new Date();
        delivery.paymentStatus = 'completed';
        // Free up driver
        Driver.findById(delivery.driver).then(function(d) {
          if (d) {
            d.isAvailable = true;
            d.totalDeliveries = (d.totalDeliveries || 0) + 1;
            d.save();
          }
        });
      }

      if (req.body.photo) {
        if (newStatus === 'picked_up') delivery.pickupPhoto = req.body.photo;
        if (newStatus === 'delivered') delivery.deliveryPhoto = req.body.photo;
      }

      return delivery.save();
    })
    .then(function(delivery) {
      if (!delivery) return;

      io.to(delivery._id.toString()).emit('delivery-status', {
        deliveryId: delivery._id,
        status: delivery.status
      });

      res.status(200).json({ success: true, delivery: delivery });
    })
    .catch(function(error) {
      console.error('Update Delivery Status Error:', error);
      res.status(500).json({ success: false, message: 'Erreur' });
    });
};

// ========== GET DELIVERIES ==========

exports.getMyDeliveries = function(req, res) {
  Rider.findOne({ userId: req.user._id })
    .then(function(rider) {
      if (!rider) {
        return res.status(404).json({ success: false, message: 'Profil non trouvÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©' });
      }

      return Delivery.find({ riderId: rider._id })
        .sort({ createdAt: -1 })
        .limit(30);
    })
    .then(function(deliveries) {
      if (deliveries) {
        res.status(200).json({ success: true, deliveries: deliveries });
      }
    })
    .catch(function(error) {
      console.error('Get Deliveries Error:', error);
      res.status(500).json({ success: false, message: 'Erreur' });
    });
};

exports.getActiveDelivery = function(req, res) {
  Rider.findOne({ userId: req.user._id })
    .then(function(rider) {
      if (!rider) {
        return res.status(404).json({ success: false, message: 'Profil non trouvÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©' });
      }

      return Delivery.findOne({
        riderId: rider._id,
        status: { $in: ['pending', 'accepted', 'at_pickup', 'picked_up', 'in_transit', 'at_dropoff'] }
      });
    })
    .then(function(delivery) {
      res.status(200).json({ success: true, delivery: delivery || null });
    })
    .catch(function(error) {
      console.error('Get Active Delivery Error:', error);
      res.status(500).json({ success: false, message: 'Erreur' });
    });
};

exports.getDeliveryById = function(req, res) {
  Rider.findOne({ userId: req.user._id })
    .then(function(rider) {
      if (!rider) {
        return res.status(404).json({ success: false, message: 'Profil non trouve' });
      }
      return Delivery.findOne({ _id: req.params.deliveryId, riderId: rider._id })
        .populate('driver');
    })
    .then(function(delivery) {
      if (!delivery) {
        return res.status(404).json({ success: false, message: 'Livraison non trouvee' });
      }
      res.status(200).json({ success: true, delivery: delivery });
    })
    .catch(function(error) {
      console.error('Get Delivery By Id Error:', error);
      res.status(500).json({ success: false, message: 'Erreur' });
    });
};

exports.getDriverActiveDelivery = function(req, res) {
  Driver.findOne({ userId: req.user._id })
    .then(function(driver) {
      if (!driver) {
        return res.status(404).json({ success: false, message: 'Chauffeur non trouvÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©' });
      }

      return Delivery.findOne({
        driver: driver._id,
        status: { $in: ['accepted', 'at_pickup', 'picked_up', 'in_transit', 'at_dropoff'] }
      });
    })
    .then(function(delivery) {
      res.status(200).json({ success: true, delivery: delivery || null });
    })
    .catch(function(error) {
      console.error('Get Driver Active Delivery Error:', error);
      res.status(500).json({ success: false, message: 'Erreur' });
    });
};

exports.cancelDelivery = function(req, res) {
  var io = req.app.get('io');
  var userRole = req.user.role;

  var findProfile;
  if (userRole === 'driver') {
    findProfile = Driver.findOne({ userId: req.user._id }).then(function(driver) {
      if (!driver) return res.status(404).json({ success: false, message: 'Profil non trouv\u00e9' });
      return Delivery.findOne({ _id: req.params.deliveryId, driver: driver._id, status: { $in: ['pending', 'accepted'] } });
    });
  } else {
    findProfile = Rider.findOne({ userId: req.user._id }).then(function(rider) {
      if (!rider) return res.status(404).json({ success: false, message: 'Profil non trouv\u00e9' });
      return Delivery.findOne({ _id: req.params.deliveryId, riderId: rider._id, status: { $in: ['pending', 'accepted'] } });
    });
  }
  findProfile
    .then(function(delivery) {
      if (!delivery) {
        return res.status(400).json({ success: false, message: "Impossible d'annuler cette livraison" });
      }

      delivery.status = 'cancelled';
      delivery.cancelledBy = req.user.role;
      delivery.cancellationReason = req.body.reason || 'Annul\u00e9';
      if (delivery.driver) {
        Driver.findById(delivery.driver).then(function(d) {
          if (d) {
            d.isAvailable = true;
            d.save();
          }
        });
        io.to('driver-' + delivery.driver.toString()).emit('delivery-cancelled', { deliveryId: delivery._id });
      }

      return delivery.save();
    })
    .then(function(delivery) {
      if (delivery) {
        res.status(200).json({ success: true, message: 'Livraison annul\u00e9e' });
      }
    })
    .catch(function(error) {
      console.error('Cancel Delivery Error:', error);
      res.status(500).json({ success: false, message: 'Erreur' });
    });
};

