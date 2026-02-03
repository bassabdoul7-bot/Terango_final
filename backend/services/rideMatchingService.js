const Driver = require('../models/Driver');
const Ride = require('../models/Ride');
const { calculateDistance } = require('../utils/distance');

class RideMatchingService {
  constructor(io) {
    this.io = io;
    this.pendingOffers = new Map(); // Track active offers to drivers
    this.offerTimeouts = new Map(); // Track timeout handlers
  }

  /**
   * Find nearby online drivers sorted by proximity
   */
  async findNearbyDrivers(pickupCoords, maxRadius = 10) {
    try {
      // Get all online drivers
      const onlineDrivers = await Driver.find({ 
        isOnline: true,
        isAvailable: true 
      }).populate('userId', 'name phone rating');

      // Calculate distance to each driver and filter by radius
      const driversWithDistance = onlineDrivers
        .map(driver => {
          if (!driver.currentLocation || !driver.currentLocation.coordinates) {
            return null;
          }

          const distance = calculateDistance(
            pickupCoords.latitude,
            pickupCoords.longitude,
            driver.currentLocation.coordinates.latitude,
            driver.currentLocation.coordinates.longitude
          );

          return {
            driver,
            distance,
            driverId: driver._id.toString()
          };
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
   * Offer ride to drivers sequentially (Uber-style)
   */
  async offerRideToDrivers(rideId, pickupCoords, rideData) {
    try {
      // Find nearby drivers
      let nearbyDrivers = await this.findNearbyDrivers(pickupCoords, 5);

      // If no drivers within 5km, expand to 10km
      if (nearbyDrivers.length === 0) {
        console.log(`No drivers within 5km, expanding search to 10km for ride ${rideId}`);
        nearbyDrivers = await this.findNearbyDrivers(pickupCoords, 10);
      }

      // If still no drivers, expand to 20km
      if (nearbyDrivers.length === 0) {
        console.log(`No drivers within 10km, expanding search to 20km for ride ${rideId}`);
        nearbyDrivers = await this.findNearbyDrivers(pickupCoords, 20);
      }

      if (nearbyDrivers.length === 0) {
        console.log(`No available drivers found for ride ${rideId}`);
        
        // Update ride status to no_drivers_available
        await Ride.findByIdAndUpdate(rideId, { 
          status: 'no_drivers_available' 
        });

        // Notify rider
        this.io.emit(`ride-no-drivers-${rideId}`, {
          message: 'Aucun chauffeur disponible pour le moment'
        });

        return;
      }

      console.log(`Found ${nearbyDrivers.length} nearby drivers for ride ${rideId}`);

      // Start offering to drivers sequentially
      await this.offerToNextDriver(rideId, nearbyDrivers, 0, rideData);

    } catch (error) {
      console.error('Offer Ride Error:', error);
    }
  }

  /**
   * Offer ride to next driver in sequence
   */
  async offerToNextDriver(rideId, driversList, currentIndex, rideData) {
    try {
      // Check if ride is still pending
      const ride = await Ride.findById(rideId);
      if (!ride || ride.status !== 'pending') {
        console.log(`Ride ${rideId} no longer pending, stopping offers`);
        this.cleanupOffer(rideId);
        return;
      }

      // Check if we've exhausted all drivers
      if (currentIndex >= driversList.length) {
        console.log(`All drivers rejected/ignored ride ${rideId}`);
        
        await Ride.findByIdAndUpdate(rideId, { 
          status: 'no_drivers_available' 
        });

        this.io.emit(`ride-no-drivers-${rideId}`, {
          message: 'Tous les chauffeurs sont occupés'
        });

        this.cleanupOffer(rideId);
        return;
      }

      const { driver, distance, driverId } = driversList[currentIndex];

      console.log(`Offering ride ${rideId} to driver ${driverId} (${distance.toFixed(2)}km away)`);

      // Store offer info
      this.pendingOffers.set(rideId, {
        currentDriverId: driverId,
        currentIndex,
        driversList,
        rideData
      });

      // Send offer to specific driver via socket
      this.io.emit(`new-ride-offer-${driverId}`, {
        rideId,
        ...rideData,
        distanceToPickup: distance,
        offerExpiresIn: 15000 // 15 seconds
      });

      // Set timeout for this offer (15 seconds)
      const timeout = setTimeout(async () => {
        console.log(`Driver ${driverId} did not respond to ride ${rideId}, moving to next driver`);
        
        // Move to next driver
        await this.offerToNextDriver(rideId, driversList, currentIndex + 1, rideData);
      }, 15000);

      this.offerTimeouts.set(rideId, timeout);

    } catch (error) {
      console.error('Offer To Next Driver Error:', error);
    }
  }

  /**
   * Handle driver accepting a ride
   */
  async handleDriverAcceptance(rideId, driverId) {
    try {
      // Use findOneAndUpdate with conditions to ensure atomic operation
      const ride = await Ride.findOneAndUpdate(
        { 
          _id: rideId, 
          status: 'pending' // Only update if still pending
        },
        { 
          driverId,
          status: 'accepted',
          acceptedAt: new Date()
        },
        { 
          new: true 
        }
      );

      // If ride is null, it means another driver already accepted
      if (!ride) {
        console.log(`Ride ${rideId} already accepted by another driver`);
        return {
          success: false,
          message: 'Cette course a déjà été acceptée par un autre chauffeur'
        };
      }

      console.log(`Driver ${driverId} successfully accepted ride ${rideId}`);

      // Clean up pending offers and timeouts
      this.cleanupOffer(rideId);

      // Get driver details
      const driver = await Driver.findById(driverId).populate('userId', 'name phone rating profilePhoto');

      // Notify rider
      this.io.emit(`ride-accepted-${rideId}`, {
        driverId: driver._id,
        driver: {
          name: driver.userId.name,
          phone: driver.userId.phone,
          rating: driver.userId.rating,
          profilePhoto: driver.userId.profilePhoto,
          vehicle: driver.vehicle
        }
      });

      // Notify other drivers that ride is no longer available
      const offerData = this.pendingOffers.get(rideId);
      if (offerData && offerData.driversList) {
        offerData.driversList.forEach(({ driverId: otherDriverId }) => {
          if (otherDriverId !== driverId.toString()) {
            this.io.emit(`ride-taken-${rideId}`, {
              message: 'Course acceptée par un autre chauffeur'
            });
          }
        });
      }

      return {
        success: true,
        ride
      };

    } catch (error) {
      console.error('Handle Driver Acceptance Error:', error);
      return {
        success: false,
        message: 'Erreur lors de l\'acceptation de la course'
      };
    }
  }

  /**
   * Handle driver rejecting a ride
   */
  async handleDriverRejection(rideId, driverId) {
    try {
      const offerData = this.pendingOffers.get(rideId);
      
      if (!offerData || offerData.currentDriverId !== driverId) {
        return; // Not the current driver being offered
      }

      console.log(`Driver ${driverId} rejected ride ${rideId}`);

      // Clear current timeout
      this.clearOfferTimeout(rideId);

      // Move to next driver
      await this.offerToNextDriver(
        rideId,
        offerData.driversList,
        offerData.currentIndex + 1,
        offerData.rideData
      );

    } catch (error) {
      console.error('Handle Driver Rejection Error:', error);
    }
  }

  /**
   * Clean up offer data and timeouts
   */
  cleanupOffer(rideId) {
    this.clearOfferTimeout(rideId);
    this.pendingOffers.delete(rideId);
  }

  /**
   * Clear offer timeout
   */
  clearOfferTimeout(rideId) {
    const timeout = this.offerTimeouts.get(rideId);
    if (timeout) {
      clearTimeout(timeout);
      this.offerTimeouts.delete(rideId);
    }
  }

  /**
   * Cancel all pending offers for a ride
   */
  async cancelRideOffers(rideId) {
    this.cleanupOffer(rideId);
    
    // Notify all drivers that ride is cancelled
    this.io.emit(`ride-cancelled-${rideId}`, {
      message: 'Course annulée'
    });
  }
}

module.exports = RideMatchingService;