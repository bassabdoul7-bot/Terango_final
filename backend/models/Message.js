var mongoose = require('mongoose');

var messageSchema = new mongoose.Schema({
  rideId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', default: null },
  deliveryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Delivery', default: null },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderRole: { type: String, enum: ['rider', 'driver'], required: true },
  text: { type: String, required: true, maxlength: 500 },
  read: { type: Boolean, default: false },
}, { timestamps: true });

messageSchema.index({ rideId: 1, createdAt: 1 });
messageSchema.index({ deliveryId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
