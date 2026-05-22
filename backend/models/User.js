var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  password: { type: String, select: false },
  pin: { type: String, select: false },
  pushToken: { type: String, default: '' },
  driverPushToken: { type: String, default: '' },
  riderPushToken: { type: String, default: '' },
  profilePhoto: { type: String, default: '' },
  photoStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'expired'], default: 'pending' },
  photoVerified: { type: Boolean, default: false },
  role: {
    type: String,
    enum: ['rider', 'driver', 'admin', 'moderator', 'restaurant', 'partner'],
    required: true
  },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  securityPinEnabled: { type: Boolean, default: false },
  totalRatings: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  emergencyContacts: [{
    name: { type: String },
    phone: { type: String }
  }],
  // Auto-share live trip URL to a designated emergency contact when a ride
  // is accepted. When alwaysOn=true the hour window is ignored. Otherwise
  // auto-share only fires if the current local hour is in [startHour, endHour).
  // Window can wrap midnight (e.g. 22 -> 6 means 22:00-06:00).
  autoShare: {
    enabled: { type: Boolean, default: false },
    alwaysOn: { type: Boolean, default: false },
    startHour: { type: Number, default: 22, min: 0, max: 23 },
    endHour: { type: Number, default: 6, min: 0, max: 23 },
    contactPhone: { type: String, default: '' },
    contactName: { type: String, default: '' }
  },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);