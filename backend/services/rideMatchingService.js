const Driver = require('../models/Driver');
const { sendPushNotification } = require('./pushService');
const User = require('../models/User');
const Ride = require('../models/Ride');
const { calculateDistance } = require('../utils/distance');

class RideMatchingService {
  constructor(io) {
    this.io = io;
    this.pendingOffers = new Map();
    this.offerTimeouts = new Map();
    this.searchTimeouts = new Map();
    this.retryTimeouts = new Map();

    // Configuration
    this.DRIVER_RESPONSE_TIMEOUT = 20000;
    this.MAX_SEARCH_TIME = 60000;
    this.SEARCH_RETRY_INTERVAL = 15000;
  }

  setDriverLocationService(driverLocationService) {
    this.driverLocationService = driverLocationService;
  }

  async findNearbyDrivers(pickupCoords, maxRadius = 10) {
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
          const drivers = await Driver.find({
            _id: { $in: driverIds },
            isAvailable: true
          }).populate('userId', 'name phone rating');

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
      const onlineDrivers = await Driver.find({
        isOnline: true,
        isAvailable: true
      }).populate('userId', 'name phone rating');

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

  async searchAndOfferToDrivers(rideId, pickupCoords, rideData, attempt) {
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

      // Progressive radius expansion
      let radius = 5;
      if (attempt >= 1) radius = 10;
      if (attempt >= 2) radius = 15;
      if (attempt >= 3) radius = 20;

      console.log(`?? Search attempt ${attempt + 1} for ride ${rideId}, radius: ${radius}km`);

      let nearbyDrivers = await this.findNearbyDrivers(pickupCoords, radius);

      // Filter out rejected drivers
      const rejectedDrivers = this.pendingOffers.get(rideId)?.rejectedDrivers || [];
      nearbyDrivers = nearbyDrivers.filter(d => !rejectedDrivers.includes(d.driverId));

      if (nearbyDrivers.length === 0) {
        console.log(`? No drivers found (attempt ${attempt + 1}) for ride ${rideId}`);

        const searchData = this.searchTimeouts.get(rideId);
        const elapsedTime = Date.now() - (searchData?.startTime || Date.now());

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

      const offerPayload = {
        rideId,
        ...rideData,
        distanceToPickup: distance,
        offerExpiresIn: this.DRIVER_RESPONSE_TIMEOUT
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

      // Notify other drivers that ride is taken
      const offerData = this.pendingOffers.get(rideId);
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
    this.cleanupSearch(rideId);
    // FIXED: Use room
    this.io.to(rideId).emit('ride-cancelled', { message: 'Course annulée' });
  }
}

module.exports = RideMatchingService;
