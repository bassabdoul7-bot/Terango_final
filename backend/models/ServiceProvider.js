var mongoose = require('mongoose');

var serviceProviderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  photo: { type: String },
  nationalIdPhoto: { type: String },
  serviceCategories: [{
    type: String,
    enum: [
      'plomberie',
      'electricite',
      'climatisation',
      'menuiserie',
      'peinture',
      'maconnerie',
      'carrelage',
      'serrurerie',
      'nettoyage',
      'jardinage',
      'informatique',
      'electromenager',
      'demenagement',
      'autre'
    ]
  }],
  description: { type: String, default: '' },
  experience: { type: Number, default: 0 }, // years
  zones: [{ type: String }], // quartiers: Plateau, Almadies, Parcelles, etc.
  pricing: {
    type: String,
    enum: ['fixed', 'hourly', 'quote'],
    default: 'quote'
  },
  hourlyRate: { type: Number, default: 0 }, // FCFA
  minimumFee: { type: Number, default: 2000 }, // FCFA
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: { type: String },
  isOnline: { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: true },
  currentLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      latitude: { type: Number, default: 0 },
      longitude: { type: Number, default: 0 }
    }
  },
  lastLocationUpdate: Date,
  rating: { type: Number, default: 5, min: 1, max: 5 },
  totalRatings: { type: Number, default: 0 },
  totalJobs: { type: Number, default: 0 },
  totalEarnings: { type: Number, default: 0 },
  completionRate: { type: Number, default: 100 },
  payoutMethod: {
    type: {
      type: String,
      enum: ['orange_money', 'wave', 'cash'],
      default: 'wave'
    },
    phoneNumber: String
  }
}, { timestamps: true });

serviceProviderSchema.index({ serviceCategories: 1, isOnline: 1 });
serviceProviderSchema.index({ zones: 1 });
serviceProviderSchema.index({ verificationStatus: 1 });

module.exports = mongoose.model('ServiceProvider', serviceProviderSchema);
