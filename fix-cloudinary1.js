var fs = require('fs');

// 1. Update driverRoutes.js - replace local multer with Cloudinary
var rf = 'C:/Users/bassa/Projects/terango-final/backend/routes/driverRoutes.js';
var rc = fs.readFileSync(rf, 'utf8');

// Replace the multer local storage setup with Cloudinary
rc = rc.replace(
  "var multer = require('multer');",
  "var multer = require('multer');\nvar cloudinary = require('cloudinary').v2;\nvar { CloudinaryStorage } = require('multer-storage-cloudinary');"
);

rc = rc.replace(
  "var storage = multer.diskStorage({\n  destination: function(req, file, cb) { cb(null, 'uploads/'); },",
  "cloudinary.config({\n  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,\n  api_key: process.env.CLOUDINARY_API_KEY,\n  api_secret: process.env.CLOUDINARY_API_SECRET\n});\n\nvar storage = new CloudinaryStorage({\n  cloudinary: cloudinary,\n  params: {\n    folder: 'terango-drivers',\n    allowed_formats: ['jpg', 'jpeg', 'png'],\n    transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }],"
);

// Need to see the rest of the multer config to replace properly
fs.writeFileSync(rf, rc, 'utf8');
console.log('Partial update done - checking file...');
