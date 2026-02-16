var ServiceProvider = require('../models/ServiceProvider');
var ServiceRequest = require('../models/ServiceRequest');
var User = require('../models/User');

// ==================== SERVICE PROVIDERS ====================

// Register as service provider
exports.registerProvider = async function(req, res) {
  try {
    var existing = await ServiceProvider.findOne({ userId: req.user.id });
    if (existing) return res.status(400).json({ success: false, message: 'Deja inscrit comme prestataire' });

    var provider = new ServiceProvider({
      userId: req.user.id,
      fullName: req.body.fullName,
      phone: req.body.phone,
      photo: req.body.photo || '',
      nationalIdPhoto: req.body.nationalIdPhoto || '',
      serviceCategories: req.body.serviceCategories || [],
      description: req.body.description || '',
      experience: req.body.experience || 0,
      zones: req.body.zones || [],
      pricing: req.body.pricing || 'quote',
      hourlyRate: req.body.hourlyRate || 0,
      minimumFee: req.body.minimumFee || 2000,
      payoutMethod: req.body.payoutMethod || { type: 'wave' }
    });

    await provider.save();
    res.status(201).json({ success: true, data: provider });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get provider profile
exports.getProviderProfile = async function(req, res) {
  try {
    var provider = await ServiceProvider.findOne({ userId: req.user.id }).populate('userId', 'firstName lastName email phone');
    if (!provider) return res.status(404).json({ success: false, message: 'Profil non trouve' });
    res.json({ success: true, data: provider });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Update provider profile
exports.updateProviderProfile = async function(req, res) {
  try {
    var allowed = ['serviceCategories', 'description', 'experience', 'zones', 'pricing', 'hourlyRate', 'minimumFee', 'photo', 'payoutMethod', 'phone'];
    var updates = {};
    allowed.forEach(function(field) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    var provider = await ServiceProvider.findOneAndUpdate(
      { userId: req.user.id },
      { $set: updates },
      { new: true }
    );
    if (!provider) return res.status(404).json({ success: false, message: 'Profil non trouve' });
    res.json({ success: true, data: provider });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Toggle online/offline
exports.toggleOnline = async function(req, res) {
  try {
    var provider = await ServiceProvider.findOne({ userId: req.user.id });
    if (!provider) return res.status(404).json({ success: false, message: 'Profil non trouve' });
    if (provider.verificationStatus !== 'approved') return res.status(403).json({ success: false, message: 'Compte non verifie' });

    provider.isOnline = !provider.isOnline;
    if (req.body.latitude && req.body.longitude) {
      provider.currentLocation.coordinates = {
        latitude: req.body.latitude,
        longitude: req.body.longitude
      };
      provider.lastLocationUpdate = new Date();
    }
    await provider.save();
    res.json({ success: true, data: { isOnline: provider.isOnline } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Search providers by category & zone
exports.searchProviders = async function(req, res) {
  try {
    var query = { verificationStatus: 'approved', isAvailable: true };
    if (req.query.category) query.serviceCategories = req.query.category;
    if (req.query.zone) query.zones = req.query.zone;
    if (req.query.online === 'true') query.isOnline = true;

    var providers = await ServiceProvider.find(query)
      .select('fullName photo serviceCategories zones rating totalJobs experience minimumFee pricing hourlyRate isOnline')
      .sort({ rating: -1, totalJobs: -1 })
      .limit(20);

    res.json({ success: true, data: providers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== SERVICE REQUESTS ====================

// Create a service request
exports.createRequest = async function(req, res) {
  try {
    var request = new ServiceRequest({
      riderId: req.user.id,
      category: req.body.category,
      urgency: req.body.urgency || 'normal',
      scheduledDate: req.body.scheduledDate,
      scheduledTimeSlot: req.body.scheduledTimeSlot,
      location: {
        address: req.body.address,
        quartier: req.body.quartier || '',
        coordinates: {
          latitude: req.body.latitude,
          longitude: req.body.longitude
        }
      },
      description: req.body.description,
      photos: req.body.photos || [],
      voiceNote: req.body.voiceNote || '',
      estimatedCost: req.body.estimatedCost || 0,
      paymentMethod: req.body.paymentMethod || 'cash'
    });

    await request.save();

    // Notify available providers via Socket.io
    var io = req.app.get('io');
    if (io) {
      io.to('service-providers-' + req.body.category).emit('new-service-request', {
        requestId: request._id,
        category: request.category,
        urgency: request.urgency,
        quartier: request.location.quartier,
        description: request.description.substring(0, 100)
      });
    }

    res.status(201).json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get request details
exports.getRequest = async function(req, res) {
  try {
    var request = await ServiceRequest.findById(req.params.id)
      .populate('provider', 'fullName phone photo rating totalJobs serviceCategories')
      .populate('riderId', 'firstName lastName phone');
    if (!request) return res.status(404).json({ success: false, message: 'Demande non trouvee' });
    res.json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get user's service requests
exports.getMyRequests = async function(req, res) {
  try {
    var requests = await ServiceRequest.find({ riderId: req.user.id })
      .populate('provider', 'fullName phone photo rating')
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Provider: get available requests
exports.getAvailableRequests = async function(req, res) {
  try {
    var provider = await ServiceProvider.findOne({ userId: req.user.id });
    if (!provider) return res.status(404).json({ success: false, message: 'Profil non trouve' });

    var query = {
      status: 'pending',
      category: { $in: provider.serviceCategories }
    };
    if (provider.zones.length > 0) {
      query['location.quartier'] = { $in: provider.zones };
    }

    var requests = await ServiceRequest.find(query)
      .populate('riderId', 'firstName lastName')
      .sort({ urgency: -1, createdAt: 1 })
      .limit(20);

    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Provider: accept a request
exports.acceptRequest = async function(req, res) {
  try {
    var provider = await ServiceProvider.findOne({ userId: req.user.id });
    if (!provider) return res.status(404).json({ success: false, message: 'Profil non trouve' });

    var request = await ServiceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Demande non trouvee' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Demande deja prise en charge' });

    request.provider = provider._id;
    request.status = 'accepted';
    request.acceptedAt = new Date();
    if (req.body.quotedPrice) {
      request.quotedPrice = req.body.quotedPrice;
    }
    await request.save();

    // Notify customer
    var io = req.app.get('io');
    if (io) {
      io.to('service-' + request._id).emit('service-accepted', {
        requestId: request._id,
        provider: {
          name: provider.fullName,
          phone: provider.phone,
          photo: provider.photo,
          rating: provider.rating
        },
        quotedPrice: request.quotedPrice
      });
    }

    res.json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Provider: update request status
exports.updateRequestStatus = async function(req, res) {
  try {
    var request = await ServiceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Demande non trouvee' });

    var provider = await ServiceProvider.findOne({ userId: req.user.id });
    if (!provider || !request.provider.equals(provider._id)) {
      return res.status(403).json({ success: false, message: 'Non autorise' });
    }

    var validTransitions = {
      'accepted': ['en_route', 'cancelled'],
      'en_route': ['arrived', 'cancelled'],
      'arrived': ['in_progress', 'cancelled'],
      'in_progress': ['completed']
    };

    var newStatus = req.body.status;
    var allowed = validTransitions[request.status] || [];
    if (!allowed.includes(newStatus)) {
      return res.status(400).json({ success: false, message: 'Transition non valide: ' + request.status + ' -> ' + newStatus });
    }

    request.status = newStatus;

    // Set timestamps
    if (newStatus === 'en_route') request.enRouteAt = new Date();
    if (newStatus === 'arrived') request.arrivedAt = new Date();
    if (newStatus === 'in_progress') request.startedAt = new Date();
    if (newStatus === 'completed') {
      request.completedAt = new Date();
      request.finalPrice = req.body.finalPrice || request.quotedPrice;
      request.materialsCost = req.body.materialsCost || 0;
      request.platformCommission = Math.round(request.finalPrice * 0.15); // 15% commission
      request.providerEarnings = request.finalPrice - request.platformCommission;
      request.completionPhotos = req.body.completionPhotos || [];
      request.completionNotes = req.body.completionNotes || '';

      // Update provider stats
      provider.totalJobs += 1;
      provider.totalEarnings += request.providerEarnings;
      await provider.save();
    }
    if (newStatus === 'cancelled') {
      request.cancelledAt = new Date();
      request.cancelledBy = 'provider';
      request.cancellationReason = req.body.cancellationReason || '';
    }

    await request.save();

    // Notify customer
    var io = req.app.get('io');
    if (io) {
      io.to('service-' + request._id).emit('service-status-update', {
        requestId: request._id,
        status: newStatus,
        finalPrice: request.finalPrice,
        providerLocation: provider.currentLocation
      });
    }

    res.json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Customer: accept provider's quote
exports.acceptQuote = async function(req, res) {
  try {
    var request = await ServiceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Demande non trouvee' });
    if (request.riderId.toString() !== req.user.id) return res.status(403).json({ success: false, message: 'Non autorise' });

    request.quoteAccepted = true;
    request.finalPrice = request.quotedPrice;
    await request.save();

    var io = req.app.get('io');
    if (io) {
      io.to('service-' + request._id).emit('quote-accepted', { requestId: request._id });
    }

    res.json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Customer: rate the service
exports.rateService = async function(req, res) {
  try {
    var request = await ServiceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Demande non trouvee' });
    if (request.status !== 'completed') return res.status(400).json({ success: false, message: 'Service non termine' });

    request.rating = {
      rating: req.body.rating,
      review: req.body.review || ''
    };
    await request.save();

    // Update provider average rating
    var provider = await ServiceProvider.findById(request.provider);
    if (provider) {
      var newTotal = provider.totalRatings + 1;
      provider.rating = ((provider.rating * provider.totalRatings) + req.body.rating) / newTotal;
      provider.totalRatings = newTotal;
      await provider.save();
    }

    res.json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Customer: cancel request
exports.cancelRequest = async function(req, res) {
  try {
    var request = await ServiceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Demande non trouvee' });

    if (['completed', 'cancelled'].includes(request.status)) {
      return res.status(400).json({ success: false, message: 'Impossible d\'annuler' });
    }

    request.status = 'cancelled';
    request.cancelledAt = new Date();
    request.cancelledBy = 'rider';
    request.cancellationReason = req.body.reason || '';
    await request.save();

    var io = req.app.get('io');
    if (io) {
      io.to('service-' + request._id).emit('service-cancelled', {
        requestId: request._id,
        cancelledBy: 'rider'
      });
    }

    res.json({ success: true, message: 'Demande annulee' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== ADMIN ====================

// Get all providers (admin)
exports.getAllProviders = async function(req, res) {
  try {
    var query = {};
    if (req.query.status) query.verificationStatus = req.query.status;
    if (req.query.category) query.serviceCategories = req.query.category;

    var providers = await ServiceProvider.find(query)
      .populate('userId', 'firstName lastName email phone')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: providers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Approve/reject provider (admin)
exports.verifyProvider = async function(req, res) {
  try {
    var provider = await ServiceProvider.findById(req.params.id);
    if (!provider) return res.status(404).json({ success: false, message: 'Prestataire non trouve' });

    provider.verificationStatus = req.body.status; // 'approved' or 'rejected'
    if (req.body.status === 'rejected') {
      provider.rejectionReason = req.body.reason || '';
    }
    await provider.save();

    res.json({ success: true, data: provider });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get all service requests (admin)
exports.getAllRequests = async function(req, res) {
  try {
    var query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.category) query.category = req.query.category;

    var requests = await ServiceRequest.find(query)
      .populate('riderId', 'firstName lastName phone')
      .populate('provider', 'fullName phone')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Dashboard stats (admin)
exports.getServiceStats = async function(req, res) {
  try {
    var totalProviders = await ServiceProvider.countDocuments();
    var approvedProviders = await ServiceProvider.countDocuments({ verificationStatus: 'approved' });
    var pendingProviders = await ServiceProvider.countDocuments({ verificationStatus: 'pending' });
    var onlineProviders = await ServiceProvider.countDocuments({ isOnline: true });

    var totalRequests = await ServiceRequest.countDocuments();
    var pendingRequests = await ServiceRequest.countDocuments({ status: 'pending' });
    var completedRequests = await ServiceRequest.countDocuments({ status: 'completed' });
    var cancelledRequests = await ServiceRequest.countDocuments({ status: 'cancelled' });

    var revenueAgg = await ServiceRequest.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$platformCommission' }, volume: { $sum: '$finalPrice' } } }
    ]);

    var revenue = revenueAgg[0] || { total: 0, volume: 0 };

    res.json({
      success: true,
      data: {
        providers: { total: totalProviders, approved: approvedProviders, pending: pendingProviders, online: onlineProviders },
        requests: { total: totalRequests, pending: pendingRequests, completed: completedRequests, cancelled: cancelledRequests },
        revenue: { commission: revenue.total, volume: revenue.volume }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
