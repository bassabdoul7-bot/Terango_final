var Driver = require('../models/Driver');
var User = require('../models/User');
var Ride = require('../models/Ride');
var Delivery = require('../models/Delivery');
var Delivery = require('../models/Delivery');

exports.getProfile = function(req, res) {
  Driver.findOne({ userId: req.user._id })
    .populate('userId', 'name phone email rating profilePhoto photoStatus photoVerified')
    .then(function(driver) {
      if (!driver) {
        return res.status(404).json({ success: false, message: 'Profil chauffeur non trouvé' });
      }
      res.status(200).json({ success: true, driver: driver });
    })
    .catch(function(error) {
      console.error('Get Profile Error:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la récupération du profil' });
    });
};

exports.completeProfile = function(req, res) {
  var driverLicenseNumber = req.body.driverLicenseNumber;
  var driverLicensePhoto = req.body.driverLicensePhoto;
  var vehicle = req.body.vehicle;

  Driver.findOne({ userId: req.user._id })
    .then(function(driver) {
      if (!driver) {
        return res.status(404).json({ success: false, message: 'Profil chauffeur non trouvé' });
      }
      driver.driverLicenseNumber = driverLicenseNumber;
      driver.driverLicensePhoto = driverLicensePhoto;
      driver.vehicle = vehicle;
      driver.verificationStatus = 'approved';
      return driver.save();
    })
    .then(function(driver) {
      if (driver) {
        res.status(200).json({
          success: true,
          message: 'Profil complété. En attente de vérification.',
          driver: driver
        });
      }
    })
    .catch(function(error) {
      console.error('Complete Profile Error:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour du profil' });
    });
};

exports.toggleOnlineStatus = function(req, res) {
  var isOnline = req.body.isOnline;
  var latitude = req.body.latitude;
  var longitude = req.body.longitude;

  Driver.findOne({ userId: req.user._id })
    .then(function(driver) {
      if (!driver) {
        return res.status(404).json({ success: false, message: 'Profil chauffeur non trouvé' });
      }
    // if (driver.verificationStatus !== 'approved') {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Votre compte doit \u00eatre v\u00e9rifi\u00e9 pour vous mettre en ligne'
    //   });
    // }

      var driverLocationService = req.app.get('driverLocationService');
      driver.isOnline = isOnline;
      driver.isAvailable = isOnline;

      driver.save().then(function() {
        if (isOnline && latitude && longitude) {
          return driverLocationService.setDriverOnline(driver._id.toString(), latitude, longitude, {
            vehicle: driver.vehicle,
            rating: (driver.userId && driver.userId.rating) ? driver.userId.rating : 5.0
          });
        } else {
          return driverLocationService.setDriverOffline(driver._id.toString());
        }
      }).then(function() {
        res.status(200).json({
          success: true,
          message: isOnline ? 'Vous êtes maintenant en ligne' : 'Vous êtes maintenant hors ligne',
          isOnline: driver.isOnline
        });
      });
    })
    .catch(function(error) {
      console.error('Toggle Online Error:', error);
      res.status(500).json({ success: false, message: 'Erreur lors du changement de statut' });
    });
};

exports.updateLocation = function(req, res) {
  var latitude = req.body.latitude;
  var longitude = req.body.longitude;

  Driver.findOne({ userId: req.user._id })
    .populate('userId', 'rating')
    .then(function(driver) {
      if (!driver) {
        return res.status(404).json({ success: false, message: 'Profil chauffeur non trouvé' });
      }

      var driverLocationService = req.app.get('driverLocationService');
      var io = req.app.get('io');

      driverLocationService.updateDriverLocation(
        driver._id.toString(),
        latitude,
        longitude,
        {
          vehicle: driver.vehicle,
          rating: (driver.userId && driver.userId.rating) ? driver.userId.rating : 5.0
        }
      ).then(function() {
        driver.currentLocation = {
          type: 'Point',
          coordinates: { latitude: latitude, longitude: longitude }
        };
        driver.lastLocationUpdate = new Date();
        return driver.save();
      }).then(function() {
        return Ride.findOne({
          driver: driver._id,
          status: { $in: ['accepted', 'in_progress', 'arrived'] }
        });
      }).then(function(activeRide) {
        if (activeRide) {
          io.to(activeRide._id.toString()).emit('driver-location-update', {
            driverId: driver._id,
            location: { latitude: latitude, longitude: longitude },
            timestamp: new Date()
          });
        }


        // Also emit to active delivery room
        Delivery.findOne({
          driver: driver._id,
          status: { $in: ['accepted', 'picked_up', 'in_transit', 'at_pickup'] }
        }).then(function(activeDelivery) {
          if (activeDelivery) {
            io.to(activeDelivery._id.toString()).emit('driver-location-update', {
              driverId: driver._id,
              location: { latitude: latitude, longitude: longitude },
              timestamp: new Date()
            });
          }
        });

        io.to('riders-watching').emit('nearby-driver-location', {
          driverId: driver._id.toString(),
          location: { latitude: latitude, longitude: longitude },
          timestamp: new Date()
        });

        res.status(200).json({
          success: true,
          currentLocation: { latitude: latitude, longitude: longitude }
        });
      });
    })
    .catch(function(error) {
      console.error('Update Location Error:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour de la localisation' });
    });
};

exports.getNearbyDrivers = function(req, res) {
  var latitude = req.query.latitude;
  var longitude = req.query.longitude;
  var radius = req.query.radius || 10;

  if (!latitude || !longitude) {
    return res.status(400).json({ success: false, message: 'Latitude et longitude requises' });
  }

  var driverLocationService = req.app.get('driverLocationService');

  driverLocationService.getNearbyDrivers(
    parseFloat(latitude),
    parseFloat(longitude),
    parseFloat(radius)
  ).then(function(nearbyDrivers) {
    var promises = nearbyDrivers.map(function(redisDriver) {
      return Driver.findById(redisDriver.driverId)
        .populate('userId', 'name rating')
        .then(function(mongoDriver) {
          return {
            _id: redisDriver.driverId,
            location: redisDriver.location,
            distance: redisDriver.distance,
            vehicle: (mongoDriver && mongoDriver.vehicle) ? mongoDriver.vehicle : redisDriver.vehicle,
            rating: (mongoDriver && mongoDriver.userId && mongoDriver.userId.rating) ? mongoDriver.userId.rating : (redisDriver.rating || 5.0),
            name: (mongoDriver && mongoDriver.userId) ? mongoDriver.userId.name : null
          };
        })
        .catch(function() {
          return redisDriver;
        });
    });

    return Promise.all(promises);
  }).then(function(enrichedDrivers) {
    res.status(200).json({
      success: true,
      count: enrichedDrivers.length,
      drivers: enrichedDrivers
    });
  }).catch(function(error) {
    console.error('Get Nearby Drivers Error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la recherche de chauffeurs' });
  });
};

exports.getActiveRide = function(req, res) {
  Driver.findOne({ userId: req.user._id })
    .then(function(driver) {
      if (!driver) {
        return res.status(404).json({ success: false, message: 'Profil chauffeur non trouvé' });
      }

      return Ride.findOne({
        driver: driver._id,
        status: { $in: ['accepted', 'arrived', 'in_progress'] }
      }).populate('riderId');
    })
    .then(function(activeRide) {
      if (!activeRide) {
        return res.status(200).json({ success: true, ride: null });
      }

      var riderId = activeRide.riderId;
      var userIdRef = riderId ? riderId.userId : null;

      if (!userIdRef) {
        var rideObj = activeRide.toObject();
        rideObj.rider = null;
        return res.status(200).json({ success: true, ride: rideObj });
      }

      User.findById(userIdRef).then(function(riderUser) {
        var rideObj = activeRide.toObject();
        rideObj.rider = riderUser ? { name: riderUser.name, phone: riderUser.phone } : null;
        res.status(200).json({ success: true, ride: rideObj });
      });
    })
    .catch(function(error) {
      console.error('Get Active Ride Error:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la récupération de la course active' });
    });
};

exports.getEarnings = function(req, res) {
  Driver.findOne({ userId: req.user._id })
    .then(function(driver) {
      if (!driver) {
        return res.status(404).json({ success: false, message: 'Profil chauffeur non trouvé' });
      }

      return Ride.find({ driver: driver._id, status: 'completed' });
    })
    .then(function(completedRides) {
      if (!completedRides) return;

      var totalEarnings = completedRides.reduce(function(sum, ride) {
        return sum + (ride.driverEarnings || ride.fare || 0);
      }, 0);

      var today = new Date();
      today.setHours(0, 0, 0, 0);

      var todayEarnings = 0;
      var todayRides = 0;

      completedRides.forEach(function(ride) {
        var rideDate = new Date(ride.completedAt || ride.updatedAt);
        if (rideDate >= today) {
          todayEarnings += (ride.driverEarnings || ride.fare || 0);
          todayRides += 1;
        }
      });

      var now = new Date();
      var dayOfWeek = now.getDay();
      var mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      var monday = new Date(now);
      monday.setDate(now.getDate() - mondayOffset);
      monday.setHours(0, 0, 0, 0);

      var weeklyBreakdown = [0, 0, 0, 0, 0, 0, 0];
      var weeklyRides = [0, 0, 0, 0, 0, 0, 0];

      completedRides.forEach(function(ride) {
        var rideDate = new Date(ride.completedAt || ride.updatedAt);
        if (rideDate >= monday) {
          var rideDay = rideDate.getDay();
          var index = rideDay === 0 ? 6 : rideDay - 1;
          weeklyBreakdown[index] += (ride.driverEarnings || ride.fare || 0);
          weeklyRides[index] += 1;
        }
      });

      var weekTotal = weeklyBreakdown.reduce(function(a, b) { return a + b; }, 0);
      var weekRidesTotal = weeklyRides.reduce(function(a, b) { return a + b; }, 0);

      res.status(200).json({
        success: true,
        earnings: {
          total: totalEarnings,
          today: todayEarnings,
          todayRides: todayRides,
          totalRides: completedRides.length,
          weekTotal: weekTotal,
          weekRides: weekRidesTotal,
          weeklyBreakdown: weeklyBreakdown,
          weeklyRides: weeklyRides
        }
      });
    })
    .catch(function(error) {
      console.error('Get Earnings Error:', error);
      res.status(500).json({ success: false, message: 'Erreur lors de la récupération des gains' });
    });
};

exports.getRideHistory = function(req, res) {
  Driver.findOne({ userId: req.user._id })
    .then(function(driver) {
      if (!driver) {
        return res.status(404).json({ success: false, message: 'Profil chauffeur non trouvé' });
      }

      return Ride.find({ driver: driver._id, status: 'completed' })
        .sort({ completedAt: -1 })
        .limit(50);
    })
    .then(function(rides) {
      if (rides) {
        res.status(200).json({ success: true, rides: rides });
      }
    })
    .catch(function(error) {
      console.error('Get Ride History Error:', error);
      res.status(500).json({ success: false, message: "Erreur lors de la récupération de l'historique" });
    });
};

exports.getOnlineCount = function(req, res) {
  var driverLocationService = req.app.get('driverLocationService');

  driverLocationService.getOnlineDriversCount()
    .then(function(count) {
      res.status(200).json({ success: true, onlineDrivers: count });
    })
    .catch(function(error) {
      console.error('Get Online Count Error:', error);
      res.status(500).json({ success: false, message: 'Erreur' });
    });
};

exports.uploadProfilePhoto = function(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Aucune photo fournie' });
  }

  var photoUrl = req.protocol + '://' + req.get('host') + '/uploads/' + req.file.filename;

  User.findByIdAndUpdate(req.user.id, {
    profilePhoto: photoUrl,
    photoStatus: 'pending',
    photoVerified: false
  })
    .then(function() {
      res.json({ success: true, message: 'Photo mise à jour', profilePhoto: photoUrl });
    })
    .catch(function(error) {
      console.error('Upload photo error:', error);
      res.status(500).json({ success: false, message: 'Erreur serveur' });
    });
};

exports.updateServicePreferences = function(req, res) {
  Driver.findOne({ userId: req.user._id })
    .then(function(driver) {
      if (!driver) {
        return res.status(404).json({ success: false, message: 'Profil chauffeur non trouvé' });
      }

      if (req.body.rides !== undefined) driver.acceptedServices.rides = req.body.rides;
      if (req.body.colis !== undefined) driver.acceptedServices.colis = req.body.colis;
      if (req.body.commande !== undefined) driver.acceptedServices.commande = req.body.commande;
      if (req.body.resto !== undefined) driver.acceptedServices.resto = req.body.resto;

      return driver.save();
    })
    .then(function(driver) {
      if (driver) {
        res.status(200).json({
          success: true,
          acceptedServices: driver.acceptedServices,
          message: 'Préférences mises à jour'
        });
      }
    })
    .catch(function(error) {
      console.error('Update Preferences Error:', error);
      res.status(500).json({ success: false, message: 'Erreur' });
    });
};

exports.getServicePreferences = function(req, res) {
  Driver.findOne({ userId: req.user._id })
    .then(function(driver) {
      if (!driver) {
        return res.status(404).json({ success: false, message: 'Profil chauffeur non trouvé' });
      }

      res.status(200).json({
        success: true,
        acceptedServices: driver.acceptedServices || { rides: true, colis: false, commande: false, resto: false }
      });
    })
    .catch(function(error) {
      console.error('Get Preferences Error:', error);
      res.status(500).json({ success: false, message: 'Erreur' });
    });
};

