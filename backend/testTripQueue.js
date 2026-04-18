/**
 * Integration test for trip-queue feature (step 1-3).
 * Creates synthetic user/rider/driver/ride records, walks through the
 * queue scenario, asserts state transitions, then cleans up.
 *
 * Usage (on the server):
 *   cd /var/www/Terango_final/backend && node testTripQueue.js
 *
 * Safe to run against production: all records use the TEST_TAG prefix
 * and are removed in the cleanup step (including on failure).
 */

require('dotenv').config();
const mongoose = require('mongoose');

const TEST_TAG = '__triptest_' + Date.now();
const results = [];
function assert(label, cond, detail) {
  results.push({ label, pass: !!cond, detail: detail || '' });
  const mark = cond ? 'PASS' : 'FAIL';
  console.log('[' + mark + '] ' + label + (detail ? ' — ' + detail : ''));
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  console.log('Connected to Mongo.\n');

  const User = require('./models/User');
  const Rider = require('./models/Rider');
  const Driver = require('./models/Driver');
  const Ride = require('./models/Ride');

  let riderAUser, riderBUser, driverUser;
  let riderA, riderB, driver;
  let rideA, rideB;

  try {
    // --- Setup ---
    riderAUser = await User.create({
      name: 'TestRiderA ' + TEST_TAG, email: TEST_TAG + '_a@test.local',
      phone: '+221700000001', password: 'xxxxxxxx', role: 'rider'
    });
    riderBUser = await User.create({
      name: 'TestRiderB ' + TEST_TAG, email: TEST_TAG + '_b@test.local',
      phone: '+221700000002', password: 'xxxxxxxx', role: 'rider'
    });
    driverUser = await User.create({
      name: 'TestDriver ' + TEST_TAG, email: TEST_TAG + '_d@test.local',
      phone: '+221700000003', password: 'xxxxxxxx', role: 'driver'
    });

    riderA = await Rider.create({ userId: riderAUser._id });
    riderB = await Rider.create({ userId: riderBUser._id });
    driver = await Driver.create({
      userId: driverUser._id,
      verificationStatus: 'approved',
      isOnline: true,
      isAvailable: false, // already busy
      queueEnabled: true,
      vehicleType: 'car',
      vehicleClass: 'standard',
      currentLocation: {
        type: 'Point',
        coordinates: { latitude: 14.7167, longitude: -17.4677 }
      },
      vehicle: { make: 'Test', model: 'Test', year: 2020, licensePlate: TEST_TAG }
    });

    const pickup = {
      address: 'Dakar Test Pickup',
      coordinates: { latitude: 14.7167, longitude: -17.4677 }
    };
    const dropoff = {
      address: 'Dakar Test Dropoff',
      coordinates: { latitude: 14.6928, longitude: -17.4467 }
    };

    rideA = await Ride.create({
      riderId: riderA._id, driver: driver._id,
      pickup, dropoff, rideType: 'standard',
      distance: 3, estimatedDuration: 10,
      fare: 2000, paymentMethod: 'cash',
      status: 'in_progress'
    });

    rideB = await Ride.create({
      riderId: riderB._id,
      pickup, dropoff, rideType: 'standard',
      distance: 3, estimatedDuration: 10,
      fare: 2000, paymentMethod: 'cash',
      status: 'pending'
    });

    console.log('Synthetic records created with tag ' + TEST_TAG + '\n');

    // --- Test 1: findQueueEligibleDrivers returns our driver ---
    const RideMatchingService = require('./services/rideMatchingService');
    const matcher = new RideMatchingService({ to: () => ({ emit: () => {} }) });
    const eligible = await matcher.findQueueEligibleDrivers(pickup.coordinates, 20, 'standard');
    const hasOurDriver = eligible.some(e => e.driverId === driver._id.toString());
    assert('findQueueEligibleDrivers includes our busy+queueEnabled driver', hasOurDriver,
      'returned ' + eligible.length + ' eligible driver(s)');

    // --- Test 2: handleDriverAcceptance routes busy driver to queue branch ---
    const acceptResult = await matcher.handleDriverAcceptance(rideB._id, driver._id);
    assert('handleDriverAcceptance returns queued=true', acceptResult.success && acceptResult.queued === true,
      JSON.stringify({ success: acceptResult.success, queued: acceptResult.queued, message: acceptResult.message }));

    const rideBAfterAccept = await Ride.findById(rideB._id);
    assert('rideB.status becomes "queued"', rideBAfterAccept && rideBAfterAccept.status === 'queued',
      'got status=' + (rideBAfterAccept && rideBAfterAccept.status));

    const driverAfterAccept = await Driver.findById(driver._id);
    assert('driver.queuedJob.refId set to rideB._id',
      driverAfterAccept && driverAfterAccept.queuedJob &&
      String(driverAfterAccept.queuedJob.refId) === String(rideB._id));
    assert('driver.queuedJob.jobType === "ride"',
      driverAfterAccept && driverAfterAccept.queuedJob &&
      driverAfterAccept.queuedJob.jobType === 'ride');
    assert('driver.isAvailable still false (unchanged)', driverAfterAccept.isAvailable === false);

    // --- Test 3: second queue attempt should fail (slot already taken) ---
    const secondAccept = await matcher.handleDriverAcceptance(rideA._id, driver._id);
    assert('second queue-accept rejected while slot is full',
      secondAccept.success === false,
      'got ' + JSON.stringify(secondAccept));

    // --- Test 4: promoteQueuedJob flips queued -> accepted ---
    const { promoteQueuedJob } = require('./services/tripQueueService');
    const promoted = await promoteQueuedJob(driver._id, null);
    assert('promoteQueuedJob returns a promoted ride', !!(promoted && promoted.ride),
      promoted ? 'rideId=' + promoted.ride._id : 'null');

    const rideBAfterPromote = await Ride.findById(rideB._id);
    assert('rideB.status becomes "accepted"', rideBAfterPromote.status === 'accepted');
    assert('rideB.acceptedAt set', !!rideBAfterPromote.acceptedAt);

    const driverAfterPromote = await Driver.findById(driver._id);
    assert('driver.queuedJob.refId cleared after promote',
      !driverAfterPromote.queuedJob || !driverAfterPromote.queuedJob.refId);
    assert('driver.isAvailable still false after promote', driverAfterPromote.isAvailable === false);

    // --- Test 5: promote with no queued job is a no-op ---
    const promoteAgain = await promoteQueuedJob(driver._id, null);
    assert('promoteQueuedJob on empty queue returns null', promoteAgain === null);

  } catch (err) {
    console.error('\nUNEXPECTED ERROR during test:', err);
    results.push({ label: 'no uncaught exceptions', pass: false, detail: err.message });
  } finally {
    // --- Cleanup ---
    console.log('\nCleaning up test records...');
    if (rideA) await Ride.deleteOne({ _id: rideA._id });
    if (rideB) await Ride.deleteOne({ _id: rideB._id });
    if (riderA) await Rider.deleteOne({ _id: riderA._id });
    if (riderB) await Rider.deleteOne({ _id: riderB._id });
    if (driver) await Driver.deleteOne({ _id: driver._id });
    if (riderAUser) await User.deleteOne({ _id: riderAUser._id });
    if (riderBUser) await User.deleteOne({ _id: riderBUser._id });
    if (driverUser) await User.deleteOne({ _id: driverUser._id });
    console.log('Cleanup done.');

    await mongoose.disconnect();

    // --- Summary ---
    const passed = results.filter(r => r.pass).length;
    const failed = results.length - passed;
    console.log('\n========================================');
    console.log('RESULT: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    process.exit(failed === 0 ? 0 : 1);
  }
}

run();
