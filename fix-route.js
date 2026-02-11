var fs = require('fs');
var f = 'C:/Users/bassa/Projects/terango-final/backend/routes/authRoutes.js';
var c = fs.readFileSync(f, 'utf8');

c = c.replace(
  "sendOTP,\n  verifyOTP,\n  getMe,\n  updateProfile\n}",
  "sendOTP,\n  verifyOTP,\n  getMe,\n  updateProfile,\n  adminLogin\n}"
);

fs.writeFileSync(f, c, 'utf8');
console.log('Done!');
