const crypto = require('crypto');
const Ride = require('../models/Ride');
const Driver = require('../models/Driver');
const { sendPushNotification } = require('../services/pushService');
const Rider = require('../models/Rider');
const Partner = require('../models/Partner');
const User = require('../models/User');
const SafetyAlert = require('../models/SafetyAlert');
const { calculateDistance, estimateDuration } = require('../utils/distance');
const { calculateFare, calculateEarnings, getTierFromRides } = require('../utils/fare');

// @desc    Create a new ride request
// @route   POST /api/rides
// @access  Private (Rider only)
exports.createRide = async (req, res) => {
  try {
    const { pickup, dropoff, rideType, paymentMethod, scheduledTime, stops } = req.body;

    // Validate stops (max 1 intermediate stop)
    const validatedStops = [];
    if (stops && Array.isArray(stops) && stops.length > 0) {
      const stop = stops[0]; // only first stop
      if (stop && stop.address && stop.coordinates && stop.coordinates.latitude && stop.coordinates.longitude) {
        validatedStops.push({
          address: stop.address,
          coordinates: {
            latitude: stop.coordinates.latitude,
            longitude: stop.coordinates.longitude
          }
        });
      }
    }

    const rider = await Rider.findOne({ userId: req.user._id });
    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Profil passager non trouv\u00e9'
      });
    }

    // Check if this is a scheduled ride
    const isScheduled = scheduledTime && new Date(scheduledTime) > new Date(Date.now() + 30 * 60 * 1000);

    // Prevent duplicate active rides (only for immediate rides)
    if (!isScheduled) {
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
    }

    // Use road distance from client (Google/OSRM) if available, fallback to Haversine
    const distance = req.body.distance || calculateDistance(
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
      status: isScheduled ? 'scheduled' : 'pending',
      isScheduled: !!isScheduled,
      scheduledTime: isScheduled ? new Date(scheduledTime) : null,
      scheduledNotified: false,
      stops: validatedStops
    });

    if (isScheduled) {
      // Scheduled ride: do NOT trigger matching, return success
      var scheduledDate = new Date(scheduledTime);
      var timeStr = scheduledDate.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      return res.status(201).json({
        success: true,
        message: 'Course programmée pour ' + timeStr,
        ride: {
          id: ride._id,
          pickup: ride.pickup,
          dropoff: ride.dropoff,
          distance: ride.distance,
          estimatedDuration: ride.estimatedDuration,
          fare: ride.fare,
          rideType: ride.rideType,
          status: ride.status,
          paymentMethod: ride.paymentMethod,
          isScheduled: true,
          scheduledTime: ride.scheduledTime
        }
      });
    }

    // Both cash and wave: trigger matching immediately
    // For wave, rider pays when driver arrives at pickup
    const matchingService = req.app.get('matchingService');

    const rideData = {
      pickup: ride.pickup,
      dropoff: ride.dropoff,
      fare: ride.fare,
      distance: ride.distance,
      estimatedDuration: ride.estimatedDuration,
      rideType: ride.rideType,
      paymentMethod: ride.paymentMethod,
      platformCommission: ride.platformCommission,
      driverEarnings: ride.driverEarnings
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

    const rides = await Ride.find({ riderId: rider._id, status: 'completed' })
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

    // Notify share viewers
    if (ride.shareEnabled && ride.shareToken) {
      var shareRoom = 'share-' + ride.shareToken;
      io.to(shareRoom).emit('share-ride-ended', { status: 'completed' });
      io.of('/share').to(shareRoom).emit('share-ride-ended', { status: 'completed' });
    }

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

    // Notify share viewers
    if (ride.shareEnabled && ride.shareToken) {
      var shareRoom = 'share-' + ride.shareToken;
      io.to(shareRoom).emit('share-ride-ended', { status: 'cancelled' });
      io.of('/share').to(shareRoom).emit('share-ride-ended', { status: 'cancelled' });
    }

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

// @desc    Get scheduled rides for current rider
// @route   GET /api/rides/scheduled
// @access  Private (Rider only)
exports.getScheduledRides = async (req, res) => {
  try {
    const rider = await Rider.findOne({ userId: req.user._id });
    if (!rider) {
      return res.status(404).json({ success: false, message: 'Profil passager non trouvé' });
    }

    const rides = await Ride.find({
      riderId: rider._id,
      isScheduled: true,
      status: 'scheduled'
    }).sort({ scheduledTime: 1 });

    res.status(200).json({
      success: true,
      count: rides.length,
      rides
    });
  } catch (error) {
    console.error('Get Scheduled Rides Error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des courses programmées' });
  }
};

// @desc    Append GPS trail points to ride
// @route   PUT /api/rides/:id/trail
// @access  Private (Driver only)
exports.appendTrailPoints = async (req, res) => {
  try {
    const { points } = req.body;
    if (!points || !Array.isArray(points) || points.length === 0) {
      return res.status(400).json({ success: false, message: 'Points requis' });
    }

    const driver = await Driver.findOne({ userId: req.user._id });
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Profil chauffeur non trouvé' });
    }

    const ride = await Ride.findById(req.params.id);
    if (!ride) {
      return res.status(404).json({ success: false, message: 'Course non trouvée' });
    }

    if (ride.driver.toString() !== driver._id.toString()) {
      return res.status(403).json({ success: false, message: 'Non autorisé' });
    }

    if (ride.status !== 'in_progress') {
      return res.status(400).json({ success: false, message: 'La course doit être en cours' });
    }

    // Validate and sanitize points
    const validPoints = points
      .filter(function(p) { return p.latitude && p.longitude; })
      .map(function(p) { return { latitude: p.latitude, longitude: p.longitude, timestamp: p.timestamp || new Date() }; });

    if (validPoints.length === 0) {
      return res.status(400).json({ success: false, message: 'Aucun point valide' });
    }

    await Ride.findByIdAndUpdate(req.params.id, {
      $push: { routeTrail: { $each: validPoints } }
    });

    res.status(200).json({ success: true, message: 'Points ajoutés', count: validPoints.length });
  } catch (error) {
    console.error('Append Trail Points Error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'ajout des points' });
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

// @desc    Upload emergency video recording for a ride
// @route   PUT /api/rides/:id/emergency-recording
// @access  Private (Rider or Driver)
// @desc    Generate share link for a ride
// @route   PUT /api/rides/:id/share
// @access  Private (Rider only)
exports.shareRide = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) {
      return res.status(404).json({ success: false, message: 'Course non trouvee' });
    }

    const rider = await Rider.findOne({ userId: req.user._id });
    if (!rider || ride.riderId.toString() !== rider._id.toString()) {
      return res.status(403).json({ success: false, message: 'Non autorise' });
    }

    // If already shared, return existing token
    if (ride.shareToken && ride.shareEnabled) {
      return res.status(200).json({
        success: true,
        shareUrl: 'https://api.terango.sn/share/' + ride.shareToken
      });
    }

    var token = crypto.randomBytes(16).toString('hex');
    ride.shareToken = token;
    ride.shareEnabled = true;
    await ride.save();

    res.status(200).json({
      success: true,
      shareUrl: 'https://api.terango.sn/share/' + token
    });
  } catch (error) {
    console.error('Share Ride Error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du partage de la course' });
  }
};

exports.uploadEmergencyRecording = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) {
      return res.status(404).json({ success: false, message: 'Course non trouvee' });
    }

    // Verify the user is either the rider or the driver of this ride
    const rider = await Rider.findOne({ userId: req.user._id });
    const driver = await Driver.findOne({ userId: req.user._id });
    const isRider = rider && ride.riderId.toString() === rider._id.toString();
    const isDriver = driver && ride.driver && ride.driver.toString() === driver._id.toString();

    if (!isRider && !isDriver) {
      return res.status(403).json({ success: false, message: 'Non autorise' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Fichier media requis' });
    }

    const audioUrl = '/recordings/' + req.file.filename;
    const duration = req.body.duration ? Number(req.body.duration) : 0;

    ride.emergencyRecordings.push({
      recordedBy: req.user._id.toString(),
      audioUrl: audioUrl,
      recordedAt: new Date(),
      duration: duration
    });
    await ride.save();

    // Send push notification to admins via Telegram
    var https = require('https');
    var TELEGRAM_BOT = process.env.TELEGRAM_BOT_TOKEN || '';
    var TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '';
    if (TELEGRAM_BOT && TELEGRAM_CHAT) {
      var alertMsg = '🚨 Enregistrement video d\'urgence — Course #' + ride._id.toString().slice(-6) + '\nPar: ' + (isRider ? 'Passager' : 'Chauffeur') + '\nDuree: ' + duration + 's';
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

// @desc    Trigger SOS alert
// @route   POST /api/rides/:id/sos
// @access  Private (Rider or Driver)
exports.triggerSOS = async (req, res) => {
  try {
    var ride = await Ride.findById(req.params.id)
      .populate({ path: 'riderId', populate: { path: 'userId', select: 'name phone' } })
      .populate({ path: 'driver', populate: { path: 'userId', select: 'name phone' } });
    if (!ride) {
      return res.status(404).json({ success: false, message: 'Course non trouvee' });
    }

    var rider = await Rider.findOne({ userId: req.user._id });
    var driver = await Driver.findOne({ userId: req.user._id });
    var isRider = rider && ride.riderId._id.toString() === rider._id.toString();
    var isDriver = driver && ride.driver && ride.driver._id.toString() === driver._id.toString();
    if (!isRider && !isDriver) {
      return res.status(403).json({ success: false, message: 'Non autorise' });
    }

    // Check if SOS already triggered for this ride
    var existing = await SafetyAlert.findOne({ rideId: ride._id, type: 'sos_triggered' });
    if (!existing) {
      await SafetyAlert.create({
        rideId: ride._id,
        type: 'sos_triggered',
        details: (isRider ? 'Passager' : 'Chauffeur') + ' a declenche le SOS'
      });
    }

    // Send Telegram alert
    var https = require('https');
    var TELEGRAM_BOT = process.env.TELEGRAM_BOT_TOKEN || '';
    var TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '';
    var triggerBy = isRider ? 'Passager' : 'Chauffeur';
    var riderName = (ride.riderId && ride.riderId.userId && ride.riderId.userId.name) || 'Inconnu';
    var driverName = (ride.driver && ride.driver.userId && ride.driver.userId.name) || 'Inconnu';
    if (TELEGRAM_BOT && TELEGRAM_CHAT) {
      var alertMsg = '\uD83C\uDD98 SOS DECLENCHE — Course #' + ride._id.toString().slice(-6) + '\nPar: ' + triggerBy + '\nPassager: ' + riderName + '\nChauffeur: ' + driverName;
      var data = JSON.stringify({ chat_id: TELEGRAM_CHAT, text: alertMsg });
      var opts = { hostname: 'api.telegram.org', path: '/bot' + TELEGRAM_BOT + '/sendMessage', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
      var r = https.request(opts, function() {});
      r.on('error', function() {});
      r.write(data);
      r.end();
    }

    // Send push to the other party
    if (isRider && ride.driver && ride.driver.userId) {
      sendPushNotification(ride.driver.userId._id, 'Alerte SOS', 'Votre passager a declenche une alerte SOS', { type: 'sos', rideId: ride._id.toString() });
    } else if (isDriver && ride.riderId && ride.riderId.userId) {
      sendPushNotification(ride.riderId.userId._id, 'Alerte SOS', 'Votre chauffeur a declenche une alerte SOS', { type: 'sos', rideId: ride._id.toString() });
    }

    // Auto-enable sharing if not enabled
    var shareUrl = null;
    if (!ride.shareToken || !ride.shareEnabled) {
      var token = crypto.randomBytes(16).toString('hex');
      ride.shareToken = token;
      ride.shareEnabled = true;
      await ride.save();
    }
    shareUrl = 'https://api.terango.sn/share/' + ride.shareToken;

    res.status(200).json({ success: true, shareUrl: shareUrl });
  } catch (error) {
    console.error('SOS Trigger Error:', error);
    res.status(500).json({ success: false, message: 'Erreur SOS' });
  }
};
