// One-shot blast trigger: creates a synthetic Ride near the given pickup,
// then invokes RideMatchingService.blastNotifyNearbyDrivers directly.
// Prints which drivers got the push. Cleans up the synthetic ride after.
//
// Usage: node scripts/triggerBlastTest.js <lat> <lng>
// Example: node scripts/triggerBlastTest.js 14.7167 -17.4677

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const path = require('path');
process.chdir(path.join(__dirname, '..'));

(async () => {
  const lat = parseFloat(process.argv[2]);
  const lng = parseFloat(process.argv[3]);
  if (isNaN(lat) || isNaN(lng)) {
    console.error('Usage: node scripts/triggerBlastTest.js <lat> <lng>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const Driver = require('../models/Driver');
  const Rider = require('../models/Rider');
  const User = require('../models/User');
  const Ride = require('../models/Ride');

  // Inventory approved drivers with push tokens within 20km
  const all = await Driver.find({
    verificationStatus: 'approved',
    isBanned: { $ne: true },
    isSuspended: { $ne: true },
    isBlockedForPayment: { $ne: true },
    currentLocation: { $exists: true }
  }).populate('userId', 'name phone pushToken');

  function dist(aLat, aLng, bLat, bLng) {
    const toRad = x => x * Math.PI / 180;
    const R = 6371;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  const nearby = all.filter(d => {
    if (!d.currentLocation || !d.currentLocation.coordinates) return false;
    const c = d.currentLocation.coordinates;
    const km = dist(lat, lng, c.latitude, c.longitude);
    d._km = km;
    return km <= 20;
  });

  console.log('Approved drivers within 20km of (' + lat + ',' + lng + '): ' + nearby.length);
  nearby.forEach(d => {
    const tok = d.userId && d.userId.pushToken ? 'PUSH' : 'no-push';
    console.log('  ' + (d.userId?.name || '?') + ' @ ' + d._km.toFixed(1) + 'km [' + tok + ']');
  });

  if (nearby.length === 0) {
    console.log('Nobody to blast to; aborting.');
    await mongoose.disconnect();
    return;
  }

  // Build a synthetic rideData (no persistence — blast doesn't need a Ride doc)
  const rideData = {
    pickup: { address: 'Test pickup', coordinates: { latitude: lat, longitude: lng } },
    dropoff: { address: 'Test dropoff', coordinates: { latitude: lat + 0.02, longitude: lng + 0.02 } },
    fare: 2000,
    rideType: 'standard'
  };

  // Instantiate the matching service with a no-op io. The blast only needs
  // the push service, which is a separate module.
  const fakeIo = { to: () => ({ emit: () => {} }) };
  const RideMatchingService = require('../services/rideMatchingService');
  const matcher = new RideMatchingService(fakeIo);

  console.log('Firing blastNotifyNearbyDrivers...');
  await matcher.blastNotifyNearbyDrivers('blast-test-' + Date.now(), rideData.pickup.coordinates, rideData);
  console.log('Blast call returned. Check drivers\' phones.');

  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
