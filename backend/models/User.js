var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  password: { type: String, select: false },
  profilePhoto: { type: String, default: '' },
  photoStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'expired'], default: 'pending' },
  photoVerified: { type: Boolean, default: false },
  role: {
    type: String,
    enum: ['rider', 'driver', 'admin', 'restaurant'],
    required: true
  },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  totalRatings: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);