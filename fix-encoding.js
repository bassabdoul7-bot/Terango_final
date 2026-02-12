var fs = require('fs');
var files = [
  'C:/Users/bassa/Projects/terango-final/rider-app/src/screens/LoginScreen.js',
  'C:/Users/bassa/Projects/terango-final/rider-app/src/screens/RegisterScreen.js',
  'C:/Users/bassa/Projects/terango-final/driver-app/src/screens/LoginScreen.js',
  'C:/Users/bassa/Projects/terango-final/driver-app/src/screens/RegisterScreen.js',
  'C:/Users/bassa/Projects/terango-final/backend/controllers/authController.js',
  'C:/Users/bassa/Projects/terango-final/backend/controllers/rideController.js',
  'C:/Users/bassa/Projects/terango-final/backend/controllers/deliveryController.js',
  'C:/Users/bassa/Projects/terango-final/backend/controllers/adminController.js'
];

var replacements = [
  [/Ã©/g, '\u00e9'],
  [/Ã¨/g, '\u00e8'],
  [/Ã /g, '\u00e0'],
  [/Ã§/g, '\u00e7'],
  [/Ã®/g, '\u00ee'],
  [/Ã´/g, '\u00f4'],
  [/Ãª/g, '\u00ea'],
  [/Ã‰/g, '\u00c9'],
  [/Ã¢/g, '\u00e2'],
  [/Ã¹/g, '\u00f9'],
  [/Ã¼/g, '\u00fc'],
  [/Ã«/g, '\u00eb'],
  [/Ã¯/g, '\u00ef'],
  [/Ã¶/g, '\u00f6'],
  [/Ã¤/g, '\u00e4'],
  [/Ã±/g, '\u00f1'],
  [/Ã¿/g, '\u00ff'],
  [/ÃƒÆ'Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ'Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©/g, '\u00e9'],
  [/ÃƒÂ©/g, '\u00e9'],
  [/Ãƒâ€°/g, '\u00c9'],
  [/â€™/g, "'"],
  [/â€˜/g, "'"],
  [/â€œ/g, '"'],
  [/â€/g, '"'],
  [/â€¦/g, '...'],
  [/â€"/g, '-'],
  [/â€"/g, '-'],
  [/Ã‚Â/g, ''],
  [/Â /g, ' ']
];

var fixed = 0;
files.forEach(function(f) {
  try {
    var c = fs.readFileSync(f, 'utf8');
    var original = c;
    replacements.forEach(function(r) {
      c = c.replace(r[0], r[1]);
    });
    if (c !== original) {
      fs.writeFileSync(f, c, 'utf8');
      fixed++;
      console.log('Fixed: ' + f.split('/').pop());
    } else {
      console.log('Clean: ' + f.split('/').pop());
    }
  } catch(e) {
    console.log('Skip: ' + f.split('/').pop() + ' - ' + e.message);
  }
});
console.log('\nFixed ' + fixed + ' files');
