var fs = require('fs');
var f = '/var/www/Terango_final/backend/controllers/rideController.js';
var lines = fs.readFileSync(f, 'utf8').split('\n');

// Find the stray }); after the duplicate ride check
for (var i = 0; i < lines.length; i++) {
  if (lines[i].indexOf("une course en cours") !== -1) {
    // Lines after: });  }  then stray });
    // i = message line, i+1 = });, i+2 = }
    // Check if i+3 is a stray });
    if (lines[i+3] && lines[i+3].trim() === '});') {
      lines.splice(i+3, 1);
      console.log('Removed stray }); at line ' + (i+4));
    }
    break;
  }
}

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('Done');
