const Driver = require('../models/Driver');
const User = require('../models/User');
const Ride = require('../models/Ride');

// @desc    Get driver profile
// @route   GET /api/drivers/profile
// @access  Private (Driver only)
exports.getProfile = async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user._id })
      .populate('userId', 'name phone email rating');
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Profil chauffeur non trouvé'
      });
    }
    res.status(200).json({
      success: true,
      driver
    });
  } catch (error) {
    console.error('Get Profile Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil'
    });
  }
};

// @desc    Complete driver profile (after registration)
// @route   PUT /api/drivers/complete-profile
// @access  Private (Driver only)
exports.completeProfile = async (req, res) => {
  try {
    const { driverLicenseNumber, driverLicensePhoto, vehicle } = req.body;
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Profil chauffeur non trouvé'
      });
    }
    driver.driverLicenseNumber = driverLicenseNumber;
    driver.driverLicensePhoto = driverLicensePhoto;
    driver.vehicle = vehicle;
    driver.verificationStatus = 'pending';
    await driver.save();
    res.status(200).json({
      success: true,
      message: 'Profil complété. En attente de vérification.',
      driver
    });
  } catch (error) {
    console.error('Complete Profile Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du profil'
    });
  }
};

// @desc    Toggle driver online/offline status
// @route   PUT /api/drivers/toggle-online
// @access  Private (Driver only)
exports.toggleOnlineStatus = async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Profil chauffeur non trouvé'
      });
    }
    if (driver.verificationStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Votre compte doit être vérifié pour vous mettre en ligne'
      });
    }

    const driverLocationService = req.app.get('driverLocationService');
    const { isOnline, latitude, longitude } = req.body;

    // Update MongoDB
    driver.isOnline = isOnline;
    driver.isAvailable = isOnline;
    await driver.save();

    // Update Redis
    if (isOnline && latitude && longitude) {
      await driverLocationService.setDriverOnline(driver._id.toString(), latitude, longitude, {
        vehicle: driver.vehicle,
        rating: driver.userId?.rating || 5.0
      });
    } else {
      await driverLocationService.setDriverOffline(driver._id.toString());
    }

    res.status(200).json({
      success: true,
      message: isOnline ? 'Vous êtes maintenant en ligne' : 'Vous êtes maintenant hors ligne',
      isOnline: driver.isOnline
    });
  } catch (error) {
    console.error('Toggle Online Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du changement de statut'
    });
  }
};

// @desc    Update driver location (called every 5 seconds)
// @route   PUT /api/drivers/location
// @access  Private (Driver only)
exports.updateLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    
    const driver = await Driver.findOne({ userId: req.user._id })
      .populate('userId', 'rating');

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Profil chauffeur non trouvé'
      });
    }

    const driverLocationService = req.app.get('driverLocationService');
    const io = req.app.get('io');

    // Update Redis (this refreshes TTL - keeps driver "alive")
    await driverLocationService.updateDriverLocation(
      driver._id.toString(),
      latitude,
      longitude,
      {
        vehicle: driver.vehicle,
        rating: driver.userId?.rating || 5.0
      }
    );

    // Also update MongoDB (for persistence/history)
    driver.currentLocation = {
      type: 'Point',
      coordinates: { latitude, longitude }
    };
    driver.lastLocationUpdate = new Date();
    await driver.save();

    // Check for active ride and emit to ride room
    const activeRide = await Ride.findOne({
      driver: driver._id,
      status: { $in: ['accepted', 'in_progress', 'arrived'] }
    });

    if (activeRide) {
      io.to(activeRide._id.toString()).emit('driver-location-update', {
        driverId: driver._id,
        location: { latitude, longitude },
        timestamp: new Date()
      });
    }

    // Broadcast to riders watching (for nearby drivers on map)
    io.to('riders-watching').emit('nearby-driver-location', {
      driverId: driver._id.toString(),
      location: { latitude, longitude },
      timestamp: new Date()
    });

    res.status(200).json({
      success: true,
      currentLocation: { latitude, longitude }
    });
  } catch (error) {
    console.error('Update Location Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la localisation'
    });
  }
};

// @desc    Get nearby online drivers (for riders to see on map)
// @route   GET /api/drivers/nearby
// @access  Private (Rider)
exports.getNearbyDrivers = async (req, res) => {
  try {
    const { latitude, longitude, radius = 10 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude et longitude requises'
      });
    }

    const driverLocationService = req.app.get('driverLocationService');

    // Get drivers from Redis (real-time, only actually online drivers)
    const nearbyDrivers = await driverLocationService.getNearbyDrivers(
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(radius)
    );

    // Enrich with MongoDB data if needed
    const enrichedDrivers = await Promise.all(
      nearbyDrivers.map(async (redisDriver) => {
        try {
          const mongoDriver = await Driver.findById(redisDriver.driverId)
            .populate('userId', 'name rating');
          
          return {
            _id: redisDriver.driverId,
            location: redisDriver.location,
            distance: redisDriver.distance,
            vehicle: mongoDriver?.vehicle || redisDriver.vehicle,
            rating: mongoDriver?.userId?.rating || redisDriver.rating || 5.0,
            name: mongoDriver?.userId?.name
          };
        } catch (err) {
          return redisDriver;
        }
      })
    );

    res.status(200).json({
      success: true,
      count: enrichedDrivers.length,
      drivers: enrichedDrivers
    });
  } catch (error) {
    console.error('Get Nearby Drivers Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche de chauffeurs'
    });
  }
};

// @desc    Get driver active ride
// @route   GET /api/drivers/active-ride
// @access  Private (Driver only)
exports.getActiveRide = async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Profil chauffeur non trouvé'
      });
    }

    const activeRide = await Ride.findOne({
      driver: driver._id,
      status: { $in: ['accepted', 'arrived', 'in_progress'] }
    }).populate('riderId');

    // Get rider info
    let rideWithRider = null;
    if (activeRide) {
      const riderUser = await User.findById(activeRide.riderId?.userId);
      rideWithRider = {
        ...activeRide.toObject(),
        rider: riderUser ? { name: riderUser.name, phone: riderUser.phone } : null
      };
    }

    res.status(200).json({
      success: true,
      ride: rideWithRider
    });
  } catch (error) {
    console.error('Get Active Ride Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la course active'
    });
  }
};

// @desc    Get driver earnings
// @route   GET /api/drivers/earnings
// @access  Private (Driver only)
exports.getEarnings = async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Profil chauffeur non trouvé'
      });
    }

    const completedRides = await Ride.find({
      driver: driver._id,
      status: 'completed'
    });

    const totalEarnings = completedRides.reduce((sum, ride) => sum + (ride.driverEarnings || ride.fare), 0);
    const todayEarnings = completedRides
      .filter(ride => {
        const today = new Date();
        const rideDate = new Date(ride.completedAt || ride.updatedAt);
        return rideDate.toDateString() === today.toDateString();
      })
      .reduce((sum, ride) => sum + (ride.driverEarnings || ride.fare), 0);

    res.status(200).json({
      success: true,
      earnings: {
        total: totalEarnings,
        today: todayEarnings,
        totalRides: completedRides.length
      }
    });
  } catch (error) {
    console.error('Get Earnings Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des gains'
    });
  }
};

// @desc    Get driver ride history
// @route   GET /api/drivers/ride-history
// @access  Private (Driver only)
exports.getRideHistory = async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Profil chauffeur non trouvé'
      });
    }

    const rides = await Ride.find({
      driver: driver._id,
      status: 'completed'
    })
      .sort({ completedAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      rides
    });
  } catch (error) {
    console.error('Get Ride History Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique'
    });
  }
};

// @desc    Get online drivers count (for admin/stats)
// @route   GET /api/drivers/online-count
// @access  Private
exports.getOnlineCount = async (req, res) => {
  try {
    const driverLocationService = req.app.get('driverLocationService');
    const count = await driverLocationService.getOnlineDriversCount();
    
    res.status(200).json({
      success: true,
      onlineDrivers: count
    });
  } catch (error) {
    console.error('Get Online Count Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur'
    });
  }
};


// @desc    Upload profile photo
// @route   PUT /api/drivers/profile-photo
// @access  Private (Driver)
exports.uploadProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucune photo fournie' });
    }

    const photoUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    const User = require('../models/User');
    await User.findByIdAndUpdate(req.user.id, { profilePhoto: photoUrl });

    res.json({
      success: true,
      message: 'Photo mise à jour',
      profilePhoto: photoUrl
    });
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
