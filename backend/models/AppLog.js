const mongoose = require('mongoose');

const appLogSchema = new mongoose.Schema({
  level: { type: String, enum: ['error', 'warn', 'info', 'debug'], default: 'error' },
  source: { type: String, enum: ['rider-app', 'driver-app', 'backend', 'admin'], required: true },
  screen: { type: String, default: '' },
  message: { type: String, required: true },
  stack: { type: String, default: '' },
  userId: { type: String, default: '' },
  deviceInfo: {
    platform: String,
    osVersion: String,
    appVersion: String,
    deviceModel: String
  },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true, expires: 2592000 } // auto-delete after 30 days
});

appLogSchema.index({ source: 1, level: 1, createdAt: -1 });
appLogSchema.index({ screen: 1, createdAt: -1 });

module.exports = mongoose.model('AppLog', appLogSchema);
