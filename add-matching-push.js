var fs = require('fs');
var f = 'C:/Users/bassa/Projects/terango-final/backend/services/rideMatchingService.js';
var c = fs.readFileSync(f, 'utf8');

// Add push import at top
c = c.replace(
  "const Driver = require('../models/Driver');",
  "const Driver = require('../models/Driver');\nconst { sendPushNotification } = require('./pushService');"
);

// 1. Push notify driver when ride is offered (line 223 area)
c = c.replace(
  "this.io.to(`driver-${driverId}`).emit('new-ride-offer', offerPayload);",
  "this.io.to(`driver-${driverId}`).emit('new-ride-offer', offerPayload);\n\n      // Push notify driver\n      sendPushNotification(driver.userId, 'Nouvelle course!', 'Un passager demande une course \\u00e0 ' + (rideData.dropoff && rideData.dropoff.address ? rideData.dropoff.address.substring(0, 30) : 'proximit\\u00e9'), { type: 'new-ride-offer', rideId: rideId });"
);

// 2. Push notify rider when no drivers found (line 259 area)
c = c.replace(
  "this.io.to(rideId).emit('ride-no-drivers', {",
  "// Push notify rider - no drivers\n      const noDriverRide = await Ride.findById(rideId).populate('riderId');\n      if (noDriverRide && noDriverRide.riderId) {\n        sendPushNotification(noDriverRide.riderId.userId, 'Aucun chauffeur disponible', 'D\\u00e9sol\\u00e9, aucun chauffeur n\\'est disponible pour le moment. Veuillez r\\u00e9essayer.', { type: 'ride-no-drivers', rideId: rideId });\n      }\n\n      this.io.to(rideId).emit('ride-no-drivers', {"
);

fs.writeFileSync(f, c, 'utf8');
console.log('Push notifications added to rideMatchingService!');
