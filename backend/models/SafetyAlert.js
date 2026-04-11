const mongoose = require('mongoose');

const safetyAlertSchema = new mongoose.Schema({
  rideId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride',
    required: true
  },
  type: {
    type: String,
    enum: ['route_deviation', 'duration_anomaly', 'speed_alert', 'driver_offline', 'sos_triggered'],
    required: true
  },
  details: {
    type: String,
    default: ''
  },
  acknowledged: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

safetyAlertSchema.index({ rideId: 1, type: 1 });
safetyAlertSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SafetyAlert', safetyAlertSchema);
