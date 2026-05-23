const Driver = require('../models/Driver');
const { sendPushNotification, sendPushToMultiple } = require('./pushService');
const User = require('../models/User');
const Ride = require('../models/Ride');
const Delivery = require('../models/Delivery');
const { calculateDistance } = require('../utils/distance');

class RideMatchingService {
  constructor(io) {
    this.io = io;
    this.pendingOffers = new Map();
    this.offerTimeouts = new Map();
    this.searchTimeouts = new Map();
    this.retryTimeouts = new Map();

    // Configuration
    this.DRIVER_RESPONSE_TIMEOUT = 60000;
    this.MAX_SEARCH_TIME = 300000; // 5 minutes
    this.SEARCH_RETRY_INTERVAL = 30000; // 30 seconds
    // Blast at 25s — most riders rage-cancel under a minute. Earlier blast
    // gives offline drivers more reaction window before the rider bails.
    this.BLAST_NOTIFICATION_THRESHOLD = 25000;
  }

  setDriverLocationService(driverLocationService) {
    this.driverLocationService = driverLocationService;
  }

  async findNearbyDrivers(pickupCoords, maxRadius = 50000, rideType = null) {
    try {
      if (this.driverLocationService) {
        const redisDrivers = await this.driverLocationService.getNearbyDrivers(
          pickupCoords.latitude,
          pickupCoords.longitude,
          maxRadius
        );

        if (redisDrivers.length > 0) {
          // FIXED: Batch query instead of N+1
          const driverIds = redisDrivers.map(rd => rd.driverId);
          var driverQuery = { _id: { $in: driverIds }, isAvailable: true, isBlockedForPayment: { $ne: true } };
          if (rideType === 'comfort') driverQuery.vehicleClass = 'comfort';
          else if (rideType === 'xl') driverQuery.vehicleClass = 'xl';
          else if (rideType === 'standard') driverQuery.vehicleType = 'car';
          const drivers = await Driver.find(driverQuery).populate('userId', 'name phone rating');

          const driverMap = new Map(
            drivers.map(d => [d._id.toString(), d])
          );

          return redisDrivers
            .map(rd => {
              const driver = driverMap.get(rd.driverId);
              if (!driver) return null;
              return { driver, distance: rd.distance, driverId: rd.driverId };
            })
            .filter(Boolean)
            .sort((a, b) => a.distance - b.distance);
        }
      }

      console.log('Using MongoDB fallback for driver search');
      var fallbackQuery = { isOnline: true, isAvailable: true, isBlockedForPayment: { $ne: true } };
      if (rideType === 'comfort') fallbackQuery.vehicleClass = 'comfort';
      else if (rideType === 'xl') fallbackQuery.vehicleClass = 'xl';
      else if (rideType === 'standard') fallbackQuery.vehicleType = 'car';
      const onlineDrivers = await Driver.find(fallbackQuery).populate('userId', 'name phone rating');

      const driversWithDistance = onlineDrivers
        .map(driver => {
          if (!driver.currentLocation || !driver.currentLocation.coordinates) return null;
          const distance = calculateDistance(
            pickupCoords.latitude, pickupCoords.longitude,
            driver.currentLocation.coordinates.latitude,
            driver.currentLocation.coordinates.longitude
          );
          return { driver, distance, driverId: driver._id.toString() };
        })
        .filter(item => item !== null && item.distance <= maxRadius)
        .sort((a, b) => a.distance - b.distance);

      return driversWithDistance;
    } catch (error) {
      console.error('Find Nearby Drivers Error:', error);
      return [];
    }
  }

  /**
   * Look up any offer currently being made to the given driver.
   * Used by the driver-app on foreground to recover offers that were sent
   * while the app was backgrounded and the socket emit went to a dead socket.
   */
  getCurrentOfferForDriver(driverId) {
    var targetId = driverId && driverId.toString ? driverId.toString() : String(driverId);
    for (var entry of this.pendingOffers.entries()) {
      var rideId = entry[0];
      var offerData = entry[1];
      if (!offerData || !offerData.currentDriverId) continue;
      if (offerData.currentDriverId.toString() !== targetId) continue;
      // Skip if this driver already rejected (or auto-timed-out) — otherwise
      // the offer reappears for them while the retry timer waits to find a
      // new batch of drivers, which causes the "rejected offer keeps coming
      // back" bug.
      var rejected = offerData.rejectedDrivers || [];
      if (rejected.indexOf(targetId) !== -1) continue;
      var driverEntry = (offerData.driversList || []).find(function(d) { return d.driverId === targetId; });
      return Object.assign({}, offerData.rideData || {}, {
        rideId: rideId,
        distanceToPickup: driverEntry ? driverEntry.distance : null,
        offerExpiresIn: this.DRIVER_RESPONSE_TIMEOUT,
        willBeQueued: offerData.tier === 'queue'
      });
    }
    return null;
  }

  async findQueueEligibleDrivers(pickupCoords, maxRadius, rideType) {
    try {
      const activeRides = await Ride.find({ status: 'in_progress' }).select('driver');
      const activeDeliveries = await Delivery.find({
        status: { $in: ['picked_up', 'in_transit', 'at_dropoff'] }
      }).select('driver');

      const busyIds = [
        ...activeRides.map(r => r.driver).filter(Boolean),
        ...activeDeliveries.map(d => d.driver).filter(Boolean)
      ];
      if (busyIds.length === 0) return [];

      var q = {
        _id: { $in: busyIds },
        queueEnabled: true,
        'queuedJob.refId': null,
        isBlockedForPayment: { $ne: true }
      };
      if (rideType === 'comfort') q.vehicleClass = 'comfort';
      else if (rideType === 'xl') q.vehicleClass = 'xl';
      else if (rideType === 'standard') q.vehicleType = 'car';

      const drivers = await Driver.find(q).populate('userId', 'name phone rating');

      return drivers
        .map(driver => {
          if (!driver.currentLocation || !driver.currentLocation.coordinates) return null;
          const distance = calculateDistance(
            pickupCoords.latitude, pickupCoords.longitude,
            driver.currentLocation.coordinates.latitude,
            driver.currentLocation.coordinates.longitude
          );
          return { driver, distance, driverId: driver._id.toString() };
        })
        .filter(item => item !== null && item.distance <= maxRadius)
        .sort((a, b) => a.distance - b.distance);
    } catch (error) {
      console.error('Find Queue Eligible Drivers Error:', error);
      return [];
    }
  }

  /**
   * Check if ride is still searchable (pending and not timed out)
   */
  isRideStillSearching(rideId) {
    return this.searchTimeouts.has(String(rideId));
  }

  /**
   * Called from server.js when a driver flips online, so any pending ride
   * search waiting on supply can fire immediately instead of waiting up to
   * 30s for the next retry tick. Cheap: most of the time `searchTimeouts`
   * is empty and this exits in microseconds.
   */
  async onDriverCameOnline(driverId) {
    try {
      if (!driverId || this.searchTimeouts.size === 0) return;
      const driver = await Driver.findById(driverId).lean();
      if (!driver || driver.verificationStatus !== 'approved' || driver.isSuspended || driver.isBanned) return;
      const driverLoc = driver.currentLocation && driver.currentLocation.coordinates;
      if (!driverLoc || typeof driverLoc.latitude !== 'number' || typeof driverLoc.longitude !== 'number') return;

      for (const [rideId, searchData] of this.searchTimeouts.entries()) {
        try {
          const ride = await Ride.findById(rideId).lean();
          if (!ride || ride.status !== 'pending' || !ride.pickup || !ride.pickup.coordinates) continue;

          // Don't poke about rides this driver already rejected.
          const offerData = this.pendingOffers.get(rideId);
          if (offerData && offerData.rejectedDrivers && offerData.rejectedDrivers.includes(String(driverId))) continue;

          // Make sure the driver type matches the ride. (Currently all
          // passenger rides are car-only; if/when moto passenger rides exist
          // this needs widening.)
          if (!driver.acceptedServices || driver.acceptedServices.rides !== true) continue;
          if (driver.vehicleType !== 'car') continue;

          const dist = calculateDistance(
            ride.pickup.coordinates.latitude, ride.pickup.coordinates.longitude,
            driverLoc.latitude, driverLoc.longitude
          );
          // 20 km outer bound matches the final search-radius tier.
          if (dist > 20) continue;

          // Last-minute guard: don't kick off if there's already a live offer
          // out to a different driver — let that one play out first.
          if (offerData && offerData.currentDriverId) continue;

          console.log(`?? Driver ${driverId} (${dist.toFixed(2)}km) came online — re-triggering match for ride ${rideId}`);
          // Reset attempt to 0 so we use the tight 3km radius first.
          this.searchAndOfferToDrivers(rideId, ride.pickup.coordinates, {
            pickup: ride.pickup,
            dropoff: ride.dropoff,
            fare: ride.fare,
            distance: ride.distance,
            estimatedDuration: ride.estimatedDuration,
            rideType: ride.rideType,
            paymentMethod: ride.paymentMethod,
            platformCommission: ride.platformCommission,
            driverEarnings: ride.driverEarnings
          }, 0).catch(function(err) { console.error('Re-trigger search error:', err); });
        } catch (innerErr) {
          console.error('onDriverCameOnline inner error:', innerErr);
        }
      }
    } catch (err) {
      console.error('onDriverCameOnline error:', err);
    }
  }

  async offerRideToDrivers(rideId, pickupCoords, rideData) {
    rideId = String(rideId);
    try {
      const startTime = Date.now();

      const maxSearchTimeout = setTimeout(async () => {
        console.log(`?? Max search time reached for ride ${rideId}`);
        await this.markNoDriversAvailable(rideId);
      }, this.MAX_SEARCH_TIME);

      this.searchTimeouts.set(rideId, { maxSearchTimeout, startTime });
      await this.searchAndOfferToDrivers(rideId, pickupCoords, rideData, 0);
    } catch (error) {
      console.error('Offer Ride Error:', error);
    }
  }

  async blastNotifyNearbyDrivers(rideId, pickupCoords, rideData) {
    rideId = String(rideId);
    try {
      const ride = await Ride.findById(rideId);
      if (!ride || ride.status !== 'pending') return;

      // Filter by vehicleType so we don't spam moto drivers for car rides
      // (rideType standard/comfort/xl all = car; deliveries use a different
      // dispatch path, this function is only called for passenger rides).
      const rideType = rideData.rideType || 'standard';
      const blastQuery = {
        verificationStatus: 'approved',
        isBlockedForPayment: { $ne: true },
        isSuspended: { $ne: true },
        isBanned: { $ne: true },
        currentLocation: { $exists: true },
        // Only drivers who actually take passenger rides — moto drivers with
        // acceptedServices.rides = false would just be annoyed by a push
        // they can't act on.
        'acceptedServices.rides': true,
        vehicleType: 'car'
      };
      const allDrivers = await Driver.find(blastQuery).populate('userId', 'name phone');

      const nearbyApproved = allDrivers.filter(driver => {
        if (!driver.currentLocation || !driver.currentLocation.coordinates) return false;
        const dist = calculateDistance(
          pickupCoords.latitude, pickupCoords.longitude,
          driver.currentLocation.coordinates.latitude,
          driver.currentLocation.coordinates.longitude
        );
        return dist <= 20; // 20km
      });

      if (nearbyApproved.length === 0) {
        console.log(`Blast notification: no approved drivers within 20km for ride ${rideId}`);
        return;
      }

      const pickupAddr = rideData.pickup?.address || 'Depart';
      const dropoffAddr = rideData.dropoff?.address || 'Arrivee';
      const fare = rideData.fare || 0;
      const title = 'Course disponible!';
      const body = pickupAddr.substring(0, 40) + ' → ' + dropoffAddr.substring(0, 40) + ' • ' + fare + ' FCFA • Connectez-vous!';
      const notifData = { type: 'ride-available', rideId: rideId.toString() };

      const userIds = nearbyApproved.map(d => d.userId?._id || d.userId).filter(Boolean);
      await sendPushToMultiple(userIds, title, body, notifData, 'driver');

      // Also emit socket event to each driver
      nearbyApproved.forEach(driver => {
        this.io.to('driver-' + driver._id.toString()).emit('ride-available-blast', {
          rideId: rideId.toString(),
          pickup: rideData.pickup,
          dropoff: rideData.dropoff,
          fare: fare,
          rideType: rideData.rideType
        });
      });

      console.log(`Blast notification sent to ${nearbyApproved.length} approved drivers for ride ${rideId}`);
    } catch (error) {
      console.error('Blast Notify Error:', error);
    }
  }

  async searchAndOfferToDrivers(rideId, pickupCoords, rideData, attempt) {
    rideId = String(rideId);
    var rideType = rideData.rideType || null;
    try {
      // CRITICAL: Check if search was cancelled (ride accepted/cancelled)
      if (!this.isRideStillSearching(rideId)) {
        console.log(`?? Search cancelled for ride ${rideId}, stopping`);
        return;
      }

      const ride = await Ride.findById(rideId);
      if (!ride || ride.status !== 'pending') {
        console.log(`?? Ride ${rideId} is ${ride?.status}, stopping search`);
        this.cleanupSearch(rideId);
        return;
      }

      // Progressive radius expansion (km)
      let radius = 3;
      if (attempt >= 1) radius = 5;
      if (attempt >= 2) radius = 10;
      if (attempt >= 3) radius = 20;

      console.log(`?? Search attempt ${attempt + 1} for ride ${rideId}, radius: ${radius}km`);

      let nearbyDrivers = await this.findNearbyDrivers(pickupCoords, radius, rideType);

      // Filter out rejected drivers
      const rejectedDrivers = this.pendingOffers.get(rideId)?.rejectedDrivers || [];
      nearbyDrivers = nearbyDrivers.filter(d => !rejectedDrivers.includes(d.driverId));

      let tier = 'free';
      if (nearbyDrivers.length === 0) {
        const queueEligible = await this.findQueueEligibleDrivers(pickupCoords, radius, rideType);
        const filteredQueue = queueEligible.filter(d => !rejectedDrivers.includes(d.driverId));
        if (filteredQueue.length > 0) {
          console.log(`Using ${filteredQueue.length} queue-eligible drivers for ride ${rideId}`);
          nearbyDrivers = filteredQueue;
          tier = 'queue';
        }
      }

      if (nearbyDrivers.length === 0) {
        console.log(`? No drivers found (attempt ${attempt + 1}) for ride ${rideId}`);

        const searchData = this.searchTimeouts.get(rideId);
        const elapsedTime = Date.now() - (searchData?.startTime || Date.now());

        // After 60 seconds with no match, trigger blast notification (once)
        if (elapsedTime >= this.BLAST_NOTIFICATION_THRESHOLD && !searchData?.blastSent) {
          console.log(`Triggering blast notification for ride ${rideId} after ${Math.round(elapsedTime / 1000)}s`);
          searchData.blastSent = true;
          this.searchTimeouts.set(rideId, searchData);
          this.blastNotifyNearbyDrivers(rideId, pickupCoords, rideData).catch(err => console.error('Blast error:', err));
        }

        if (elapsedTime >= this.MAX_SEARCH_TIME) {
          await this.markNoDriversAvailable(rideId);
          return;
        }

        console.log(`?? Retrying search in ${this.SEARCH_RETRY_INTERVAL / 1000}s for ride ${rideId}`);
        const retryTimeout = setTimeout(() => {
          this.searchAndOfferToDrivers(rideId, pickupCoords, rideData, attempt + 1);
        }, this.SEARCH_RETRY_INTERVAL);

        const existingRetries = this.retryTimeouts.get(rideId) || [];
        existingRetries.push(retryTimeout);
        this.retryTimeouts.set(rideId, existingRetries);
        return;
      }

      console.log(`? Found ${nearbyDrivers.length} nearby drivers for ride ${rideId}`);

      if (!this.pendingOffers.has(rideId)) {
        this.pendingOffers.set(rideId, { rejectedDrivers: [] });
      }
      const existingOfferData = this.pendingOffers.get(rideId);
      existingOfferData.tier = tier;
      this.pendingOffers.set(rideId, existingOfferData);

      await this.offerToNextDriver(rideId, nearbyDrivers, 0, rideData, pickupCoords);
    } catch (error) {
      console.error('Search And Offer Error:', error);
    }
  }

  async offerToNextDriver(rideId, driversList, currentIndex, rideData, pickupCoords) {
    rideId = String(rideId);
    try {
      // CRITICAL: Check if search was cancelled
      if (!this.isRideStillSearching(rideId)) {
        console.log(`?? Search cancelled for ride ${rideId}, stopping offers`);
        return;
      }

      const ride = await Ride.findById(rideId).populate({ path: 'riderId', populate: { path: 'userId', select: 'name phone' } });
      if (!ride || ride.status !== 'pending') {
        console.log(`?? Ride ${rideId} is ${ride?.status}, stopping offers`);
        this.cleanupSearch(rideId);
        return;
      }

      var riderUser = ride.riderId && ride.riderId.userId ? ride.riderId.userId : null;
      var riderPhone = riderUser && riderUser.phone ? riderUser.phone : null;
      var riderName = riderUser && riderUser.name ? riderUser.name : null;

      if (currentIndex >= driversList.length) {
        console.log(`?? All drivers in batch rejected ride ${rideId}, searching again...`);

        const offerData = this.pendingOffers.get(rideId) || { rejectedDrivers: [] };
        driversList.forEach(d => {
          if (!offerData.rejectedDrivers.includes(d.driverId)) {
            offerData.rejectedDrivers.push(d.driverId);
          }
        });
        this.pendingOffers.set(rideId, offerData);

        const retryTimeout = setTimeout(() => {
          const attempt = Math.floor(offerData.rejectedDrivers.length / 3);
          this.searchAndOfferToDrivers(rideId, pickupCoords, rideData, attempt);
        }, 5000);

        const existingRetries = this.retryTimeouts.get(rideId) || [];
        existingRetries.push(retryTimeout);
        this.retryTimeouts.set(rideId, existingRetries);
        return;
      }

      const { driver, distance, driverId } = driversList[currentIndex];

      // Re-check availability at the moment of emit. The driversList was
      // fetched once; cycling through with 15s timeouts means a driver at
      // index N may have accepted a different ride before we reach them.
      // Skip them silently if so — no push, no vibration.
      const freshDriver = await Driver.findById(driverId).select('isAvailable isBlockedForPayment');
      if (!freshDriver || freshDriver.isAvailable !== true || freshDriver.isBlockedForPayment === true) {
        console.log(`?? Skipping driver ${driverId} (no longer available) for ride ${rideId}`);
        const skipData = this.pendingOffers.get(rideId) || { rejectedDrivers: [] };
        if (!skipData.rejectedDrivers.includes(driverId)) skipData.rejectedDrivers.push(driverId);
        this.pendingOffers.set(rideId, skipData);
        return await this.offerToNextDriver(rideId, driversList, currentIndex + 1, rideData, pickupCoords);
      }

      console.log(`?? Offering ride ${rideId} to driver ${driverId} (${distance.toFixed(2)}km away)`);

      const offerData = this.pendingOffers.get(rideId) || { rejectedDrivers: [] };
      offerData.currentDriverId = driverId;
      offerData.currentIndex = currentIndex;
      offerData.driversList = driversList;
      offerData.rideData = rideData;
      offerData.pickupCoords = pickupCoords;
      this.pendingOffers.set(rideId, offerData);

      const willBeQueued = (this.pendingOffers.get(rideId) || {}).tier === 'queue';
      const offerPayload = {
        rideId,
        ...rideData,
        distanceToPickup: distance,
        offerExpiresIn: this.DRIVER_RESPONSE_TIMEOUT,
        willBeQueued,
        riderPhone: riderPhone,
        riderName: riderName
      };

      // FIXED: Use rooms instead of dynamic event names
      this.io.to(`driver-${driverId}`).emit('new-ride-offer', offerPayload);

      // Push notify driver
      sendPushNotification(driver.userId, 'Nouvelle course!', 'Un passager demande une course \u00e0 ' + (rideData.dropoff && rideData.dropoff.address ? rideData.dropoff.address.substring(0, 30) : 'proximit\u00e9'), { type: 'new-ride-offer', rideId: rideId }, 'driver');

      // Set timeout for driver response
      const timeout = setTimeout(async () => {
        if (!this.isRideStillSearching(rideId)) return;

        console.log(`? Driver ${driverId} did not respond to ride ${rideId}, moving to next`);

        const currentOfferData = this.pendingOffers.get(rideId) || { rejectedDrivers: [] };
        if (!currentOfferData.rejectedDrivers.includes(driverId)) {
          currentOfferData.rejectedDrivers.push(driverId);
          this.pendingOffers.set(rideId, currentOfferData);
        }

        await this.offerToNextDriver(rideId, driversList, currentIndex + 1, rideData, pickupCoords);
      }, this.DRIVER_RESPONSE_TIMEOUT);

      this.offerTimeouts.set(rideId, timeout);
    } catch (error) {
      console.error('Offer To Next Driver Error:', error);
    }
  }

  async markNoDriversAvailable(rideId) {
    rideId = String(rideId);
    try {
      const ride = await Ride.findById(rideId);
      if (!ride || ride.status !== 'pending') {
        console.log(`?? Ride ${rideId} is ${ride?.status}, NOT marking no-drivers`);
        this.cleanupSearch(rideId);
        return;
      }

      // Final blast notification before giving up (if not already sent)
      const searchData = this.searchTimeouts.get(rideId);
      if (searchData && !searchData.blastSent) {
        await this.blastNotifyNearbyDrivers(rideId, ride.pickup?.coordinates || {}, {
          pickup: ride.pickup,
          dropoff: ride.dropoff,
          fare: ride.fare,
          rideType: ride.rideType
        });
      }

      console.log(`? No drivers available for ride ${rideId} after exhaustive search`);
      await Ride.findByIdAndUpdate(rideId, { status: 'no_drivers_available' });

      // FIXED: Use room instead of dynamic event name
      // Push notify rider - no drivers
      const noDriverRide = await Ride.findById(rideId).populate('riderId');
      if (noDriverRide && noDriverRide.riderId) {
        sendPushNotification(noDriverRide.riderId.userId, 'Aucun chauffeur disponible', 'D\u00e9sol\u00e9, aucun chauffeur n\'est disponible pour le moment. Veuillez r\u00e9essayer.', { type: 'ride-no-drivers', rideId: rideId });
      }

      this.io.to(rideId).emit('ride-no-drivers', {
        message: 'Aucun chauffeur disponible pour le moment'
      });

      this.cleanupSearch(rideId);
    } catch (error) {
      console.error('Mark No Drivers Error:', error);
    }
  }

  async handleDriverAcceptance(rideId, driverId) {
    rideId = String(rideId);
    driverId = String(driverId);
    try {
      // Use atomic update - only accept if still pending
            // Check if either rider or driver has PIN enabled
      const riderUser = await User.findOne({ _id: (await Ride.findById(rideId)).riderId }).populate('userId') || null;
      const rideDoc = await Ride.findById(rideId).populate('riderId');
      const driverDoc = await Driver.findById(driverId).populate('userId');
      const riderUserId = rideDoc?.riderId?.userId || rideDoc?.riderId;
      const riderUserDoc = await User.findById(riderUserId);
      const driverUserDoc = driverDoc?.userId;
      const pinRequired = !!(riderUserDoc?.securityPinEnabled || driverUserDoc?.securityPinEnabled);
      const securityPin = pinRequired ? String(Math.floor(1000 + Math.random() * 9000)) : null;

      // Queue path: driver is already on a job. Route to queue branch.
      if (driverDoc && driverDoc.isAvailable === false) {
        return await this.handleQueuedAcceptance(rideId, driverId, pinRequired, securityPin);
      }

      const ride = await Ride.findOneAndUpdate(
        { _id: rideId, status: 'pending' },
        { driver: driverId, status: 'accepted', acceptedAt: new Date(), pinRequired, securityPin },
        { new: true }
      );

      if (!ride) {
        console.log(`?? Ride ${rideId} already accepted by another driver`);
        return {
          success: false,
          message: 'Cette course a déjà été acceptée par un autre chauffeur'
        };
      }

      console.log(`? Driver ${driverId} accepted ride ${rideId}`);

      // Capture offer data before cleanup (needed for ETA and notifying other drivers)
      const offerData = this.pendingOffers.get(rideId);

      // CRITICAL: Cleanup ALL timeouts immediately
      this.cleanupSearch(rideId);

      const driver = await Driver.findById(driverId).populate('userId', 'name phone rating profilePhoto');

      // Mark driver as unavailable
      await Driver.findByIdAndUpdate(driverId, { isAvailable: false });

      // Cancel any OTHER ride currently being offered to this same driver.
      // Without this, a driver accepting ride A still gets pushes/vibrations
      // for ride B because its offer timeout (15s) is still running and the
      // emit/push already fired. Each affected ride bumps to its next driver.
      var driverIdStr = String(driverId);
      var entries = Array.from(this.pendingOffers.entries());
      for (var i = 0; i < entries.length; i++) {
        var otherRideId = entries[i][0];
        var otherOfferData = entries[i][1];
        if (otherRideId === rideId) continue;
        if (!otherOfferData) continue;
        if (String(otherOfferData.currentDriverId || '') !== driverIdStr) continue;
        console.log('Cancelling stale offer ' + otherRideId + ' for driver ' + driverIdStr + ' (just accepted ' + rideId + ')');
        var staleTimeout = this.offerTimeouts.get(otherRideId);
        if (staleTimeout) { clearTimeout(staleTimeout); this.offerTimeouts.delete(otherRideId); }
        otherOfferData.rejectedDrivers = otherOfferData.rejectedDrivers || [];
        if (otherOfferData.rejectedDrivers.indexOf(driverIdStr) === -1) otherOfferData.rejectedDrivers.push(driverIdStr);
        this.io.to('driver-' + driverIdStr).emit('ride-taken', { rideId: otherRideId });
        this.offerToNextDriver(otherRideId, otherOfferData.driversList, (otherOfferData.currentIndex || 0) + 1, otherOfferData.rideData, otherOfferData.pickupCoords);
      }

      // FIXED: Notify rider via room
      this.io.to(rideId).emit('ride-accepted', {
        driverId: driver._id,
        driver: {
          name: driver.userId?.name,
          phone: driver.userId?.phone,
          rating: driver.userId?.rating,
          profilePhoto: driver.userId?.profilePhoto,
          vehicle: driver.vehicle
        }
      });

      // Live-update share-link viewers (Chauffeur en route).
      if (ride.shareEnabled && ride.shareToken) {
        var acceptShareRoom = 'share-' + ride.shareToken;
        var acceptPayload = { status: 'accepted' };
        this.io.to(acceptShareRoom).emit('share-status-update', acceptPayload);
        this.io.of('/share').to(acceptShareRoom).emit('share-status-update', acceptPayload);
      }

      // Push notify rider - driver found
      const acceptedRider = await require('../models/Rider').findById(ride.riderId);
      if (acceptedRider) {
        const driverName = driver.userId?.name || 'Votre chauffeur';
        const driverEntry = offerData?.driversList?.find(d => d.driverId === driverId.toString());
        const etaMinutes = driverEntry ? Math.max(2, Math.round(driverEntry.distance * 2)) : 5;
        sendPushNotification(acceptedRider.userId, 'Chauffeur trouvé!', driverName + ' arrive dans ~' + etaMinutes + ' minutes', { type: 'ride-accepted', rideId: rideId });
      }

      // Notify other drivers that ride is taken
      if (offerData?.driversList) {
        offerData.driversList.forEach(d => {
          if (d.driverId !== driverId.toString()) {
            this.io.to(`driver-${d.driverId}`).emit('ride-taken', { rideId });
          }
        });
      }

      return { success: true, ride };
    } catch (error) {
      console.error('Handle Driver Acceptance Error:', error);
      return { success: false, message: "Erreur lors de l'acceptation de la course" };
    }
  }

  async handleQueuedAcceptance(rideId, driverId, pinRequired, securityPin) {
    rideId = String(rideId);
    driverId = String(driverId);
    try {
      const driverClaimed = await Driver.findOneAndUpdate(
        { _id: driverId, queueEnabled: true, 'queuedJob.refId': null },
        { 'queuedJob.jobType': 'ride', 'queuedJob.refId': rideId, 'queuedJob.queuedAt': new Date() },
        { new: true }
      );
      if (!driverClaimed) {
        return { success: false, message: 'File d\u0027attente indisponible ou deja occupee' };
      }

      const ride = await Ride.findOneAndUpdate(
        { _id: rideId, status: 'pending' },
        { driver: driverId, status: 'queued', pinRequired, securityPin },
        { new: true }
      );
      if (!ride) {
        await Driver.findByIdAndUpdate(driverId, {
          'queuedJob.jobType': null, 'queuedJob.refId': null, 'queuedJob.queuedAt': null
        });
        return { success: false, message: 'Cette course a deja ete acceptee par un autre chauffeur' };
      }

      console.log('Driver ' + driverId + ' queued ride ' + rideId);
      const offerData = this.pendingOffers.get(rideId);
      this.cleanupSearch(rideId);

      const driver = await Driver.findById(driverId).populate('userId', 'name phone rating profilePhoto');

      this.io.to(rideId.toString()).emit('ride-queued', {
        driverId: driver._id,
        driver: {
          name: driver.userId?.name,
          phone: driver.userId?.phone,
          rating: driver.userId?.rating,
          profilePhoto: driver.userId?.profilePhoto,
          vehicle: driver.vehicle
        }
      });

      const Rider = require('../models/Rider');
      const queuedRider = await Rider.findById(ride.riderId);
      if (queuedRider) {
        const driverName = driver.userId?.name || 'Un chauffeur';
        sendPushNotification(queuedRider.userId, 'Chauffeur trouve!', driverName + ' termine une course puis vient vous chercher', { type: 'ride-queued', rideId: rideId });
      }

      if (offerData?.driversList) {
        offerData.driversList.forEach(d => {
          if (d.driverId !== driverId.toString()) {
            this.io.to('driver-' + d.driverId).emit('ride-taken', { rideId });
          }
        });
      }

      return { success: true, ride, queued: true };
    } catch (error) {
      console.error('Handle Queued Acceptance Error:', error);
      return { success: false, message: 'Erreur lors de la mise en file d\u0027attente' };
    }
  }

  async handleDriverRejection(rideId, driverId) {
    rideId = String(rideId);
    driverId = String(driverId);
    try {
      const offerData = this.pendingOffers.get(rideId);
      if (!offerData) return;
      if (offerData.currentDriverId !== driverId) return;

      if (!offerData.rejectedDrivers.includes(driverId)) {
        offerData.rejectedDrivers.push(driverId);
        this.pendingOffers.set(rideId, offerData);
      }

      this.clearOfferTimeout(rideId);

      await this.offerToNextDriver(
        rideId,
        offerData.driversList,
        offerData.currentIndex + 1,
        offerData.rideData,
        offerData.pickupCoords
      );
    } catch (error) {
      console.error('Handle Driver Rejection Error:', error);
    }
  }

  /**
   * CRITICAL: Cleanup ALL timeouts for a ride
   */
  cleanupSearch(rideId) {
    rideId = String(rideId);
    console.log(`?? Cleaning up all timeouts for ride ${rideId}`);

    // Clear offer timeout
    this.clearOfferTimeout(rideId);

    // Clear max search timeout
    const searchData = this.searchTimeouts.get(rideId);
    if (searchData?.maxSearchTimeout) {
      clearTimeout(searchData.maxSearchTimeout);
    }
    this.searchTimeouts.delete(rideId);

    // Clear ALL retry timeouts
    const retryTimeouts = this.retryTimeouts.get(rideId) || [];
    retryTimeouts.forEach(t => clearTimeout(t));
    this.retryTimeouts.delete(rideId);

    // Clear pending offers
    this.pendingOffers.delete(rideId);
  }

  clearOfferTimeout(rideId) {
    rideId = String(rideId);
    const timeout = this.offerTimeouts.get(rideId);
    if (timeout) {
      clearTimeout(timeout);
      this.offerTimeouts.delete(rideId);
    }
  }

  async cancelRideOffers(rideId) {
    rideId = String(rideId);
    var offerData = this.pendingOffers.get(rideId);
    if (offerData && offerData.currentDriverId) {
      var room = 'driver-' + offerData.currentDriverId;
      this.io.to(room).emit('ride-cancelled', { rideId: rideId, message: 'Le passager a annul\u00e9 la course' });
    }
    // Also notify all drivers that were offered this ride
    if (offerData && offerData.driversList) {
      offerData.driversList.forEach(function(d) {
        this.io.to('driver-' + d.driverId).emit('ride-cancelled', { rideId: rideId, message: 'Course annul\u00e9e' });
      }.bind(this));
    }
    this.cleanupSearch(rideId);
    this.io.to(rideId).emit('ride-cancelled', { rideId: rideId, message: 'Course annul\u00e9e' });
  }
}

module.exports = RideMatchingService;



