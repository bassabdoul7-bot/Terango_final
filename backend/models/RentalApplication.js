var mongoose = require('mongoose');

var rentalApplicationSchema = new mongoose.Schema({
  listingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FleetListing',
    required: true,
    index: true
  },
  applicantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Marks whether the applicant is a verified TeranGO driver or a private
  // renter. Drivers skip ID/license re-submission since those live on Driver;
  // private renters upload them here.
  applicantType: {
    type: String,
    enum: ['driver', 'private'],
    required: true
  },
  message: { type: String, default: '', trim: true },
  proposedStartDate: { type: Date, required: true },
  proposedDays: { type: Number, required: true, min: 1 },

  // Private-renter docs (Cloudinary URLs). Empty for 'driver' applicants.
  idPhoto: { type: String },
  licensePhoto: { type: String },
  selfiePhoto: { type: String },

  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'paid', 'cancelled', 'expired'],
    default: 'pending',
    index: true
  },
  rejectionReason: { type: String },

  acceptedAt: { type: Date },
  // 48h window to pay the closing fee after owner accepts, else status -> 'expired'
  // and the listing reopens for other applicants.
  expiresAt: { type: Date },
  paidAt: { type: Date },
  cancelledAt: { type: Date },
  cancelledBy: { type: String, enum: ['owner', 'applicant', 'admin', 'system'] }
}, { timestamps: true });

rentalApplicationSchema.index({ listingId: 1, status: 1 });
rentalApplicationSchema.index({ applicantId: 1, status: 1, createdAt: -1 });
rentalApplicationSchema.index({ status: 1, expiresAt: 1 }); // for the expire cron

module.exports = mongoose.model('RentalApplication', rentalApplicationSchema);
