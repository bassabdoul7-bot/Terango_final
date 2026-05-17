var mongoose = require('mongoose');

var fleetListingSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Display
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  // Vehicle
  vehicleType: { type: String, enum: ['car', 'moto'], required: true },
  vehicleClass: { type: String, enum: ['standard', 'comfort', 'xl'], default: 'standard' },
  make: { type: String, trim: true },
  model: { type: String, trim: true },
  year: { type: Number },
  color: { type: String, trim: true },
  licensePlate: { type: String, trim: true },
  // Media — Cloudinary URLs
  photos: [{ type: String }],
  registrationPhoto: { type: String },
  insurancePhoto: { type: String },
  // Pricing
  dailyRate: { type: Number, required: true, min: 0 },
  depositRequired: { type: Number, default: 0, min: 0 },
  minRentalDays: { type: Number, default: 1, min: 1 },
  maxRentalDays: { type: Number, default: 90 },
  // Audience
  rentalType: { type: String, enum: ['driver', 'private', 'both'], default: 'both', index: true },
  // Location
  location: {
    neighborhood: { type: String, trim: true },
    coords: {
      latitude: { type: Number },
      longitude: { type: Number }
    }
  },
  // Owner-defined rules ("no smoking", "return with full tank")
  conditions: { type: String, default: '', trim: true },
  // Lifecycle
  isActive: { type: Boolean, default: true, index: true },
  isVerified: { type: Boolean, default: false, index: true },
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  rejectionReason: { type: String },
  // Denormalised counters for cheap list rendering
  applicationCount: { type: Number, default: 0 },
  agreementCount: { type: Number, default: 0 }
}, { timestamps: true });

fleetListingSchema.index({ rentalType: 1, isActive: 1, isVerified: 1 });
fleetListingSchema.index({ 'location.neighborhood': 1, isActive: 1, isVerified: 1 });
fleetListingSchema.index({ createdAt: -1 });

module.exports = mongoose.model('FleetListing', fleetListingSchema);
