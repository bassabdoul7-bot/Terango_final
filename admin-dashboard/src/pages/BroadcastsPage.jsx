import { useState, useEffect } from 'react';
import { adminService } from '../services/api';
import { Send, Bell, Mail, Users, Loader } from 'lucide-react';

export default function BroadcastsPage() {
  var [audience, setAudience] = useState('all');
  var [push, setPush] = useState(true);
  var [email, setEmail] = useState(true);
  var [title, setTitle] = useState('');
  var [body, setBody] = useState('');
  var [sending, setSending] = useState(false);
  var [history, setHistory] = useState([]);
  var [loadingHistory, setLoadingHistory] = useState(true);

  function loadHistory() {
    setLoadingHistory(true);
    adminService.getBroadcasts().then(function(res) {
      setHistory(res.broadcasts || []);
      setLoadingHistory(false);
    }).catch(function() { setLoadingHistory(false); });
  }

  useEffect(function() { loadHistory(); }, []);

  function send() {
    if (!title.trim() || !body.trim()) {
      alert('Titre et message requis');
      return;
    }
    var channels = [];
    if (push) channels.push('push');
    if (email) channels.push('email');
    if (channels.length === 0) {
      alert('Selectionnez au moins un canal (push ou email)');
      return;
    }
    var audienceLabel = audience === 'riders' ? 'tous les passagers' : audience === 'drivers' ? 'tous les chauffeurs' : 'tous les utilisateurs';
    if (!confirm('Envoyer cette diffusion à ' + audienceLabel + ' via ' + channels.join(' + ') + ' ?')) return;
    setSending(true);
    adminService.sendBroadcast({ audience: audience, channels: channels, title: title.trim(), body: body.trim() })
      .then(function(res) {
        setSending(false);
        var s = res.summary || {};
        alert('Diffusion envoyée!\n\nPush: ' + (s.pushSent || 0) + ' OK / ' + (s.pushFailed || 0) + ' échecs\nEmail: ' + (s.emailSent || 0) + ' OK / ' + (s.emailFailed || 0) + ' échecs\nTotal utilisateurs ciblés: ' + (s.totalUsers || 0));
        setTitle('');
        setBody('');
        loadHistory();
      })
      .catch(function(e) {
        setSending(false);
        alert('Erreur: ' + ((e && e.response && e.response.data && e.response.data.message) || 'echec'));
      });
  }

  function fmtDate(d) { try { return new Date(d).toLocaleString('fr-FR'); } catch (e) { return ''; } }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Diffusion</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Composer une diffusion</h2>

        <label className="block text-sm text-gray-400 mb-2">Destinataires</label>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { v: 'riders', label: 'Passagers' },
            { v: 'drivers', label: 'Chauffeurs' },
            { v: 'all', label: 'Tous' }
          ].map(function(o) {
            return (
              <button key={o.v} onClick={function() { setAudience(o.v); }}
                className={'py-3 rounded-xl text-sm font-medium ' + (audience === o.v ? 'bg-emerald-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700')}>
                <Users size={16} className="inline mr-2" />{o.label}
              </button>
            );
          })}
        </div>

        <label className="block text-sm text-gray-400 mb-2">Canaux</label>
        <div className="flex gap-3 mb-5">
          <button onClick={function() { setPush(!push); }}
            className={'flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ' + (push ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400' : 'bg-gray-800 text-gray-400 border border-gray-700')}>
            <Bell size={16} /> Notification push
          </button>
          <button onClick={function() { setEmail(!email); }}
            className={'flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ' + (email ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400' : 'bg-gray-800 text-gray-400 border border-gray-700')}>
            <Mail size={16} /> Email
          </button>
        </div>

        <label className="block text-sm text-gray-400 mb-2">Titre</label>
        <input type="text" value={title} onChange={function(e) { setTitle(e.target.value); }} maxLength={80}
          placeholder="Ex. Promo de lancement: première course gratuite!"
          className="w-full px-4 py-3 mb-4 rounded-xl bg-gray-800 text-white border border-gray-700 focus:border-emerald-500 outline-none" />

        <label className="block text-sm text-gray-400 mb-2">Message</label>
        <textarea value={body} onChange={function(e) { setBody(e.target.value); }} rows={5}
          placeholder="Profitez de votre première course gratuite jusqu'à 1500 FCFA. Code automatique."
          className="w-full px-4 py-3 mb-4 rounded-xl bg-gray-800 text-white border border-gray-700 focus:border-emerald-500 outline-none resize-none" />

        <button onClick={send} disabled={sending}
          className="w-full py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2">
          {sending ? <><Loader size={18} className="animate-spin" /> Envoi en cours...</> : <><Send size={18} /> Envoyer la diffusion</>}
        </button>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Historique</h2>
        {loadingHistory ? (
          <div className="text-gray-400">Chargement...</div>
        ) : history.length === 0 ? (
          <div className="text-gray-500 text-sm">Aucune diffusion envoyée pour le moment.</div>
        ) : (
          <div className="space-y-3">
            {history.map(function(b) {
              return (
                <div key={b._id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-white font-semibold">{b.title}</div>
                      <div className="text-xs text-gray-500 mt-1">{fmtDate(b.createdAt)} · {b.audience} · {(b.channels || []).join(' + ')}</div>
                    </div>
                    <div className="text-right text-xs">
                      {(b.channels || []).indexOf('push') !== -1 && <div className="text-emerald-400">Push: {b.pushSent}/{b.pushSent + b.pushFailed}</div>}
                      {(b.channels || []).indexOf('email') !== -1 && <div className="text-blue-400">Email: {b.emailSent}/{b.emailSent + b.emailFailed}</div>}
                    </div>
                  </div>
                  <div className="text-gray-400 text-sm whitespace-pre-wrap">{b.body}</div>
                  {b.sentByName && <div className="text-xs text-gray-600 mt-2">Envoyé par {b.sentByName}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
