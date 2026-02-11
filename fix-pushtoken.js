var fs = require('fs');
var f = 'C:/Users/bassa/Projects/terango-final/backend/models/User.js';
var c = fs.readFileSync(f, 'utf8');

c = c.replace(
  "password: { type: String, select: false },",
  "password: { type: String, select: false },\n  pushToken: { type: String, default: '' },"
);

fs.writeFileSync(f, c, 'utf8');
console.log('Done!');
