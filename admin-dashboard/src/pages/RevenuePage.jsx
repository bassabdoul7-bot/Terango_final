import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { DollarSign, TrendingUp, Car, PieChart } from 'lucide-react';

export default function RevenuePage() {
  var [analytics, setAnalytics] = useState(null);
  var [loading, setLoading] = useState(true);
  var [startDate, setStartDate] = useState('');
  var [endDate, setEndDate] = useState('');

  function loadRevenue() {
    setLoading(true);
    var params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    adminService.getRevenue(params).then(function(res) {
      setAnalytics(res.analytics);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }

  useEffect(function() { loadRevenue(); }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Revenus</h1>

      <div className="flex gap-4 mb-6 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date début</label>
          <input type="date" value={startDate} onChange={function(e) { setStartDate(e.target.value); }}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date fin</label>
          <input type="date" value={endDate} onChange={function(e) { setEndDate(e.target.value); }}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
        </div>
        <button onClick={loadRevenue} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Filtrer
        </button>
      </div>

      {loading ? <div className="text-gray-500 text-center py-10">Chargement...</div> : !analytics ? <div className="text-red-400 text-center py-10">Erreur</div> : (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <DollarSign size={22} className="text-yellow-400 mb-3" />
              <p className="text-3xl font-bold text-white">{analytics.totalFare.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">Total courses (FCFA)</p>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <TrendingUp size={22} className="text-emerald-400 mb-3" />
              <p className="text-3xl font-bold text-emerald-400">{analytics.totalCommission.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">Commission TeranGO (FCFA)</p>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <Car size={22} className="text-blue-400 mb-3" />
              <p className="text-3xl font-bold text-white">{analytics.totalDriverEarnings.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">Gains chauffeurs (FCFA)</p>
            </div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <PieChart size={22} className="text-purple-400 mb-3" />
              <p className="text-3xl font-bold text-white">{Math.round(analytics.averageFare).toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">Tarif moyen (FCFA)</p>
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Répartition par type</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                <p className="text-2xl font-bold text-white">{analytics.ridesByType.standard}</p>
                <p className="text-sm text-gray-500">Standard</p>
              </div>
              <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                <p className="text-2xl font-bold text-white">{analytics.ridesByType.comfort}</p>
                <p className="text-sm text-gray-500">Confort</p>
              </div>
              <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                <p className="text-2xl font-bold text-white">{analytics.ridesByType.xl}</p>
                <p className="text-sm text-gray-500">XL</p>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">Total courses analysées: {analytics.totalRides}</p>
          </div>
        </div>
      )}
    </div>
  );
}
