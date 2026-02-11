var fs = require('fs');
var f = 'C:/Users/bassa/Projects/terango-final/backend/controllers/authController.js';
var c = fs.readFileSync(f, 'utf8');

c = c.replace(
  "console.log('ADMIN LOGIN ATTEMPT - email:', email, 'role: admin');\n    const user = await User.findOne({ email: email.toLowerCase(), role: 'admin' }).select('+password');\n    console.log('USER FOUND:', !!user);",
  "console.log('ADMIN LOGIN ATTEMPT - email:', email);\n    var debugUser = await User.findOne({ email: email.toLowerCase() });\n    console.log('DEBUG - by email only:', debugUser ? debugUser.name + ' role=' + debugUser.role : 'NOT FOUND');\n    var allAdmins = await User.find({ role: 'admin' });\n    console.log('DEBUG - all admins:', allAdmins.length, allAdmins.map(function(a){ return a.email; }));\n    const user = await User.findOne({ email: email.toLowerCase(), role: 'admin' }).select('+password');\n    console.log('USER FOUND:', !!user);"
);

fs.writeFileSync(f, c, 'utf8');
console.log('Enhanced debug added');
