var fs = require('fs');
var f = 'C:/Users/bassa/Projects/terango-final/backend/controllers/deliveryController.js';
var c = fs.readFileSync(f, 'utf8');

// Add push service import at top
var firstLine = c.indexOf('\n');
c = c.substring(0, firstLine) + "\nvar { sendPushNotification } = require('../services/pushService');" + c.substring(firstLine);

// 1. After delivery accepted - notify rider
c = c.replace(
  "          res.status(200).json({ success: true, delivery: delivery });",
  "          // Push notify rider\n          Delivery.findById(delivery._id).populate('riderId').then(function(d) {\n            if (d && d.riderId) {\n              sendPushNotification(d.riderId.userId, 'Livreur trouv\\u00e9!', 'Un livreur a accept\\u00e9 votre livraison.', { type: 'delivery-accepted', deliveryId: delivery._id.toString() });\n            }\n          });\n\n          res.status(200).json({ success: true, delivery: delivery });"
);

// 2. After delivery status update - notify rider
c = c.replace(
  "io.to(delivery._id.toString()).emit('delivery-status-update',",
  "// Push notify rider on status change\n          var statusTitles = { at_pickup: 'Livreur au point de retrait', picked_up: 'Colis r\\u00e9cup\\u00e9r\\u00e9', in_transit: 'Livraison en route', delivered: 'Livraison termin\\u00e9e!' };\n          var statusBodies = { at_pickup: 'Le livreur est arriv\\u00e9 au point de retrait.', picked_up: 'Le livreur a r\\u00e9cup\\u00e9r\\u00e9 votre colis.', in_transit: 'Votre livraison est en route.', delivered: 'Votre livraison a \\u00e9t\\u00e9 effectu\\u00e9e avec succ\\u00e8s!' };\n          if (statusTitles[newStatus]) {\n            Delivery.findById(delivery._id).populate('riderId').then(function(d) {\n              if (d && d.riderId) {\n                sendPushNotification(d.riderId.userId, statusTitles[newStatus], statusBodies[newStatus], { type: 'delivery-status', deliveryId: delivery._id.toString(), status: newStatus });\n              }\n            });\n          }\n\n          io.to(delivery._id.toString()).emit('delivery-status-update',"
);

fs.writeFileSync(f, c, 'utf8');
console.log('Push notifications added to deliveryController!');
