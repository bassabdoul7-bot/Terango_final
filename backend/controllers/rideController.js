const Ride = require('../models/Ride');
const Driver = require('../models/Driver');
const Rider = require('../models/Rider');
const { calculateDistance, estimateDuration } = require('../utils/distance');
const { calculateFare, calculateEarnings } = require('../utils/fare');

// @desc    Create a new ride request
// @route   POST /api/rides
// @access  Private (Rider only)
exports.createRide = async (req, res) => {
  try {
    const { pickup, dropoff, rideType, paymentMethod } = req.body;

    const rider = await Rider.findOne({ userId: req.user._id });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Profil passager non trouvé'
      });
    }

    const distance = calculateDistance(
      pickup.coordinates.latitude,
      pickup.coordinates.longitude,
      dropoff.coordinates.latitude,
      dropoff.coordinates.longitude
    );

    const estimatedDuration = estimateDuration(distance);
    const fare = calculateFare(distance, rideType);
    const earnings = calculateEarnings(fare);

    const ride = await Ride.create({
      riderId: rider._id,
      pickup,
      dropoff,
      rideType,
      distance,
      estimatedDuration,
      fare: earnings.fare,
      platformCommission: earnings.platformCommission,
      driverEarnings: earnings.driverEarnings,
      paymentMethod,
      status: 'pending'
    });

    const matchingService = req.app.get('matchingService');
    
    const rideData = {
      pickup: ride.pickup,
      dropoff: ride.dropoff,
      fare: ride.fare,
      distance: ride.distance,
      estimatedDuration: ride.estimatedDuration,
      rideType: ride.rideType
    };

    matchingService.offerRideToDrivers(
      ride._id,
      pickup.coordinates,
      rideData
    ).catch(err => console.error('Matching error:', err));

    res.status(201).json({
      success: true,
      message: 'Demande de course créée',
      ride: {
        id: ride._id,
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        distance: ride.distance,
        estimatedDuration: ride.estimatedDuration,
        fare: ride.fare,
        rideType: ride.rideType,
        status: ride.status
      }
    });

  } catch (error) {
    console.error('Create Ride Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la course'
    });
  }
};

// @desc    Get ride by ID
// @route   GET /api/rides/:id
// @access  Private
exports.getRide = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id)
      .populate('riderId', 'userId')
      .populate({ path: 'driver', populate: { path: 'userId', select: 'name phone rating profilePhoto' } });

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Course non trouvée'
      });
    }

    res.status(200).json({
      success: true,
      ride
    });

  } catch (error) {
    console.error('Get Ride Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la course'
    });
  }
};

// @desc    Get rider's ride history
// @route   GET /api/rides/my-rides
// @access  Private (Rider)
exports.getMyRides = async (req, res) => {
  try {
    const rider = await Rider.findOne({ userId: req.user._id });
    
    const rides = await Ride.find({ riderId: rider._id })
      .populate({ path: 'driver', populate: { path: 'userId', select: 'name phone rating profilePhoto' } })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      count: rides.length,
      rides
    });

  } catch (error) {
    console.error('Get My Rides Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des courses'
    });
  }
};

// @desc    Driver accepts ride
// @route   PUT /api/rides/:id/accept
// @access  Private (Driver only)
exports.acceptRide = async (req, res) => {
  try {
    const driver = await Driver.findOne({ userId: req.user._id });
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Profil chauffeur non trouvé'
      });
    }

    if (!driver.isOnline) {
      return res.status(400).json({
        success: false,
        message: 'Vous devez être en ligne pour accepter une course'
      });
    }

    const matchingService = req.app.get('matchingService');
    const result = await matchingService.handleDriverAcceptance(
      req.params.id,
      driver._id
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    driver.isAvailable = false;
    await driver.save();

    res.status(200).json({
      success: true,
      message: 'Course acceptée',
      ride: result.ride
    });

  } catch (error) {
    console.error('Accept Ride Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'acceptation de la course'
    });
  }
};

// @desc    Driver rejects ride
// @route   PUT /api/rides/:id/reject
// @access  Private (Driver only)
exports.rejectRide = async (req, res) => {
  try {
    const { reason } = req.body;
    const driver = await Driver.findOne({ userId: req.user._id });
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Profil chauffeur non trouvé'
      });
    }

    const matchingService = req.app.get('matchingService');
    await matchingService.handleDriverRejection(req.params.id, driver._id.toString());

    res.status(200).json({
      success: true,
      message: 'Course rejetée'
    });

  } catch (error) {
    console.error('Reject Ride Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du rejet de la course'
    });
  }
};

// @desc    Driver updates ride status
// @route   PUT /api/rides/:id/status
// @access  Private (Driver only)
exports.updateRideStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Course non trouvée'
      });
    }

    const driver = await Driver.findOne({ userId: req.user._id });
    
    if (ride.driver.toString() !== driver._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé'
      });
    }

    ride.status = status;
    
    if (status === 'arrived') {
      ride.arrivedAt = new Date();
    } else if (status === 'in_progress') {
      ride.startedAt = new Date();
    } else if (status === 'completed') {
      ride.completedAt = new Date();
      ride.paymentStatus = 'completed';
      
      driver.totalEarnings += ride.driverEarnings;
      driver.weeklyEarnings += ride.driverEarnings;
      driver.totalRides += 1;
      driver.isAvailable = true;
      await driver.save();

      const rider = await Rider.findById(ride.riderId);
      rider.totalRides += 1;
      await rider.save();
    }

    await ride.save();

    const io = req.app.get('io');
    io.emit(`ride-status-${ride._id}`, {
      status: ride.status,
      timestamp: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Statut mis à jour',
      ride
    });

  } catch (error) {
    console.error('Update Ride Status Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut'
    });
  }
};

// @desc    Cancel ride
// @route   PUT /api/rides/:id/cancel
// @access  Private
exports.cancelRide = async (req, res) => {
  try {
    const { reason } = req.body;
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Course non trouvée'
      });
    }

    if (ride.status === 'completed' || ride.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Impossible d\'annuler cette course'
      });
    }

    ride.status = 'cancelled';
    ride.cancelledAt = new Date();
    ride.cancelledBy = req.user.role;
    ride.cancellationReason = reason;
    await ride.save();

    const matchingService = req.app.get('matchingService');
    await matchingService.cancelRideOffers(ride._id);

    if (ride.driver) {
      await Driver.findByIdAndUpdate(ride.driver, { isAvailable: true });
    }

    const io = req.app.get('io');
    io.emit(`ride-cancelled-${ride._id}`, {
      cancelledBy: req.user.role,
      reason
    });

    res.status(200).json({
      success: true,
      message: 'Course annulée',
      ride
    });

  } catch (error) {
    console.error('Cancel Ride Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'annulation de la course'
    });
  }
};

// @desc    Rate ride
// @route   PUT /api/rides/:id/rate
// @access  Private
exports.rateRide = async (req, res) => {
  try {
    const { rating, review } = req.body;
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Course non trouvée'
      });
    }

    if (ride.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'La course doit être terminée pour être notée'
      });
    }

    const rider = await Rider.findOne({ userId: req.user._id });
    const driver = await Driver.findOne({ userId: req.user._id });

    if (rider) {
      ride.driverRating = { rating, review };
      await ride.save();

      const driverUser = await Driver.findById(ride.driver).populate('userId');
      const allRatings = await Ride.find({ 
        driver: ride.driver, 
        'driverRating.rating': { $exists: true } 
      });
      
      const avgRating = allRatings.reduce((sum, r) => sum + r.driverRating.rating, 0) / allRatings.length;
      
      driverUser.userId.rating = avgRating;
      driverUser.userId.totalRatings = allRatings.length;
      await driverUser.userId.save();

    } else if (driver) {
      ride.riderRating = { rating, review };
      await ride.save();

      const riderUser = await Rider.findById(ride.riderId).populate('userId');
      const allRatings = await Ride.find({ 
        riderId: ride.riderId, 
        'riderRating.rating': { $exists: true } 
      });
      
      const avgRating = allRatings.reduce((sum, r) => sum + r.riderRating.rating, 0) / allRatings.length;
      
      riderUser.userId.rating = avgRating;
      riderUser.userId.totalRatings = allRatings.length;
      await riderUser.userId.save();
    }

    res.status(200).json({
      success: true,
      message: 'Note enregistrée',
      ride
    });

  } catch (error) {
    console.error('Rate Ride Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement de la note'
    });
  }
};