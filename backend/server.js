require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const RideMatchingService = require('./services/rideMatchingService');
const authRoutes = require('./routes/authRoutes');
const rideRoutes = require('./routes/rideRoutes');
const driverRoutes = require('./routes/driverRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
connectDB();

// Initialize Ride Matching Service (UBER-LEVEL!)
const matchingService = new RideMatchingService(io);
app.set('matchingService', matchingService);

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'TeranGO API is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/admin', adminRoutes);

// Socket.io connection
io.on('connection', (socket) => {
  console.log('✓ New socket connection:', socket.id);

  // Driver connects and joins their personal room
  socket.on('driver-online', (driverId) => {
    socket.join(`driver-${driverId}`);
    console.log(`Driver ${driverId} joined their room`);
  });

  // Driver disconnects from their room
  socket.on('driver-offline', (driverId) => {
    socket.leave(`driver-${driverId}`);
    console.log(`Driver ${driverId} left their room`);
  });

  // Join ride room for real-time updates
  socket.on('join-ride-room', (rideId) => {
    socket.join(`ride-${rideId}`);
    console.log(`Socket ${socket.id} joined ride room: ${rideId}`);
  });

  // Leave ride room
  socket.on('leave-ride-room', (rideId) => {
    socket.leave(`ride-${rideId}`);
    console.log(`Socket ${socket.id} left ride room: ${rideId}`);
  });

  // Driver location updates
  socket.on('driver-location-update', (data) => {
    io.to(`ride-${data.rideId}`).emit('driver-location', data);
  });

  // Ride updates
  socket.on('ride-update', (data) => {
    io.to(`ride-${data.rideId}`).emit('ride-status-update', data);
  });

  socket.on('disconnect', () => {
    console.log('✓ Socket disconnected:', socket.id);
  });
});

// Make io accessible to routes
app.set('io', io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 TeranGO Backend API - FULLY OPERATIONAL!`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Available Endpoints:`);
  console.log(`   📱 /api/auth      - Authentication & User Management`);
  console.log(`   🚗 /api/rides     - Ride Booking & Management`);
  console.log(`   👨‍✈️ /api/drivers   - Driver Operations & Tracking`);
  console.log(`   👨‍💼 /api/admin     - Admin Dashboard & Analytics`);
  console.log(`🔌 WebSocket: Real-time updates enabled`);
  console.log(`🎯 UBER-LEVEL MATCHING: Proximity-based ride matching active!`);
});

module.exports = { app, server, io };