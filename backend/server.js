require('dotenv').config({ override: false });
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');
const { protect } = require('./middleware/auth');
const RideMatchingService = require('./services/rideMatchingService');
const driverLocationService = require('./services/driverLocationService');

const app = express();
const server = http.createServer(app);

// CORS whitelist
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['https://admin.terango.sn', 'https://terango.sn'];

const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV !== 'production' ? '*' : allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

connectDB();

const matchingService = new RideMatchingService(io);
matchingService.setDriverLocationService(driverLocationService);

app.use(cors({
  origin: process.env.NODE_ENV !== 'production'
    ? true
    : function(origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
  credentials: true
}));

// Security headers
app.use(helmet());

// General API rate limit: 100 requests per 15 minutes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api', generalLimiter);

// Auth endpoints rate limit: 10 requests per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts, please try again later.' }
});
app.use('/api/auth', authLimiter);

// Body size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static('uploads'));

app.set('io', io);
app.set('matchingService', matchingService);
app.set('driverLocationService', driverLocationService);

// Routes
const authRoutes = require('./routes/authRoutes');
const rideRoutes = require('./routes/rideRoutes');
const driverRoutes = require('./routes/driverRoutes');
const adminRoutes = require('./routes/adminRoutes');
const restaurantRoutes = require('./routes/restaurantRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const partnerRoutes = require('./routes/partnerRoutes');

app.get('/', function(req, res) { res.json({ app: 'TeranGO API', status: 'running' }); });

app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/services', require('./routes/serviceRoutes'));

// Feedback endpoint (authenticated)
app.post('/api/errors/feedback', protect, async (req, res) => {
  try {
    var db = require('mongoose').connection.db;
    await db.collection('feedbacks').insertOne({
      message: req.body.message,
      screen: req.body.screen,
      userId: req.body.userId,
      userName: req.body.userName,
      userPhone: req.body.userPhone,
      app: req.body.app || 'rider',
      createdAt: new Date()
    });
    res.json({ success: true });
  } catch (e) {
    console.error('Feedback error:', e);
    res.status(500).json({ success: false });
  }
});

// Health check
async function healthCheck(req, res) {
  var checks = { redis: 'down', mongo: 'down', onlineDrivers: 0 };
  try { checks.onlineDrivers = await driverLocationService.getOnlineDriversCount(); checks.redis = 'ok'; } catch (e) {}
  try { var state = require('mongoose').connection.readyState; checks.mongo = state === 1 ? 'ok' : 'connecting'; } catch (e) {}
  var healthy = checks.redis === 'ok' && checks.mongo === 'ok';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    version: '1.0.0',
    uptime: Math.floor(process.uptime()) + 's',
    checks: checks,
    timestamp: new Date().toISOString()
  });
}
app.get('/health', healthCheck);
app.get('/api/health', healthCheck);

// ========== TELEGRAM ALERTS ==========
var TELEGRAM_BOT = process.env.TELEGRAM_BOT_TOKEN || '';
var TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '';
var lastAlertStatus = { redis: 'ok', mongo: 'ok' };

function sendTelegramAlert(msg) {
  var https = require('https');
  var data = JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg });
  var opts = { hostname: 'api.telegram.org', path: '/bot' + TELEGRAM_BOT + '/sendMessage', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
  var r = https.request(opts, function() {});
  r.on('error', function(e) { console.log('Telegram error:', e.message); });
  r.write(data);
  r.end();
}

setInterval(async function() {
  try {
    var mongoOk = require('mongoose').connection.readyState === 1;
    var redisOk = true;
    try { await driverLocationService.getOnlineDriversCount(); } catch(e) { redisOk = false; }

    if (!mongoOk && lastAlertStatus.mongo === 'ok') sendTelegramAlert('🚨 TeranGO: MongoDB is DOWN! ' + new Date().toISOString());
    if (mongoOk && lastAlertStatus.mongo === 'down') sendTelegramAlert('✅ TeranGO: MongoDB recovered! ' + new Date().toISOString());
    if (!redisOk && lastAlertStatus.redis === 'ok') sendTelegramAlert('🚨 TeranGO: Redis is DOWN! ' + new Date().toISOString());
    if (redisOk && lastAlertStatus.redis === 'down') sendTelegramAlert('✅ TeranGO: Redis recovered! ' + new Date().toISOString());

    lastAlertStatus = { redis: redisOk ? 'ok' : 'down', mongo: mongoOk ? 'ok' : 'down' };
  } catch(e) { console.log('Monitor error:', e.message); }
}, 2 * 60 * 1000);

setTimeout(function() { sendTelegramAlert('🚀 TeranGO Server Started!\nRedis: ok\nMongo: ok\nTime: ' + new Date().toISOString()); }, 8000);

// Self-ping every 4 minutes to prevent Fly auto-stop
setInterval(function() {
  require('http').get('http://localhost:5000/health', function(res) {
    console.log('Self-ping: ' + res.statusCode);
  }).on('error', function() {});
}, 4 * 60 * 1000);

// Global error handler
app.use(function(err, req, res, next) {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// ========== Auto-expire stale rides (every 5 min) ==========
setInterval(function() {
  var RideModel = require("./models/Ride");
  var cutoff = new Date(Date.now() - 10 * 60 * 1000);
  RideModel.updateMany(
    { status: { "\u0024in": ["pending", "accepted"] }, createdAt: { "\u0024lt": cutoff } },
    { "\u0024set": { status: "cancelled", cancellationReason: "Auto-expired after 10 minutes" } }
  ).then(function(r) { if (r.modifiedCount > 0) console.log("Auto-expired", r.modifiedCount, "stale rides"); }).catch(function() {});

  // ========== Auto-complete zombie in_progress rides (3+ hours) ==========
  (async function() {
    try {
      var ZombieRide = require('./models/Ride');
      var threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      var zombieRides = await ZombieRide.find({ status: 'in_progress', startedAt: { $lt: threeHoursAgo } });
      for (var i = 0; i < zombieRides.length; i++) {
        var ride = zombieRides[i];
        ride.status = 'completed';
        ride.completedAt = new Date();
        // Calculate earnings from the fare already on the ride if not set
        if (!ride.driverEarnings && ride.fare) {
          ride.platformCommission = Math.round(ride.fare * 0.15);
          ride.driverEarnings = ride.fare - ride.platformCommission;
        }
        await ride.save();
        console.log('Auto-completed zombie ride ' + ride._id + ' (started ' + ride.startedAt + ')');
      }
    } catch (e) {
      console.error('Zombie ride cleanup error:', e.message);
    }
  })();
}, 5 * 60 * 1000);


// ========== Socket.io Authentication ==========
io.use(function(socket, next) {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId || decoded.id;
    socket.userType = decoded.userType;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

// ========== Rate Limiter for Location Updates ==========
const lastLocationUpdate = new Map();
const LOCATION_UPDATE_INTERVAL = 3000; // 3 seconds minimum

// ========== Socket.io Events ==========
io.on('connection', function(socket) {
    console.log('Socket connected: ' + socket.id + ' (user: ' + socket.userId + ')');

  socket.on('driver-online', function(data) {
    const driverId = data.driverId;
    const latitude = data.latitude;
    const longitude = data.longitude;
    const vehicle = data.vehicle;
    const rating = data.rating;

    // Verify driver identity
    var DriverModel = require('./models/Driver');
    DriverModel.findById(driverId).then(function(drv) {
      if (!drv) {
        socket.emit('error', { message: 'Driver not found' });
        return;
      }
      if (drv.userId.toString() !== socket.userId) {
        socket.emit('error', { message: 'Driver identity mismatch' });
        return;
      }

      // Check commission debt before allowing online
      if (drv.isBlockedForPayment) {
        socket.emit('blocked-for-payment', {
          balance: drv.commissionBalance,
          cap: drv.commissionCap || 2000,
          message: 'Veuillez payer votre solde de commission pour continuer'
        });
      }

      socket.join('driver-' + driverId);
      socket.join('online-drivers');
      socket.driverId = driverId;

      require('./models/Driver').findByIdAndUpdate(driverId, { lastLocationUpdate: new Date(), isOnline: true }).catch(function(){});
      driverLocationService.setDriverOnline(driverId, latitude, longitude, { vehicle: vehicle, rating: rating })
        .then(function() {
          io.to('riders-watching').emit('driver-came-online', {
            driverId: driverId,
            location: { latitude: latitude, longitude: longitude }
          });
        })
        .catch(function(err) {
          console.error('Driver online failed for ' + driverId + ':', err.message);
          socket.emit('error', { message: 'Failed to go online' });
        });
    }).catch(function(err) {
      console.error('Driver identity check failed:', err.message);
      socket.emit('error', { message: 'Failed to verify driver identity' });
    });
  });

  socket.on('driver-offline', function(driverId) {

    socket.leave('driver-' + driverId);
    socket.leave('online-drivers');

    driverLocationService.setDriverOffline(driverId)
      .then(function() {
        io.to('riders-watching').emit('driver-went-offline', { driverId: driverId });
      })
      .catch(function(err) {
        console.error(`Driver offline failed for ${driverId}:`, err.message);
      });
  });

  socket.on('driver-location-update', function(data) {
    const driverId = data.driverId;
    const latitude = data.latitude;
    const longitude = data.longitude;
    const rideId = data.rideId;
    const vehicle = data.vehicle;
    const rating = data.rating;

    // Verify identity

    // Rate limit: max once per 3 seconds per driver
    const now = Date.now();
    const last = lastLocationUpdate.get(driverId) || 0;
    if (now - last < LOCATION_UPDATE_INTERVAL) return;
    lastLocationUpdate.set(driverId, now);

    driverLocationService.updateDriverLocation(driverId, latitude, longitude, { vehicle: vehicle, rating: rating })
      .then(function() {
        require('./models/Driver').findByIdAndUpdate(driverId, { lastLocationUpdate: new Date() }).catch(function(){});
        if (rideId) {
          io.to(rideId).emit('driver-location-update', {
            driverId: driverId,
            location: { latitude: latitude, longitude: longitude },
            timestamp: now
          });
        }
        io.to('riders-watching').emit('nearby-driver-location', {
          driverId: driverId,
          location: { latitude: latitude, longitude: longitude },
          timestamp: now
        });
      })
      .catch(function(err) {
        console.error(`Location update failed for ${driverId}:`, err.message);
      });
  });

  socket.on('rider-watching-drivers', function() {
    socket.join('riders-watching');
    console.log(`Rider ${socket.id} watching for drivers`);
  });

  socket.on('rider-stop-watching', function() {
    socket.leave('riders-watching');
  });

  socket.on('join-ride-room', async function(rideId) {
    try {
      var Ride = require('./models/Ride');
      var Rider = require('./models/Rider');
      var Driver = require('./models/Driver');
      var ride = await Ride.findById(rideId);
      if (!ride) return socket.emit('error', { message: 'Ride not found' });

      // Check if user is the rider or the driver for this ride
      var rider = await Rider.findOne({ _id: ride.riderId, userId: socket.userId });
      var driver = ride.driver ? await Driver.findOne({ _id: ride.driver, userId: socket.userId }) : null;
      if (!rider && !driver) {
        return socket.emit('error', { message: 'Not authorized to join this ride room' });
      }

      socket.join(rideId);
      console.log(`Socket ${socket.id} joined ride: ${rideId}`);
    } catch (err) {
      console.error('join-ride-room error:', err.message);
      socket.emit('error', { message: 'Failed to join ride room' });
    }
  });

  socket.on('leave-ride-room', function(rideId) {
    socket.leave(rideId);
  });

  // Delivery rooms
  socket.on('join-delivery-room', async function(deliveryId) {
    try {
      var Delivery = require('./models/Delivery');
      var Rider = require('./models/Rider');
      var Driver = require('./models/Driver');
      var delivery = await Delivery.findById(deliveryId);
      if (!delivery) return socket.emit('error', { message: 'Delivery not found' });

      var rider = await Rider.findOne({ _id: delivery.riderId, userId: socket.userId });
      var driver = delivery.driver ? await Driver.findOne({ _id: delivery.driver, userId: socket.userId }) : null;
      if (!rider && !driver) {
        return socket.emit('error', { message: 'Not authorized to join this delivery room' });
      }

      socket.join(deliveryId);
      console.log(`Socket ${socket.id} joined delivery: ${deliveryId}`);
    } catch (err) {
      console.error('join-delivery-room error:', err.message);
      socket.emit('error', { message: 'Failed to join delivery room' });
    }
  });

  socket.on('leave-delivery-room', function(deliveryId) {
    socket.leave(deliveryId);
  });

  // Order rooms
  socket.on('join-order-room', async function(orderId) {
    try {
      var Order = require('./models/Order');
      var Rider = require('./models/Rider');
      var Driver = require('./models/Driver');
      var order = await Order.findById(orderId);
      if (!order) return socket.emit('error', { message: 'Order not found' });

      var rider = await Rider.findOne({ _id: order.riderId, userId: socket.userId });
      var driver = order.driver ? await Driver.findOne({ _id: order.driver, userId: socket.userId }) : null;
      if (!rider && !driver) {
        return socket.emit('error', { message: 'Not authorized to join this order room' });
      }

      socket.join(orderId);
      console.log(`Socket ${socket.id} joined order: ${orderId}`);
    } catch (err) {
      console.error('join-order-room error:', err.message);
      socket.emit('error', { message: 'Failed to join order room' });
    }
  });

  socket.on('leave-order-room', function(orderId) {
    socket.leave(orderId);
  });


  // ========== CHAT ==========
  var Message = require("./models/Message");

  socket.on('chat-message', function(data) {
    if (!data.text || !data.text.trim()) return;
    var roomId = data.rideId || data.deliveryId;
    if (!roomId) return;

    var msg = new Message({
      rideId: data.rideId || null,
      deliveryId: data.deliveryId || null,
      senderId: socket.userId,
      senderRole: data.senderRole,
      text: data.text.trim().substring(0, 500),
    });

    msg.save().then(function(saved) {
      io.to(roomId).emit('new-chat-message', {
        _id: saved._id,
        rideId: saved.rideId,
        deliveryId: saved.deliveryId,
        senderId: saved.senderId,
        senderRole: saved.senderRole,
        text: saved.text,
        createdAt: saved.createdAt,
      });
    }).catch(function(err) {
      console.log('Chat save error:', err.message);
    });
  });

  socket.on('chat-history', function(data) {
    var query = {};
    if (data.rideId) query.rideId = data.rideId;
    else if (data.deliveryId) query.deliveryId = data.deliveryId;
    else return;

    Message.find(query).sort({ createdAt: 1 }).limit(100).then(function(messages) {
      socket.emit('chat-history-response', messages);
    }).catch(function(err) {
      console.log('Chat history error:', err.message);
    });
  });

  socket.on('disconnect', function() {
    console.log('Socket disconnected: ' + socket.id);
    if (socket.driverId) {
      var dId = socket.driverId;
      lastLocationUpdate.delete(dId);
      setTimeout(function() {
        var activeSocket = Array.from(io.sockets.sockets.values()).find(function(s) { return s.driverId === dId; });
        if (!activeSocket) {
          driverLocationService.setDriverOffline(dId)
            .then(function() {
              io.to('riders-watching').emit('driver-went-offline', { driverId: dId });
              console.log('Driver ' + dId + ' set offline after 60s timeout');
            })
            .catch(function(err) {
              console.error('Disconnect cleanup failed for ' + dId + ':', err.message);
            });

          // Check if driver has an active ride and notify rider
          var RideModelDc = require('./models/Ride');
          RideModelDc.findOne({ driver: dId, status: { $in: ['accepted', 'arrived', 'in_progress'] } })
            .then(function(activeRide) {
              if (!activeRide) return;
              io.to(activeRide._id.toString()).emit('driver-disconnected', {
                rideId: activeRide._id,
                driverId: dId,
                message: 'Le chauffeur a été déconnecté'
              });
              console.log('Notified rider of driver disconnect for ride ' + activeRide._id);

              // Second timeout: 5 minutes total (4 more minutes from now) — cancel ride if driver still absent
              setTimeout(function() {
                var stillConnected = Array.from(io.sockets.sockets.values()).find(function(s) { return s.driverId === dId; });
                if (stillConnected) {
                  console.log('Driver ' + dId + ' reconnected before ride cancellation');
                  return;
                }
                RideModelDc.findById(activeRide._id).then(function(ride) {
                  if (!ride || !['accepted', 'arrived', 'in_progress'].includes(ride.status)) return;
                  ride.status = 'cancelled';
                  ride.cancellationReason = 'Chauffeur déconnecté';
                  ride.cancelledAt = new Date();
                  return ride.save().then(function() {
                    io.to(ride._id.toString()).emit('ride-cancelled', {
                      rideId: ride._id,
                      reason: 'Chauffeur déconnecté'
                    });
                    console.log('Auto-cancelled ride ' + ride._id + ' due to driver disconnect');
                    // Notify rider via push
                    var RiderModelDc = require('./models/Rider');
                    RiderModelDc.findById(ride.riderId).then(function(rider) {
                      if (rider) {
                        var { sendPushNotification } = require('./services/pushService');
                        sendPushNotification(rider.userId, 'Course annulée', 'Votre course a été annulée car le chauffeur a été déconnecté.', { type: 'ride-cancelled', rideId: ride._id.toString() });
                      }
                    }).catch(function() {});
                  });
                }).catch(function(err) {
                  console.error('Ride cancel after disconnect failed:', err.message);
                });
              }, 4 * 60 * 1000); // 4 more minutes (5 total from disconnect)
            })
            .catch(function(err) {
              console.error('Active ride check on disconnect failed:', err.message);
            });
        } else {
          console.log('Driver ' + dId + ' reconnected, skipping offline');
        }
      }, 60000);
    }
  });
});

// ========== Graceful Shutdown ==========
const gracefulShutdown = async function(signal) {
    console.log(signal + ' received. Shutting down gracefully...');

  // Close socket connections
  io.close();

  // Disconnect Redis
  await driverLocationService.disconnect();

  // Close HTTP server
  server.close(function() {
    console.log('Server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(function() {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', function() { gracefulShutdown('SIGTERM'); });
process.on('SIGINT', function() { gracefulShutdown('SIGINT'); });

const PORT = process.env.PORT || 5000;
// Auto-offline stale drivers every 5 minutes
var staleDriverCleanup = setInterval(async function() {
  try {
    var Driver = require('./models/Driver');
    var tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    var result = await Driver.updateMany(
      { isOnline: true, lastLocationUpdate: { $lt: tenMinAgo } },
      { isOnline: false, isAvailable: false }
    );
    if (result.modifiedCount > 0) console.log('Auto-offlined ' + result.modifiedCount + ' stale drivers');
  } catch(e) {}
}, 5 * 60 * 1000);

// ========== Midnight commission blocking (Senegal time UTC+0) ==========
function scheduleMidnightCommissionCheck() {
  var now = new Date();
  var nextMidnight = new Date(now);
  nextMidnight.setUTCHours(24, 0, 0, 0); // next midnight UTC
  var msUntilMidnight = nextMidnight.getTime() - now.getTime();

  setTimeout(function() {
    runCommissionBlockCheck();
    // Then repeat every 24 hours
    setInterval(runCommissionBlockCheck, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);

  console.log('Commission check scheduled in ' + Math.round(msUntilMidnight / 60000) + ' minutes (midnight UTC)');
}

async function runCommissionBlockCheck() {
  try {
    var DriverModel = require('./models/Driver');
    var { sendPushNotification } = require('./services/pushService');
    var drivers = await DriverModel.find({ commissionBalance: { $gt: 0 }, isBlockedForPayment: false });
    console.log('Midnight commission check: ' + drivers.length + ' drivers with unpaid commission');
    for (var i = 0; i < drivers.length; i++) {
      var drv = drivers[i];
      drv.isBlockedForPayment = true;
      await drv.save();
      sendPushNotification(drv.userId, 'Commission due', 'Votre commission de ' + drv.commissionBalance + ' FCFA est due. Payez pour reprendre les courses demain.', { type: 'commission-blocked' });
    }
  } catch (e) {
    console.error('Midnight commission check error:', e.message);
  }
}

scheduleMidnightCommissionCheck();

server.listen(PORT, '0.0.0.0', function() {
    console.log('\nTeranGO Backend Running on port ' + PORT);
    console.log('   Redis: Upstash (Production)');
    console.log('   WebSocket: Active (Authenticated)');
    console.log('   Driver TTL: 60 seconds');
    console.log('   Thiak Thiak: Colis + Commande + Resto');

    // ========== Startup Recovery: clean up stale rides & deliveries from crash ==========
    (async function startupRecovery() {
      try {
        var RideRecover = require('./models/Ride');
        var DeliveryRecover = require('./models/Delivery');
        var twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

        // Cancel stale rides (active but not updated in 2+ hours)
        var rideResult = await RideRecover.updateMany(
          { status: { $in: ['accepted', 'arrived', 'in_progress'] }, updatedAt: { $lt: twoHoursAgo } },
          { $set: { status: 'cancelled', cancellationReason: 'Course expirée - redémarrage serveur', cancelledAt: new Date() } }
        );
        if (rideResult.modifiedCount > 0) {
          console.log('Startup recovery: cancelled ' + rideResult.modifiedCount + ' stale rides');
        }

        // Cancel stale deliveries (active but not updated in 2+ hours)
        var deliveryResult = await DeliveryRecover.updateMany(
          { status: { $in: ['accepted', 'at_pickup', 'picked_up', 'at_dropoff'] }, updatedAt: { $lt: twoHoursAgo } },
          { $set: { status: 'cancelled', cancellationReason: 'Livraison expirée - redémarrage serveur', cancelledAt: new Date() } }
        );
        if (deliveryResult.modifiedCount > 0) {
          console.log('Startup recovery: cancelled ' + deliveryResult.modifiedCount + ' stale deliveries');
        }
      } catch (e) {
        console.error('Startup recovery error:', e.message);
      }
    })();
});



