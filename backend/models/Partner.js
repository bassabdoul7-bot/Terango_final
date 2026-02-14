var mongoose = require('mongoose');
var partnerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  businessName: {
    type: String,
    trim: true,
    default: ''
  },
  businessPhone: {
    type: String,
    trim: true
  },
  businessAddress: {
    type: String,
    trim: true
  },
  idPhoto: {
    type: String,
    default: ''
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  commissionRate: {
    type: Number,
    default: 3
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  weeklyEarnings: {
    type: Number,
    default: 0
  },
  totalDrivers: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Partner', partnerSchema);
