const Redis = require('ioredis');

/**
 * Production-Ready Driver Location Service
 * Uses Redis Geospatial indexing with TTL for real-time driver tracking
 * Similar to Uber/Lyft architecture
 */
class DriverLocationService {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    // Key names
    this.DRIVERS_GEO_KEY = 'terango:drivers:locations';
    this.DRIVER_INFO_PREFIX = 'terango:driver:info:';
    this.DRIVER_HEARTBEAT_PREFIX = 'terango:driver:heartbeat:';
    
    // TTL in seconds - driver considered offline if no update within this time
    this.DRIVER_TTL = 60; // 60 seconds
    this.HEARTBEAT_INTERVAL = 5; // Driver should send update every 5 seconds

    this.redis.on('connect', () => {
      console.log('✅ Redis connected for Driver Location Service');
    });

    this.redis.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
    });

    // Start cleanup job for stale drivers
    this.startCleanupJob();
  }

  /**
   * Update driver location - called every 5 seconds from driver app
   * Uses Redis GEOADD for geospatial indexing
   */
  async updateDriverLocation(driverId, latitude, longitude, additionalInfo = {}) {
    try {
      const now = Date.now();
      
      // 1. Add/Update driver location in geospatial index
      await this.redis.geoadd(
        this.DRIVERS_GEO_KEY,
        longitude, // Redis expects longitude first
        latitude,
        driverId
      );

      // 2. Store driver info with TTL (auto-expires if no updates)
      const driverInfo = {
        driverId,
        latitude,
        longitude,
        lastUpdate: now,
        ...additionalInfo
      };
      
      await this.redis.setex(
        `${this.DRIVER_INFO_PREFIX}${driverId}`,
        this.DRIVER_TTL,
        JSON.stringify(driverInfo)
      );

      // 3. Set heartbeat with TTL
      await this.redis.setex(
        `${this.DRIVER_HEARTBEAT_PREFIX}${driverId}`,
        this.DRIVER_TTL,
        now.toString()
      );

      return { success: true, timestamp: now };
    } catch (error) {
      console.error('Update driver location error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get nearby drivers within radius
   * Uses Redis GEOSEARCH for efficient spatial queries
   */
  async getNearbyDrivers(latitude, longitude, radiusKm = 10, limit = 50) {
    try {
      // 1. Get drivers within radius using geospatial query
      const nearbyDriverIds = await this.redis.geosearch(
        this.DRIVERS_GEO_KEY,
        'FROMLONLAT',
        longitude,
        latitude,
        'BYRADIUS',
        radiusKm,
        'km',
        'WITHDIST',
        'WITHCOORD',
        'ASC', // Sort by distance
        'COUNT',
        limit
      );

      if (!nearbyDriverIds || nearbyDriverIds.length === 0) {
        return [];
      }

      // 2. Parse results and filter only active drivers (with valid heartbeat)
      const drivers = [];
      
      for (let i = 0; i < nearbyDriverIds.length; i += 4) {
        const driverId = nearbyDriverIds[i];
        const distance = parseFloat(nearbyDriverIds[i + 1]);
        const [lng, lat] = nearbyDriverIds[i + 2];

        // Check if driver has valid heartbeat (is actually online)
        const heartbeat = await this.redis.get(`${this.DRIVER_HEARTBEAT_PREFIX}${driverId}`);
        
        if (heartbeat) {
          // Get additional driver info
          const infoStr = await this.redis.get(`${this.DRIVER_INFO_PREFIX}${driverId}`);
          const info = infoStr ? JSON.parse(infoStr) : {};

          drivers.push({
            _id: driverId,
            driverId,
            location: {
              latitude: parseFloat(lat),
              longitude: parseFloat(lng)
            },
            distance: Math.round(distance * 100) / 100, // Round to 2 decimals
            lastUpdate: info.lastUpdate,
            vehicle: info.vehicle,
            rating: info.rating
          });
        }
      }

      return drivers;
    } catch (error) {
      console.error('Get nearby drivers error:', error);
      return [];
    }
  }

  /**
   * Mark driver as offline - removes from all indexes
   */
  async setDriverOffline(driverId) {
    try {
      // Remove from geospatial index
      await this.redis.zrem(this.DRIVERS_GEO_KEY, driverId);
      
      // Remove driver info
      await this.redis.del(`${this.DRIVER_INFO_PREFIX}${driverId}`);
      
      // Remove heartbeat
      await this.redis.del(`${this.DRIVER_HEARTBEAT_PREFIX}${driverId}`);

      console.log(`🔴 Driver ${driverId} set offline`);
      return { success: true };
    } catch (error) {
      console.error('Set driver offline error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark driver as online with initial location
   */
  async setDriverOnline(driverId, latitude, longitude, driverInfo = {}) {
    console.log(`🟢 Driver ${driverId} going online at ${latitude}, ${longitude}`);
    return this.updateDriverLocation(driverId, latitude, longitude, driverInfo);
  }

  /**
   * Check if driver is online (has valid heartbeat)
   */
  async isDriverOnline(driverId) {
    const heartbeat = await this.redis.get(`${this.DRIVER_HEARTBEAT_PREFIX}${driverId}`);
    return !!heartbeat;
  }

  /**
   * Get single driver location
   */
  async getDriverLocation(driverId) {
    try {
      const pos = await this.redis.geopos(this.DRIVERS_GEO_KEY, driverId);
      
      if (!pos || !pos[0]) {
        return null;
      }

      const [longitude, latitude] = pos[0];
      const infoStr = await this.redis.get(`${this.DRIVER_INFO_PREFIX}${driverId}`);
      const info = infoStr ? JSON.parse(infoStr) : {};

      return {
        driverId,
        location: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude)
        },
        ...info
      };
    } catch (error) {
      console.error('Get driver location error:', error);
      return null;
    }
  }

  /**
   * Get count of online drivers (for analytics)
   */
  async getOnlineDriversCount() {
    try {
      // Count drivers with valid heartbeats
      const keys = await this.redis.keys(`${this.DRIVER_HEARTBEAT_PREFIX}*`);
      return keys.length;
    } catch (error) {
      console.error('Get online drivers count error:', error);
      return 0;
    }
  }

  /**
   * Cleanup job - removes stale drivers from geospatial index
   * Runs every 30 seconds
   */
  startCleanupJob() {
    setInterval(async () => {
      try {
        // Get all drivers in geo index
        const allDrivers = await this.redis.zrange(this.DRIVERS_GEO_KEY, 0, -1);
        
        for (const driverId of allDrivers) {
          // Check if heartbeat exists
          const heartbeat = await this.redis.get(`${this.DRIVER_HEARTBEAT_PREFIX}${driverId}`);
          
          if (!heartbeat) {
            // No heartbeat = stale driver, remove from geo index
            await this.redis.zrem(this.DRIVERS_GEO_KEY, driverId);
            console.log(`🧹 Cleaned up stale driver: ${driverId}`);
          }
        }
      } catch (error) {
        console.error('Cleanup job error:', error);
      }
    }, 30000); // Run every 30 seconds
  }

  /**
   * Get distance between driver and a point
   */
  async getDistanceToPoint(driverId, latitude, longitude) {
    try {
      const dist = await this.redis.geodist(
        this.DRIVERS_GEO_KEY,
        driverId,
        `temp_point_${Date.now()}`, // This won't work directly
        'km'
      );
      
      // Alternative: Calculate using driver's position
      const driverLoc = await this.getDriverLocation(driverId);
      if (!driverLoc) return null;

      return this.calculateDistance(
        driverLoc.location.latitude,
        driverLoc.location.longitude,
        latitude,
        longitude
      );
    } catch (error) {
      return null;
    }
  }

  /**
   * Haversine formula for distance calculation
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Graceful shutdown
   */
  async disconnect() {
    await this.redis.quit();
    console.log('Redis disconnected');
  }
}

// Export singleton instance
module.exports = new DriverLocationService();
