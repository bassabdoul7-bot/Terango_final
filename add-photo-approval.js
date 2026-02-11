var fs = require('fs');

// 1. Add photo approval endpoints to adminController
var f = 'C:/Users/bassa/Projects/terango-final/backend/controllers/adminController.js';
var c = fs.readFileSync(f, 'utf8');

var photoCode = `

// @desc    Get drivers with pending photos
// @route   GET /api/admin/pending-photos
// @access  Private (Admin only)
exports.getPendingPhotos = async (req, res) => {
  try {
    const users = await User.find({ photoStatus: 'pending', profilePhoto: { $ne: '' } });
    res.status(200).json({ success: true, users: users });
  } catch (error) {
    console.error('Pending Photos Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// @desc    Approve driver photo
// @route   PUT /api/admin/users/:id/approve-photo
// @access  Private (Admin only)
exports.approvePhoto = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, {
      photoStatus: 'approved',
      photoVerified: true
    }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouv\u00e9' });
    res.json({ success: true, message: 'Photo approuv\u00e9e', user: user });
  } catch (error) {
    console.error('Approve Photo Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// @desc    Reject driver photo
// @route   PUT /api/admin/users/:id/reject-photo
// @access  Private (Admin only)
exports.rejectPhoto = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, {
      photoStatus: 'rejected',
      photoVerified: false
    }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouv\u00e9' });
    res.json({ success: true, message: 'Photo rejet\u00e9e', user: user });
  } catch (error) {
    console.error('Reject Photo Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
`;

c = c + photoCode;
fs.writeFileSync(f, c, 'utf8');
console.log('1. Photo endpoints added to adminController');

// 2. Add routes
var rf = 'C:/Users/bassa/Projects/terango-final/backend/routes/adminRoutes.js';
var rc = fs.readFileSync(rf, 'utf8');

rc = rc.replace(
  "toggleUserStatus\n}",
  "toggleUserStatus,\n  getPendingPhotos,\n  approvePhoto,\n  rejectPhoto\n}"
);

rc = rc.replace(
  "module.exports = router;",
  "// Photo verification\nrouter.get('/pending-photos', getPendingPhotos);\nrouter.put('/users/:id/approve-photo', approvePhoto);\nrouter.put('/users/:id/reject-photo', rejectPhoto);\n\nmodule.exports = router;"
);

fs.writeFileSync(rf, rc, 'utf8');
console.log('2. Photo routes added');

console.log('Done! Deploy to Fly.io next.');
