var fs = require('fs');
var base = 'C:/Users/bassa/Projects/terango-final/admin-dashboard/src';

// 1. Add pending photos API calls
var apiFile = base + '/services/api.js';
var apiCode = fs.readFileSync(apiFile, 'utf8');
apiCode = apiCode.replace(
  "approvePhoto: function(id) { return api.put('/admin/users/' + id + '/approve-photo'); },\n  rejectPhoto: function(id, reason) { return api.put('/admin/users/' + id + '/reject-photo', { reason: reason }); }",
  "getPendingPhotos: function() { return api.get('/admin/pending-photos'); },\n  approvePhoto: function(id) { return api.put('/admin/users/' + id + '/approve-photo'); },\n  rejectPhoto: function(id, reason) { return api.put('/admin/users/' + id + '/reject-photo', { reason: reason }); }"
);
fs.writeFileSync(apiFile, apiCode, 'utf8');
console.log('1. API service updated');

// 2. Create PhotosPage
var photosPage = `import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { CheckCircle, XCircle, Clock, User } from 'lucide-react';

export default function PhotosPage() {
  var [users, setUsers] = useState([]);
  var [loading, setLoading] = useState(true);

  function loadPhotos() {
    setLoading(true);
    adminService.getPendingPhotos().then(function(res) {
      setUsers(res.users || []);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }

  useEffect(function() { loadPhotos(); }, []);

  function handleApprove(userId) {
    adminService.approvePhoto(userId).then(function() { loadPhotos(); });
  }

  function handleReject(userId) {
    var reason = prompt('Raison du rejet:');
    if (!reason) return;
    adminService.rejectPhoto(userId, reason).then(function() { loadPhotos(); });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">V\u00e9rification des photos</h1>

      {loading ? <div className="text-gray-500 text-center py-10">Chargement...</div> : users.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <CheckCircle size={48} className="text-emerald-400 mx-auto mb-4" />
          <p className="text-lg text-white mb-2">Aucune photo en attente</p>
          <p className="text-gray-500">Toutes les photos ont \u00e9t\u00e9 v\u00e9rifi\u00e9es</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map(function(user) {
            return (
              <div key={user._id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="aspect-square bg-gray-800 flex items-center justify-center">
                  {user.profilePhoto ? (
                    <img src={user.profilePhoto} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <User size={64} className="text-gray-600" />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="text-white font-semibold">{user.name}</h3>
                  <p className="text-gray-400 text-sm">{user.phone}</p>
                  <p className="text-gray-500 text-xs mt-1">{user.role}</p>
                  <div className="flex gap-2 mt-4">
                    <button onClick={function() { handleApprove(user._id); }}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-sm font-medium">
                      <CheckCircle size={16} /> Approuver
                    </button>
                    <button onClick={function() { handleReject(user._id); }}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium">
                      <XCircle size={16} /> Rejeter
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
`;
fs.writeFileSync(base + '/pages/PhotosPage.jsx', photosPage, 'utf8');
console.log('2. PhotosPage created');

// 3. Update App.jsx to add PhotosPage route
var appFile = base + '/App.jsx';
var appCode = fs.readFileSync(appFile, 'utf8');
appCode = appCode.replace(
  "import RevenuePage from './pages/RevenuePage';",
  "import RevenuePage from './pages/RevenuePage';\nimport PhotosPage from './pages/PhotosPage';"
);
appCode = appCode.replace(
  "<Route path=\"revenue\" element={<RevenuePage />} />",
  "<Route path=\"revenue\" element={<RevenuePage />} />\n        <Route path=\"photos\" element={<PhotosPage />} />"
);
fs.writeFileSync(appFile, appCode, 'utf8');
console.log('3. Route added to App.jsx');

// 4. Update Layout to add Photos link in sidebar
var layoutFile = base + '/components/Layout.jsx';
var layoutCode = fs.readFileSync(layoutFile, 'utf8');
layoutCode = layoutCode.replace(
  "import { LayoutDashboard, Car, Users, MapPin, DollarSign, LogOut } from 'lucide-react';",
  "import { LayoutDashboard, Car, Users, MapPin, DollarSign, LogOut, Camera } from 'lucide-react';"
);
layoutCode = layoutCode.replace(
  "{ to: '/revenue', icon: DollarSign, label: 'Revenus' },",
  "{ to: '/revenue', icon: DollarSign, label: 'Revenus' },\n  { to: '/photos', icon: Camera, label: 'Photos' },"
);
fs.writeFileSync(layoutFile, layoutCode, 'utf8');
console.log('4. Photos link added to sidebar');

console.log('\\nDone! Refresh the admin dashboard.');
