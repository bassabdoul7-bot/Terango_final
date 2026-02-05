var mongoose = require('mongoose');

var driverSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  nationalId: { type: String, required: false },
  nationalIdPhoto: { type: String, required: false },
  driverLicense: { type: String, required: false },
  driverLicensePhoto: { type: String, required: false },
  vehicle: {
    make: String,
    model: String,
    year: Number,
    color: String,
    licensePlate: { type: String, required: false },
    registrationPhoto: String,
    insurancePhoto: String
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  isOnline: { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: true },
  acceptedServices: {
    rides: { type: Boolean, default: true },
    colis: { type: Boolean, default: false },
    commande: { type: Boolean, default: false },
    resto: { type: Boolean, default: false }
  },
  currentLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      latitude: { type: Number, default: 0 },
      longitude: { type: Number, default: 0 }
    }
  },
  lastLocationUpdate: Date,
  totalEarnings: { type: Number, default: 0 },
  weeklyEarnings: { type: Number, default: 0 },
  totalRides: { type: Number, default: 0 },
  totalDeliveries: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  acceptanceRate: { type: Number, default: 100 },
  payoutMethod: {
    type: {
      type: String,
      enum: ['orange_money', 'wave', 'bank'],
      default: 'orange_money'
    },
    phoneNumber: String,
    accountNumber: String
  },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Driver', driverSchema);