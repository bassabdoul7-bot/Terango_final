var fs = require('fs');
var f = 'C:/Users/bassa/Projects/terango-final/backend/.env';
var c = fs.readFileSync(f, 'utf8');
c = c + '\n# Cloudinary\nCLOUDINARY_CLOUD_NAME=dittpcisb\nCLOUDINARY_API_KEY=***ROTATED_CLOUDINARY_KEY***\nCLOUDINARY_API_SECRET=***ROTATED_CLOUDINARY_SECRET***\n';
fs.writeFileSync(f, c, 'utf8');
console.log('Done!');
