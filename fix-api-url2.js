var fs = require('fs');
var f = 'C:/Users/bassa/Projects/terango-final/admin-dashboard/src/services/api.js';
var c = fs.readFileSync(f, 'utf8');
c = c.replace("http://localhost:5000/api", "https://terango-api.fly.dev/api");
fs.writeFileSync(f, c, 'utf8');
console.log('Switched to Fly.io API');
