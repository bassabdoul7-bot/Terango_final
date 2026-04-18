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
    this.BLAST_NOTIFICATION_THRESHOLD = 60000; // Send blast after 60s with no match
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
    return this.searchTimeouts.has(rideId);
  }

  async offerRideToDrivers(rideId, pickupCoords, rideData) {
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
    try {
      const ride = await Ride.findById(rideId);
      if (!ride || ride.status !== 'pending') return;

      // Query ALL approved drivers (not just online) within 20km
      const allDrivers = await Driver.find({
        verificationStatus: 'approved',
        isBlockedForPayment: { $ne: true },
        isSuspended: { $ne: true },
        isBanned: { $ne: true },
        currentLocation: { $exists: true }
      }).populate('userId', 'name phone');

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
      await sendPushToMultiple(userIds, title, body, notifData);

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
    try {
      // CRITICAL: Check if search was cancelled
      if (!this.isRideStillSearching(rideId)) {
        console.log(`?? Search cancelled for ride ${rideId}, stopping offers`);
        return;
      }

      const ride = await Ride.findById(rideId);
      if (!ride || ride.status !== 'pending') {
        console.log(`?? Ride ${rideId} is ${ride?.status}, stopping offers`);
        this.cleanupSearch(rideId);
        return;
      }

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
        willBeQueued
      };

      // FIXED: Use rooms instead of dynamic event names
      this.io.to(`driver-${driverId}`).emit('new-ride-offer', offerPayload);

      // Push notify driver
      sendPushNotification(driver.userId, 'Nouvelle course!', 'Un passager demande une course \u00e0 ' + (rideData.dropoff && rideData.dropoff.address ? rideData.dropoff.address.substring(0, 30) : 'proximit\u00e9'), { type: 'new-ride-offer', rideId: rideId });

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
          message: 'Cette course a dï¿½jï¿½ ï¿½tï¿½ acceptï¿½e par un autre chauffeur'
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
    try {
      const offerData = this.pendingOffers.get(rideId);
      if (!offerData || offerData.currentDriverId !== driverId) return;

      console.log(`? Driver ${driverId} rejected ride ${rideId}`);

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
    const timeout = this.offerTimeouts.get(rideId);
    if (timeout) {
      clearTimeout(timeout);
      this.offerTimeouts.delete(rideId);
    }
  }

  async cancelRideOffers(rideId) {
    // Notify currently offered driver BEFORE cleanup
    var offerData = this.pendingOffers.get(rideId);
    if (offerData && offerData.currentDriverId) {
      console.log('Notifying driver ' + offerData.currentDriverId + ' of cancellation');
      this.io.to('driver-' + offerData.currentDriverId).emit('ride-cancelled', { rideId: rideId, message: 'Le passager a annul\u00e9 la course' });
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



