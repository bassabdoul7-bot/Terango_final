var Partner = require('../models/Partner');
var bcrypt = require('bcryptjs');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Rider = require('../models/Rider');
const Ride = require('../models/Ride');
const Broadcast = require('../models/Broadcast');
const { sendPushNotification } = require('../services/pushService');
const nodemailer = require('nodemailer');

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
exports.getDashboardStats = async (req, res) => {
  try {
    // Total counts
    const totalRiders = await Rider.countDocuments();
    const totalDrivers = await Driver.countDocuments({ selfiePhoto: { $ne: null }, nationalIdPhoto: { $ne: null } });
    const totalRides = await Ride.countDocuments({ status: 'completed' });

    // Active drivers
    const activeDrivers = await Driver.countDocuments({ isOnline: true });

    // Pending verifications (only those with docs submitted)
    const pendingVerifications = await Driver.countDocuments({
      verificationStatus: 'pending',
      selfiePhoto: { $ne: null },
      nationalIdPhoto: { $ne: null },
      driverLicensePhoto: { $ne: null }
    });
    
    // Today's rides
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayRides = await Ride.countDocuments({ status: 'completed',
      createdAt: { $gte: today }
    });
    
    // Revenue calculation using aggregation (rides + deliveries)
    const rideRevenueAgg = await Ride.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$platformCommission' },
          todayRevenue: {
            $sum: {
              $cond: [{ $gte: ['$completedAt', today] }, '$platformCommission', 0]
            }
          }
        }
      }
    ]);

    var Delivery = require('../models/Delivery');
    const deliveryRevenueAgg = await Delivery.aggregate([
      { $match: { status: 'delivered' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$platformCommission' },
          todayRevenue: {
            $sum: {
              $cond: [{ $gte: ['$deliveredAt', today] }, '$platformCommission', 0]
            }
          }
        }
      }
    ]);

    const rideRev = rideRevenueAgg.length > 0 ? rideRevenueAgg[0] : { totalRevenue: 0, todayRevenue: 0 };
    const delRev = deliveryRevenueAgg.length > 0 ? deliveryRevenueAgg[0] : { totalRevenue: 0, todayRevenue: 0 };
    const totalRevenue = rideRev.totalRevenue + delRev.totalRevenue;
    const todayRevenue = rideRev.todayRevenue + delRev.todayRevenue;

    const totalDeliveries = await Delivery.countDocuments({ status: 'delivered' });
    const todayDeliveries = await Delivery.countDocuments({ status: 'delivered', deliveredAt: { $gte: today } });

    // Commission stats
    const commissionAgg = await Driver.aggregate([
      {
        $group: {
          _id: null,
          totalUnpaidCommissions: { $sum: '$commissionBalance' },
          totalCollectedCommissions: { $sum: '$totalCommissionPaid' },
          blockedDriversCount: {
            $sum: { $cond: ['$isBlockedForPayment', 1, 0] }
          }
        }
      }
    ]);

    const totalUnpaidCommissions = commissionAgg.length > 0 ? commissionAgg[0].totalUnpaidCommissions : 0;
    const totalCollectedCommissions = commissionAgg.length > 0 ? commissionAgg[0].totalCollectedCommissions : 0;
    const blockedDriversCount = commissionAgg.length > 0 ? commissionAgg[0].blockedDriversCount : 0;

    res.status(200).json({
      success: true,
      stats: {
        totalRiders,
        totalDrivers,
        activeDrivers,
        totalRides,
        todayRides,
        pendingVerifications,
        totalRevenue,
        todayRevenue,
        totalDeliveries,
        todayDeliveries,
        totalUnpaidCommissions,
        totalCollectedCommissions,
        blockedDriversCount
      }
    });

  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
};

// @desc    Get all drivers with filters
// @route   GET /api/admin/drivers
// @access  Private (Admin only)
exports.getAllDrivers = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) {
      query.verificationStatus = status;
    }
    if (req.query.includeIncomplete === '1') {
      // Show ONLY incompletes: pending with no selfie
      query.verificationStatus = 'pending';
      query.selfiePhoto = null;
    } else {
      // Default: show approved + rejected + pending WITH docs
      if (!status) {
        query.$or = [
          { verificationStatus: { $in: ['approved', 'rejected'] } },
          { verificationStatus: 'pending', selfiePhoto: { $ne: null } }
        ];
      }
    }
    
    const drivers = await Driver.find(query)
      .populate('userId', 'name phone email rating')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const count = await Driver.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      drivers
    });

  } catch (error) {
    console.error('Get All Drivers Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des chauffeurs'
    });
  }
};

// @desc    Verify/Reject driver
// @route   PUT /api/admin/drivers/:id/verify
// @access  Private (Admin only)
exports.verifyDriver = async (req, res) => {
  try {
    const { status, reason } = req.body; // status: 'approved' or 'rejected'
    
    const driver = await Driver.findById(req.params.id).populate('userId');
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Chauffeur non trouvé'
      });
    }
    
    driver.verificationStatus = status;
    await driver.save();

    // Auto-set driver selfie as user profile photo on approval
    if (status === 'approved' && driver.selfiePhoto && driver.userId) {
      const User = require('../models/User');
      await User.findByIdAndUpdate(driver.userId._id || driver.userId, {
        profilePhoto: driver.selfiePhoto,
        photoStatus: 'approved',
        photoVerified: true
      });
    }
    
    // TODO: Send notification to driver (SMS/Email)
    
    res.status(200).json({
      success: true,
      message: status === 'approved' 
        ? 'Chauffeur approuvé' 
        : 'Chauffeur rejeté',
      driver
    });

  } catch (error) {
    console.error('Verify Driver Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification'
    });
  }
};

// @desc    Get all rides with filters
// @route   GET /api/admin/rides
// @access  Private (Admin only)
exports.getAllRides = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) {
      query.status = status;
    }
    
    const rides = await Ride.find(query)
      .populate({ path: 'riderId', populate: { path: 'userId', select: 'name phone' } })
      .populate({ path: 'driver', populate: { path: 'userId', select: 'name phone' } })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const count = await Ride.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      rides
    });

  } catch (error) {
    console.error('Get All Rides Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des courses'
    });
  }
};

// @desc    Get single ride details (with routeTrail, emergencyRecordings)
// @route   GET /api/admin/rides/:id
// @access  Private (Admin only)
exports.getRideDetails = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id)
      .populate({
        path: 'riderId',
        populate: { path: 'userId', select: 'name phone' }
      })
      .populate({
        path: 'driver',
        populate: { path: 'userId', select: 'name phone' }
      });

    if (!ride) {
      return res.status(404).json({ success: false, message: 'Course non trouvee' });
    }

    res.status(200).json({ success: true, ride });
  } catch (error) {
    console.error('Get Ride Details Error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la recuperation de la course' });
  }
};

// @desc    Get all riders
// @route   GET /api/admin/riders
// @access  Private (Admin only)
exports.getAllRiders = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const riders = await Rider.find()
      .populate('userId', 'name phone email rating')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const count = await Rider.countDocuments();

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      riders
    });

  } catch (error) {
    console.error('Get All Riders Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des passagers'
    });
  }
};

// @desc    Get revenue analytics
// @route   GET /api/admin/revenue
// @access  Private (Admin only)
exports.getRevenueAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = { status: 'completed' };
    
    if (startDate && endDate) {
      query.completedAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const aggResult = await Ride.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalRides: { $sum: 1 },
          totalFare: { $sum: '$fare' },
          totalCommission: { $sum: '$platformCommission' },
          totalDriverEarnings: { $sum: '$driverEarnings' },
          averageFare: { $avg: '$fare' }
        }
      }
    ]);

    const typeAgg = await Ride.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$rideType',
          count: { $sum: 1 }
        }
      }
    ]);

    const ridesByType = { standard: 0, comfort: 0, xl: 0 };
    typeAgg.forEach(t => {
      if (t._id in ridesByType) ridesByType[t._id] = t.count;
    });

    const stats = aggResult.length > 0 ? aggResult[0] : {
      totalRides: 0, totalFare: 0, totalCommission: 0, totalDriverEarnings: 0, averageFare: 0
    };

    const analytics = {
      totalRides: stats.totalRides,
      totalFare: stats.totalFare,
      totalCommission: stats.totalCommission,
      totalDriverEarnings: stats.totalDriverEarnings,
      averageFare: stats.averageFare || 0,
      ridesByType
    };

    res.status(200).json({
      success: true,
      analytics
    });

  } catch (error) {
    console.error('Revenue Analytics Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des analyses'
    });
  }
};

// @desc    Deactivate/Activate user
// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin only)
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: user.isActive 
        ? 'Utilisateur activé' 
        : 'Utilisateur désactivé',
      user
    });

  } catch (error) {
    console.error('Toggle User Status Error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du changement de statut'
    });
  }
};

// @desc    Get drivers with pending photos
// @route   GET /api/admin/pending-photos
// @access  Private (Admin only)
exports.getPendingPhotos = async (req, res) => {
  try {
    const users = await User.find({ photoStatus: 'pending', profilePhoto: { $ne: '' } });
    res.status(200).json({ success: true, users: users });
  } catch (error) {
    console.error('Pending Photos Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// @desc    Approve driver photo
// @route   PUT /api/admin/users/:id/approve-photo
// @access  Private (Admin only)
exports.approvePhoto = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, {
      photoStatus: 'approved',
      photoVerified: true
    }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    res.json({ success: true, message: 'Photo approuvée', user: user });
  } catch (error) {
    console.error('Approve Photo Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// @desc    Reject driver photo
// @route   PUT /api/admin/users/:id/reject-photo
// @access  Private (Admin only)
// @desc    Send a broadcast to riders / drivers / all via push and/or email
// @route   POST /api/admin/broadcast
// @access  Private (Admin/Moderator)
exports.sendBroadcast = async (req, res) => {
  try {
    const { audience, channels, title, body } = req.body;
    if (!audience || !['riders', 'drivers', 'all'].includes(audience)) {
      return res.status(400).json({ success: false, message: 'audience invalide' });
    }
    if (!Array.isArray(channels) || channels.length === 0) {
      return res.status(400).json({ success: false, message: 'channels requis' });
    }
    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'titre et message requis' });
    }

    // Build user query by role
    let roleFilter;
    if (audience === 'riders') roleFilter = { role: 'rider' };
    else if (audience === 'drivers') roleFilter = { role: 'driver' };
    else roleFilter = { role: { $in: ['rider', 'driver'] } };

    const users = await User.find(roleFilter, 'name email role pushToken driverPushToken riderPushToken').lean();

    // Create Broadcast doc immediately and respond to client; the actual
    // sending runs in background and updates this doc as it progresses.
    const broadcast = await Broadcast.create({
      audience: audience,
      channels: channels,
      title: title,
      body: body,
      sentBy: req.user._id,
      sentByName: req.user.name || '',
      pushSent: 0, pushFailed: 0, emailSent: 0, emailFailed: 0
    });

    res.json({
      success: true,
      broadcast: broadcast,
      summary: { totalUsers: users.length, processing: true }
    });

    // Fire-and-forget background processor
    processBroadcastInBackground(broadcast._id, users, channels, title, body).catch(function(e) {
      console.error('processBroadcastInBackground error:', e.message);
    });
  } catch (error) {
    console.error('Send Broadcast Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

async function processBroadcastInBackground(broadcastId, users, channels, title, body) {
  let pushSent = 0, pushFailed = 0, emailSent = 0, emailFailed = 0;

  if (channels.includes('push')) {
    // Concurrency: 10 in flight at a time
    const queue = users.slice();
    async function worker() {
      while (queue.length > 0) {
        const u = queue.shift();
        if (!u) break;
        try {
          await sendPushNotification(u._id, title, body, { type: 'broadcast' }, u.role);
          pushSent++;
        } catch (e) { pushFailed++; }
      }
    }
    await Promise.all([worker(), worker(), worker(), worker(), worker(), worker(), worker(), worker(), worker(), worker()]);
    await Broadcast.findByIdAndUpdate(broadcastId, { pushSent: pushSent, pushFailed: pushFailed });
  }

  if (channels.includes('email') && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      pool: true,
      maxConnections: 5
    });
    const html = '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;">' +
      '<h2 style="color:#00853F;margin:0 0 12px 0;">' + escapeHtml(title) + '</h2>' +
      '<div style="font-size:15px;line-height:1.5;color:#333;white-space:pre-wrap;">' + escapeHtml(body) + '</div>' +
      '<hr style="margin:24px 0;border:none;border-top:1px solid #eee;">' +
      '<p style="font-size:11px;color:#999;">TeranGO — Vous recevez cet email car vous avez créé un compte. Pour ne plus recevoir ces messages, répondez "STOP".</p>' +
      '</div>';
    const queue = users.filter(u => u.email);
    async function worker() {
      while (queue.length > 0) {
        const u = queue.shift();
        if (!u) break;
        try {
          await transporter.sendMail({
            from: '"TeranGO" <' + process.env.EMAIL_USER + '>',
            to: u.email, subject: title, text: body, html: html
          });
          emailSent++;
        } catch (e) { emailFailed++; }
      }
    }
    await Promise.all([worker(), worker(), worker(), worker(), worker()]);
    transporter.close();
    await Broadcast.findByIdAndUpdate(broadcastId, { emailSent: emailSent, emailFailed: emailFailed });
  }

  console.log('[broadcast] ' + broadcastId + ' done: push ' + pushSent + '/' + pushFailed + ' email ' + emailSent + '/' + emailFailed);
}

// @desc    Get past broadcasts
// @route   GET /api/admin/broadcasts
// @access  Private (Admin/Moderator)
exports.getBroadcasts = async (req, res) => {
  try {
    const broadcasts = await Broadcast.find().sort({ createdAt: -1 }).limit(50).lean();
    res.json({ success: true, broadcasts });
  } catch (error) {
    console.error('Get Broadcasts Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// @desc    Update a driver's document expiration dates
// @route   PUT /api/admin/drivers/:id/document-expiry
// @access  Private (Admin only)
exports.updateDriverDocumentExpiry = async (req, res) => {
  try {
    const Driver = require('../models/Driver');
    const valid = ['driverLicense', 'vehicleInsurance', 'vehicleRegistration', 'vehicleInspection'];
    const update = {};
    const clearReminders = {};
    for (const k of valid) {
      if (req.body[k] !== undefined) {
        const d = req.body[k] ? new Date(req.body[k]) : null;
        if (d && isNaN(d.getTime())) continue;
        update['documentExpiry.' + k] = d;
        // Clear all reminder buckets for this doc since the date changed
        ['30', '14', '7', '1', '0'].forEach(b => { clearReminders['documentRemindersSent.' + k + ':' + b] = ''; });
      }
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, message: 'Aucune date fournie' });
    }
    const ops = { $set: update };
    if (Object.keys(clearReminders).length > 0) ops.$unset = clearReminders;
    const driver = await Driver.findByIdAndUpdate(req.params.id, ops, { new: true });
    if (!driver) return res.status(404).json({ success: false, message: 'Chauffeur non trouvé' });
    res.json({ success: true, documentExpiry: driver.documentExpiry });
  } catch (error) {
    console.error('Update Driver Document Expiry Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

exports.rejectPhoto = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, {
      photoStatus: 'rejected',
      photoVerified: false
    }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    res.json({ success: true, message: 'Photo rejetée', user: user });
  } catch (error) {
    console.error('Reject Photo Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// @desc    Create a new partner account
// @route   POST /api/admin/partners
// @access  Private (Admin)
exports.createPartner = async (req, res) => {
  try {
    var { name, phone, email, pin, businessName, businessPhone, businessAddress, commissionRate } = req.body;

    if (!name || !phone || !pin || !businessName) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone, PIN, and business name are required'
      });
    }

    var existingUser = await User.findOne({ phone: phone });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already registered'
      });
    }

    var salt = await bcrypt.genSalt(10);
    var hashedPin = await bcrypt.hash(pin, salt);

    var user = await User.create({
      name: name,
      phone: phone,
      email: email || '',
      pin: hashedPin,
      role: 'partner',
      isActive: true
    });

    var partner = await Partner.create({
      userId: user._id,
      businessName: businessName,
      businessPhone: businessPhone || phone,
      businessAddress: businessAddress || '',
      commissionRate: commissionRate || 3,
      verificationStatus: 'approved'
    });

    res.status(201).json({
      success: true,
      message: 'Partner created successfully',
      partner: {
        id: partner._id,
        userId: user._id,
        name: user.name,
        phone: user.phone,
        businessName: partner.businessName,
        commissionRate: partner.commissionRate
      }
    });
  } catch (error) {
    console.error('Create partner error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get all partners
// @route   GET /api/admin/partners
// @access  Private (Admin)
exports.getAllPartners = async (req, res) => {
  try {
    var partners = await Partner.find().populate('userId', 'name phone email').sort({ createdAt: -1 });

    var Driver = require('../models/Driver');
    var partnerList = [];
    for (var i = 0; i < partners.length; i++) {
      var p = partners[i];
      var driverCount = await Driver.countDocuments({ partnerId: p._id });
      partnerList.push({
        id: p._id,
        name: p.userId ? p.userId.name : '',
        phone: p.userId ? p.userId.phone : '',
        email: p.userId ? p.userId.email : '',
        businessName: p.businessName,
        commissionRate: p.commissionRate,
        totalEarnings: p.totalEarnings,
        totalDrivers: driverCount,
        isActive: p.isActive,
        idPhoto: p.idPhoto || '',
        verificationStatus: p.verificationStatus || 'approved',
        createdAt: p.createdAt
      });
    }

    res.status(200).json({
      success: true,
      count: partnerList.length,
      partners: partnerList
    });
  } catch (error) {
    console.error('Get partners error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Verify (approve/reject) a partner
// @route   PUT /api/admin/partners/:id/verify
// @access  Private (Admin)
exports.verifyPartner = async function(req, res) {
  try {
    var { status, reason } = req.body;
    var partner = await Partner.findById(req.params.id);
    if (!partner) {
      return res.status(404).json({ success: false, message: 'Partner not found' });
    }
    partner.verificationStatus = status;
    if (status === 'rejected' && reason) {
      partner.rejectionReason = reason;
    }
    await partner.save();
    res.json({
      success: true,
      message: 'Partner ' + status,
      partner: { id: partner._id, verificationStatus: partner.verificationStatus }
    });
  } catch (error) {
    console.error('Verify partner error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Verify (approve/reject) a partner
// @route   PUT /api/admin/partners/:id/verify
// @access  Private (Admin)
exports.verifyPartner = async function(req, res) {
  try {
    var { status, reason } = req.body;
    var partner = await Partner.findById(req.params.id);
    if (!partner) {
      return res.status(404).json({ success: false, message: 'Partner not found' });
    }
    partner.verificationStatus = status;
    if (status === 'rejected' && reason) {
      partner.rejectionReason = reason;
    }
    await partner.save();
    res.json({
      success: true,
      message: 'Partner ' + status,
      partner: { id: partner._id, verificationStatus: partner.verificationStatus }
    });
  } catch (error) {
    console.error('Verify partner error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
async (req, res) => {
  try {
    var Driver = require('../models/Driver');
    var driver = await Driver.findById(req.params.id).populate('userId', 'name phone');
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Chauffeur non trouve' });
    }
    var amountPaid = driver.commissionBalance;
    driver.totalCommissionPaid = (driver.totalCommissionPaid || 0) + amountPaid;
    driver.commissionBalance = 0;
    driver.isBlockedForPayment = false;
    driver.lastCommissionPayment = new Date();
    await driver.save();
    res.json({
      success: true,
      message: 'Commission marquee comme payee',
      driver: {
        id: driver._id,
        name: driver.userId ? driver.userId.name : 'N/A',
        amountPaid: amountPaid,
        totalPaid: driver.totalCommissionPaid
      }
    });
  } catch (error) {
    console.error('Mark Commission Paid Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
}
// @desc    Mark driver commission as paid
// @route   PUT /api/admin/drivers/:id/commission-paid
// @access  Private (Admin only)
exports.markCommissionPaid = async (req, res) => {
  try {
    var Driver = require('../models/Driver');
    var driver = await Driver.findById(req.params.id).populate('userId', 'name phone');
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Chauffeur non trouve' });
    }
    var amountPaid = driver.commissionBalance;
    driver.totalCommissionPaid = (driver.totalCommissionPaid || 0) + amountPaid;
    driver.commissionBalance = 0;
    driver.isBlockedForPayment = false;
    driver.lastCommissionPayment = new Date();
    await driver.save();
    res.json({
      success: true,
      message: 'Commission marquee comme payee',
      driver: {
        id: driver._id,
        name: driver.userId ? driver.userId.name : 'N/A',
        amountPaid: amountPaid,
        totalPaid: driver.totalCommissionPaid
      }
    });
  } catch (error) {
    console.error('Mark Commission Paid Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};


// @desc    Confirm Wave payment for a ride
// @route   PUT /api/admin/rides/:id/payment-confirmed
// @access  Private (Admin only)
exports.confirmWavePayment = async (req, res) => {
  try {
    var ride = await Ride.findById(req.params.id).populate('riderId');
    if (!ride) {
      return res.status(404).json({ success: false, message: 'Course non trouvee' });
    }

    if (!['wave', 'wave_upfront'].includes(ride.paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Cette course ne requiert pas de confirmation Wave' });
    }

    ride.wavePaymentConfirmed = true;
    ride.paymentStatus = 'completed';

    // If wave_upfront and ride has not been matched yet: trigger matching
    if (ride.paymentMethod === 'wave_upfront' && ride.status === 'pending' && !ride.driver) {
      await ride.save();

      var RideMatchingService = require('../services/rideMatchingService');
      var matchingService = req.app.get('matchingService');

      var rideData = {
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        fare: ride.fare,
        distance: ride.distance,
        estimatedDuration: ride.estimatedDuration,
        rideType: ride.rideType
      };

      matchingService.offerRideToDrivers(
        ride._id,
        ride.pickup.coordinates,
        rideData
      ).catch(function(err) { console.error('Matching error after Wave confirm:', err); });
    } else {
      await ride.save();
    }

    // Push notify rider
    if (ride.riderId && ride.riderId.userId) {
      var { sendPushNotification } = require('../services/pushService');
      sendPushNotification(ride.riderId.userId, 'Paiement confirme!', 'Votre paiement Wave a ete confirme.', { type: 'wave-payment-confirmed', rideId: ride._id.toString() });
    }

    res.json({
      success: true,
      message: 'Paiement Wave confirme',
      ride: { id: ride._id, paymentStatus: ride.paymentStatus, wavePaymentConfirmed: ride.wavePaymentConfirmed, status: ride.status }
    });
  } catch (error) {
    console.error('Confirm Wave Payment Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// @desc    Get Wave payouts grouped by driver
// @route   GET /api/admin/wave-payouts
// @access  Private (Admin only)
exports.getWavePayouts = async (req, res) => {
  try {
    var payouts = await Ride.aggregate([
      {
        $match: {
          paymentMethod: { $in: ['wave', 'wave_upfront'] },
          paymentStatus: 'completed',
          wavePayoutSent: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$driver',
          totalFare: { $sum: '$fare' },
          totalDriverEarnings: { $sum: '$driverEarnings' },
          totalCommission: { $sum: '$platformCommission' },
          rideCount: { $sum: 1 },
          rides: { $push: { id: '$_id', fare: '$fare', driverEarnings: '$driverEarnings', completedAt: '$completedAt' } }
        }
      }
    ]);

    // Populate driver info
    var populatedPayouts = [];
    for (var i = 0; i < payouts.length; i++) {
      var p = payouts[i];
      if (!p._id) continue;
      var driver = await Driver.findById(p._id).populate('userId', 'name phone');
      populatedPayouts.push({
        driverId: p._id,
        driverName: driver && driver.userId ? driver.userId.name : 'N/A',
        driverPhone: driver && driver.userId ? driver.userId.phone : 'N/A',
        totalFare: p.totalFare,
        totalDriverEarnings: p.totalDriverEarnings,
        totalCommission: p.totalCommission,
        rideCount: p.rideCount,
        rides: p.rides
      });
    }

    res.json({ success: true, payouts: populatedPayouts });
  } catch (error) {
    console.error('Get Wave Payouts Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// @desc    Mark Wave payout as sent to driver
// @route   PUT /api/admin/drivers/:id/wave-payout-sent
// @access  Private (Admin only)
exports.markWavePayoutSent = async (req, res) => {
  try {
    var driverId = req.params.id;
    var driver = await Driver.findById(driverId).populate('userId', 'name phone');
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Chauffeur non trouve' });
    }

    var result = await Ride.updateMany(
      {
        driver: driverId,
        paymentMethod: { $in: ['wave', 'wave_upfront'] },
        paymentStatus: 'completed',
        wavePayoutSent: { $ne: true }
      },
      {
        $set: { wavePayoutSent: true, wavePayoutSentAt: new Date() }
      }
    );

    res.json({
      success: true,
      message: 'Paiement chauffeur marque comme envoye',
      driver: {
        id: driver._id,
        name: driver.userId ? driver.userId.name : 'N/A'
      },
      ridesUpdated: result.modifiedCount
    });
  } catch (error) {
    console.error('Mark Wave Payout Sent Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ========== MONITORING / OBSERVABILITY ==========

// @desc    Get logs with filters
// @route   GET /api/admin/logs
// @access  Private (Admin only)
exports.getLogs = async (req, res) => {
  try {
    var AppLog = require('../models/AppLog');
    var { source, level, screen, search, from, to, page, limit } = req.query;
    var pg = parseInt(page) || 1;
    var lim = Math.min(parseInt(limit) || 50, 200);

    var query = {};
    if (source) query.source = source;
    if (level) query.level = level;
    if (screen) query.screen = { $regex: screen, $options: 'i' };
    if (search) query.message = { $regex: search, $options: 'i' };
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    var count = await AppLog.countDocuments(query);
    var logs = await AppLog.find(query)
      .sort({ createdAt: -1 })
      .limit(lim)
      .skip((pg - 1) * lim)
      .lean();

    res.json({
      success: true,
      count: count,
      totalPages: Math.ceil(count / lim),
      currentPage: pg,
      logs: logs
    });
  } catch (error) {
    console.error('Get Logs Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// @desc    Get log stats
// @route   GET /api/admin/logs/stats
// @access  Private (Admin only)
exports.getLogStats = async (req, res) => {
  try {
    var AppLog = require('../models/AppLog');
    var now = new Date();
    var h24 = new Date(now - 24 * 60 * 60 * 1000);
    var d7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
    var d30 = new Date(now - 30 * 24 * 60 * 60 * 1000);

    // Error count by source for 24h, 7d, 30d
    var bySource24h = await AppLog.aggregate([
      { $match: { level: 'error', createdAt: { $gte: h24 } } },
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);
    var bySource7d = await AppLog.aggregate([
      { $match: { level: 'error', createdAt: { $gte: d7 } } },
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);
    var bySource30d = await AppLog.aggregate([
      { $match: { level: 'error', createdAt: { $gte: d30 } } },
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);

    // Top 10 screens with most errors
    var topScreens = await AppLog.aggregate([
      { $match: { level: 'error', screen: { $ne: '' }, createdAt: { $gte: d7 } } },
      { $group: { _id: '$screen', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Error count by hour (last 24h)
    var byHour = await AppLog.aggregate([
      { $match: { createdAt: { $gte: h24 } } },
      {
        $group: {
          _id: {
            hour: { $hour: '$createdAt' },
            level: '$level'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.hour': 1 } }
    ]);

    // Total by level (last 7d)
    var byLevel = await AppLog.aggregate([
      { $match: { createdAt: { $gte: d7 } } },
      { $group: { _id: '$level', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      stats: {
        bySource: { h24: bySource24h, d7: bySource7d, d30: bySource30d },
        topScreens: topScreens,
        byHour: byHour,
        byLevel: byLevel
      }
    });
  } catch (error) {
    console.error('Log Stats Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// @desc    Server health check (detailed)
// @route   GET /api/admin/health
// @access  Private (Admin only)
exports.getHealth = async (req, res) => {
  try {
    var mongoose = require('mongoose');
    var driverLocationService = require('../services/driverLocationService');

    // MongoDB
    var mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    // Redis
    var redisStatus = 'disconnected';
    try {
      await driverLocationService.getOnlineDriversCount();
      redisStatus = 'connected';
    } catch (e) { /* down */ }

    // Memory
    var mem = process.memoryUsage();

    // Socket connections
    var io = req.app.get('io');
    var activeConnections = io ? io.engine.clientsCount : 0;

    // Uptime
    var uptimeSeconds = Math.floor(process.uptime());
    var days = Math.floor(uptimeSeconds / 86400);
    var hours = Math.floor((uptimeSeconds % 86400) / 3600);
    var minutes = Math.floor((uptimeSeconds % 3600) / 60);
    var uptimeStr = days + 'd ' + hours + 'h ' + minutes + 'm';

    res.json({
      success: true,
      health: {
        uptime: uptimeStr,
        uptimeSeconds: uptimeSeconds,
        mongoStatus: mongoStatus,
        redisStatus: redisStatus,
        memory: {
          rss: Math.round(mem.rss / 1024 / 1024) + ' MB',
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + ' MB',
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + ' MB'
        },
        activeConnections: activeConnections,
        nodeVersion: process.version,
        platform: process.platform
      }
    });
  } catch (error) {
    console.error('Health Check Error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// ========== DRIVER MODERATION ==========

// @desc    Suspend/Unsuspend driver
// @route   PUT /api/admin/drivers/:id/suspend
exports.suspendDriver = async (req, res) => {
  try {
    var driver = await Driver.findById(req.params.id).populate('userId');
    if (!driver) return res.status(404).json({ success: false, message: 'Chauffeur non trouve' });
    var reason = req.body.reason || 'Non specifie';
    var action = req.body.action || 'suspend'; // 'suspend' or 'unsuspend'
    if (action === 'suspend') {
      driver.isSuspended = true;
      driver.suspendedAt = new Date();
      driver.suspensionReason = reason;
      driver.isOnline = false;
      driver.isAvailable = false;
    } else {
      driver.isSuspended = false;
      driver.suspendedAt = null;
      driver.suspensionReason = null;
    }
    await driver.save();
    res.json({ success: true, message: action === 'suspend' ? 'Chauffeur suspendu' : 'Suspension levee', driver: driver });
  } catch (error) {
    console.error('Suspend Driver Error:', error);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// @desc    Ban driver permanently
// @route   PUT /api/admin/drivers/:id/ban
exports.banDriver = async (req, res) => {
  try {
    var driver = await Driver.findById(req.params.id).populate('userId');
    if (!driver) return res.status(404).json({ success: false, message: 'Chauffeur non trouve' });
    driver.isBanned = true;
    driver.bannedAt = new Date();
    driver.banReason = req.body.reason || 'Non specifie';
    driver.isOnline = false;
    driver.isAvailable = false;
    driver.verificationStatus = 'rejected';
    await driver.save();
    res.json({ success: true, message: 'Chauffeur banni', driver: driver });
  } catch (error) {
    console.error('Ban Driver Error:', error);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// @desc    Get active rides (live operations)
// @route   GET /api/admin/live/rides
exports.getActiveRides = async (req, res) => {
  try {
    const rides = await Ride.find({
      status: { $in: ['accepted', 'arrived', 'in_progress'] }
    })
      .populate({
        path: 'riderId',
        populate: { path: 'userId', select: 'name phone' }
      })
      .populate({
        path: 'driver',
        populate: { path: 'userId', select: 'name phone' },
        select: 'userId waveNumber currentLocation isAvailable vehicle vehicleType'
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, rides });
  } catch (error) {
    console.error('Get Active Rides Error:', error);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// @desc    Get active deliveries (live operations)
// @route   GET /api/admin/live/deliveries
exports.getActiveDeliveries = async (req, res) => {
  try {
    var Delivery = require('../models/Delivery');
    const deliveries = await Delivery.find({
      status: { $in: ['accepted', 'at_pickup', 'picked_up', 'at_dropoff'] }
    })
      .populate({
        path: 'riderId',
        populate: { path: 'userId', select: 'name phone' }
      })
      .populate({
        path: 'driver',
        populate: { path: 'userId', select: 'name phone' },
        select: 'userId waveNumber currentLocation isAvailable vehicle vehicleType'
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, deliveries });
  } catch (error) {
    console.error('Get Active Deliveries Error:', error);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// @desc    Get online drivers (live operations)
// @route   GET /api/admin/live/drivers
exports.getOnlineDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find({ isOnline: true })
      .populate('userId', 'name phone')
      .select('userId currentLocation isAvailable vehicle vehicleType waveNumber currentRide currentDelivery');

    res.status(200).json({ success: true, drivers });
  } catch (error) {
    console.error('Get Online Drivers Error:', error);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};

// @desc    Warn driver
// @route   POST /api/admin/drivers/:id/warn
exports.warnDriver = async (req, res) => {
  try {
    var driver = await Driver.findById(req.params.id).populate('userId');
    if (!driver) return res.status(404).json({ success: false, message: 'Chauffeur non trouve' });
    var warning = { message: req.body.message || 'Avertissement', date: new Date(), issuedBy: req.user._id };
    if (!driver.warnings) driver.warnings = [];
    driver.warnings.push(warning);
    driver.totalWarnings = (driver.totalWarnings || 0) + 1;
    await driver.save();
    // TODO: Send push notification to driver
    var { sendPushNotification } = require('../services/pushService');
    if (driver.userId) {
      sendPushNotification(driver.userId._id || driver.userId, 'Avertissement TeranGO', warning.message, { type: 'warning' });
    }
    res.json({ success: true, message: 'Avertissement envoye', driver: driver });
  } catch (error) {
    console.error('Warn Driver Error:', error);
    res.status(500).json({ success: false, message: 'Erreur' });
  }
};
