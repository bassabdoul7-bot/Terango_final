var fs = require('fs');
var f = 'C:/Users/bassa/Projects/terango-final/driver-app/src/screens/MenuScreen.js';
var c = fs.readFileSync(f, 'binary');

// Decode double-encoded UTF-8
var buf = Buffer.from(c, 'binary');
var decoded = buf.toString('utf8');

// Now fix specific known garbled patterns to proper unicode
var fixes = {
  'Ã\u00a0': '\u00e0',   // à
  'Ã©': '\u00e9',         // é  
  'Ã¨': '\u00e8',         // è
  'Ã§': '\u00e7',         // ç
  'Ã®': '\u00ee',         // î
  'Ã´': '\u00f4',         // ô
  'Ãª': '\u00ea',         // ê
  'Ã¹': '\u00f9',         // ù
  'Ã¢': '\u00e2',         // â
  'Ã‰': '\u00c9',         // É
};

// Try re-encoding approach: read as latin1, output as utf8
var content = fs.readFileSync(f, 'latin1');
var fixed = Buffer.from(content, 'latin1').toString('utf8');

// Check if that helped
var garbled = (fixed.match(/ðŸ|â€¢|â€º|â†/g) || []).length;
if (garbled === 0) {
  fs.writeFileSync(f, fixed, 'utf8');
  console.log('Fixed via latin1->utf8 re-encoding!');
} else {
  console.log('Re-encoding did not help, garbled remaining: ' + garbled);
  // Manual replacements needed
  var c2 = fs.readFileSync(f, 'utf8');
  var replacements = [
    ['ðŸš—', '\uD83D\uDE97'],
    ['ðŸ'°', '\uD83D\uDCB0'],
    ['ðŸ"‹', '\uD83D\uDCCB'],
    ['ðŸŽ§', '\uD83C\uDFA7'],
    ['ðŸ"ž', '\uD83D\uDCDE'],
    ['ðŸ'¬', '\uD83D\uDCAC'],
    ['ðŸ"§', '\uD83D\uDCE7'],
    ['ðŸ""', '\uD83D\uDD14'],
    ['ðŸ"Š', '\uD83D\uDCCA'],
    ['ðŸŒ', '\uD83C\uDF10'],
    ['ðŸ"±', '\uD83D\uDCF1'],
    ['ðŸ'‹', '\uD83D\uDC4B'],
    ['ðŸ"·', '\uD83D\uDCF7'],
    ['â­', '\u2B50'],
    ['â€¢', '\u2022'],
    ['â€º', '\u203A'],
    ['â†', '\u2190'],
    ['âœ"', '\u2714'],
    ['â³', '\u23F3'],
    ['âš ï¸', '\u26A0\uFE0F'],
    ['âš™ï¸', '\u2699\uFE0F'],
    ['â„¹ï¸', '\u2139\uFE0F'],
    ['âœ…', '\u2705'],
  ];
  replacements.forEach(function(pair) {
    while (c2.indexOf(pair[0]) !== -1) {
      c2 = c2.split(pair[0]).join(pair[1]);
    }
  });
  fs.writeFileSync(f, c2, 'utf8');
  var remaining = (c2.match(/ðŸ|â€¢|â€º|â†/g) || []).length;
  console.log('Manual fix done. Remaining: ' + remaining);
}
