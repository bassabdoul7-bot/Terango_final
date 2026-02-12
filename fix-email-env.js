var fs = require('fs');
var f = 'C:/Users/bassa/Projects/terango-final/backend/.env';
var c = fs.readFileSync(f, 'utf8');
c = c + '\n# Email\nEMAIL_USER=bassabdoul7@gmail.com\nEMAIL_PASS=jfzzoadelzsebfmp\n';
fs.writeFileSync(f, c, 'utf8');
console.log('Done!');
