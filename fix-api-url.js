var fs = require('fs');
var f = 'C:/Users/bassa/Projects/terango-final/admin-dashboard/src/services/api.js';
var c = fs.readFileSync(f, 'utf8');
c = c.replace("https://terango-api.fly.dev/api", "http://localhost:5000/api");
fs.writeFileSync(f, c, 'utf8');
console.log('Switched to local API');
