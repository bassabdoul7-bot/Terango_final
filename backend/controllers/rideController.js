const Ride = require('../models/Ride');
const Driver = require('../models/Driver');
const { sendPushNotification } = require('../services/pushService');
const Rider = require('../models/Rider');
const Partner = require('../models/Partner');
const { calculateDistance, estimateDuration } = require('../utils/distance');
const { calculateFare, calculateEarnings, getTierFromRides } = require('../utils/fare');

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
        message: 'Profil passager non trouv\u00e9'
      });
    }

    // Prevent duplicate active rides
    const activeRide = await Ride.findOne({
      riderId: rider._id,
      status: { $in: ['pending', 'accepted', 'arrived', 'in_progress'] }
    });
    if (activeRide) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez d\u00e9j\u00e0 une course en cours'
      });
    }

    const distance = calculateDistance(
      pickup.coordinates.latitude,
      pickup.coordinates.longitude,
      dropoff.coordinates.latitude,
      dropoff.coordinates.longitude
    );

    const estimatedDuration = req.body.estimatedDuration || estimateDuration(distance);
    const fareResult = calculateFare(distance, rideType, estimatedDuration);
    const earnings = calculateEarnings(fareResult.fare);

    const ride = await Ride.create({
      riderId: rider._id,
      pickup,
      dropoff,
      rideType,
      distance,
      estimatedDuration,
      fare: earnings.fare,
      surgeMultiplier: fareResult.surgeMultiplier,
      pickupFee: fareResult.pickupFee,
      platformCommission: earnings.platformCommission,
      driverEarnings: earnings.driverEarnings,
      paymentMethod,
      paymentStatus: 'pending',
      status: 'pending'
    });

    // Both cash and wave: trigger matching immediately
    // For wave, rider pays when driver arrives at pickup
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
      message: 'Demande de course cr\u00e9\u00e9e',
      ride: {
        id: ride._id,
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        distance: ride.distance,
        estimatedDuration: ride.estimatedDuration,
        fare: ride.fare,
        rideType: ride.rideType,
        status: ride.status,
        paymentMethod: ride.paymentMethod
      }
    });

  } catch (error) {
    console.error('Create Ride Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la cr\u00e9ation de la course'
    });
  }
};

// @desc    Get ride by ID
// @route   GET /api/rides/:id
// @access  Private
exports.getRide = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id)
      .populate({ path: 'riderId', populate: { path: 'userId', select: 'name phone rating profilePhoto' } })
      .populate({ path: 'driver', populate: { path: 'userId', select: 'name phone rating profilePhoto' } });

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Course non trouv\u00e9e'
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
      message: 'Erreur lors de la r\u00e9cup\u00e9ration de la course'
    });
  }
};

// @desc    Get rider's ride history
// @route   GET /api/rides/my-rides
// @access  Private (Rider)
exports.getActiveRide = async (req, res) => {
  try {
    const rider = await Rider.findOne({ userId: req.user._id });
    if (!rider) return res.status(200).json({ success: false, ride: null });
    const ride = await Ride.findOne({
      riderId: rider._id,
      status: { $in: ["pending", "accepted", "arrived", "in_progress"] }
    }).populate({ path: "driver", populate: { path: "userId", select: "name phone rating profilePhoto" } });
    res.status(200).json({ success: !!ride, ride: ride || null });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

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
      message: 'Erreur lors de la r\u00e9cup\u00e9ration des courses'
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
        message: 'Profil chauffeur non trouv\u00e9'
      });
    }

    if (driver.isBlockedForPayment === true) {
      return res.status(403).json({
        success: false,
        message: 'Vous devez payer votre commission avant d\'accepter de nouvelles courses. Envoyez ' + driver.commissionBalance + ' FCFA par Wave.'
      });
    }

    if (!driver.isOnline) {
      return res.status(400).json({
        success: false,
        message: 'Vous devez \u00eatre en ligne pour accepter une course'
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
      message: 'Course accept\u00e9e',
      ride: result.ride
    });

  } catch (error) {
    console.error('Accept Ride Error:', error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'acceptation de la course"
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
        message: 'Profil chauffeur non trouv\u00e9'
      });
    }

    const matchingService = req.app.get('matchingService');
    await matchingService.handleDriverRejection(req.params.id, driver._id.toString());

    res.status(200).json({
      success: true,
      message: 'Course rejet\u00e9e'
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
        message: 'Course non trouv\u00e9e'
      });
    }

    const driver = await Driver.findOne({ userId: req.user._id });

    if (ride.driver.toString() !== driver._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Non autoris\u00e9'
      });
    }

    ride.status = status;

    if (status === 'arrived') {
      ride.arrivedAt = new Date();
      // Push notify rider - driver arrived
      var arrivedRide = await Ride.findById(ride._id).populate('riderId');
      if (arrivedRide && arrivedRide.riderId) {
          sendPushNotification(arrivedRide.riderId.userId, 'Chauffeur arrivé', 'Votre chauffeur est arrivé au point de départ', { type: 'ride-arrived', rideId: ride._id.toString() });
      }
    } else if (status === 'in_progress') {
      ride.startedAt = new Date();
    } else if (status === 'completed') {
      ride.completedAt = new Date();
      ride.paymentStatus = 'completed';

      driver.totalEarnings += ride.driverEarnings;
      driver.weeklyEarnings += ride.driverEarnings;
      driver.totalRides += 1;
      driver.isAvailable = true;

      // Track commission debt
      var earningsData = calculateEarnings(ride.fare, !!(driver.partnerId), driver.tier || 'goorgoorlu');
      driver.commissionBalance = (driver.commissionBalance || 0) + (earningsData.platformCommission || 0);
      if (driver.commissionBalance >= (driver.commissionCap || 750)) {
        driver.isBlockedForPayment = true;
        sendPushNotification(driver.userId, 'Commission due', 'Votre commission de ' + driver.commissionBalance + ' FCFA est due. Envoyez par Wave pour continuer.', { type: 'commission-blocked' });
      }

      await driver.save();

      const rider = await Rider.findById(ride.riderId);
      if (rider) {
        rider.totalRides += 1;
        await rider.save();
      }
    }

    await ride.save();

    const io = req.app.get('io');
    io.to(ride._id.toString()).emit('ride-status', {
      status: ride.status,
      timestamp: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Statut mis \u00e0 jour',
      ride
    });

  } catch (error) {
    console.error('Update Ride Status Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise \u00e0 jour du statut'
    });
  }
};

// @desc    Start ride (Driver picks up rider)
// @route   PUT /api/rides/:id/start
// @access  Private (Driver only)
exports.startRide = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Course non trouv\u00e9e'
      });
    }

    const driver = await Driver.findOne({ userId: req.user._id });

    if (!driver || ride.driver.toString() !== driver._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Non autoris\u00e9'
      });
    }

    if (ride.status !== 'arrived') {
      return res.status(400).json({
        success: false,
        message: "Vous devez d'abord arriver au point de d\u00e9part"
      });
    }

    // Check PIN if required
    if (ride.pinRequired && !ride.pinVerified) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez v\u00e9rifier le code de s\u00e9curit\u00e9 avant de d\u00e9marrer'
      });
    }

    ride.status = 'in_progress';
    ride.startedAt = new Date();
    await ride.save();

    const io = req.app.get('io');
    io.to(ride._id.toString()).emit('ride-status', {
      status: 'in_progress',
      timestamp: new Date()
    });

    io.to(ride._id.toString()).emit('ride-started', {
      rideId: ride._id,
      startedAt: ride.startedAt
    });

    res.status(200).json({
      success: true,
      message: 'Course d\u00e9marr\u00e9e',
      ride
    });

  } catch (error) {
    console.error('Start Ride Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du d\u00e9marrage de la course'
    });
  }
};

// @desc    Complete ride
// @route   PUT /api/rides/:id/complete
// @access  Private (Driver only)
exports.completeRide = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Course non trouv\u00e9e'
      });
    }

    const driver = await Driver.findOne({ userId: req.user._id });
    const driverLocationService = req.app.get('driverLocationService');

    if (!driver || ride.driver.toString() !== driver._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Non autoris\u00e9'
      });
    }

    if (ride.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'La course doit \u00eatre en cours pour \u00eatre termin\u00e9e'
      });
    }

    // Recalculate commission if driver has a partner
    var hasPartner = !!(driver.partnerId);
    var partnerEarnings = calculateEarnings(ride.fare, hasPartner, driver.tier || 'goorgoorlu');
    ride.platformCommission = partnerEarnings.platformCommission;
    ride.driverEarnings = partnerEarnings.driverEarnings;
    ride.partnerCommission = partnerEarnings.partnerCommission;
    if (driver.partnerId) {
      ride.partnerId = driver.partnerId;
    }

    // Complete the ride
    ride.status = 'completed';
    ride.completedAt = new Date();

    ride.paymentStatus = 'completed';
    await ride.save();

    // Update partner earnings if applicable
    if (driver.partnerId && partnerEarnings.partnerCommission > 0) {
      await Partner.findByIdAndUpdate(driver.partnerId, {
        $inc: { totalEarnings: partnerEarnings.partnerCommission, weeklyEarnings: partnerEarnings.partnerCommission }
      });
    }

    // Update driver earnings and make available again
    driver.totalEarnings = (driver.totalEarnings || 0) + (partnerEarnings.driverEarnings || ride.fare);
    driver.weeklyEarnings = (driver.weeklyEarnings || 0) + (partnerEarnings.driverEarnings || ride.fare);
    driver.totalRides = (driver.totalRides || 0) + 1;
    driver.completedRides = (driver.completedRides || 0) + 1;
    driver.tier = getTierFromRides(driver.completedRides);
    driver.isAvailable = true;

    // Track commission debt
    driver.commissionBalance = (driver.commissionBalance || 0) + (partnerEarnings.platformCommission || 0);
    if (driver.commissionBalance >= (driver.commissionCap || 750)) {
      driver.isBlockedForPayment = true;
      sendPushNotification(driver.userId, 'Commission due', 'Votre commission de ' + driver.commissionBalance + ' FCFA est due. Envoyez par Wave pour continuer.', { type: 'commission-blocked' });
    }

    await driver.save();

    // Update rider stats
    const rider = await Rider.findById(ride.riderId);
    if (rider) {
      rider.totalRides = (rider.totalRides || 0) + 1;
      await rider.save();
    }

    // Update Redis - driver is available again
    if (driver.currentLocation && driver.currentLocation.coordinates) {
      await driverLocationService.updateDriverLocation(
        driver._id.toString(),
        driver.currentLocation.coordinates.latitude,
        driver.currentLocation.coordinates.longitude,
        { vehicle: driver.vehicle, rating: driver.userId ? driver.userId.rating : 5.0 }
      );
    }

    const io = req.app.get('io');

    // Notify rider
    io.to(ride._id.toString()).emit('ride-status', {
      status: 'completed',
      timestamp: new Date(),
      fare: ride.fare,
      driverEarnings: ride.driverEarnings
    });

    // Push notify rider - ride completed
    var completedRide = await Ride.findById(ride._id).populate('riderId');
    if (completedRide && completedRide.riderId) {
      sendPushNotification(completedRide.riderId.userId, 'Course terminee!', 'Merci! Votre course de ' + ride.fare + ' FCFA est terminee.', { type: 'ride-completed', rideId: ride._id.toString() });
    }

    io.to(ride._id.toString()).emit('ride-completed', {
      rideId: ride._id,
      completedAt: ride.completedAt,
      fare: ride.fare,
      paymentMethod: ride.paymentMethod,
      paymentStatus: ride.paymentStatus
    });

    res.status(200).json({
      success: true,
      message: 'Course terminee',
      ride,
      earnings: {
        thisRide: ride.driverEarnings || ride.fare,
        totalToday: driver.weeklyEarnings,
        totalAllTime: driver.totalEarnings
      }
    });

  } catch (error) {
    console.error('Complete Ride Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la finalisation de la course'
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
        message: 'Course non trouv\u00e9e'
      });
    }

    if (ride.status === 'completed' || ride.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: "Impossible d'annuler cette course"
      });
    }

    ride.status = 'cancelled';
    ride.cancelledAt = new Date();
    ride.cancelledBy = req.user.role;
    ride.cancellationReason = reason || 'Non sp\u00e9cifi\u00e9';
    await ride.save();

    const matchingService = req.app.get('matchingService');
    await matchingService.cancelRideOffers(ride._id);

    // Make driver available again and track cancellation
    if (ride.driver) {
      if (req.user.role === 'driver') {
        var cancelDriver = await Driver.findById(ride.driver);
        if (cancelDriver) {
          var today = new Date().toDateString();
          var lastCancel = cancelDriver.lastCancellationDate ? cancelDriver.lastCancellationDate.toDateString() : null;
          cancelDriver.totalCancellations = (cancelDriver.totalCancellations || 0) + 1;
          cancelDriver.dailyCancellations = (lastCancel === today) ? (cancelDriver.dailyCancellations || 0) + 1 : 1;
          cancelDriver.lastCancellationDate = new Date();
          cancelDriver.cancellationRate = cancelDriver.totalRides > 0 ? Math.round((cancelDriver.totalCancellations / (cancelDriver.totalRides + cancelDriver.totalCancellations)) * 100) : 0;
          cancelDriver.isAvailable = true;
          await cancelDriver.save();
        }
      } else {
        await Driver.findByIdAndUpdate(ride.driver, { isAvailable: true });
      }
    }

    const io = req.app.get('io');
    // Push notify cancellation
    var cancelledRide = await Ride.findById(ride._id).populate('riderId').populate('driver');
    if (cancelledRide) {
      if (req.user.role === 'driver' && cancelledRide.riderId) {
        sendPushNotification(cancelledRide.riderId.userId, 'Course annul\u00e9e', 'Votre chauffeur a annul\u00e9 la course.', { type: 'ride-cancelled', rideId: ride._id.toString() });
      } else if (cancelledRide.driver) {
        sendPushNotification(cancelledRide.driver.userId, 'Course annul\u00e9e', 'Le passager a annul\u00e9 la course.', { type: 'ride-cancelled', rideId: ride._id.toString() });
      }
    }

    io.to(ride._id.toString()).emit('ride-cancelled', {
      cancelledBy: req.user.role,
      reason: reason || 'Non sp\u00e9cifi\u00e9'
    });

    res.status(200).json({
      success: true,
      message: 'Course annul\u00e9e',
      ride
    });

  } catch (error) {
    console.error('Cancel Ride Error:', error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'annulation de la course"
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
        message: 'Course non trouv\u00e9e'
      });
    }

    if (ride.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'La course doit \u00eatre termin\u00e9e pour \u00eatre not\u00e9e'
      });
    }

    const rider = await Rider.findOne({ userId: req.user._id });
    const driver = await Driver.findOne({ userId: req.user._id });

    if (rider) {
      ride.driverRating = { rating, review };
      await ride.save();

      const driverDoc = await Driver.findById(ride.driver).populate('userId');
      if (driverDoc && driverDoc.userId) {
        const allRatings = await Ride.find({
          driver: ride.driver,
          'driverRating.rating': { $exists: true }
        });

        const avgRating = allRatings.reduce(function(sum, r) { return sum + r.driverRating.rating; }, 0) / allRatings.length;

        driverDoc.userId.rating = avgRating;
        driverDoc.userId.totalRatings = allRatings.length;
        await driverDoc.userId.save();
      }

    } else if (driver) {
      ride.riderRating = { rating, review };
      await ride.save();

      const riderDoc = await Rider.findById(ride.riderId).populate('userId');
      if (riderDoc && riderDoc.userId) {
        const allRatings = await Ride.find({
          riderId: ride.riderId,
          'riderRating.rating': { $exists: true }
        });

        const avgRating = allRatings.reduce(function(sum, r) { return sum + r.riderRating.rating; }, 0) / allRatings.length;

        riderDoc.userId.rating = avgRating;
        riderDoc.userId.totalRatings = allRatings.length;
        await riderDoc.userId.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Note enregistr\u00e9e',
      ride
    });

  } catch (error) {
    console.error('Rate Ride Error:', error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'enregistrement de la note"
    });
  }
};

exports.verifyPin = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) {
      return res.status(404).json({ success: false, message: 'Course non trouv\u00e9e' });
    }
    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver || ride.driver.toString() !== driver._id.toString()) {
      return res.status(403).json({ success: false, message: 'Non autoris\u00e9' });
    }
    if (!ride.pinRequired) {
      return res.status(200).json({ success: true, message: 'PIN non requis' });
    }
    const { pin } = req.body;
    if (!pin || pin !== ride.securityPin) {
      return res.status(400).json({ success: false, message: 'Code incorrect' });
    }
    ride.pinVerified = true;
    await ride.save();
    res.status(200).json({ success: true, message: 'Code v\u00e9rifi\u00e9' });
  } catch (error) {
    console.error('Verify PIN Error:', error);
    res.status(500).json({ success: false, message: 'Erreur de v\u00e9rification' });
  }
};



