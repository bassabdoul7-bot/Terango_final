var FleetListing = require('../models/FleetListing');
var RentalApplication = require('../models/RentalApplication');
var RentalAgreement = require('../models/RentalAgreement');
var Driver = require('../models/Driver');
var User = require('../models/User');

// Closing fee constants. Kept here so we can tune the price without redeploying
// app builds — only the backend recomputes the split server-side at payment.
var CLOSING_FEE_TOTAL = 30000; // FCFA
var CLOSING_FEE_OWNER_SHARE = 15000;
var CLOSING_FEE_APPLICANT_SHARE = 15000;
var APPLICATION_PAY_WINDOW_MS = 48 * 60 * 60 * 1000;

// ========== OWNER ENDPOINTS ==========

// @route POST /api/fleet/listings
// @desc  Create a new listing. Goes to admin queue (isVerified=false).
exports.createListing = async function(req, res) {
  try {
    var body = req.body || {};
    if (!body.title || !body.vehicleType || !body.dailyRate) {
      return res.status(400).json({ success: false, message: 'Titre, type de vehicule et tarif journalier requis' });
    }
    var listing = await FleetListing.create({
      ownerId: req.user._id,
      title: body.title,
      description: body.description || '',
      vehicleType: body.vehicleType,
      vehicleClass: body.vehicleClass || 'standard',
      make: body.make,
      model: body.model,
      year: body.year,
      color: body.color,
      licensePlate: body.licensePlate,
      photos: Array.isArray(body.photos) ? body.photos : [],
      registrationPhoto: body.registrationPhoto,
      insurancePhoto: body.insurancePhoto,
      dailyRate: body.dailyRate,
      depositRequired: body.depositRequired || 0,
      minRentalDays: body.minRentalDays || 1,
      maxRentalDays: body.maxRentalDays || 90,
      rentalType: body.rentalType || 'both',
      location: body.location || {},
      conditions: body.conditions || '',
      isActive: true,
      isVerified: false,
      verificationStatus: 'pending'
    });
    res.status(201).json({ success: true, listing: listing });
  } catch (err) {
    console.error('createListing error:', err);
    res.status(500).json({ success: false, message: 'Erreur creation annonce' });
  }
};

// @route GET /api/fleet/my-listings
exports.getMyListings = async function(req, res) {
  try {
    var listings = await FleetListing.find({ ownerId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, listings: listings });
  } catch (err) {
    console.error('getMyListings error:', err);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// @route PUT /api/fleet/listings/:id
// Owner edits a draft or active listing. Verified listings remain verified
// (we don't re-queue for minor edits like price/description).
exports.updateListing = async function(req, res) {
  try {
    var listing = await FleetListing.findOne({ _id: req.params.id, ownerId: req.user._id });
    if (!listing) return res.status(404).json({ success: false, message: 'Annonce non trouvee' });
    var editable = ['title', 'description', 'dailyRate', 'depositRequired', 'minRentalDays', 'maxRentalDays', 'rentalType', 'location', 'conditions', 'isActive', 'photos'];
    editable.forEach(function(k) {
      if (req.body[k] !== undefined) listing[k] = req.body[k];
    });
    await listing.save();
    res.json({ success: true, listing: listing });
  } catch (err) {
    console.error('updateListing error:', err);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// @route DELETE /api/fleet/listings/:id
exports.deleteListing = async function(req, res) {
  try {
    var listing = await FleetListing.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user._id },
      { isActive: false },
      { new: true }
    );
    if (!listing) return res.status(404).json({ success: false, message: 'Annonce non trouvee' });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteListing error:', err);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// @route GET /api/fleet/listings/:id/applications
// Owner sees all applicants for their own listing.
exports.getApplicationsForListing = async function(req, res) {
  try {
    var listing = await FleetListing.findOne({ _id: req.params.id, ownerId: req.user._id });
    if (!listing) return res.status(404).json({ success: false, message: 'Annonce non trouvee' });
    var apps = await RentalApplication.find({ listingId: listing._id })
      .populate('applicantId', 'name phone profilePhoto rating')
      .sort({ createdAt: -1 });
    res.json({ success: true, applications: apps });
  } catch (err) {
    console.error('getApplicationsForListing error:', err);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// @route PUT /api/fleet/applications/:id/accept
// Owner accepts an application. Starts the 48h payment window.
exports.acceptApplication = async function(req, res) {
  try {
    var app = await RentalApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Demande non trouvee' });
    var listing = await FleetListing.findOne({ _id: app.listingId, ownerId: req.user._id });
    if (!listing) return res.status(403).json({ success: false, message: 'Non autorise' });
    if (app.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Demande deja traitee' });
    }
    app.status = 'accepted';
    app.acceptedAt = new Date();
    app.expiresAt = new Date(Date.now() + APPLICATION_PAY_WINDOW_MS);
    await app.save();
    res.json({ success: true, application: app });
  } catch (err) {
    console.error('acceptApplication error:', err);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// @route PUT /api/fleet/applications/:id/reject
exports.rejectApplication = async function(req, res) {
  try {
    var app = await RentalApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Demande non trouvee' });
    var listing = await FleetListing.findOne({ _id: app.listingId, ownerId: req.user._id });
    if (!listing) return res.status(403).json({ success: false, message: 'Non autorise' });
    if (app.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Demande deja traitee' });
    }
    app.status = 'rejected';
    app.rejectionReason = (req.body && req.body.reason) || '';
    await app.save();
    res.json({ success: true, application: app });
  } catch (err) {
    console.error('rejectApplication error:', err);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// ========== PUBLIC / RENTER ENDPOINTS ==========

// @route GET /api/fleet/listings
// Browse verified active listings. Query: type, neighborhood, minRate, maxRate
exports.browseListings = async function(req, res) {
  try {
    var q = { isActive: true, isVerified: true };
    if (req.query.type && req.query.type !== 'all') q.rentalType = { $in: [req.query.type, 'both'] };
    if (req.query.neighborhood) q['location.neighborhood'] = req.query.neighborhood;
    if (req.query.minRate || req.query.maxRate) {
      q.dailyRate = {};
      if (req.query.minRate) q.dailyRate.$gte = Number(req.query.minRate);
      if (req.query.maxRate) q.dailyRate.$lte = Number(req.query.maxRate);
    }
    var listings = await FleetListing.find(q)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, listings: listings });
  } catch (err) {
    console.error('browseListings error:', err);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// @route GET /api/fleet/listings/:id
exports.getListing = async function(req, res) {
  try {
    var listing = await FleetListing.findById(req.params.id).lean();
    if (!listing || !listing.isActive || !listing.isVerified) {
      return res.status(404).json({ success: false, message: 'Annonce non trouvee' });
    }
    // Owner contact stays hidden until a paid agreement exists.
    res.json({ success: true, listing: listing });
  } catch (err) {
    console.error('getListing error:', err);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// @route POST /api/fleet/listings/:id/apply
// Renter applies. Resolves applicantType automatically — if the user has a
// verified Driver record, they're a 'driver' applicant and skip doc upload.
exports.applyToListing = async function(req, res) {
  try {
    var listing = await FleetListing.findById(req.params.id);
    if (!listing || !listing.isActive || !listing.isVerified) {
      return res.status(404).json({ success: false, message: 'Annonce non disponible' });
    }
    // Can't apply to your own listing.
    if (String(listing.ownerId) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas postuler a votre propre annonce' });
    }
    // Prevent duplicate active applications from the same user to the same listing.
    var existing = await RentalApplication.findOne({
      listingId: listing._id,
      applicantId: req.user._id,
      status: { $in: ['pending', 'accepted', 'paid'] }
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Vous avez deja une demande en cours pour cette annonce' });
    }

    // Auto-detect applicantType. A verified TeranGO driver doesn't re-submit
    // ID/license — those are already on file.
    var driver = await Driver.findOne({ userId: req.user._id });
    var isVerifiedDriver = !!(driver && driver.verificationStatus === 'approved');
    var applicantType = isVerifiedDriver ? 'driver' : 'private';

    // For private renters, all three docs must be present unless the listing
    // is rentalType='driver' only (which they can't apply to anyway).
    if (applicantType === 'private' && listing.rentalType === 'driver') {
      return res.status(400).json({ success: false, message: 'Cette annonce est reservee aux chauffeurs TeranGO verifies' });
    }
    if (applicantType === 'private' && !(req.body.idPhoto && req.body.licensePhoto && req.body.selfiePhoto)) {
      return res.status(400).json({ success: false, message: 'Photos d\'identite, permis et selfie requis' });
    }
    if (!req.body.proposedStartDate || !req.body.proposedDays) {
      return res.status(400).json({ success: false, message: 'Date de debut et duree requises' });
    }
    if (req.body.proposedDays < listing.minRentalDays || req.body.proposedDays > listing.maxRentalDays) {
      return res.status(400).json({ success: false, message: 'Duree hors limites (' + listing.minRentalDays + '-' + listing.maxRentalDays + ' jours)' });
    }

    var app = await RentalApplication.create({
      listingId: listing._id,
      applicantId: req.user._id,
      applicantType: applicantType,
      message: req.body.message || '',
      proposedStartDate: new Date(req.body.proposedStartDate),
      proposedDays: req.body.proposedDays,
      idPhoto: applicantType === 'private' ? req.body.idPhoto : undefined,
      licensePhoto: applicantType === 'private' ? req.body.licensePhoto : undefined,
      selfiePhoto: applicantType === 'private' ? req.body.selfiePhoto : undefined,
      status: 'pending'
    });

    listing.applicationCount = (listing.applicationCount || 0) + 1;
    await listing.save();

    res.status(201).json({ success: true, application: app });
  } catch (err) {
    console.error('applyToListing error:', err);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// @route GET /api/fleet/my-applications
exports.getMyApplications = async function(req, res) {
  try {
    var apps = await RentalApplication.find({ applicantId: req.user._id })
      .populate('listingId', 'title dailyRate vehicleType make model photos ownerId rentalType')
      .sort({ createdAt: -1 });
    res.json({ success: true, applications: apps });
  } catch (err) {
    console.error('getMyApplications error:', err);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// @route POST /api/fleet/applications/:id/pay-fee
// Renter pays the closing fee. For v1 we record the Wave reference the client
// passes in (Wave's send-money flow happens app-side via deep link). Once the
// platform integrates a Wave checkout SDK we can move this to a server-side
// charge.
exports.payClosingFee = async function(req, res) {
  try {
    var app = await RentalApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Demande non trouvee' });
    if (String(app.applicantId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Non autorise' });
    }
    if (app.status !== 'accepted') {
      return res.status(400).json({ success: false, message: 'Demande non acceptee' });
    }
    if (app.expiresAt && new Date() > app.expiresAt) {
      app.status = 'expired';
      await app.save();
      return res.status(400).json({ success: false, message: 'Delai de paiement depasse' });
    }

    var listing = await FleetListing.findById(app.listingId);
    if (!listing) return res.status(404).json({ success: false, message: 'Annonce non trouvee' });

    var ownerUser = await User.findById(listing.ownerId);
    var applicantUser = await User.findById(app.applicantId);

    var agreement = await RentalAgreement.create({
      listingId: listing._id,
      applicationId: app._id,
      ownerId: listing.ownerId,
      applicantId: app.applicantId,
      applicantType: app.applicantType,
      agreedStartDate: app.proposedStartDate,
      agreedDays: app.proposedDays,
      closingFee: {
        amount: CLOSING_FEE_TOTAL,
        ownerShare: CLOSING_FEE_OWNER_SHARE,
        applicantShare: CLOSING_FEE_APPLICANT_SHARE,
        waveRef: (req.body && req.body.waveRef) || '',
        paidAt: new Date()
      },
      ownerPhone: ownerUser ? ownerUser.phone : '',
      applicantPhone: applicantUser ? applicantUser.phone : '',
      status: 'active'
    });

    app.status = 'paid';
    app.paidAt = new Date();
    await app.save();

    listing.agreementCount = (listing.agreementCount || 0) + 1;
    await listing.save();

    res.status(201).json({ success: true, agreement: agreement });
  } catch (err) {
    console.error('payClosingFee error:', err);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// @route GET /api/fleet/agreements/:id
// Only the two parties (or admin) can view.
exports.getAgreement = async function(req, res) {
  try {
    var ag = await RentalAgreement.findById(req.params.id)
      .populate('listingId', 'title make model vehicleType photos dailyRate location')
      .populate('ownerId', 'name phone')
      .populate('applicantId', 'name phone');
    if (!ag) return res.status(404).json({ success: false, message: 'Accord non trouve' });
    var isOwner = String(ag.ownerId._id) === String(req.user._id);
    var isApplicant = String(ag.applicantId._id) === String(req.user._id);
    var isAdmin = req.user.role === 'admin';
    if (!isOwner && !isApplicant && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Non autorise' });
    }
    res.json({ success: true, agreement: ag });
  } catch (err) {
    console.error('getAgreement error:', err);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// ========== ADMIN ENDPOINTS ==========

// @route GET /api/admin/fleet/listings?status=pending|all
exports.adminGetListings = async function(req, res) {
  try {
    var q = {};
    if (req.query.status === 'pending') q.verificationStatus = 'pending';
    else if (req.query.status === 'approved') q.verificationStatus = 'approved';
    else if (req.query.status === 'rejected') q.verificationStatus = 'rejected';
    var listings = await FleetListing.find(q)
      .populate('ownerId', 'name phone email')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, listings: listings });
  } catch (err) {
    console.error('adminGetListings error:', err);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// @route PUT /api/admin/fleet/listings/:id/verify  { approved: bool, reason: string }
exports.adminVerifyListing = async function(req, res) {
  try {
    var listing = await FleetListing.findById(req.params.id);
    if (!listing) return res.status(404).json({ success: false, message: 'Annonce non trouvee' });
    var approved = !!(req.body && req.body.approved);
    listing.verificationStatus = approved ? 'approved' : 'rejected';
    listing.isVerified = approved;
    listing.rejectionReason = approved ? '' : ((req.body && req.body.reason) || 'Non specifie');
    await listing.save();
    res.json({ success: true, listing: listing });
  } catch (err) {
    console.error('adminVerifyListing error:', err);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// @route GET /api/admin/fleet/agreements
exports.adminGetAgreements = async function(req, res) {
  try {
    var q = {};
    if (req.query.status) q.status = req.query.status;
    var ags = await RentalAgreement.find(q)
      .populate('listingId', 'title make model dailyRate')
      .populate('ownerId', 'name phone')
      .populate('applicantId', 'name phone')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, agreements: ags });
  } catch (err) {
    console.error('adminGetAgreements error:', err);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};
