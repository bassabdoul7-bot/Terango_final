var fs = require('fs');

var files = [
  'C:/Users/bassa/Projects/terango-final/rider-app/src/screens/LoginScreen.js',
  'C:/Users/bassa/Projects/terango-final/rider-app/src/screens/RegisterScreen.js',
  'C:/Users/bassa/Projects/terango-final/driver-app/src/screens/LoginScreen.js',
  'C:/Users/bassa/Projects/terango-final/driver-app/src/screens/RegisterScreen.js'
];

var replacements = [
  ['\\\\u00e9', '\u00e9'],
  ['\\\\u00e8', '\u00e8'],
  ['\\\\u00e0', '\u00e0'],
  ['\\\\u00e7', '\u00e7'],
  ['\\\\u00ea', '\u00ea'],
  ['\\\\u00ee', '\u00ee'],
  ['\\\\u00f4', '\u00f4'],
  ['\\\\u00c9', '\u00c9'],
  ['\\\\u2022', '\u2022'],
  ['\\\\u00e2', '\u00e2']
];

files.forEach(function(f) {
  var c = fs.readFileSync(f, 'utf8');
  replacements.forEach(function(r) {
    while (c.indexOf(r[0]) !== -1) {
      c = c.split(r[0]).join(r[1]);
    }
  });
  fs.writeFileSync(f, c, 'utf8');
  console.log('Fixed: ' + f.split('/').pop());
});
console.log('Done!');
