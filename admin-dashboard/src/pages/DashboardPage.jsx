import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { Users, Car, MapPin, DollarSign, AlertCircle, Activity, Smartphone, Send, CheckCircle } from 'lucide-react';

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
  var [payouts, setPayouts] = useState([]);
  var [payoutsLoading, setPayoutsLoading] = useState(true);
  var [sendingId, setSendingId] = useState(null);

  useEffect(function() {
    adminService.getDashboard().then(function(res) {
      setStats(res.stats);
      setLoading(false);
    }).catch(function() { setLoading(false); });
    loadPayouts();
  }, []);

  function loadPayouts() {
    setPayoutsLoading(true);
    adminService.getWavePayouts().then(function(res) {
      setPayouts(res.payouts || []);
      setPayoutsLoading(false);
    }).catch(function() { setPayoutsLoading(false); });
  }

  function handleMarkSent(driverId) {
    setSendingId(driverId);
    adminService.markWavePayoutSent(driverId).then(function() {
      loadPayouts();
      setSendingId(null);
    }).catch(function() { setSendingId(null); });
  }

  if (loading) return <div className="text-gray-500 text-center mt-20">Chargement...</div>;
  if (!stats) return <div className="text-red-400 text-center mt-20">Erreur de chargement</div>;

  var totalPayoutAmount = payouts.reduce(function(sum, p) { return sum + (p.amountOwed || 0); }, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Tableau de bord</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <StatCard icon={Users} label="Passagers" value={stats.totalRiders} color="bg-blue-500" />
        <StatCard icon={Car} label="Chauffeurs" value={stats.totalDrivers} color="bg-emerald-500" sub={stats.activeDrivers + ' en ligne'} />
        <StatCard icon={MapPin} label="Courses totales" value={stats.totalRides} color="bg-purple-500" sub={stats.todayRides + " aujourd'hui"} />
        <StatCard icon={DollarSign} label="Revenus (FCFA)" value={stats.totalRevenue.toLocaleString()} color="bg-yellow-500" sub={stats.todayRevenue.toLocaleString() + " aujourd'hui"} />
        <StatCard icon={Smartphone} label="Wave en attente" value={stats.pendingWavePayments || 0} color="bg-indigo-500" sub="paiements a confirmer" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={18} className="text-orange-400" />
            <h2 className="text-lg font-semibold text-white">Verifications en attente</h2>
          </div>
          <p className="text-4xl font-bold text-orange-400">{stats.pendingVerifications}</p>
          <p className="text-sm text-gray-500 mt-2">chauffeurs en attente d'approbation</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Activite en temps reel</h2>
          </div>
          <p className="text-4xl font-bold text-emerald-400">{stats.activeDrivers}</p>
          <p className="text-sm text-gray-500 mt-2">chauffeurs connectes maintenant</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={18} className="text-red-400" />
            <h2 className="text-lg font-semibold text-white">Commissions</h2>
          </div>
          <p className="text-4xl font-bold text-red-400">{(stats.totalUnpaidCommissions || 0).toLocaleString()} <span className="text-lg font-normal text-gray-500">FCFA</span></p>
          <p className="text-sm text-gray-500 mt-2">impayees</p>
          <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Chauffeurs bloques</p>
              <p className="text-lg font-bold text-orange-400">{stats.blockedDriversCount || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total collecte</p>
              <p className="text-lg font-bold text-emerald-400">{(stats.totalCollectedCommissions || 0).toLocaleString()} F</p>
            </div>
          </div>
        </div>
      </div>

      {/* Wave Payouts Section */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Smartphone size={20} className="text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Versements Wave aux chauffeurs</h2>
          </div>
          {totalPayoutAmount > 0 && (
            <div className="px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
              <span className="text-sm text-indigo-400 font-semibold">Total a envoyer: {totalPayoutAmount.toLocaleString()} FCFA</span>
            </div>
          )}
        </div>
        {payoutsLoading ? (
          <div className="text-gray-500 text-center py-6">Chargement...</div>
        ) : payouts.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
            <CheckCircle size={18} className="text-emerald-500" />
            <span>Aucun versement en attente</span>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-800/30">
                  <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">CHAUFFEUR</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">TELEPHONE</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">COURSES WAVE</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">MONTANT DU</th>
                  <th className="text-left text-xs text-gray-500 font-medium px-5 py-3">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map(function(payout) {
                  var driverName = payout.driverName || (payout.driver && (payout.driver.firstName + ' ' + payout.driver.lastName)) || 'Chauffeur';
                  var phone = payout.driverPhone || (payout.driver && payout.driver.phone) || '-';
                  return (
                    <tr key={payout.driverId || (payout.driver && payout.driver._id)} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-5 py-4 text-white text-sm font-medium">{driverName}</td>
                      <td className="px-5 py-4 text-gray-400 text-sm">{phone}</td>
                      <td className="px-5 py-4 text-gray-400 text-sm">{payout.rideCount || 0}</td>
                      <td className="px-5 py-4 text-indigo-400 font-semibold">{(payout.amountOwed || 0).toLocaleString()} FCFA</td>
                      <td className="px-5 py-4">
                        <button
                          disabled={sendingId === (payout.driverId || (payout.driver && payout.driver._id))}
                          onClick={function() { handleMarkSent(payout.driverId || (payout.driver && payout.driver._id)); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-50">
                          <Send size={12} />
                          {sendingId === (payout.driverId || (payout.driver && payout.driver._id)) ? 'Envoi...' : 'Envoye'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
