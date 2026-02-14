var Partner = require('../models/Partner');
var bcrypt = require('bcryptjs');
﻿const User = require('../models/User');
const Driver = require('../models/Driver');
const Rider = require('../models/Rider');
const Ride = require('../models/Ride');

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
exports.getDashboardStats = async (req, res) => {
  try {
    // Total counts
    const totalRiders = await Rider.countDocuments();
    const totalDrivers = await Driver.countDocuments();
    const totalRides = await Ride.countDocuments();
    
    // Active drivers
    const activeDrivers = await Driver.countDocuments({ isOnline: true });
    
    // Pending verifications
    const pendingVerifications = await Driver.countDocuments({ 
      verificationStatus: 'pending' 
    });
    
    // Today's rides
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayRides = await Ride.countDocuments({
      createdAt: { $gte: today }
    });
    
    // Revenue calculation
    const completedRides = await Ride.find({ status: 'completed' });
    const totalRevenue = completedRides.reduce(
      (sum, ride) => sum + ride.platformCommission, 
      0
    );
    
    // Today's revenue
    const todayCompletedRides = completedRides.filter(
      ride => ride.completedAt >= today
    );
    const todayRevenue = todayCompletedRides.reduce(
      (sum, ride) => sum + ride.platformCommission,
      0
    );

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
        todayRevenue
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
      .populate('riderId', 'userId')
      .populate('driverId', 'userId vehicle')
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
    
    const rides = await Ride.find(query);
    
    const analytics = {
      totalRides: rides.length,
      totalFare: rides.reduce((sum, ride) => sum + ride.fare, 0),
      totalCommission: rides.reduce((sum, ride) => sum + ride.platformCommission, 0),
      totalDriverEarnings: rides.reduce((sum, ride) => sum + ride.driverEarnings, 0),
      averageFare: rides.length > 0 
        ? rides.reduce((sum, ride) => sum + ride.fare, 0) / rides.length 
        : 0,
      ridesByType: {
        standard: rides.filter(r => r.rideType === 'standard').length,
        comfort: rides.filter(r => r.rideType === 'comfort').length,
        xl: rides.filter(r => r.rideType === 'xl').length
      }
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
