var fs = require('fs');
var f = 'C:/Users/bassa/Projects/terango-final/driver-app/src/screens/ActiveRideScreen.js';
var c = fs.readFileSync(f, 'utf8');

// Update chat button styles
c = c.replace(
  "chatButtonRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },",
  "chatButtonRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },"
);
c = c.replace(
  "chatBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(179, 229, 206, 0.2)', borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(179, 229, 206, 0.3)' },",
  "chatBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(66, 133, 244, 0.25)', borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: 'rgba(66, 133, 244, 0.5)' },"
);
c = c.replace(
  "chatBtnIcon: { fontSize: 18, marginRight: 8 },",
  "chatBtnIcon: { fontSize: 24, marginRight: 8 },"
);
c = c.replace(
  "chatBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },",
  "chatBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },"
);

// Also update callBtn to green
c = c.replace(
  "callBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(76, 217, 100, 0.2)', borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(76, 217, 100, 0.3)' },",
  "callBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(76, 217, 100, 0.25)', borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: 'rgba(76, 217, 100, 0.5)' },"
);

fs.writeFileSync(f, c, 'utf8');
console.log('Driver styles updated!');

// Now do the same for rider ActiveRideScreen contact buttons
var f2 = 'C:/Users/bassa/Projects/terango-final/rider-app/src/screens/ActiveRideScreen.js';
var c2 = fs.readFileSync(f2, 'utf8');

// Find and update contactButton style + contactIconBg
c2 = c2.replace(
  "contactButton: { alignItems: 'center' },",
  "contactButton: { alignItems: 'center', backgroundColor: 'rgba(66, 133, 244, 0.15)', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(66, 133, 244, 0.3)' },"
);

fs.writeFileSync(f2, c2, 'utf8');
console.log('Rider styles updated!');

// Rider ActiveDeliveryScreen - update chat button
var f3 = 'C:/Users/bassa/Projects/terango-final/rider-app/src/screens/ActiveDeliveryScreen.js';
var c3 = fs.readFileSync(f3, 'utf8');
c3 = c3.replace(
  "chatBtnSmall: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(179, 229, 206, 0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(179, 229, 206, 0.3)' },",
  "chatBtnSmall: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(66, 133, 244, 0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(66, 133, 244, 0.5)' },"
);
fs.writeFileSync(f3, c3, 'utf8');
console.log('Delivery styles updated!');
