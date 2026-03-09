var mongoose = require('mongoose');
var driverSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  partnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Partner',
    default: null
  },
  registeredBy: {
    type: String,
    enum: ['self', 'partner'],
    default: 'self'
  },
  vehicleType: {
    type: String,
    enum: ['car', 'moto'],
    default: 'car'
  },
  vehicleFrontPhoto: { type: String },
  vehicleBackPhoto: { type: String },
  vehicleInteriorPhoto: { type: String },
  vehicleClass: {
    type: String,
    enum: ['standard', 'comfort', 'xl'],
    default: 'standard'
  },
  nationalId: { type: String, required: false },
  nationalIdPhoto: { type: String, required: false },
  driverLicense: { type: String, required: false },
  driverLicensePhoto: { type: String, required: false },
  selfiePhoto: { type: String, required: false },
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
  rejectionReason: { type: String },
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
  tier: {
    type: String,
    enum: ['goorgoorlu', 'jambaar', 'ndaanaan'],
    default: 'goorgoorlu'
  },
  completedRides: { type: Number, default: 0 },
  totalDeliveries: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  acceptanceRate: { type: Number, default: 100 },
  commissionBalance: { type: Number, default: 0 },
  commissionCap: { type: Number, default: 2000 },
  totalCommissionPaid: { type: Number, default: 0 },
  lastCommissionPayment: { type: Date },
  isBlockedForPayment: { type: Boolean, default: false },
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