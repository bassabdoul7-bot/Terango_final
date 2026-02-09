const Redis = require('ioredis');

/**
 * Production-Ready Driver Location Service
 * Uses Redis Geospatial indexing with TTL for real-time driver tracking
 * Compatible with Upstash Redis (TLS enabled)
 */
class DriverLocationService {
  constructor() {
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        tls: { rejectUnauthorized: false },
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
      });
    } else {
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

    // TTL in seconds
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
    if (lat === 0 && lng === 0) return false;
    return true;
  }

  /**
   * Update driver location - called every 5 seconds from driver app
   */
  async updateDriverLocation(driverId, latitude, longitude, additionalInfo = {}) {
    try {
      if (!driverId) {
        console.log('⚠️ updateDriverLocation: No driverId provided');
        return { success: false, error: 'No driverId provided' };
      }

      if (!this.isValidCoordinates(latitude, longitude)) {
    console.log('updateDriverLocation: Invalid coordinates for ' + driverId + ': ' + latitude + ', ' + longitude);
        return { success: false, error: 'Invalid coordinates' };
      }

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const now = Date.now();

      const driverInfo = {
        driverId: driverId.toString(),
        latitude: lat,
        longitude: lng,
        lastUpdate: now,
        ...additionalInfo
      };

      // FIXED: Use pipeline for atomic batch operation (1 round trip instead of 3)
      const pipeline = this.redis.pipeline();
      pipeline.geoadd(this.DRIVERS_GEO_KEY, lng, lat, driverId.toString());
      pipeline.setex(this.DRIVER_INFO_PREFIX + driverId, this.DRIVER_TTL, JSON.stringify(driverInfo));
      pipeline.setex(this.DRIVER_HEARTBEAT_PREFIX + driverId, this.DRIVER_TTL, now.toString());
      await pipeline.exec();

      return { success: true, timestamp: now };
    } catch (error) {
      console.error('Update driver location error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get nearby drivers within radius using GEORADIUS
   */
  async getNearbyDrivers(latitude, longitude, radiusKm = 10, limit = 50) {
    try {
      if (!this.isValidCoordinates(latitude, longitude)) {
    console.log('getNearbyDrivers: Invalid coordinates: ' + latitude + ', ' + longitude);
        return [];
      }

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);

      const nearbyDriverIds = await this.redis.georadius(
        this.DRIVERS_GEO_KEY,
        lng, lat, radiusKm, 'km',
        'WITHDIST', 'WITHCOORD', 'ASC', 'COUNT', limit
      );

      if (!nearbyDriverIds || nearbyDriverIds.length === 0) {
        return [];
      }

      // FIXED: Use pipeline instead of sequential gets (1 round trip instead of N*2)
      const pipeline = this.redis.pipeline();
      for (const item of nearbyDriverIds) {
        const driverId = item[0];
        pipeline.get(this.DRIVER_HEARTBEAT_PREFIX + driverId);
        pipeline.get(this.DRIVER_INFO_PREFIX + driverId);
      }
      const results = await pipeline.exec();

      const drivers = [];
      for (let i = 0; i < nearbyDriverIds.length; i++) {
        const item = nearbyDriverIds[i];
        const driverId = item[0];
        const distance = parseFloat(item[1]);
        const [driverLng, driverLat] = item[2];

        const heartbeat = results[i * 2][1];
        const infoStr = results[i * 2 + 1][1];

        if (heartbeat) {
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

      // FIXED: Use pipeline instead of 3 separate calls
      const pipeline = this.redis.pipeline();
      pipeline.zrem(this.DRIVERS_GEO_KEY, driverId.toString());
      pipeline.del(this.DRIVER_INFO_PREFIX + driverId);
      pipeline.del(this.DRIVER_HEARTBEAT_PREFIX + driverId);
      await pipeline.exec();

    console.log('Driver ' + driverId + ' set offline in Redis');
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
    console.log('Driver ' + driverId + ' going online but no valid location yet');
      return { success: true, warning: 'No valid location' };
    }

    console.log('Driver ' + driverId + ' going online at ' + latitude + ', ' + longitude);
    return this.updateDriverLocation(driverId, latitude, longitude, driverInfo);
  }

  /**
   * Check if driver is online
   */
  async isDriverOnline(driverId) {
    if (!driverId) return false;
    const heartbeat = await this.redis.get(this.DRIVER_HEARTBEAT_PREFIX + driverId);
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
      const infoStr = await this.redis.get(this.DRIVER_INFO_PREFIX + driverId);
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
   * FIXED: Use ZCARD instead of KEYS (O(1) instead of O(n))
   */
  async getOnlineDriversCount() {
    try {
      return await this.redis.zcard(this.DRIVERS_GEO_KEY);
    } catch (error) {
      console.error('Get online drivers count error:', error);
      return 0;
    }
  }

  /**
   * Cleanup stale drivers - FIXED: Use pipeline for batch operations
   */
  startCleanupJob() {
    this._cleanupInterval = setInterval(async () => {
      try {
        const allDrivers = await this.redis.zrange(this.DRIVERS_GEO_KEY, 0, -1);
        if (allDrivers.length === 0) return;

        // Batch check all heartbeats in one round trip
        const pipeline = this.redis.pipeline();
        allDrivers.forEach(id => {
        pipeline.get(this.DRIVER_HEARTBEAT_PREFIX + id);
        });
        const results = await pipeline.exec();

        const staleDrivers = allDrivers.filter((_, i) => !results[i][1]);

        if (staleDrivers.length > 0) {
          await this.redis.zrem(this.DRIVERS_GEO_KEY, ...staleDrivers);
      console.log('Cleaned ' + staleDrivers.length + ' stale drivers');
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
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
    }
    await this.redis.quit();
    console.log('Redis disconnected');
  }
}

module.exports = new DriverLocationService();
