var fs = require('fs');
var f = 'C:/Users/bassa/Projects/terango-final/backend/controllers/rideController.js';
var c = fs.readFileSync(f, 'utf8');

// Add push service import at top
c = c.replace(
  "const { generateToken } = require('../utils/jwt');",
  "const { generateToken } = require('../utils/jwt');\nconst { sendPushNotification } = require('../services/pushService');"
);

// If that import doesn't exist, try another anchor
if (c.indexOf("require('../services/pushService')") === -1) {
  c = c.replace(
    "const Driver = require('../models/Driver');",
    "const Driver = require('../models/Driver');\nconst { sendPushNotification } = require('../services/pushService');"
  );
}

// 1. After ride accepted - notify rider
c = c.replace(
  "    driver.isAvailable = false;\n    await driver.save();\n\n    res.status(200).json({\n      success: true,\n      message: 'Course accept\u00c3\u00a9e',\n      ride: result.ride\n    });",
  "    driver.isAvailable = false;\n    await driver.save();\n\n    // Push notify rider\n    var acceptedRide = await Ride.findById(req.params.id).populate('riderId');\n    if (acceptedRide && acceptedRide.riderId) {\n      sendPushNotification(acceptedRide.riderId.userId, 'Chauffeur trouv\\u00e9!', 'Un chauffeur a accept\\u00e9 votre course.', { type: 'ride-accepted', rideId: req.params.id });\n    }\n\n    res.status(200).json({\n      success: true,\n      message: 'Course accept\\u00e9e',\n      ride: result.ride\n    });"
);

// 2. After ride status update (arrived) - notify rider
c = c.replace(
  "    io.to(ride._id.toString()).emit('ride-status', {\n      status: ride.status,\n      timestamp: new Date()\n    });\n\n    res.status(200).json({\n      success: true,\n      message: 'Statut mis",
  "    io.to(ride._id.toString()).emit('ride-status', {\n      status: ride.status,\n      timestamp: new Date()\n    });\n\n    // Push notify based on status\n    var statusRide = await Ride.findById(ride._id).populate('riderId');\n    if (statusRide && statusRide.riderId) {\n      var titles = { arrived: 'Chauffeur arriv\\u00e9!', in_progress: 'Course en cours' };\n      var bodies = { arrived: 'Votre chauffeur est arriv\\u00e9 au point de prise en charge.', in_progress: 'Votre course a commenc\\u00e9.' };\n      if (titles[ride.status]) {\n        sendPushNotification(statusRide.riderId.userId, titles[ride.status], bodies[ride.status], { type: 'ride-status', rideId: ride._id.toString(), status: ride.status });\n      }\n    }\n\n    res.status(200).json({\n      success: true,\n      message: 'Statut mis"
);

// 3. After ride completed - notify rider
c = c.replace(
  "    io.to(ride._id.toString()).emit('ride-completed', {",
  "    // Push notify rider - ride completed\n    var completedRide = await Ride.findById(ride._id).populate('riderId');\n    if (completedRide && completedRide.riderId) {\n      sendPushNotification(completedRide.riderId.userId, 'Course termin\\u00e9e!', 'Merci! Votre course de ' + ride.fare + ' FCFA est termin\\u00e9e.', { type: 'ride-completed', rideId: ride._id.toString() });\n    }\n\n    io.to(ride._id.toString()).emit('ride-completed', {"
);

// 4. After ride cancelled - notify the other party
c = c.replace(
  "    io.to(ride._id.toString()).emit('ride-cancelled', {",
  "    // Push notify cancellation\n    var cancelledRide = await Ride.findById(ride._id).populate('riderId').populate('driver');\n    if (cancelledRide) {\n      if (req.user.role === 'driver' && cancelledRide.riderId) {\n        sendPushNotification(cancelledRide.riderId.userId, 'Course annul\\u00e9e', 'Votre chauffeur a annul\\u00e9 la course.', { type: 'ride-cancelled', rideId: ride._id.toString() });\n      } else if (cancelledRide.driver) {\n        sendPushNotification(cancelledRide.driver.userId, 'Course annul\\u00e9e', 'Le passager a annul\\u00e9 la course.', { type: 'ride-cancelled', rideId: ride._id.toString() });\n      }\n    }\n\n    io.to(ride._id.toString()).emit('ride-cancelled', {"
);

fs.writeFileSync(f, c, 'utf8');
console.log('Push notifications added to rideController!');
