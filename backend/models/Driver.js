const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Verification Documents
  nationalId: {
    type: String,
    required: false
  },
  nationalIdPhoto: {
    type: String,
    required: false
  },
  driverLicense: {
    type: String,
    required: false
  },
  driverLicensePhoto: {
    type: String,
    required: false
  },
  
  // Vehicle Information
  vehicle: {
    make: String,
    model: String,
    year: Number,
    color: String,
    licensePlate: {
      type: String,
      required: false
    },
    registrationPhoto: String, // Carte grise
    insurancePhoto: String
  },
  
  // Driver Status
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  
  // Location (Custom format - lat/lng object)
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      latitude: {
        type: Number,
        default: 0
      },
      longitude: {
        type: Number,
        default: 0
      }
    }
  },
  
  // Earnings & Stats
  totalEarnings: {
    type: Number,
    default: 0
  },
  weeklyEarnings: {
    type: Number,
    default: 0
  },
  totalRides: {
    type: Number,
    default: 0
  },
  acceptanceRate: {
    type: Number,
    default: 100
  },
  
  // Payout Information
  payoutMethod: {
    type: {
      type: String,
      enum: ['orange_money', 'wave', 'bank'],
      default: 'orange_money'
    },
    phoneNumber: String,
    accountNumber: String
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// NO geospatial index - we're using custom lat/lng format
// Manual distance calculation in matching service

module.exports = mongoose.model('Driver', driverSchema);