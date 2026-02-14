import { useState, useEffect } from 'react';
import { partnerService } from '../services/api';
import { DollarSign, TrendingUp, Users } from 'lucide-react';

export default function PartnerEarningsPage() {
  var [earnings, setEarnings] = useState(null);
  var [loading, setLoading] = useState(true);

  useEffect(function() {
    partnerService.getEarnings().then(function(res) {
      if (res.success) setEarnings(res.earnings);
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }, []);

  if (loading) return <div className="text-gray-500 text-center py-12">Chargement...</div>;
  if (!earnings) return <div className="text-red-400 text-center py-12">Erreur de chargement</div>;

  var days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  var maxWeekly = Math.max.apply(null, earnings.weeklyBreakdown) || 1;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Mes Revenus</h1>
        <p className="text-gray-500 mt-1">Commission: {earnings.commissionRate}% par course</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-emerald-500/10"><DollarSign className="text-emerald-400" size={20} /></div>
            <span className="text-gray-400 text-sm">Total Revenus</span>
          </div>
          <p className="text-3xl font-bold text-white">{(earnings.totalEarnings || 0).toLocaleString()} FCFA</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-blue-500/10"><TrendingUp className="text-blue-400" size={20} /></div>
            <span className="text-gray-400 text-sm">Cette Semaine</span>
          </div>
          <p className="text-3xl font-bold text-white">{(earnings.weeklyEarnings || 0).toLocaleString()} FCFA</p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Revenus de la semaine</h2>
        <div className="flex items-end gap-2 h-40">
          {earnings.weeklyBreakdown.map(function(val, i) {
            var height = maxWeekly > 0 ? (val / maxWeekly) * 100 : 0;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-400">{val > 0 ? val.toLocaleString() : ''}</span>
                <div className="w-full rounded-t-md bg-emerald-500/20 relative" style={{ height: Math.max(height, 4) + '%' }}>
                  <div className="absolute inset-0 rounded-t-md bg-emerald-500" style={{ opacity: 0.6 }}></div>
                </div>
                <span className="text-xs text-gray-500">{days[i]}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 mb-8">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Users size={18} /> Revenus par Chauffeur</h2>
        </div>
        {earnings.driverBreakdown && earnings.driverBreakdown.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Chauffeur</th>
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Courses</th>
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Votre Commission</th>
              </tr>
            </thead>
            <tbody>
              {earnings.driverBreakdown.map(function(d) {
                return (
                  <tr key={d.driverId} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="p-4">
                      <p className="text-white font-medium">{d.name}</p>
                      <p className="text-gray-500 text-xs">{d.phone}</p>
                    </td>
                    <td className="p-4 text-gray-300">{d.rideCount}</td>
                    <td className="p-4 text-emerald-400 font-medium">{(d.partnerEarnings || 0).toLocaleString()} FCFA</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-500">Aucune donnee de revenus</div>
        )}
      </div>

      {earnings.recentRides && earnings.recentRides.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800">
          <div className="p-6 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">Courses recentes</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Date</th>
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Tarif</th>
                <th className="text-left p-4 text-gray-400 text-sm font-medium">Votre Commission</th>
              </tr>
            </thead>
            <tbody>
              {earnings.recentRides.map(function(r) {
                return (
                  <tr key={r.rideId} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="p-4 text-gray-300 text-sm">{r.completedAt ? new Date(r.completedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="p-4 text-gray-300">{(r.fare || 0).toLocaleString()} FCFA</td>
                    <td className="p-4 text-emerald-400 font-medium">{(r.partnerCommission || 0).toLocaleString()} FCFA</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
