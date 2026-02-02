const Driver = require('../models/Driver');
const User = require('../models/User');
const Ride = require('../models/Ride');

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
    
    // Get active ride for this driver
    const activeRide = await Ride.findOne({ 
      driverId: driver._id, 
      status: { $in: ['accepted', 'in_progress', 'arrived'] }
    });

    console.log('Active ride found:', activeRide._id);
    
    if (activeRide) {
      console.log('Emitting driver-location-update to room:', activeRide._id.toString());
      io.to(activeRide._id.toString()).emit('driver-location-update', {
        driverId: driver._id,
        location: { latitude, longitude },
        timestamp: new Date()
      });
    }

    if (!activeRide) {
      console.log('No active ride found for driver');
    }
    
    res.status(200).json({
      success: true,
      currentLocation: {
        latitude,
        longitude
      }
    });
  } catch (error) {
    console.error('Update Location Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la localisation'
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
    }).populate('rider', 'name phone');

    res.status(200).json({
      success: true,
      ride: activeRide
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

    const totalEarnings = completedRides.reduce((sum, ride) => sum + ride.fare, 0);
    const todayEarnings = completedRides
      .filter(ride => {
        const today = new Date();
        const rideDate = new Date(ride.completedAt);
        return rideDate.toDateString() === today.toDateString();
      })
      .reduce((sum, ride) => sum + ride.fare, 0);

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
      .populate('rider', 'name phone')
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