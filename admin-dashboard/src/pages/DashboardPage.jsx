import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { Users, Car, MapPin, DollarSign, AlertCircle, Activity } from 'lucide-react';

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <span className={'p-2 rounded-lg bg-opacity-10 ' + color}><Icon size={22} className={color.replace('bg-','text-')} /></span>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-emerald-400 mt-2">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  var [stats, setStats] = useState(null);
  var [loading, setLoading] = useState(true);

  useEffect(function() {
    adminService.getDashboard().then(function(res) {
      setStats(res.stats);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }, []);

  if (loading) return <div className="text-gray-500 text-center mt-20">Chargement...</div>;
  if (!stats) return <div className="text-red-400 text-center mt-20">Erreur de chargement</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Tableau de bord</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard icon={Users} label="Passagers" value={stats.totalRiders} color="bg-blue-500" />
        <StatCard icon={Car} label="Chauffeurs" value={stats.totalDrivers} color="bg-emerald-500" sub={stats.activeDrivers + ' en ligne'} />
        <StatCard icon={MapPin} label="Courses totales" value={stats.totalRides} color="bg-purple-500" sub={stats.todayRides + " aujourd'hui"} />
        <StatCard icon={DollarSign} label="Revenus (FCFA)" value={stats.totalRevenue.toLocaleString()} color="bg-yellow-500" sub={stats.todayRevenue.toLocaleString() + " aujourd'hui"} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={18} className="text-orange-400" />
            <h2 className="text-lg font-semibold text-white">Vérifications en attente</h2>
          </div>
          <p className="text-4xl font-bold text-orange-400">{stats.pendingVerifications}</p>
          <p className="text-sm text-gray-500 mt-2">chauffeurs en attente d'approbation</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Activité en temps réel</h2>
          </div>
          <p className="text-4xl font-bold text-emerald-400">{stats.activeDrivers}</p>
          <p className="text-sm text-gray-500 mt-2">chauffeurs connectés maintenant</p>
        </div>
      </div>
    </div>
  );
}
