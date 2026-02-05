var mongoose = require('mongoose');

var deliverySchema = new mongoose.Schema({
  deliveryNumber: { type: String, unique: true },
  riderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rider',
    required: true
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  serviceType: {
    type: String,
    enum: ['colis', 'commande'],
    required: true
  },
  pickup: {
    address: { type: String, required: true },
    coordinates: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    },
    contactName: String,
    contactPhone: String,
    instructions: String
  },
  dropoff: {
    address: { type: String, required: true },
    coordinates: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    },
    contactName: { type: String, required: true },
    contactPhone: { type: String, required: true },
    instructions: String
  },
  packageDetails: {
    size: { type: String, enum: ['petit', 'moyen', 'grand'], default: 'petit' },
    description: { type: String, required: true },
    weight: String,
    isFragile: { type: Boolean, default: false }
  },
  commandeDetails: {
    storeName: String,
    storeType: { type: String, enum: ['restaurant', 'pharmacie', 'supermarche', 'boutique', 'autre'], default: 'autre' },
    itemsList: String,
    estimatedItemsCost: { type: Number, default: 0 }
  },
  status: {
    type: String,
    enum: [
      'pending',
      'accepted',
      'at_pickup',
      'picked_up',
      'in_transit',
      'at_dropoff',
      'delivered',
      'cancelled',
      'no_drivers_available'
    ],
    default: 'pending'
  },
  distance: { type: Number, required: true },
  estimatedDuration: { type: Number, required: true },
  fare: { type: Number, required: true },
  deliveryFee: { type: Number, required: true },
  sizeSurcharge: { type: Number, default: 0 },
  platformCommission: { type: Number, default: 0 },
  driverEarnings: { type: Number, default: 0 },
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
  pickupPhoto: String,
  deliveryPhoto: String,
  recipientSignature: String,
  rating: {
    rating: { type: Number, min: 1, max: 5 },
    review: String
  },
  cancelledBy: { type: String, enum: ['rider', 'driver', 'system'] },
  cancellationReason: String,
  requestedAt: { type: Date, default: Date.now },
  acceptedAt: Date,
  atPickupAt: Date,
  pickedUpAt: Date,
  atDropoffAt: Date,
  deliveredAt: Date,
  cancelledAt: Date
}, { timestamps: true });

deliverySchema.pre('save', function() {
  if (!this.deliveryNumber) {
    var prefix = this.serviceType === 'colis' ? 'COL-' : 'CMD-';
    this.deliveryNumber = prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
  }

});

deliverySchema.index({ riderId: 1, createdAt: -1 });
deliverySchema.index({ driver: 1, createdAt: -1 });
deliverySchema.index({ status: 1 });
deliverySchema.index({ serviceType: 1 });

module.exports = mongoose.model('Delivery', deliverySchema);
