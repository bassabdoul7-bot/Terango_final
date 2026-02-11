var fs = require('fs');
var f = 'C:/Users/bassa/Projects/terango-final/backend/controllers/driverController.js';
var c = fs.readFileSync(f, 'utf8');

// Replace local file URL with Cloudinary URL (req.file.path is the Cloudinary URL with multer-storage-cloudinary)
c = c.replace(
  "var photoUrl = req.protocol + '://' + req.get('host') + '/uploads/' + req.file.filename;",
  "var photoUrl = req.file.path;"
);

fs.writeFileSync(f, c, 'utf8');
console.log('Done!');
