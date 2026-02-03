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

    // Get rider profile
    const rider = await Rider.findOne({ userId: req.user._id });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Profil passager non trouvé'
      });
    }

    // Calculate distance between pickup and dropoff
    const distance = calculateDistance(
      pickup.coordinates.latitude,
      pickup.coordinates.longitude,
      dropoff.coordinates.latitude,
      dropoff.coordinates.longitude
    );

    // Estimate duration
    const estimatedDuration = estimateDuration(distance);

    // Calculate fare
    const fare = calculateFare(distance, rideType);
    const earnings = calculateEarnings(fare);

    // Create ride
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

    // Get the matching service from app
    const matchingService = req.app.get('matchingService');
    
    // Start offering ride to nearby drivers (UBER-LEVEL MATCHING!)
    const rideData = {
      pickup: ride.pickup,
      dropoff: ride.dropoff,
      fare: ride.fare,
      distance: ride.distance,
      estimatedDuration: ride.estimatedDuration,
      rideType: ride.rideType
    };

    // Offer to drivers asynchronously (don't wait)
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
      .populate({ path: 'driverId', populate: { path: 'userId', select: 'name phone rating profilePhoto' } });

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
      .populate({ path: 'driverId', populate: { path: 'userId', select: 'name phone rating profilePhoto' } })
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

// @desc    Driver accepts ride (NEW UBER-LEVEL VERSION)
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

    // Use matching service for atomic acceptance
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

    // Update driver availability
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

    // Use matching service to handle rejection
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

// @desc    Driver updates ride status (arrived, started, completed)
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
    
    if (ride.driverId.toString() !== driver._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé'
      });
    }

    // Update status and timestamps
    ride.status = status;
    
    if (status === 'arrived') {
      ride.arrivedAt = new Date();
    } else if (status === 'in_progress') {
      ride.startedAt = new Date();
    } else if (status === 'completed') {
      ride.completedAt = new Date();
      ride.paymentStatus = 'completed';
      
      // Update driver earnings
      driver.totalEarnings += ride.driverEarnings;
      driver.weeklyEarnings += ride.driverEarnings;
      driver.totalRides += 1;
      driver.isAvailable = true; // Driver is available again
      await driver.save();

      // Update rider total rides
      const rider = await Rider.findById(ride.riderId);
      rider.totalRides += 1;
      await rider.save();
    }

    await ride.save();

    // Emit Socket.io event
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

    // Cancel pending offers if ride was still pending
    const matchingService = req.app.get('matchingService');
    await matchingService.cancelRideOffers(ride._id);

    // If driver was assigned, make them available again
    if (ride.driverId) {
      await Driver.findByIdAndUpdate(ride.driverId, { isAvailable: true });
    }

    // Emit Socket.io event
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

// @desc    Rate ride (rider rates driver or driver rates rider)
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
      // Rider rating driver
      ride.driverRating = { rating, review };
      await ride.save();

      // Update driver's overall rating
      const driverUser = await Driver.findById(ride.driverId).populate('userId');
      const allRatings = await Ride.find({ 
        driverId: ride.driverId, 
        'driverRating.rating': { $exists: true } 
      });
      
      const avgRating = allRatings.reduce((sum, r) => sum + r.driverRating.rating, 0) / allRatings.length;
      
      driverUser.userId.rating = avgRating;
      driverUser.userId.totalRatings = allRatings.length;
      await driverUser.userId.save();

    } else if (driver) {
      // Driver rating rider
      ride.riderRating = { rating, review };
      await ride.save();

      // Update rider's overall rating
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