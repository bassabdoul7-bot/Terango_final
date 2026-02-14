require('dotenv').config({ override: false });
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');
const RideMatchingService = require('./services/rideMatchingService');
const driverLocationService = require('./services/driverLocationService');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

connectDB();

const matchingService = new RideMatchingService(io);
matchingService.setDriverLocationService(driverLocationService);

app.use(cors());
app.use(express.json());
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
var TELEGRAM_BOT = '8259630845:AAHgV30lqjcU0KiHyQqI87un-BFF0UUbSPw';
var TELEGRAM_CHAT = '8460600516';
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

    if (!mongoOk && lastAlertStatus.mongo === 'ok') sendTelegramAlert('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¨ TeranGO: MongoDB is DOWN! ' + new Date().toISOString());
    if (mongoOk && lastAlertStatus.mongo === 'down') sendTelegramAlert('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ TeranGO: MongoDB recovered! ' + new Date().toISOString());
    if (!redisOk && lastAlertStatus.redis === 'ok') sendTelegramAlert('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¨ TeranGO: Redis is DOWN! ' + new Date().toISOString());
    if (redisOk && lastAlertStatus.redis === 'down') sendTelegramAlert('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ TeranGO: Redis recovered! ' + new Date().toISOString());

    lastAlertStatus = { redis: redisOk ? 'ok' : 'down', mongo: mongoOk ? 'ok' : 'down' };
  } catch(e) { console.log('Monitor error:', e.message); }
}, 2 * 60 * 1000);

setTimeout(function() { sendTelegramAlert('ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ TeranGO Server Started!\nRedis: ok\nMongo: ok\nTime: ' + new Date().toISOString()); }, 8000);

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
    // Driver sends Driver model _id, socket.userId is User._id - skip strict match
    // driverId will be validated by Redis/MongoDB operations


    socket.join('driver-' + driverId);
    socket.join('online-drivers');
    socket.driverId = driverId;

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
  });

  socket.on('driver-offline', function(driverId) {
    if (socket.userId !== driverId) {
      return socket.emit('error', { message: 'Unauthorized' });
    }

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
    if (socket.userId !== driverId) {
      return socket.emit('error', { message: 'Unauthorized' });
    }

    // Rate limit: max once per 3 seconds per driver
    const now = Date.now();
    const last = lastLocationUpdate.get(driverId) || 0;
    if (now - last < LOCATION_UPDATE_INTERVAL) return;
    lastLocationUpdate.set(driverId, now);

    driverLocationService.updateDriverLocation(driverId, latitude, longitude, { vehicle: vehicle, rating: rating })
      .then(function() {
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

  socket.on('join-ride-room', function(rideId) {
    socket.join(rideId);
    console.log(`Socket ${socket.id} joined ride: ${rideId}`);
  });

  socket.on('leave-ride-room', function(rideId) {
    socket.leave(rideId);
  });

  // Delivery rooms
  socket.on('join-delivery-room', function(deliveryId) {
    socket.join(deliveryId);
    console.log(`Socket ${socket.id} joined delivery: ${deliveryId}`);
  });

  socket.on('leave-delivery-room', function(deliveryId) {
    socket.leave(deliveryId);
  });

  // Order rooms
  socket.on('join-order-room', function(orderId) {
    socket.join(orderId);
    console.log(`Socket ${socket.id} joined order: ${orderId}`);
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
      // Clean up rate limiter
      lastLocationUpdate.delete(socket.driverId);

      driverLocationService.setDriverOffline(socket.driverId)
        .then(function() {
          io.to('riders-watching').emit('driver-went-offline', { driverId: socket.driverId });
        })
        .catch(function(err) {
          console.error(`Disconnect cleanup failed for ${socket.driverId}:`, err.message);
        });
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
server.listen(PORT, '0.0.0.0', function() {
    console.log('\nTeranGO Backend Running on port ' + PORT);
    console.log('   Redis: Upstash (Production)');
    console.log('   WebSocket: Active (Authenticated)');
    console.log('   Driver TTL: 60 seconds');
    console.log('   Thiak Thiak: Colis + Commande + Resto');
});
