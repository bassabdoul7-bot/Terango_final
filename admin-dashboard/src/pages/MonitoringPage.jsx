import React, { useState, useEffect, useCallback } from 'react';
import { adminService } from '../services/api';
import { Activity, Database, Server, Wifi, AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Search } from 'lucide-react';

var levelColors = {
  error: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  warn: { bg: 'rgba(234,179,8,0.15)', text: '#eab308', border: 'rgba(234,179,8,0.3)' },
  info: { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6', border: 'rgba(59,130,246,0.3)' },
  debug: { bg: 'rgba(156,163,175,0.15)', text: '#9ca3af', border: 'rgba(156,163,175,0.3)' }
};

var sourceLabels = { 'rider-app': 'Rider', 'driver-app': 'Driver', 'backend': 'Backend', 'admin': 'Admin' };

function StatusDot({ ok }) {
  return (
    <span style={{
      display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
      background: ok ? '#22c55e' : '#ef4444',
      boxShadow: ok ? '0 0 8px rgba(34,197,94,0.5)' : '0 0 8px rgba(239,68,68,0.5)'
    }} />
  );
}

function Card({ children, className }) {
  return (
    <div className={className || ''} style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: 16
    }}>
      {children}
    </div>
  );
}

export default function MonitoringPage() {
  var [health, setHealth] = useState(null);
  var [stats, setStats] = useState(null);
  var [logs, setLogs] = useState([]);
  var [logCount, setLogCount] = useState(0);
  var [totalPages, setTotalPages] = useState(1);
  var [loading, setLoading] = useState(true);
  var [expandedRow, setExpandedRow] = useState(null);
  var [autoRefresh, setAutoRefresh] = useState(true);

  // Filters
  var [source, setSource] = useState('');
  var [level, setLevel] = useState('');
  var [searchText, setSearchText] = useState('');
  var [page, setPage] = useState(1);

  var fetchHealth = useCallback(async function() {
    try { var res = await adminService.getHealth(); setHealth(res.health); } catch(e) { console.error('Health fetch error:', e); }
  }, []);

  var fetchStats = useCallback(async function() {
    try { var res = await adminService.getLogStats(); setStats(res.stats); } catch(e) { console.error('Stats fetch error:', e); }
  }, []);

  var fetchLogs = useCallback(async function() {
    try {
      var params = { page: page, limit: 30 };
      if (source) params.source = source;
      if (level) params.level = level;
      if (searchText) params.search = searchText;
      var res = await adminService.getLogs(params);
      setLogs(res.logs || []);
      setLogCount(res.count || 0);
      setTotalPages(res.totalPages || 1);
    } catch(e) { console.error('Logs fetch error:', e); }
  }, [page, source, level, searchText]);

  var fetchAll = useCallback(async function() {
    setLoading(true);
    await Promise.all([fetchHealth(), fetchStats(), fetchLogs()]);
    setLoading(false);
  }, [fetchHealth, fetchStats, fetchLogs]);

  useEffect(function() { fetchAll(); }, [fetchAll]);

  // Auto-refresh every 30 seconds
  useEffect(function() {
    if (!autoRefresh) return;
    var interval = setInterval(fetchAll, 30000);
    return function() { clearInterval(interval); };
  }, [autoRefresh, fetchAll]);

  // Reset page when filters change
  useEffect(function() { setPage(1); }, [source, level, searchText]);

  // Parse stats helpers
  function getSourceCount(arr, src) {
    if (!arr) return 0;
    var found = arr.find(function(a) { return a._id === src; });
    return found ? found.count : 0;
  }

  function getTotalErrors24h() {
    if (!stats || !stats.bySource || !stats.bySource.h24) return 0;
    return stats.bySource.h24.reduce(function(sum, s) { return sum + s.count; }, 0);
  }

  // Build hourly chart data
  function getHourlyData() {
    if (!stats || !stats.byHour) return [];
    var hours = [];
    for (var i = 0; i < 24; i++) {
      hours.push({ hour: i, error: 0, warn: 0, info: 0, debug: 0 });
    }
    stats.byHour.forEach(function(item) {
      var h = item._id.hour;
      var lvl = item._id.level;
      if (hours[h] && lvl in hours[h]) {
        hours[h][lvl] = item.count;
      }
    });
    return hours;
  }

  function formatTime(dateStr) {
    var d = new Date(dateStr);
    return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  var hourlyData = getHourlyData();
  var maxHourly = Math.max(1, ...hourlyData.map(function(h) { return h.error + h.warn + h.info + h.debug; }));

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity size={24} style={{ color: '#00853F' }} />
            Monitoring
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>
            Observabilite temps reel - {logCount} logs indexes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <input type="checkbox" checked={autoRefresh} onChange={function() { setAutoRefresh(!autoRefresh); }} className="accent-green-600" />
            Auto-refresh 30s
          </label>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: 'rgba(0,133,63,0.15)', color: '#00853F', border: '1px solid rgba(0,133,63,0.3)' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Health Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Server size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Uptime</span>
          </div>
          <p className="text-lg font-bold text-white">{health ? health.uptime : '--'}</p>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Database size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>MongoDB</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot ok={health && health.mongoStatus === 'connected'} />
            <span className="text-sm font-semibold text-white">{health ? health.mongoStatus : '--'}</span>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Wifi size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Redis</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot ok={health && health.redisStatus === 'connected'} />
            <span className="text-sm font-semibold text-white">{health ? health.redisStatus : '--'}</span>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Server size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Memoire</span>
          </div>
          <p className="text-lg font-bold text-white">{health ? health.memory.heapUsed : '--'}</p>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Wifi size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Connexions</span>
          </div>
          <p className="text-lg font-bold text-white">{health ? health.activeConnections : '--'}</p>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} style={{ color: '#ef4444' }} />
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Erreurs 24h</span>
          </div>
          <p className="text-lg font-bold" style={{ color: getTotalErrors24h() > 0 ? '#ef4444' : '#22c55e' }}>
            {getTotalErrors24h()}
          </p>
        </Card>
      </div>

      {/* Error Trend + Source Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Hourly Chart */}
        <div className="lg:col-span-2">
          <Card>
            <h3 className="text-sm font-semibold text-white mb-4">Logs par heure (24h)</h3>
            <div className="flex items-end gap-1" style={{ height: 120 }}>
              {hourlyData.map(function(h) {
                var total = h.error + h.warn + h.info + h.debug;
                var pct = (total / maxHourly) * 100;
                var errorPct = total > 0 ? (h.error / total) * 100 : 0;
                var warnPct = total > 0 ? (h.warn / total) * 100 : 0;
                return (
                  <div key={h.hour} className="flex-1 flex flex-col items-center gap-1" title={h.hour + 'h: ' + total + ' logs (' + h.error + ' err, ' + h.warn + ' warn)'}>
                    <div className="w-full rounded-t" style={{
                      height: Math.max(pct, total > 0 ? 4 : 0) + '%',
                      minHeight: total > 0 ? 4 : 0,
                      background: h.error > 0
                        ? 'linear-gradient(to top, #ef4444 ' + errorPct + '%, #eab308 ' + errorPct + '% ' + (errorPct + warnPct) + '%, #3b82f6 ' + (errorPct + warnPct) + '%)'
                        : total > 0 ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                      transition: 'height 0.3s ease'
                    }} />
                    {h.hour % 3 === 0 && (
                      <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{h.hour}h</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <span className="flex items-center gap-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} /> error
              </span>
              <span className="flex items-center gap-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#eab308', display: 'inline-block' }} /> warn
              </span>
              <span className="flex items-center gap-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#3b82f6', display: 'inline-block' }} /> info
              </span>
            </div>
          </Card>
        </div>

        {/* Source Breakdown */}
        <Card>
          <h3 className="text-sm font-semibold text-white mb-4">Erreurs par source</h3>
          <div className="space-y-3">
            {['rider-app', 'driver-app', 'backend', 'admin'].map(function(src) {
              var c24 = stats ? getSourceCount(stats.bySource.h24, src) : 0;
              var c7d = stats ? getSourceCount(stats.bySource.d7, src) : 0;
              var c30d = stats ? getSourceCount(stats.bySource.d30, src) : 0;
              return (
                <div key={src} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-white">{sourceLabels[src]}</span>
                    <span className="text-xs font-bold" style={{ color: c24 > 0 ? '#ef4444' : '#22c55e' }}>{c24}</span>
                  </div>
                  <div className="flex gap-3 text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    <span>7j: {c7d}</span>
                    <span>30j: {c30d}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top Screens */}
          {stats && stats.topScreens && stats.topScreens.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>Top ecrans (7j)</h4>
              {stats.topScreens.slice(0, 5).map(function(s) {
                return (
                  <div key={s._id} className="flex items-center justify-between py-1">
                    <span className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '70%' }}>{s._id}</span>
                    <span className="text-[11px] font-bold" style={{ color: '#ef4444' }}>{s.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Log Table */}
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <h3 className="text-sm font-semibold text-white">Logs</h3>
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <select
              value={source} onChange={function(e) { setSource(e.target.value); }}
              className="text-xs rounded-lg px-3 py-2 outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <option value="">Toutes sources</option>
              <option value="rider-app">Rider App</option>
              <option value="driver-app">Driver App</option>
              <option value="backend">Backend</option>
              <option value="admin">Admin</option>
            </select>

            <select
              value={level} onChange={function(e) { setLevel(e.target.value); }}
              className="text-xs rounded-lg px-3 py-2 outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <option value="">Tous niveaux</option>
              <option value="error">Error</option>
              <option value="warn">Warn</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>

            <div className="relative flex-1 min-w-[160px]">
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
              <input
                type="text"
                placeholder="Rechercher dans les messages..."
                value={searchText}
                onChange={function(e) { setSearchText(e.target.value); }}
                className="w-full text-xs rounded-lg pl-8 pr-3 py-2 outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <th className="text-left py-2 px-3 font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Heure</th>
                <th className="text-left py-2 px-3 font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Niveau</th>
                <th className="text-left py-2 px-3 font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Source</th>
                <th className="text-left py-2 px-3 font-semibold hidden sm:table-cell" style={{ color: 'rgba(255,255,255,0.4)' }}>Ecran</th>
                <th className="text-left py-2 px-3 font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Message</th>
                <th className="text-left py-2 px-3 font-semibold hidden md:table-cell" style={{ color: 'rgba(255,255,255,0.4)' }}>User</th>
                <th className="py-2 px-1 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {loading ? 'Chargement...' : 'Aucun log trouve'}
                  </td>
                </tr>
              )}
              {logs.map(function(log) {
                var isExpanded = expandedRow === log._id;
                var lc = levelColors[log.level] || levelColors.debug;
                return (
                  <React.Fragment key={log._id}>
                    <tr
                      onClick={function() { setExpandedRow(isExpanded ? null : log._id); }}
                      className="cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isExpanded ? 'rgba(255,255,255,0.03)' : 'transparent' }}
                      onMouseEnter={function(e) { if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                      onMouseLeave={function(e) { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td className="py-2 px-3 whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {formatTime(log.createdAt)}
                      </td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: lc.bg, color: lc.text, border: '1px solid ' + lc.border }}>
                          {log.level}
                        </span>
                      </td>
                      <td className="py-2 px-3" style={{ color: 'rgba(255,255,255,0.6)' }}>
                        {sourceLabels[log.source] || log.source}
                      </td>
                      <td className="py-2 px-3 hidden sm:table-cell truncate" style={{ color: 'rgba(255,255,255,0.4)', maxWidth: 120 }}>
                        {log.screen || '-'}
                      </td>
                      <td className="py-2 px-3 truncate" style={{ color: 'rgba(255,255,255,0.7)', maxWidth: 300 }}>
                        {log.message}
                      </td>
                      <td className="py-2 px-3 hidden md:table-cell" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {log.userId ? log.userId.substring(0, 8) + '...' : '-'}
                      </td>
                      <td className="py-2 px-1">
                        {isExpanded ? <ChevronUp size={14} style={{ color: 'rgba(255,255,255,0.3)' }} /> : <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} style={{ background: 'rgba(0,0,0,0.2)', padding: '12px 16px' }}>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Stack trace */}
                            {log.stack && (
                              <div>
                                <p className="text-[10px] font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>STACK TRACE</p>
                                <pre className="text-[10px] whitespace-pre-wrap break-all rounded-lg p-3" style={{
                                  background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.5)',
                                  maxHeight: 200, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                  {log.stack}
                                </pre>
                              </div>
                            )}

                            {/* Device info + Metadata */}
                            <div>
                              {log.deviceInfo && (log.deviceInfo.platform || log.deviceInfo.appVersion) && (
                                <div className="mb-3">
                                  <p className="text-[10px] font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>DEVICE INFO</p>
                                  <div className="text-[11px] space-y-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                    {log.deviceInfo.platform && <p>Platform: {log.deviceInfo.platform}</p>}
                                    {log.deviceInfo.osVersion && <p>OS: {log.deviceInfo.osVersion}</p>}
                                    {log.deviceInfo.appVersion && <p>App: v{log.deviceInfo.appVersion}</p>}
                                    {log.deviceInfo.deviceModel && <p>Model: {log.deviceInfo.deviceModel}</p>}
                                  </div>
                                </div>
                              )}

                              {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <div>
                                  <p className="text-[10px] font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>METADATA</p>
                                  <pre className="text-[10px] whitespace-pre-wrap break-all rounded-lg p-3" style={{
                                    background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.5)',
                                    maxHeight: 150, overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)'
                                  }}>
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}

                              {log.userId && (
                                <div className="mt-2">
                                  <p className="text-[10px] font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>USER ID</p>
                                  <p className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>{log.userId}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Page {page} / {totalPages} ({logCount} total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={function() { setPage(page - 1); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Precedent
              </button>
              <button
                disabled={page >= totalPages}
                onClick={function() { setPage(page + 1); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
