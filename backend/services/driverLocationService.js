const Redis = require('ioredis');

/**
 * Production-Ready Driver Location Service
 * Uses Redis Geospatial indexing with TTL for real-time driver tracking
 * Compatible with Upstash Redis (TLS enabled)
 */
class DriverLocationService {
  constructor() {
    // Use REDIS_URL if available (Upstash format), otherwise build from parts
    const redisUrl = process.env.REDIS_URL;
    
    if (redisUrl) {
      // Upstash connection with TLS
      this.redis = new Redis(redisUrl, {
        tls: { rejectUnauthorized: false },
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
      });
    } else {
      // Local Redis fallback
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
      });
    }

    // Key names
    this.DRIVERS_GEO_KEY = 'terango:drivers:locations';
    this.DRIVER_INFO_PREFIX = 'terango:driver:info:';
    this.DRIVER_HEARTBEAT_PREFIX = 'terango:driver:heartbeat:';
    
    // TTL in seconds - driver considered offline if no update within this time
    this.DRIVER_TTL = 60;

    this.redis.on('connect', () => {
      console.log('✅ Redis connected (Upstash) for Driver Location Service');
    });

    this.redis.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
    });

    // Start cleanup job
    this.startCleanupJob();
  }

  /**
   * Validate coordinates
   */
  isValidCoordinates(latitude, longitude) {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    
    if (isNaN(lat) || isNaN(lng)) return false;
    if (lat < -90 || lat > 90) return false;
    if (lng < -180 || lng > 180) return false;
    if (lat === 0 && lng === 0) return false; // Unlikely real location
    
    return true;
  }

  /**
   * Update driver location - called every 5 seconds from driver app
   */
  async updateDriverLocation(driverId, latitude, longitude, additionalInfo = {}) {
    try {
      // Validate inputs
      if (!driverId) {
        console.log('⚠️ updateDriverLocation: No driverId provided');
        return { success: false, error: 'No driverId provided' };
      }

      if (!this.isValidCoordinates(latitude, longitude)) {
        console.log(`⚠️ updateDriverLocation: Invalid coordinates for ${driverId}: ${latitude}, ${longitude}`);
        return { success: false, error: 'Invalid coordinates' };
      }

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const now = Date.now();
      
      // Add/Update driver location in geospatial index
      await this.redis.geoadd(
        this.DRIVERS_GEO_KEY,
        lng,
        lat,
        driverId.toString()
      );

      // Store driver info with TTL
      const driverInfo = {
        driverId: driverId.toString(),
        latitude: lat,
        longitude: lng,
        lastUpdate: now,
        ...additionalInfo
      };
      
      await this.redis.setex(
        `${this.DRIVER_INFO_PREFIX}${driverId}`,
        this.DRIVER_TTL,
        JSON.stringify(driverInfo)
      );

      // Set heartbeat with TTL
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
   * Get nearby drivers within radius using GEORADIUS (compatible with older Redis)
   */
  async getNearbyDrivers(latitude, longitude, radiusKm = 10, limit = 50) {
    try {
      if (!this.isValidCoordinates(latitude, longitude)) {
        console.log(`⚠️ getNearbyDrivers: Invalid coordinates: ${latitude}, ${longitude}`);
        return [];
      }

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);

      // Use GEORADIUS for better compatibility with Upstash
      const nearbyDriverIds = await this.redis.georadius(
        this.DRIVERS_GEO_KEY,
        lng,
        lat,
        radiusKm,
        'km',
        'WITHDIST',
        'WITHCOORD',
        'ASC',
        'COUNT',
        limit
      );

      if (!nearbyDriverIds || nearbyDriverIds.length === 0) {
        return [];
      }

      // Parse results - GEORADIUS returns [name, distance, [lng, lat]]
      const drivers = [];
      
      for (const item of nearbyDriverIds) {
        const driverId = item[0];
        const distance = parseFloat(item[1]);
        const [driverLng, driverLat] = item[2];

        // Check if driver has valid heartbeat
        const heartbeat = await this.redis.get(`${this.DRIVER_HEARTBEAT_PREFIX}${driverId}`);
        
        if (heartbeat) {
          const infoStr = await this.redis.get(`${this.DRIVER_INFO_PREFIX}${driverId}`);
          const info = infoStr ? JSON.parse(infoStr) : {};

          drivers.push({
            _id: driverId,
            driverId,
            location: {
              latitude: parseFloat(driverLat),
              longitude: parseFloat(driverLng)
            },
            distance: Math.round(distance * 100) / 100,
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
   * Mark driver as offline
   */
  async setDriverOffline(driverId) {
    try {
      if (!driverId) {
        return { success: false, error: 'No driverId provided' };
      }

      await this.redis.zrem(this.DRIVERS_GEO_KEY, driverId.toString());
      await this.redis.del(`${this.DRIVER_INFO_PREFIX}${driverId}`);
      await this.redis.del(`${this.DRIVER_HEARTBEAT_PREFIX}${driverId}`);
      console.log(`🔴 Driver ${driverId} set offline in Redis`);
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
    if (!driverId) {
      console.log('⚠️ setDriverOnline: No driverId provided');
      return { success: false, error: 'No driverId provided' };
    }

    if (!this.isValidCoordinates(latitude, longitude)) {
      console.log(`⚠️ Driver ${driverId} going online but no valid location yet`);
      // Still allow going online, just don't add to geo index
      return { success: true, warning: 'No valid location' };
    }

    console.log(`🟢 Driver ${driverId} going online at ${latitude}, ${longitude}`);
    return this.updateDriverLocation(driverId, latitude, longitude, driverInfo);
  }

  /**
   * Check if driver is online
   */
  async isDriverOnline(driverId) {
    if (!driverId) return false;
    const heartbeat = await this.redis.get(`${this.DRIVER_HEARTBEAT_PREFIX}${driverId}`);
    return !!heartbeat;
  }

  /**
   * Get single driver location
   */
  async getDriverLocation(driverId) {
    try {
      if (!driverId) return null;

      const pos = await this.redis.geopos(this.DRIVERS_GEO_KEY, driverId.toString());
      if (!pos || !pos[0]) return null;

      const [longitude, latitude] = pos[0];
      const infoStr = await this.redis.get(`${this.DRIVER_INFO_PREFIX}${driverId}`);
      const info = infoStr ? JSON.parse(infoStr) : {};

      return {
        driverId,
        location: { latitude: parseFloat(latitude), longitude: parseFloat(longitude) },
        ...info
      };
    } catch (error) {
      console.error('Get driver location error:', error);
      return null;
    }
  }

  /**
   * Get count of online drivers
   */
  async getOnlineDriversCount() {
    try {
      const keys = await this.redis.keys(`${this.DRIVER_HEARTBEAT_PREFIX}*`);
      return keys.length;
    } catch (error) {
      console.error('Get online drivers count error:', error);
      return 0;
    }
  }

  /**
   * Cleanup stale drivers every 30 seconds
   */
  startCleanupJob() {
    setInterval(async () => {
      try {
        const allDrivers = await this.redis.zrange(this.DRIVERS_GEO_KEY, 0, -1);
        
        for (const driverId of allDrivers) {
          const heartbeat = await this.redis.get(`${this.DRIVER_HEARTBEAT_PREFIX}${driverId}`);
          
          if (!heartbeat) {
            await this.redis.zrem(this.DRIVERS_GEO_KEY, driverId);
            console.log(`🧹 Cleaned up stale driver: ${driverId}`);
          }
        }
      } catch (error) {
        // Silently fail cleanup - not critical
      }
    }, 30000);
  }

  /**
   * Graceful shutdown
   */
  async disconnect() {
    await this.redis.quit();
    console.log('Redis disconnected');
  }
}

module.exports = new DriverLocationService();