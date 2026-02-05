require('dotenv').config();
var express = require('express');
var http = require('http');
var socketIo = require('socket.io');
var cors = require('cors');
var connectDB = require('./config/db');
var RideMatchingService = require('./services/rideMatchingService');
var driverLocationService = require('./services/driverLocationService');

var app = express();
var server = http.createServer(app);
var io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

connectDB();

var matchingService = new RideMatchingService(io);
matchingService.setDriverLocationService(driverLocationService);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.set('io', io);
app.set('matchingService', matchingService);
app.set('driverLocationService', driverLocationService);

// Routes
var authRoutes = require('./routes/authRoutes');
var rideRoutes = require('./routes/rideRoutes');
var driverRoutes = require('./routes/driverRoutes');
var adminRoutes = require('./routes/adminRoutes');
var restaurantRoutes = require('./routes/restaurantRoutes');
var deliveryRoutes = require('./routes/deliveryRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/orders', require('./routes/orderRoutes'));


// Health check
app.get('/health', function(req, res) {
  driverLocationService.getOnlineDriversCount().then(function(onlineDrivers) {
    res.json({ status: 'ok', onlineDrivers: onlineDrivers, timestamp: new Date().toISOString() });
  });
});

// Socket.io
io.on('connection', function(socket) {
  console.log('✓ Socket connected:', socket.id);

  socket.on('driver-online', function(data) {
    var driverId = data.driverId;
    var latitude = data.latitude;
    var longitude = data.longitude;
    var vehicle = data.vehicle;
    var rating = data.rating;
    socket.join('driver-' + driverId);
    socket.join('online-drivers');
    socket.driverId = driverId;

    driverLocationService.setDriverOnline(driverId, latitude, longitude, { vehicle: vehicle, rating: rating }).then(function() {
      io.to('riders-watching').emit('driver-came-online', { driverId: driverId, location: { latitude: latitude, longitude: longitude } });
    });
  });

  socket.on('driver-offline', function(driverId) {
    socket.leave('driver-' + driverId);
    socket.leave('online-drivers');
    driverLocationService.setDriverOffline(driverId).then(function() {
      io.to('riders-watching').emit('driver-went-offline', { driverId: driverId });
    });
  });

  socket.on('driver-location-update', function(data) {
    var driverId = data.driverId;
    var latitude = data.latitude;
    var longitude = data.longitude;
    var rideId = data.rideId;
    var vehicle = data.vehicle;
    var rating = data.rating;

    driverLocationService.updateDriverLocation(driverId, latitude, longitude, { vehicle: vehicle, rating: rating }).then(function() {
      if (rideId) {
        io.to(rideId).emit('driver-location-update', { driverId: driverId, location: { latitude: latitude, longitude: longitude }, timestamp: Date.now() });
      }
      io.to('riders-watching').emit('nearby-driver-location', { driverId: driverId, location: { latitude: latitude, longitude: longitude }, timestamp: Date.now() });
    });
  });

  socket.on('rider-watching-drivers', function() {
    socket.join('riders-watching');
    console.log('Rider ' + socket.id + ' watching for drivers');
  });

  socket.on('rider-stop-watching', function() {
    socket.leave('riders-watching');
  });

  socket.on('join-ride-room', function(rideId) {
    socket.join(rideId);
    console.log('Socket ' + socket.id + ' joined ride: ' + rideId);
  });

  socket.on('leave-ride-room', function(rideId) {
    socket.leave(rideId);
  });

  // Delivery rooms
  socket.on('join-delivery-room', function(deliveryId) {
    socket.join(deliveryId);
    console.log('Socket ' + socket.id + ' joined delivery: ' + deliveryId);
  });

  socket.on('leave-delivery-room', function(deliveryId) {
    socket.leave(deliveryId);
  });

  // Order rooms
  socket.on('join-order-room', function(orderId) {
    socket.join(orderId);
    console.log('Socket ' + socket.id + ' joined order: ' + orderId);
  });

  socket.on('leave-order-room', function(orderId) {
    socket.leave(orderId);
  });

  socket.on('disconnect', function() {
    console.log('✓ Socket disconnected:', socket.id);
    if (socket.driverId) {
      driverLocationService.setDriverOffline(socket.driverId).then(function() {
        io.to('riders-watching').emit('driver-went-offline', { driverId: socket.driverId });
      });
    }
  });
});

var PORT = process.env.PORT || 5000;

server.listen(PORT, function() {
  console.log('\n🚀 TeranGO Backend Running on port ' + PORT);
  console.log('   📡 Redis: Upstash (Production)');
  console.log('   🔌 WebSocket: Active');
  console.log('   ⏱️  Driver TTL: 60 seconds');
  console.log('   🍽️  Thiak Thiak: Colis + Commande + Resto');
});

