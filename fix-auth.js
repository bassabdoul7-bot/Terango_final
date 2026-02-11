var fs = require('fs');
var f = 'C:/Users/bassa/Projects/terango-final/backend/middleware/auth.js';
var c = fs.readFileSync(f, 'utf8');

// Update restrictTo to always allow admin
c = c.replace(
  "if (!roles.includes(req.user.role)) {",
  "if (req.user.role !== 'admin' && !roles.includes(req.user.role)) {"
);

fs.writeFileSync(f, c, 'utf8');
console.log('Done!');
