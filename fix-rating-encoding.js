var fs = require('fs');
var f = 'C:/Users/bassa/Projects/terango-final/rider-app/src/screens/RatingScreen.js';
var c = fs.readFileSync(f, 'utf8');

// Line 50: bullet point
c = c.replace("' \u00e2\u20ac\u00a2 '", "' \u2022 '");

// Line 57: à
c = c.replace("une note \u00c3  votre", "une note \u00e0 votre");

// Line 92: star character
c = c.replace("\u00e2\u02dc\u0085", "\u2605");

// Line 125: checkmark
c = c.replace("\u00e2\u0153\u201c", "\u2714");

// Line 133: star emoji
c = c.replace("\u00e2\u00ad ", "\u2B50 ");

fs.writeFileSync(f, c, 'utf8');
console.log('Done! Checking for remaining issues...');

var check = fs.readFileSync(f, 'utf8');
var m = check.match(/\u00c3\u00a9|\u00c3\u00a8|\u00c3\u00a7|\u00c3\u00a0|\u00c3\u00ae|\u00e2\u20ac\u00a2|\u00e2\u02dc|\u00e2\u0153/g);
console.log(m ? m.length + ' issues remain' : 'Clean!');
