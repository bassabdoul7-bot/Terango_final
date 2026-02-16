var mongoose = require('mongoose');

var serviceRequestSchema = new mongoose.Schema({
  requestNumber: { type: String, unique: true },
  riderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rider',
    required: true
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceProvider'
  },
  category: {
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
    ],
    required: true
  },
  urgency: {
    type: String,
    enum: ['normal', 'urgent', 'planifie'],
    default: 'normal'
  },
  scheduledDate: { type: Date },
  scheduledTimeSlot: { type: String }, // e.g. "08h-10h", "14h-16h"

  // Location
  location: {
    address: { type: String, required: true },
    quartier: { type: String },
    coordinates: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    }
  },

  // Problem description
  description: { type: String, required: true },
  photos: [{ type: String }], // photos of the problem
  voiceNote: { type: String }, // audio description (for non-literate users)

  // Status flow
  status: {
    type: String,
    enum: [
      'pending',         // looking for provider
      'accepted',        // provider accepted
      'en_route',        // provider on the way
      'arrived',         // provider at location
      'in_progress',     // work started
      'completed',       // work done
      'cancelled',       // cancelled
      'no_providers'     // no one available
    ],
    default: 'pending'
  },

  // Pricing
  estimatedCost: { type: Number, default: 0 },
  quotedPrice: { type: Number, default: 0 },    // provider's quote
  quoteAccepted: { type: Boolean, default: false },
  finalPrice: { type: Number, default: 0 },      // agreed price
  platformCommission: { type: Number, default: 0 }, // 15% commission
  providerEarnings: { type: Number, default: 0 },
  materialsCost: { type: Number, default: 0 },    // cost of parts/materials

  // Payment
  paymentMethod: {
    type: String,
    enum: ['orange_money', 'wave', 'free_money', 'cash'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },

  // Completion
  completionPhotos: [{ type: String }], // before/after photos
  completionNotes: { type: String },

  // Rating
  rating: {
    rating: { type: Number, min: 1, max: 5 },
    review: String
  },

  // Cancellation
  cancelledBy: { type: String, enum: ['rider', 'provider', 'system'] },
  cancellationReason: String,

  // Timestamps
  requestedAt: { type: Date, default: Date.now },
  acceptedAt: Date,
  enRouteAt: Date,
  arrivedAt: Date,
  startedAt: Date,
  completedAt: Date,
  cancelledAt: Date
}, { timestamps: true });

serviceRequestSchema.pre('save', function() {
  if (!this.requestNumber) {
    this.requestNumber = 'SRV-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
  }
});

serviceRequestSchema.index({ riderId: 1, createdAt: -1 });
serviceRequestSchema.index({ provider: 1, createdAt: -1 });
serviceRequestSchema.index({ status: 1 });
serviceRequestSchema.index({ category: 1 });
serviceRequestSchema.index({ 'location.quartier': 1 });

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
