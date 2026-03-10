var fs = require('fs');
var f = '/var/www/Terango_final/backend/services/rideMatchingService.js';
var lines = fs.readFileSync(f, 'utf8').split('\n');

// Find and remove the stale lines after our new cancelRideOffers
for (var i = 0; i < lines.length; i++) {
  if (lines[i].trim() === '}' && lines[i-1] && lines[i-1].indexOf("'Course annul") !== -1 && lines[i+1] && lines[i+1].indexOf('this.cleanupSearch') !== -1) {
    // Remove the stale old function lines (i+1 to i+4)
    lines.splice(i + 1, 4);
    break;
  }
}

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('Stale lines removed');
