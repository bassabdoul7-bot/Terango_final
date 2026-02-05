var mongoose = require('mongoose');

var orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  riderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rider',
    required: true
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  items: [{
    menuItemId: mongoose.Schema.Types.ObjectId,
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    options: [{
      name: String,
      choice: String,
      priceAdd: { type: Number, default: 0 }
    }],
    subtotal: { type: Number, required: true }
  }],
  subtotal: { type: Number, required: true },
  deliveryFee: { type: Number, required: true },
  platformFee: { type: Number, default: 0 },
  total: { type: Number, required: true },
  restaurantEarnings: { type: Number, default: 0 },
  driverEarnings: { type: Number, default: 0 },
  platformCommission: { type: Number, default: 0 },
  status: {
    type: String,
    enum: [
      'pending',
      'confirmed',
      'preparing',
      'ready',
      'driver_assigned',
      'picked_up',
      'delivering',
      'delivered',
      'cancelled'
    ],
    default: 'pending'
  },
  pickup: {
    address: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  dropoff: {
    address: { type: String, required: true },
    coordinates: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    }
  },
  distance: { type: Number, default: 0 },
  estimatedDeliveryTime: { type: Number, default: 30 },
  specialInstructions: { type: String, default: '' },
  paymentMethod: {
    type: String,
    enum: ['orange_money', 'wave', 'free_money', 'cash'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  rating: {
    food: { type: Number, min: 1, max: 5 },
    delivery: { type: Number, min: 1, max: 5 },
    review: String
  },
  cancelledBy: { type: String, enum: ['rider', 'restaurant', 'driver', 'system'] },
  cancellationReason: String,
  confirmedAt: Date,
  preparingAt: Date,
  readyAt: Date,
  pickedUpAt: Date,
  deliveredAt: Date,
  cancelledAt: Date
}, { timestamps: true });

orderSchema.pre('save', function(next) {
  if (!this.orderNumber) {
    this.orderNumber = 'TT-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
  }
  next();
});

orderSchema.index({ riderId: 1, createdAt: -1 });
orderSchema.index({ restaurant: 1, createdAt: -1 });
orderSchema.index({ driver: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

module.exports = mongoose.model('Order', orderSchema);