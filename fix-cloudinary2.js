var fs = require('fs');
var f = 'C:/Users/bassa/Projects/terango-final/backend/routes/driverRoutes.js';
var c = fs.readFileSync(f, 'utf8');

// Fix the storage config - replace the broken params block
c = c.replace(
  "var storage = new CloudinaryStorage({\n  cloudinary: cloudinary,\n  params: {\n    folder: 'terango-drivers',\n    allowed_formats: ['jpg', 'jpeg', 'png'],\n    transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }],\n  filename: function(req, file, cb) { cb(null, 'driver-' + req.user.id + '-' + Date.now() + path.extname(file.originalname)); }\n});",
  "var storage = new CloudinaryStorage({\n  cloudinary: cloudinary,\n  params: {\n    folder: 'terango-drivers',\n    allowed_formats: ['jpg', 'jpeg', 'png'],\n    transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }]\n  }\n});"
);

fs.writeFileSync(f, c, 'utf8');
console.log('Done!');
