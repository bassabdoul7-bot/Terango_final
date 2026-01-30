const Driver = require('../models/Driver');
const User = require('../models/User');
const Ride = require('../models/Ride');

// @desc    Complete driver profile (after registration)
// @route   PUT /api/drivers/complete-profile
// @access  Private (Driver only)
exports.completeProfile = async (req, res) => {
  try {
    const {
      nationalId,
      nationalIdPhoto,
      driverLicense,
      driverLicensePhoto,
      vehicle
    } = req.body;

    const driver = await Driver.findOne({ userId: req.user._id });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Profil chauffeur non trouvé'
      });
    }

    // Update driver profile
    driver.nationalId = nationalId;
    driver.nationalIdPhoto = nationalIdPhoto;
    driver.driverLicense = driverLicense;
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

    driver.isOnline = req.body.isOnline;
    await driver.save();

    res.status(200).json({
      success: true,
      message: driver.isOnline ? 'Vous êtes maintenant en ligne' : 'Vous êtes maintenant hors ligne',
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

// @desc    Update driver location
// @route   PUT /api/drivers/location
// @access  Private (Driver only)
exports.updateLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    const driver = await Driver.findOne({ userId: req.user._id });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Profil chauffeur non trouvé'
      });
    }

    driver.currentLocation = {
      type: 'Point',
      coordinates: [longitude, latitude]
    };

    await driver.save();

    // Emit Socket.io event for real-time tracking
    const io = req.app.get('io');
    io.emit(`driver-location-${driver._id}`, {
      latitude,
      longitude,
      timestamp: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Localisation mise à jour'
    });

  } catch (error) {
    console.error('Update Location Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la localisation'
    });
  }
};

// @desc    Get driver's ride history
// @route   GET /api/drivers/my-rides
// @access  Private (Driver only)
exports.getMyRides = async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user._id });

    const rides = await Ride.find({ driverId: driver._id })
      .populate('riderId', 'userId')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      count: rides.length,
      rides
    });

  } catch (error) {
    console.error('Get Driver Rides Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des courses'
    });
  }
};

// @desc    Get driver earnings summary
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

    // Get completed rides for detailed breakdown
    const completedRides = await Ride.find({
      driverId: driver._id,
      status: 'completed'
    }).sort({ completedAt: -1 });

    // Calculate today's earnings
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayRides = completedRides.filter(ride => 
      ride.completedAt >= today
    );
    
    const todayEarnings = todayRides.reduce((sum, ride) => sum + ride.driverEarnings, 0);

    res.status(200).json({
      success: true,
      earnings: {
        today: todayEarnings,
        week: driver.weeklyEarnings,
        total: driver.totalEarnings,
        totalRides: driver.totalRides,
        todayRides: todayRides.length
      },
      recentRides: completedRides.slice(0, 10)
    });

  } catch (error) {
    console.error('Get Earnings Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des gains'
    });
  }
};

// @desc    Get driver statistics
// @route   GET /api/drivers/stats
// @access  Private (Driver only)
exports.getStats = async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user._id }).populate('userId');

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Profil chauffeur non trouvé'
      });
    }

    res.status(200).json({
      success: true,
      stats: {
        totalRides: driver.totalRides,
        totalEarnings: driver.totalEarnings,
        weeklyEarnings: driver.weeklyEarnings,
        rating: driver.userId.rating,
        totalRatings: driver.userId.totalRatings,
        acceptanceRate: driver.acceptanceRate,
        isOnline: driver.isOnline,
        verificationStatus: driver.verificationStatus
      }
    });

  } catch (error) {
    console.error('Get Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
};

// @desc    Find nearby drivers (used by ride matching)
// @route   POST /api/drivers/nearby
// @access  Private (Internal use)
exports.findNearbyDrivers = async (req, res) => {
  try {
    const { latitude, longitude, radius = 5 } = req.body; // radius in km

    // Convert km to meters for MongoDB geospatial query
    const radiusInMeters = radius * 1000;

    const drivers = await Driver.find({
      isOnline: true,
      verificationStatus: 'approved',
      currentLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: radiusInMeters
        }
      }
    }).populate('userId', 'name phone rating');

    res.status(200).json({
      success: true,
      count: drivers.length,
      drivers
    });

  } catch (error) {
    console.error('Find Nearby Drivers Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche des chauffeurs'
    });
  }
};
