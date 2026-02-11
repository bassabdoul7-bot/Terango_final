var fs = require('fs');
var f = 'C:/Users/bassa/Projects/terango-final/rider-app/src/screens/RatingScreen.js';
var c = fs.readFileSync(f, 'utf8');

// Line 57: \xC3\xA0 is UTF-8 for à - actually correct! But let's use unicode escape
c = c.replace('note \u00c3\u00a0 votre', 'note \u00e0 votre');

// Line 92: e2 2dc 2026 = garbled star, replace with proper star
c = c.replace('\u00e2\u02dc\u2026', '\u2605');

// Line 133: e2 ad 90 = garbled star emoji
c = c.replace('\u00e2\u00ad\u0090', '\u2B50');

fs.writeFileSync(f, c, 'utf8');

var check = fs.readFileSync(f, 'utf8');
var m = check.match(/[\u00c3][\u00a0]|[\u00e2][\u02dc]|[\u00e2][\u00ad]/g);
console.log(m ? m.length + ' issues remain' : 'Clean!');
