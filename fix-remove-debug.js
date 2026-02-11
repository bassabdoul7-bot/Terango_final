var fs = require('fs');
var f = 'C:/Users/bassa/Projects/terango-final/backend/controllers/authController.js';
var c = fs.readFileSync(f, 'utf8');

c = c.replace("console.log('ADMIN LOGIN ATTEMPT - email:', email);\n    console.log('DEBUG MONGO_URI:', (process.env.MONGO_URI || 'NOT SET').substring(0, 60) + '...');\n    var debugUser = await User.findOne({ email: email.toLowerCase() });\n    console.log('DEBUG - by email only:', debugUser ? debugUser.name + ' role=' + debugUser.role : 'NOT FOUND');\n    var allAdmins = await User.find({ role: 'admin' });\n    console.log('DEBUG - all admins:', allAdmins.length, allAdmins.map(function(a){ return a.email; }));\n    const user = await User.findOne({ email: email.toLowerCase(), role: 'admin' }).select('+password');\n    console.log('USER FOUND:', !!user);",
  "const user = await User.findOne({ email: email.toLowerCase(), role: 'admin' }).select('+password');"
);

fs.writeFileSync(f, c, 'utf8');
console.log('Debug removed');
