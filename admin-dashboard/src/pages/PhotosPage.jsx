import { useState, useEffect } from 'react';
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
      <h1 className="text-2xl font-bold text-white mb-6">Vérification des photos</h1>

      {loading ? <div className="text-gray-500 text-center py-10">Chargement...</div> : users.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <CheckCircle size={48} className="text-emerald-400 mx-auto mb-4" />
          <p className="text-lg text-white mb-2">Aucune photo en attente</p>
          <p className="text-gray-500">Toutes les photos ont été vérifiées</p>
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
