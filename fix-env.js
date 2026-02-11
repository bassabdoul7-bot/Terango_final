var fs = require('fs');
var f = 'C:/Users/bassa/Projects/terango-final/backend/.env';
var c = fs.readFileSync(f, 'utf8');
c = c + '\n# Cloudinary\nCLOUDINARY_CLOUD_NAME=dittpcisb\nCLOUDINARY_API_KEY=622997271164411\nCLOUDINARY_API_SECRET=tq9cx7Sh4w-UqYcKz_h05dynAEw\n';
fs.writeFileSync(f, c, 'utf8');
console.log('Done!');
