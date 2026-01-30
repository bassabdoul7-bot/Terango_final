const mongoose = require('mongoose');

const riderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  favoriteLocations: [{
    name: String,
    address: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  }],
  paymentMethods: [{
    type: {
      type: String,
      enum: ['orange_money', 'wave', 'free_money', 'cash'],
      required: true
    },
    phoneNumber: String,
    isDefault: {
      type: Boolean,
      default: false
    }
  }],
  totalRides: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Rider', riderSchema);
