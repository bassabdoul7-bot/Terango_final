var Delivery = require('../models/Delivery');
var Order = require('../models/Order');
var { sendPushNotification } = require('../services/pushService');
var Driver = require('../models/Driver');
var Rider = require('../models/Rider');
var User = require('../models/User');

// Pricing config
var PRICING = {
  colis: {
    base: 500,
    perKmTiers: [
      { maxKm: 10, rate: 150 },
      { maxKm: 30, rate: 200 },
      { maxKm: Infinity, rate: 250 }
    ],
    sizeSurcharge: { petit: 0, moyen: 300, grand: 600 }
  },
  commande: {
    base: 1000,
    perKmTiers: [
      { maxKm: 10, rate: 150 },
      { maxKm: 30, rate: 200 },
      { maxKm: Infinity, rate: 250 }
    ],
    sizeSurcharge: { petit: 0, moyen: 300, grand: 600 }
  },
  commissionRate: 0.05
};

function calculateTieredDistance(distance, tiers) {
  var remaining = distance;
  var total = 0;
  var prevMax = 0;
  for (var i = 0; i < tiers.length; i++) {
    var tierKm = Math.min(remaining, tiers[i].maxKm - prevMax);
    if (tierKm <= 0) break;
    total += tierKm * tiers[i].rate;
    remaining -= tierKm;
    prevMax = tiers[i].maxKm;
    if (remaining <= 0) break;
  }
  return total;
}

function calculateDeliveryPrice(serviceType, distance, size) {
  var config = PRICING[serviceType] || PRICING.colis;
  var baseFare = config.base;
  var distanceFare = Math.round(calculateTieredDistance(distance, config.perKmTiers));
  var surcharge = config.sizeSurcharge[size] || 0;
  var subtotal = baseFare + distanceFare + surcharge;
  var fare = Math.ceil(subtotal / 100) * 100;
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
    return res.status(400).json({ success: false, message: 'Données incomplètes' });
  }

  Rider.findOne({ userId: req.user._id })
    .then(function(rider) {
      if (!rider) {
        return res.status(404).json({ success: false, message: 'Profil passager non trouvé' });
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
          isAvailable: true,
          isOnline: true
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
            message: 'Livraison demandée',
            delivery: delivery
          });
        });
      });
    })
    .catch(function(error) {
      console.error('Create Delivery Error:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la création de la livraison' });
    });
};

// ========== DRIVER ACCEPTS DELIVERY ==========

exports.acceptDelivery = function(req, res) {
  var io = req.app.get('io');

  Driver.findOne({ userId: req.user._id })
    .then(function(driver) {
      if (!driver) {
        return res.status(404).json({ success: false, message: 'Profil chauffeur non trouvé' });
      }

      if (driver.isBlockedForPayment === true) {
        return res.status(403).json({
          success: false,
          message: 'Vous devez payer votre commission avant d\'accepter de nouvelles courses. Envoyez ' + driver.commissionBalance + ' FCFA par Wave.'
        });
      }

      return Delivery.findOneAndUpdate(
        { _id: req.params.deliveryId, status: 'pending' },
        { driver: driver._id, status: 'accepted', acceptedAt: new Date() },
        { new: true }
      )
        .then(function(delivery) {
          if (!delivery) {
            return res.status(400).json({ success: false, message: 'Livraison non disponible' });
          }

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

          // Sync linked Order status if this is a restaurant delivery
          if (delivery.orderId) {
            Order.findByIdAndUpdate(
              delivery.orderId,
              { status: 'driver_assigned', driver: driver._id },
              { new: true }
            ).then(function(order) {
              if (order) {
                io.to(order._id.toString()).emit('order-status', {
                  orderId: order._id,
                  status: 'driver_assigned',
                  driverId: driver._id
                });
              }
            }).catch(function(err) {
              console.error('Sync order status on accept error:', err);
            });
          }

          // Push notify rider (restaurant-specific message if linked to order)
          Delivery.findById(delivery._id).populate('riderId').then(function(d) {
            if (d && d.riderId) {
              var pushTitle = d.orderId ? 'Chauffeur en route vers le restaurant' : 'Livreur trouve!';
              var pushBody = d.orderId ? 'Un chauffeur a ete assigne a votre commande et se dirige vers le restaurant.' : 'Un livreur a accepte votre livraison.';
              sendPushNotification(d.riderId.userId, pushTitle, pushBody, { type: 'delivery-accepted', deliveryId: delivery._id.toString(), orderId: d.orderId ? d.orderId.toString() : null });
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
    'picked_up': ['at_dropoff'],
    'at_dropoff': ['delivered']
  };

  Driver.findOne({ userId: req.user._id })
    .then(function(driver) {
      if (!driver) {
        return res.status(404).json({ success: false, message: 'Chauffeur non trouvé' });
      }

      return Delivery.findOne({ _id: req.params.deliveryId, driver: driver._id });
    })
    .then(function(delivery) {
      if (!delivery) {
        return res.status(404).json({ success: false, message: 'Livraison non trouvée' });
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
        // Free up driver (or promote queued ride) + track commission
        Driver.findById(delivery.driver).then(function(d) {
          if (!d) return;
          var hasQueuedJob = !!(d.queuedJob && d.queuedJob.refId);
          d.isAvailable = !hasQueuedJob;
          d.totalDeliveries = (d.totalDeliveries || 0) + 1;
          d.totalEarnings = (d.totalEarnings || 0) + (delivery.driverEarnings || 0);
          d.commissionBalance = (d.commissionBalance || 0) + (delivery.platformCommission || 0);
          if (d.commissionBalance >= (d.commissionCap || 750)) {
            d.isBlockedForPayment = true;
          }
          return d.save().then(function() {
            if (hasQueuedJob) {
              var promote = require('../services/tripQueueService').promoteQueuedJob;
              return promote(d._id, io);
            }
          });
        }).catch(function(err) { console.error('Driver free/promote on delivery complete:', err); });
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

      // Sync linked Order status if this is a restaurant delivery
      if (delivery.orderId) {
        var orderStatusMap = {
          'at_pickup': null, // no order status change for at_pickup
          'picked_up': 'picked_up',
          'at_dropoff': 'delivering',
          'delivered': 'delivered'
        };
        var newOrderStatus = orderStatusMap[delivery.status];
        if (newOrderStatus) {
          var orderUpdate = { status: newOrderStatus };
          if (newOrderStatus === 'picked_up') orderUpdate.pickedUpAt = new Date();
          if (newOrderStatus === 'delivered') orderUpdate.deliveredAt = new Date();

          Order.findByIdAndUpdate(delivery.orderId, orderUpdate, { new: true })
            .then(function(order) {
              if (order) {
                io.to(order._id.toString()).emit('order-status', {
                  orderId: order._id,
                  status: newOrderStatus
                });
              }
            }).catch(function(err) {
              console.error('Sync order status error:', err);
            });
        }
      }

      // Push notify rider on key status changes
      if (delivery.status === 'at_pickup' || delivery.status === 'picked_up' || delivery.status === 'delivered') {
        Delivery.findById(delivery._id).populate('riderId').then(function(d) {
          if (d && d.riderId) {
            var isRestaurantOrder = !!d.orderId;
            var pushTitle, pushBody;
            if (delivery.status === 'at_pickup') {
              pushTitle = isRestaurantOrder ? 'Chauffeur au restaurant' : 'Chauffeur au point de retrait';
              pushBody = isRestaurantOrder ? 'Votre chauffeur est arrive au restaurant pour recuperer votre commande.' : 'Votre livreur est arrive au point de retrait';
            } else if (delivery.status === 'picked_up') {
              pushTitle = isRestaurantOrder ? 'Votre commande a ete recuperee' : 'Colis recupere, en route';
              pushBody = isRestaurantOrder ? 'Le chauffeur a recupere votre commande et est en route vers vous.' : 'Votre colis a ete recupere et est en route';
            } else if (delivery.status === 'delivered') {
              pushTitle = isRestaurantOrder ? 'Votre commande est arrivee!' : 'Livraison effectuee!';
              pushBody = isRestaurantOrder ? 'Votre commande a ete livree avec succes. Bon appetit!' : 'Votre livraison a ete effectuee avec succes';
            }
            sendPushNotification(d.riderId.userId, pushTitle, pushBody, {
              type: 'delivery-status',
              deliveryId: delivery._id.toString(),
              orderId: d.orderId ? d.orderId.toString() : null,
              status: delivery.status
            });
          }
        });
      }

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
        return res.status(404).json({ success: false, message: 'Profil non trouvé' });
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
        return res.status(404).json({ success: false, message: 'Profil non trouvé' });
      }

      return Delivery.findOne({
        riderId: rider._id,
        status: { $in: ['pending', 'accepted', 'at_pickup', 'picked_up', 'at_dropoff'] }
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
        return res.status(404).json({ success: false, message: 'Profil non trouvé' });
      }
      return Delivery.findOne({ _id: req.params.deliveryId, riderId: rider._id })
        .populate('driver');
    })
    .then(function(delivery) {
      if (!delivery) {
        return res.status(404).json({ success: false, message: 'Livraison non trouvée' });
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
        return res.status(404).json({ success: false, message: 'Chauffeur non trouvé' });
      }

      return Delivery.findOne({
        driver: driver._id,
        status: { $in: ['accepted', 'at_pickup', 'picked_up', 'at_dropoff'] }
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

// ========== APPEND GPS TRAIL POINTS ==========

exports.appendDeliveryTrailPoints = function(req, res) {
  var points = req.body.points;
  if (!points || !Array.isArray(points) || points.length === 0) {
    return res.status(400).json({ success: false, message: 'Points requis' });
  }

  Driver.findOne({ userId: req.user._id })
    .then(function(driver) {
      if (!driver) {
        return res.status(404).json({ success: false, message: 'Profil chauffeur non trouvé' });
      }

      return Delivery.findOne({ _id: req.params.deliveryId, driver: driver._id })
        .then(function(delivery) {
          if (!delivery) {
            return res.status(404).json({ success: false, message: 'Livraison non trouvée' });
          }

          if (['picked_up', 'in_transit', 'at_dropoff'].indexOf(delivery.status) === -1) {
            return res.status(400).json({ success: false, message: 'La livraison doit être en cours' });
          }

          var validPoints = points
            .filter(function(p) { return p.latitude && p.longitude; })
            .map(function(p) { return { latitude: p.latitude, longitude: p.longitude, timestamp: p.timestamp || new Date() }; });

          if (validPoints.length === 0) {
            return res.status(400).json({ success: false, message: 'Aucun point valide' });
          }

          return Delivery.findByIdAndUpdate(req.params.deliveryId, {
            $push: { routeTrail: { $each: validPoints } }
          }).then(function() {
            res.status(200).json({ success: true, message: 'Points ajoutés', count: validPoints.length });
          });
        });
    })
    .catch(function(error) {
      console.error('Append Delivery Trail Points Error:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de l\'ajout des points' });
    });
};

exports.cancelDelivery = function(req, res) {
  var io = req.app.get('io');
  var userRole = req.user.role;

  var findProfile;
  if (userRole === 'driver') {
    findProfile = Driver.findOne({ userId: req.user._id }).then(function(driver) {
      if (!driver) return res.status(404).json({ success: false, message: 'Profil non trouvé' });
      return Delivery.findOne({ _id: req.params.deliveryId, driver: driver._id, status: { $in: ['pending', 'accepted'] } });
    });
  } else {
    findProfile = Rider.findOne({ userId: req.user._id }).then(function(rider) {
      if (!rider) return res.status(404).json({ success: false, message: 'Profil non trouvé' });
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
      delivery.cancellationReason = req.body.reason || 'Annulé';
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
        res.status(200).json({ success: true, message: 'Livraison annulée' });
      }
    })
    .catch(function(error) {
      console.error('Cancel Delivery Error:', error);
      res.status(500).json({ success: false, message: 'Erreur' });
    });
};

// @desc    Upload emergency video recording for a delivery
// @route   PUT /api/deliveries/:deliveryId/emergency-recording
// @access  Private (Rider or Driver)
exports.uploadEmergencyRecording = async function(req, res) {
  try {
    var delivery = await Delivery.findById(req.params.deliveryId);
    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Livraison non trouvee' });
    }

    // Verify the user is either the rider or the driver of this delivery
    var rider = await Rider.findOne({ userId: req.user._id });
    var driver = await Driver.findOne({ userId: req.user._id });
    var isRider = rider && delivery.riderId.toString() === rider._id.toString();
    var isDriver = driver && delivery.driver && delivery.driver.toString() === driver._id.toString();

    if (!isRider && !isDriver) {
      return res.status(403).json({ success: false, message: 'Non autorise' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Fichier media requis' });
    }

    var audioUrl = '/recordings/' + req.file.filename;
    var duration = req.body.duration ? Number(req.body.duration) : 0;

    delivery.emergencyRecordings.push({
      recordedBy: req.user._id.toString(),
      audioUrl: audioUrl,
      recordedAt: new Date(),
      duration: duration
    });
    await delivery.save();

    // Send Telegram alert to admins
    var https = require('https');
    var TELEGRAM_BOT = process.env.TELEGRAM_BOT_TOKEN || '';
    var TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '';
    if (TELEGRAM_BOT && TELEGRAM_CHAT) {
      var alertMsg = '🚨 Enregistrement video d\'urgence — Livraison #' + delivery._id.toString().slice(-6) + '\nPar: ' + (isRider ? 'Client' : 'Livreur') + '\nDuree: ' + duration + 's';
      var data = JSON.stringify({ chat_id: TELEGRAM_CHAT, text: alertMsg });
      var opts = { hostname: 'api.telegram.org', path: '/bot' + TELEGRAM_BOT + '/sendMessage', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
      var r = https.request(opts, function() {});
      r.on('error', function() {});
      r.write(data);
      r.end();
    }

    res.status(200).json({
      success: true,
      message: 'Enregistrement sauvegarde',
      recording: { audioUrl: audioUrl, recordedAt: new Date(), duration: duration }
    });
  } catch (error) {
    console.error('Upload Emergency Recording Error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'upload de l\'enregistrement' });
  }
};