var fs = require('fs');
var f = 'C:/Users/bassa/Projects/terango-final/backend/server.js';
var c = fs.readFileSync(f, 'utf8');

c = c.replace(
  "app.use('/api/auth', authRoutes);",
  "app.get('/', function(req, res) { res.json({ app: 'TeranGO API', status: 'running' }); });\n\napp.use('/api/auth', authRoutes);"
);

fs.writeFileSync(f, c, 'utf8');
console.log('Done!');
