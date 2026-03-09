var fs = require('fs');
var f = '/var/www/Terango_final/backend/controllers/rideController.js';
var lines = fs.readFileSync(f, 'utf8').split('\n');

// Find line 19 (0-indexed) that has the broken message
for (var i = 0; i < lines.length; i++) {
  if (lines[i].indexOf("Profil passager non trouv") !== -1) {
    // Replace everything from here to the stray }); }
    // Count how many lines to remove
    var end = i;
    for (var j = i + 1; j < i + 20; j++) {
      if (lines[j].trim() === '}' && lines[j-1].trim() === '});') {
        end = j;
        break;
      }
    }
    // Replace with correct code
    var fixed = [
      "        message: 'Profil passager non trouv\\u00e9'",
      "      });",
      "    }",
      "",
      "    // Prevent duplicate active rides",
      "    const activeRide = await Ride.findOne({",
      "      riderId: rider._id,",
      "      status: { $in: ['pending', 'accepted', 'arrived', 'in_progress'] }",
      "    });",
      "    if (activeRide) {",
      "      return res.status(400).json({",
      "        success: false,",
      "        message: 'Vous avez d\\u00e9j\\u00e0 une course en cours'",
      "      });",
      "    }"
    ];
    lines.splice(i, end - i + 1, ...fixed);
    break;
  }
}

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('Fixed! Lines around 19:');
var result = fs.readFileSync(f, 'utf8').split('\n');
for (var k = 14; k < 35; k++) console.log('L' + (k+1) + ': ' + result[k]);
