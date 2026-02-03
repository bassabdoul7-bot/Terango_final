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
  platformCommission: {
    type: Number,
    default: 0
  },
  driverEarnings: {
    type: Number,
    default: 0
  },
  
  // Payment
  paymentMethod: {
    type: String,
    enum: ['orange_money', 'wave', 'free_money', 'cash'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
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
  cancellationReason: String
  
}, { timestamps: true });

// Indexes for performance
rideSchema.index({ riderId: 1, createdAt: -1 });
rideSchema.index({ driver: 1, createdAt: -1 });
rideSchema.index({ status: 1 });

module.exports = mongoose.model('Ride', rideSchema);