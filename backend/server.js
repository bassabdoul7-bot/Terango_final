require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const RideMatchingService = require('./services/rideMatchingService');
const driverLocationService = require('./services/driverLocationService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Connect to MongoDB
connectDB();

// Initialize ride matching service
const matchingService = new RideMatchingService(io);
matchingService.setDriverLocationService(driverLocationService);

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Make io, matchingService, and driverLocationService accessible to routes
app.set('io', io);
app.set('matchingService', matchingService);
app.set('driverLocationService', driverLocationService);

// Routes
const authRoutes = require('./routes/authRoutes');
const rideRoutes = require('./routes/rideRoutes');
const driverRoutes = require('./routes/driverRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/health', async (req, res) => {
  const onlineDrivers = await driverLocationService.getOnlineDriversCount();
  res.json({ status: 'ok', onlineDrivers, timestamp: new Date().toISOString() });
});

// Socket.io
io.on('connection', (socket) => {
  console.log('✓ Socket connected:', socket.id);

  // Driver goes online
  socket.on('driver-online', async (data) => {
    const { driverId, latitude, longitude, vehicle, rating } = data;
    socket.join(`driver-${driverId}`);
    socket.join('online-drivers');
    socket.driverId = driverId;
    
    await driverLocationService.setDriverOnline(driverId, latitude, longitude, { vehicle, rating });
    io.to('riders-watching').emit('driver-came-online', { driverId, location: { latitude, longitude } });
  });

  // Driver goes offline
  socket.on('driver-offline', async (driverId) => {
    socket.leave(`driver-${driverId}`);
    socket.leave('online-drivers');
    await driverLocationService.setDriverOffline(driverId);
    io.to('riders-watching').emit('driver-went-offline', { driverId });
  });

  // Driver location update
  socket.on('driver-location-update', async (data) => {
    const { driverId, latitude, longitude, rideId, vehicle, rating } = data;
    
    await driverLocationService.updateDriverLocation(driverId, latitude, longitude, { vehicle, rating });
    
    if (rideId) {
      io.to(rideId).emit('driver-location-update', { driverId, location: { latitude, longitude }, timestamp: Date.now() });
    }
    io.to('riders-watching').emit('nearby-driver-location', { driverId, location: { latitude, longitude }, timestamp: Date.now() });
  });

  // Rider watching
  socket.on('rider-watching-drivers', () => {
    socket.join('riders-watching');
    console.log(`Rider ${socket.id} watching for drivers`);
  });

  socket.on('rider-stop-watching', () => {
    socket.leave('riders-watching');
    console.log(`Rider ${socket.id} stopped watching`);
  });

  // Ride rooms
  socket.on('join-ride-room', (rideId) => {
    socket.join(rideId);
    console.log(`Socket ${socket.id} joined ride: ${rideId}`);
  });

  socket.on('leave-ride-room', (rideId) => {
    socket.leave(rideId);
  });

  // Disconnect
  socket.on('disconnect', async () => {
    console.log('✓ Socket disconnected:', socket.id);
    if (socket.driverId) {
      await driverLocationService.setDriverOffline(socket.driverId);
      io.to('riders-watching').emit('driver-went-offline', { driverId: socket.driverId });
    }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`\n🚀 TeranGO Backend Running on port ${PORT}`);
  console.log(`   📡 Redis: Upstash (Production)`);
  console.log(`   🔌 WebSocket: Active`);
  console.log(`   ⏱️  Driver TTL: 60 seconds`);
});



