var mongoose = require('mongoose');

// Created the moment a renter pays the closing fee. From this point the
// contact details on both sides become visible to each other in-app, and the
// owner ↔ renter handshake continues off-platform (rental contract, deposit,
// keys, etc.). TeranGO is out of the loop on the underlying rental for v1
// (Tier B / closing-fee model) — kept as a separate doc so when we later
// graduate to Tier A daily-collection the agreement is the natural anchor.
var rentalAgreementSchema = new mongoose.Schema({
  listingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FleetListing',
    required: true,
    index: true
  },
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RentalApplication',
    required: true,
    unique: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  applicantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  applicantType: { type: String, enum: ['driver', 'private'], required: true },

  agreedStartDate: { type: Date, required: true },
  agreedDays: { type: Number, required: true, min: 1 },

  closingFee: {
    amount: { type: Number, required: true },         // total, e.g. 30000
    ownerShare: { type: Number, required: true },     // e.g. 15000
    applicantShare: { type: Number, required: true }, // e.g. 15000
    waveRef: { type: String },                        // Wave transaction ref
    paidAt: { type: Date }
  },

  // Snapshotted contact details at the moment of payment so neither side can
  // dodge the platform by changing their profile phone later.
  ownerPhone: { type: String },
  applicantPhone: { type: String },

  status: {
    type: String,
    enum: ['active', 'completed', 'disputed', 'cancelled'],
    default: 'active',
    index: true
  },
  disputedAt: { type: Date },
  disputeReason: { type: String },
  resolvedAt: { type: Date },
  adminNotes: { type: String }
}, { timestamps: true });

rentalAgreementSchema.index({ ownerId: 1, status: 1, createdAt: -1 });
rentalAgreementSchema.index({ applicantId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('RentalAgreement', rentalAgreementSchema);
