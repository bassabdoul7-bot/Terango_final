var fs = require('fs');
var f = '/var/www/Terango_final/backend/controllers/rideController.js';
var lines = fs.readFileSync(f, 'utf8').split('\n');

// Find and fix the broken section
for (var i = 0; i < lines.length; i++) {
  if (lines[i].indexOf("message: 'Profil passager non trouv") !== -1) {
    // Check if next line is the duplicate ride code instead of closing
    if (lines[i+1] && lines[i+1].indexOf('Prevent duplicate') !== -1) {
      // Fix: close the json and if block first, then add duplicate check
      var newLines = [
        lines[i] + "'",  // close the message string
        '      });',
        '    }',
        '',
        '    // Prevent duplicate active rides',
        '    const activeRide = await Ride.findOne({',
        '      riderId: rider._id,',
        '      status: { $in: ["pending", "accepted", "arrived", "in_progress"] }',
        '    });',
        '    if (activeRide) {',
        '      return res.status(400).json({',
        '        success: false,',
        '        message: "Vous avez d\u00e9j\u00e0 une course en cours"',
        '      });',
        '    }'
      ];
      // Remove the broken lines (from current to the stray }); and })
      var removeCount = 0;
      for (var j = i; j < lines.length && j < i + 20; j++) {
        removeCount++;
        if (lines[j].trim() === '}' && lines[j-1] && lines[j-1].trim() === '});') break;
      }
      lines.splice(i, removeCount, ...newLines);
      break;
    }
  }
}

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('Fixed!');
