var mongoose = require('mongoose');

var broadcastSchema = new mongoose.Schema({
  audience: { type: String, enum: ['riders', 'drivers', 'all'], required: true },
  channels: [{ type: String, enum: ['push', 'email'] }],
  title: { type: String, required: true, trim: true },
  body: { type: String, required: true },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sentByName: { type: String },
  pushSent: { type: Number, default: 0 },
  pushFailed: { type: Number, default: 0 },
  emailSent: { type: Number, default: 0 },
  emailFailed: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Broadcast', broadcastSchema);
