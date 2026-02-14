var Partner = require('../models/Partner');
var Driver = require('../models/Driver');
var User = require('../models/User');
var Ride = require('../models/Ride');
var Delivery = require('../models/Delivery');
var bcrypt = require('bcryptjs');

// @desc    Get partner dashboard stats
// @route   GET /api/partners/dashboard
// @access  Private (Partner)
exports.getDashboard = async function(req, res) {
  try {
    var partner = await Partner.findOne({ userId: req.user._id });
    if (!partner) {
      return res.status(404).json({ success: false, message: 'Partner profile not found' });
    }

    var drivers = await Driver.find({ partnerId: partner._id })
      .populate('userId', 'name phone');

    var activeDrivers = drivers.filter(function(d) { return d.isOnline; }).length;
    var approvedDrivers = drivers.filter(function(d) { return d.verificationStatus === 'approved'; }).length;
    var pendingDrivers = drivers.filter(function(d) { return d.verificationStatus === 'pending'; }).length;

    // Get today's earnings
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var todayRides = await Ride.find({
      partnerId: partner._id,
      status: 'completed',
      completedAt: { $gte: today }
    });

    var todayEarnings = todayRides.reduce(function(sum, ride) {
      return sum + (ride.partnerCommission || 0);
    }, 0);

    var todayRideCount = todayRides.length;

    res.status(200).json({
      success: true,
      dashboard: {
        businessName: partner.businessName,
        totalDrivers: drivers.length,
        activeDrivers: activeDrivers,
        approvedDrivers: approvedDrivers,
        pendingDrivers: pendingDrivers,
        totalEarnings: partner.totalEarnings,
        weeklyEarnings: partner.weeklyEarnings,
        todayEarnings: todayEarnings,
        todayRides: todayRideCount,
        commissionRate: partner.commissionRate
      }
    });
  } catch (error) {
    console.error('Partner dashboard error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get partner's drivers list
// @route   GET /api/partners/drivers
// @access  Private (Partner)
exports.getDrivers = async function(req, res) {
  try {
    var partner = await Partner.findOne({ userId: req.user._id });
    if (!partner) {
      return res.status(404).json({ success: false, message: 'Partner profile not found' });
    }

    var drivers = await Driver.find({ partnerId: partner._id })
      .populate('userId', 'name phone email profilePhoto')
      .sort({ createdAt: -1 });

    var driverList = [];
    for (var i = 0; i < drivers.length; i++) {
      var d = drivers[i];
      driverList.push({
        id: d._id,
        name: d.userId ? d.userId.name : 'Unknown',
        phone: d.userId ? d.userId.phone : '',
        vehicleType: d.vehicleType,
        verificationStatus: d.verificationStatus,
        isOnline: d.isOnline,
        totalEarnings: d.totalEarnings || 0,
        totalRides: d.totalRides || 0,
        createdAt: d.createdAt
      });
    }

    res.status(200).json({
      success: true,
      count: driverList.length,
      drivers: driverList
    });
  } catch (error) {
    console.error('Partner get drivers error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Partner registers a new driver
// @route   POST /api/partners/register-driver
// @access  Private (Partner)
exports.registerDriver = async function(req, res) {
  try {
    var partner = await Partner.findOne({ userId: req.user._id });
    if (!partner) {
      return res.status(404).json({ success: false, message: 'Partner profile not found' });
    }

    var { name, phone, pin, vehicleType } = req.body;

    if (!name || !phone || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone, and PIN are required'
      });
    }

    // Check if phone already exists
    var existingUser = await User.findOne({ phone: phone });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already registered'
      });
    }

    // Hash PIN
    var salt = await bcrypt.genSalt(10);
    var hashedPin = await bcrypt.hash(pin, salt);

    // Create user with driver role
    var user = await User.create({
      name: name,
      phone: phone,
      pin: hashedPin,
      role: 'driver',
      isActive: true
    });

    // Create driver profile linked to partner
    var driver = await Driver.create({
      userId: user._id,
      partnerId: partner._id,
      registeredBy: 'partner',
      vehicleType: vehicleType || 'car',
      verificationStatus: 'pending'
    });

    // Update partner driver count
    partner.totalDrivers = (partner.totalDrivers || 0) + 1;
    await partner.save();

    res.status(201).json({
      success: true,
      message: 'Driver registered successfully',
      driver: {
        id: driver._id,
        name: user.name,
        phone: user.phone,
        vehicleType: driver.vehicleType,
        verificationStatus: driver.verificationStatus,
        registeredBy: 'partner'
      }
    });
  } catch (error) {
    console.error('Partner register driver error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get partner earnings breakdown
// @route   GET /api/partners/earnings
// @access  Private (Partner)
exports.getEarnings = async function(req, res) {
  try {
    var partner = await Partner.findOne({ userId: req.user._id });
    if (!partner) {
      return res.status(404).json({ success: false, message: 'Partner profile not found' });
    }

    // Get rides with partner commission
    var rides = await Ride.find({
      partnerId: partner._id,
      status: 'completed'
    }).sort({ completedAt: -1 }).limit(50);

    // Per-driver breakdown
    var drivers = await Driver.find({ partnerId: partner._id })
      .populate('userId', 'name phone');

    var driverEarnings = [];
    for (var i = 0; i < drivers.length; i++) {
      var d = drivers[i];
      var driverRides = await Ride.find({
        driver: d._id,
        partnerId: partner._id,
        status: 'completed'
      });
      var totalPartnerEarning = driverRides.reduce(function(sum, r) {
        return sum + (r.partnerCommission || 0);
      }, 0);
      driverEarnings.push({
        driverId: d._id,
        name: d.userId ? d.userId.name : 'Unknown',
        phone: d.userId ? d.userId.phone : '',
        rideCount: driverRides.length,
        partnerEarnings: totalPartnerEarning
      });
    }

    // Weekly breakdown (last 7 days)
    var weeklyBreakdown = [0, 0, 0, 0, 0, 0, 0];
    var now = new Date();
    for (var j = 0; j < rides.length; j++) {
      var ride = rides[j];
      if (ride.completedAt) {
        var daysAgo = Math.floor((now - ride.completedAt) / (1000 * 60 * 60 * 24));
        if (daysAgo < 7) {
          weeklyBreakdown[6 - daysAgo] += (ride.partnerCommission || 0);
        }
      }
    }

    res.status(200).json({
      success: true,
      earnings: {
        totalEarnings: partner.totalEarnings,
        weeklyEarnings: partner.weeklyEarnings,
        commissionRate: partner.commissionRate,
        weeklyBreakdown: weeklyBreakdown,
        recentRides: rides.slice(0, 20).map(function(r) {
          return {
            rideId: r._id,
            fare: r.fare,
            partnerCommission: r.partnerCommission,
            completedAt: r.completedAt
          };
        }),
        driverBreakdown: driverEarnings
      }
    });
  } catch (error) {
    console.error('Partner earnings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get partner profile
// @route   GET /api/partners/profile
// @access  Private (Partner)
exports.getProfile = async function(req, res) {
  try {
    var partner = await Partner.findOne({ userId: req.user._id })
      .populate('userId', 'name phone email');

    if (!partner) {
      return res.status(404).json({ success: false, message: 'Partner profile not found' });
    }

    res.status(200).json({
      success: true,
      partner: {
        id: partner._id,
        name: partner.userId ? partner.userId.name : '',
        phone: partner.userId ? partner.userId.phone : '',
        email: partner.userId ? partner.userId.email : '',
        businessName: partner.businessName,
        businessPhone: partner.businessPhone,
        businessAddress: partner.businessAddress,
        commissionRate: partner.commissionRate,
        totalEarnings: partner.totalEarnings,
        weeklyEarnings: partner.weeklyEarnings,
        totalDrivers: partner.totalDrivers,
        isActive: partner.isActive,
        createdAt: partner.createdAt
      }
    });
  } catch (error) {
    console.error('Partner profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
