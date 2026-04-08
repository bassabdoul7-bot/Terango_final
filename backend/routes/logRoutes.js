const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const AppLog = require('../models/AppLog');

// Rate limit: 50 logs per minute per IP
const logLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many log submissions, slow down.' }
});

// Telegram alert for errors
function sendErrorTelegram(log) {
  try {
    var TELEGRAM_BOT = process.env.TELEGRAM_BOT_TOKEN || '';
    var TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '';
    if (!TELEGRAM_BOT || !TELEGRAM_CHAT) return;

    var msg = '🔴 APP ERROR\n'
      + 'Source: ' + log.source + '\n'
      + 'Screen: ' + (log.screen || 'N/A') + '\n'
      + 'Message: ' + (log.message || '').substring(0, 200) + '\n'
      + 'User: ' + (log.userId || 'anonymous') + '\n'
      + 'Time: ' + new Date().toISOString();

    var https = require('https');
    var data = JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg });
    var opts = {
      hostname: 'api.telegram.org',
      path: '/bot' + TELEGRAM_BOT + '/sendMessage',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    var r = https.request(opts, function() {});
    r.on('error', function() {});
    r.write(data);
    r.end();
  } catch (e) { /* silent */ }
}

// POST /api/logs — single log entry (no auth required — apps may crash before auth)
router.post('/', logLimiter, async function(req, res) {
  try {
    var body = req.body;
    var log = await AppLog.create({
      level: body.level || 'error',
      source: body.source || 'backend',
      screen: body.screen || '',
      message: (body.message || '').substring(0, 2000),
      stack: (body.stack || '').substring(0, 5000),
      userId: body.userId || '',
      deviceInfo: body.deviceInfo || {},
      metadata: body.metadata || {}
    });

    if (log.level === 'error') {
      sendErrorTelegram(log);
    }

    res.status(201).json({ success: true, id: log._id });
  } catch (error) {
    console.error('Log ingestion error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to save log' });
  }
});

// POST /api/logs/batch — array of logs
router.post('/batch', logLimiter, async function(req, res) {
  try {
    var logs = req.body.logs;
    if (!Array.isArray(logs) || logs.length === 0) {
      return res.status(400).json({ success: false, message: 'logs array required' });
    }

    // Cap at 50 logs per batch
    var toInsert = logs.slice(0, 50).map(function(b) {
      return {
        level: b.level || 'error',
        source: b.source || 'backend',
        screen: b.screen || '',
        message: (b.message || '').substring(0, 2000),
        stack: (b.stack || '').substring(0, 5000),
        userId: b.userId || '',
        deviceInfo: b.deviceInfo || {},
        metadata: b.metadata || {},
        createdAt: b.createdAt ? new Date(b.createdAt) : new Date()
      };
    });

    var inserted = await AppLog.insertMany(toInsert, { ordered: false });

    // Telegram for errors
    var errors = toInsert.filter(function(l) { return l.level === 'error'; });
    if (errors.length > 0) {
      sendErrorTelegram({ source: errors[0].source, screen: errors[0].screen, message: errors.length + ' errors from ' + errors[0].source, userId: errors[0].userId });
    }

    res.status(201).json({ success: true, count: inserted.length });
  } catch (error) {
    console.error('Batch log error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to save logs' });
  }
});

module.exports = router;
