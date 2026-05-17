import { useEffect, useMemo, useState } from 'react';
import { adminService } from '../services/api';
import { Check, X, Car, MapPin, Phone, RefreshCw, FileText, ChevronDown, ChevronUp } from 'lucide-react';

const TABS = [
  { value: 'pending', label: 'En attente' },
  { value: 'approved', label: 'Approuvees' },
  { value: 'rejected', label: 'Refusees' }
];

const RENTAL_TYPE_LABEL = {
  driver: 'Chauffeur TeranGO',
  private: 'Location privée',
  both: 'Les deux'
};

function fmtRate(n) {
  return (n || 0).toLocaleString('fr-FR') + ' FCFA/j';
}
function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function PhotoStrip({ urls }) {
  const [active, setActive] = useState(0);
  if (!urls || urls.length === 0) {
    return <div className="rounded-lg flex items-center justify-center text-xs" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', height: 180 }}>Aucune photo</div>;
  }
  return (
    <div>
      <img
        src={urls[active]}
        alt=""
        className="w-full rounded-lg object-cover"
        style={{ height: 220, background: '#000' }}
        onError={(e) => { e.currentTarget.style.opacity = '0.3'; }}
      />
      {urls.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {urls.map((u, i) => (
            <img
              key={i}
              src={u}
              onClick={() => setActive(i)}
              alt=""
              className="rounded-md cursor-pointer flex-shrink-0 object-cover"
              style={{
                width: 56, height: 56,
                border: i === active ? '2px solid #00853F' : '2px solid rgba(255,255,255,0.1)'
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ListingCard({ listing, onApprove, onReject, busy }) {
  const [expanded, setExpanded] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');
  const owner = listing.ownerId || {};
  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Car size={16} className="text-emerald-400" />
            <div className="text-base font-bold text-white truncate">{listing.title}</div>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(212,175,55,0.18)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}>
              {RENTAL_TYPE_LABEL[listing.rentalType] || listing.rentalType}
            </span>
          </div>
          <div className="text-xs grid grid-cols-2 gap-x-4 gap-y-1 mt-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
            <div><span className="opacity-60">Véhicule:</span> {[listing.make, listing.model, listing.year].filter(Boolean).join(' ') || '—'}</div>
            <div><span className="opacity-60">Couleur:</span> {listing.color || '—'}</div>
            <div><span className="opacity-60">Plaque:</span> {listing.licensePlate || '—'}</div>
            <div><span className="opacity-60">Tarif:</span> <strong className="text-white">{fmtRate(listing.dailyRate)}</strong></div>
            <div><span className="opacity-60">Caution:</span> {listing.depositRequired ? listing.depositRequired.toLocaleString('fr-FR') + ' FCFA' : 'Aucune'}</div>
            <div><span className="opacity-60">Durée:</span> {listing.minRentalDays}-{listing.maxRentalDays} jours</div>
            <div className="flex items-center gap-1"><MapPin size={11} /> {listing.location && listing.location.neighborhood ? listing.location.neighborhood : '—'}</div>
            <div><span className="opacity-60">Soumis:</span> {fmtDate(listing.createdAt)}</div>
          </div>
          <div className="text-xs mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-1 text-white font-semibold">
              <span className="opacity-60 font-normal">Propriétaire:</span> {owner.name || '—'}
              {owner.phone && <span className="flex items-center gap-1 ml-2 opacity-80"><Phone size={10} /> {owner.phone}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          {listing.verificationStatus === 'pending' && (
            <>
              <button
                onClick={() => onApprove(listing._id)}
                disabled={busy}
                className="px-4 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 text-white"
                style={{ background: 'rgba(0,133,63,0.4)', border: '1px solid rgba(0,133,63,0.55)' }}
              >
                <Check size={14} /> Approuver
              </button>
              <button
                onClick={() => setShowReject(!showReject)}
                disabled={busy}
                className="px-4 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5 text-white"
                style={{ background: 'rgba(220,38,38,0.3)', border: '1px solid rgba(220,38,38,0.5)' }}
              >
                <X size={14} /> Refuser
              </button>
            </>
          )}
          {listing.verificationStatus === 'rejected' && listing.rejectionReason && (
            <div className="text-[11px] px-3 py-2 rounded-lg max-w-[160px]" style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.25)', color: '#fca5a5' }}>
              <div className="font-semibold mb-1">Raison du refus</div>
              <div>{listing.rejectionReason}</div>
            </div>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-3 py-1.5 rounded-lg text-[11px] flex items-center justify-center gap-1"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {expanded ? <><ChevronUp size={12} /> Réduire</> : <><ChevronDown size={12} /> Voir détails</>}
          </button>
        </div>
      </div>

      {showReject && (
        <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Raison du refus (visible par le propriétaire)"
            className="w-full px-3 py-2 rounded-md text-xs text-white"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => { onReject(listing._id, reason || 'Non spécifié'); setShowReject(false); setReason(''); }}
              disabled={busy}
              className="px-3 py-1.5 rounded-md text-xs font-semibold text-white"
              style={{ background: 'rgba(220,38,38,0.5)' }}
            >Confirmer le refus</button>
            <button
              onClick={() => { setShowReject(false); setReason(''); }}
              className="px-3 py-1.5 rounded-md text-xs text-white"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >Annuler</button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="mt-4 pt-4 grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <div className="text-xs font-bold text-white mb-2">Photos du véhicule</div>
            <PhotoStrip urls={listing.photos || []} />
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-xs font-bold text-white mb-2 flex items-center gap-1"><FileText size={12} /> Documents</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Carte grise</div>
                  {listing.registrationPhoto
                    ? <img src={listing.registrationPhoto} alt="carte grise" className="w-full rounded-md" style={{ height: 100, objectFit: 'cover' }} />
                    : <div className="text-xs rounded-md flex items-center justify-center" style={{ height: 100, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)' }}>Aucune</div>}
                </div>
                <div>
                  <div className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Assurance</div>
                  {listing.insurancePhoto
                    ? <img src={listing.insurancePhoto} alt="assurance" className="w-full rounded-md" style={{ height: 100, objectFit: 'cover' }} />
                    : <div className="text-xs rounded-md flex items-center justify-center" style={{ height: 100, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)' }}>Aucune</div>}
                </div>
              </div>
            </div>
            {listing.description && (
              <div>
                <div className="text-xs font-bold text-white mb-1">Description</div>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{listing.description}</div>
              </div>
            )}
            {listing.conditions && (
              <div>
                <div className="text-xs font-bold text-white mb-1">Conditions</div>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{listing.conditions}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FleetListingsPage() {
  const [status, setStatus] = useState('pending');
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });

  async function load() {
    setLoading(true);
    try {
      // axios interceptor already unwraps res.data, so the response IS the
      // payload — NOT an axios response object.
      const res = await adminService.getFleetListings(status);
      if (res && res.success) setListings(res.listings || []);
    } catch (e) {
      console.error('Fleet listings load error:', e);
    } finally { setLoading(false); }
  }

  async function loadCounts() {
    try {
      const [p, a, r] = await Promise.all([
        adminService.getFleetListings('pending'),
        adminService.getFleetListings('approved'),
        adminService.getFleetListings('rejected')
      ]);
      setCounts({
        pending: (p && p.listings && p.listings.length) || 0,
        approved: (a && a.listings && a.listings.length) || 0,
        rejected: (r && r.listings && r.listings.length) || 0
      });
    } catch (e) { /* ignore */ }
  }

  useEffect(() => { load(); }, [status]);
  useEffect(() => { loadCounts(); }, []);

  async function handleApprove(id) {
    setBusy(true);
    try {
      await adminService.verifyFleetListing(id, true, '');
      await Promise.all([load(), loadCounts()]);
    } catch (e) {
      console.error('Approve error:', e);
      alert('Erreur lors de l\'approbation');
    } finally { setBusy(false); }
  }
  async function handleReject(id, reason) {
    setBusy(true);
    try {
      await adminService.verifyFleetListing(id, false, reason);
      await Promise.all([load(), loadCounts()]);
    } catch (e) {
      console.error('Reject error:', e);
      alert('Erreur lors du refus');
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Flotte</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>Vérification des annonces de location</p>
        </div>
        <button onClick={() => { load(); loadCounts(); }} disabled={loading} className="px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 text-white" style={{ background: 'rgba(0,133,63,0.4)', border: '1px solid rgba(0,133,63,0.5)' }}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      <div className="flex gap-1 mb-4 rounded-lg p-1 w-fit" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setStatus(t.value)}
            className="px-4 py-2 text-xs font-semibold rounded-md transition-all flex items-center gap-2"
            style={{
              background: status === t.value ? 'rgba(0,133,63,0.5)' : 'transparent',
              color: status === t.value ? '#fff' : 'rgba(255,255,255,0.55)'
            }}
          >
            {t.label}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: status === t.value ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.08)' }}>
              {counts[t.value]}
            </span>
          </button>
        ))}
      </div>

      {loading && listings.length === 0 && (
        <div className="text-center py-12 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Chargement...</div>
      )}
      {!loading && listings.length === 0 && (
        <div className="text-center py-12 text-sm rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
          Aucune annonce dans cette catégorie.
        </div>
      )}
      {listings.map((l) => (
        <ListingCard key={l._id} listing={l} onApprove={handleApprove} onReject={handleReject} busy={busy} />
      ))}
    </div>
  );
}
