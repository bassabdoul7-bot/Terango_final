import { useState, useEffect } from 'react';
import { partnerService } from '../services/api';
import { Users, DollarSign, Car, TrendingUp, Plus, X, Clock, CheckCircle } from 'lucide-react';

export default function PartnerDashboardPage() {
  var [dashboard, setDashboard] = useState(null);
  var [loading, setLoading] = useState(true);

  useEffect(function() {
    partnerService.getDashboard().then(function(res) {
      if (res.success) setDashboard(res.dashboard);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }, []);

  if (loading) return <div className="text-gray-500 text-center py-12">Chargement...</div>;
  if (!dashboard) return <div className="text-red-400 text-center py-12">Erreur de chargement</div>;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Bienvenue, {dashboard.businessName}</h1>
        <p className="text-gray-500 mt-1">Votre tableau de bord partenaire</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-emerald-500/10"><DollarSign className="text-emerald-400" size={20} /></div>
            <span className="text-gray-400 text-sm">Revenus Aujourd'hui</span>
          </div>
          <p className="text-2xl font-bold text-white">{(dashboard.todayEarnings || 0).toLocaleString()} FCFA</p>
          <p className="text-gray-500 text-xs mt-1">{dashboard.todayRides || 0} courses</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-blue-500/10"><TrendingUp className="text-blue-400" size={20} /></div>
            <span className="text-gray-400 text-sm">Cette Semaine</span>
          </div>
          <p className="text-2xl font-bold text-white">{(dashboard.weeklyEarnings || 0).toLocaleString()} FCFA</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-yellow-500/10"><DollarSign className="text-yellow-400" size={20} /></div>
            <span className="text-gray-400 text-sm">Total Revenus</span>
          </div>
          <p className="text-2xl font-bold text-white">{(dashboard.totalEarnings || 0).toLocaleString()} FCFA</p>
          <p className="text-gray-500 text-xs mt-1">Commission: {dashboard.commissionRate}%</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-purple-500/10"><Users className="text-purple-400" size={20} /></div>
            <span className="text-gray-400 text-sm">Chauffeurs</span>
          </div>
          <p className="text-2xl font-bold text-white">{dashboard.totalDrivers || 0}</p>
          <p className="text-gray-500 text-xs mt-1">{dashboard.activeDrivers || 0} en ligne</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="text-emerald-400" size={16} />
            <span className="text-gray-400 text-sm">Approuves</span>
          </div>
          <p className="text-xl font-bold text-emerald-400">{dashboard.approvedDrivers || 0}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="text-yellow-400" size={16} />
            <span className="text-gray-400 text-sm">En attente</span>
          </div>
          <p className="text-xl font-bold text-yellow-400">{dashboard.pendingDrivers || 0}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <Car className="text-blue-400" size={16} />
            <span className="text-gray-400 text-sm">En ligne</span>
          </div>
          <p className="text-xl font-bold text-blue-400">{dashboard.activeDrivers || 0}</p>
        </div>
      </div>
    </div>
  );
}
