var fs = require('fs');
var base = 'C:/Users/bassa/Projects/terango-final/admin-dashboard/src';

// Fix all files with double-escaped unicode
var files = [
  'pages/LoginPage.jsx',
  'pages/DashboardPage.jsx',
  'pages/DriversPage.jsx',
  'pages/RidersPage.jsx',
  'pages/RidesPage.jsx',
  'pages/RevenuePage.jsx',
  'components/Layout.jsx'
];

files.forEach(function(file) {
  var p = base + '/' + file;
  var c = fs.readFileSync(p, 'utf8');
  
  // Replace double-escaped unicode with actual characters
  c = c.replace(/\\u00e9/g, '\u00e9');  // é
  c = c.replace(/\\u00e8/g, '\u00e8');  // è
  c = c.replace(/\\u00e7/g, '\u00e7');  // ç
  c = c.replace(/\\u00e0/g, '\u00e0');  // à
  c = c.replace(/\\u00ee/g, '\u00ee');  // î
  c = c.replace(/\\u00f4/g, '\u00f4');  // ô
  c = c.replace(/\\u00ea/g, '\u00ea');  // ê
  c = c.replace(/\\u00c9/g, '\u00c9');  // É
  c = c.replace(/\\u00c8/g, '\u00c8');  // È
  c = c.replace(/\\u2019/g, '\u2019');  // '
  c = c.replace(/\\u00c3/g, '\u00c3');  // Ã (shouldn't appear but just in case)
  
  fs.writeFileSync(p, c, 'utf8');
  
  // Verify no encoding issues
  var check = fs.readFileSync(p, 'utf8');
  var m = check.match(/\\u00[a-f0-9]{2}/g);
  console.log(file + ': ' + (m ? m.length + ' remaining escapes' : 'Clean!'));
});
