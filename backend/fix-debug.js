var fs = require('fs');
var f = 'C:/Users/bassa/Projects/terango-final/backend/controllers/authController.js';
var c = fs.readFileSync(f, 'utf8');

c = c.replace(
  "const user = await User.findOne({ email: email.toLowerCase(), role: 'admin' }).select('+password');",
  "console.log('ADMIN LOGIN ATTEMPT - email:', email, 'role: admin');\n    const user = await User.findOne({ email: email.toLowerCase(), role: 'admin' }).select('+password');\n    console.log('USER FOUND:', !!user);"
);

fs.writeFileSync(f, c, 'utf8');
console.log('Debug added');
