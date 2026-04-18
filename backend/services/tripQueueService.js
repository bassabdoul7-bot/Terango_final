const Driver = require('../models/Driver');
const Ride = require('../models/Ride');
const Rider = require('../models/Rider');
const { sendPushNotification } = require('./pushService');

async function promoteQueuedJob(driverId, io) {
  try {
    const driver = await Driver.findById(driverId).populate('userId', 'name phone rating profilePhoto');
    if (!driver || !driver.queuedJob || !driver.queuedJob.refId) return null;

    const queuedRefId = driver.queuedJob.refId;
    const queuedType = driver.queuedJob.jobType;

    if (queuedType !== 'ride') {
      // Queued deliveries not promoted yet; skip and clear so we don't block the driver.
      await Driver.findByIdAndUpdate(driverId, {
        'queuedJob.jobType': null, 'queuedJob.refId': null, 'queuedJob.queuedAt': null
      });
      return null;
    }

    const promotedRide = await Ride.findOneAndUpdate(
      { _id: queuedRefId, status: 'queued', driver: driverId },
      { status: 'accepted', acceptedAt: new Date() },
      { new: true }
    );

    await Driver.findByIdAndUpdate(driverId, {
      'queuedJob.jobType': null, 'queuedJob.refId': null, 'queuedJob.queuedAt': null
    });

    if (!promotedRide) return null;

    if (io) {
      io.to(promotedRide._id.toString()).emit('ride-accepted', {
        driverId: driver._id,
        driver: {
          name: driver.userId && driver.userId.name,
          phone: driver.userId && driver.userId.phone,
          rating: driver.userId && driver.userId.rating,
          profilePhoto: driver.userId && driver.userId.profilePhoto,
          vehicle: driver.vehicle
        },
        promotedFromQueue: true
      });
    }

    const rider = await Rider.findById(promotedRide.riderId);
    if (rider) {
      const driverName = (driver.userId && driver.userId.name) || 'Votre chauffeur';
      sendPushNotification(rider.userId, 'Chauffeur en route!', driverName + ' a termine sa course precedente, il arrive', { type: 'ride-accepted', rideId: promotedRide._id.toString() });
    }

    return { ride: promotedRide, type: 'ride' };
  } catch (error) {
    console.error('Promote Queued Job Error:', error);
    return null;
  }
}

module.exports = { promoteQueuedJob };
