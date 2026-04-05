const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  riderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rider',
    required: true
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  
  // Location Details
  pickup: {
    address: {
      type: String,
      required: true
    },
    coordinates: {
      latitude: {
        type: Number,
        required: true
      },
      longitude: {
        type: Number,
        required: true
      }
    }
  },
  dropoff: {
    address: {
      type: String,
      required: true
    },
    coordinates: {
      latitude: {
        type: Number,
        required: true
      },
      longitude: {
        type: Number,
        required: true
      }
    }
  },
  
  // Ride Details
  status: {
    type: String,
    enum: ['pending', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_drivers_available'],
    default: 'pending'
  },
  rideType: {
    type: String,
    enum: ['standard', 'comfort', 'xl'],
    default: 'standard'
  },
  distance: {
    type: Number,
    required: true
  },
  estimatedDuration: {
    type: Number,
    required: true
  },
  
  // Pricing
  fare: {
    type: Number,
    required: true
  },
  surgeMultiplier: {
    type: Number,
    default: 1.0
  },
  pickupFee: {
    type: Number,
    default: 0
  },
  platformCommission: {
    type: Number,
    default: 0
  },
  driverEarnings: {
    type: Number,
    default: 0
  },
  partnerCommission: {
    type: Number,
    default: 0
  },
  partnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Partner",
    default: null
  },
  
  // Payment
  paymentMethod: {
    type: String,
    enum: ['cash', 'wave_upfront', 'wave'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'awaiting_payment', 'completed', 'failed'],
    default: 'pending'
  },
  wavePaymentScreenshot: {
    type: String,
    default: null
  },
  wavePaymentVerifiedByDriver: {
    type: Boolean,
    default: false
  },
  wavePayoutSent: {
    type: Boolean,
    default: false
  },
  wavePayoutSentAt: {
    type: Date,
    default: null
  },
  
  // Ratings & Reviews
  riderRating: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    review: String
  },
  driverRating: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    review: String
  },
  
  // Timestamps
  requestedAt: {
    type: Date,
    default: Date.now
  },
  acceptedAt: Date,
  arrivedAt: Date,
  startedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  cancelledBy: {
    type: String,
    enum: ['rider', 'driver']
  },
  cancellationReason: String,

  // Security PIN
  securityPin: { type: String, default: null },
  pinRequired: { type: Boolean, default: false },
  pinVerified: { type: Boolean, default: false },

  
}, { timestamps: true });

// Indexes for performance
rideSchema.index({ riderId: 1, createdAt: -1 });
rideSchema.index({ driver: 1, createdAt: -1 });
rideSchema.index({ status: 1 });

module.exports = mongoose.model('Ride', rideSchema);




