require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketio = require('socket.io');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/error');

// Import routes
const authRoutes = require('./routes/authRoutes');
const rideRoutes = require('./routes/rideRoutes');
const driverRoutes = require('./routes/driverRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Initialize Express
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = socketio(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'TeranGO API is running! 🚀',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      rides: '/api/rides',
      drivers: '/api/drivers',
      admin: '/api/admin'
    }
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

  // Driver location updates
  socket.on('driver-location-update', (data) => {
    socket.broadcast.emit(`driver-location-${data.driverId}`, data);
  });

  // Ride updates
  socket.on('ride-update', (data) => {
    socket.broadcast.emit(`ride-update-${data.rideId}`, data);
  });

  socket.on('disconnect', () => {
    console.log('✓ Socket disconnected:', socket.id);
  });
});

// Make io accessible to routes
app.set('io', io);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('');
  console.log('🚀 TeranGO Backend API - FULLY OPERATIONAL!');
  console.log('📡 Port:', PORT);
  console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
  console.log('');
  console.log('✅ Available Endpoints:');
  console.log('   📱 /api/auth      - Authentication & User Management');
  console.log('   🚗 /api/rides     - Ride Booking & Management');
  console.log('   👨‍✈️ /api/drivers   - Driver Operations & Tracking');
  console.log('   👨‍💼 /api/admin     - Admin Dashboard & Analytics');
  console.log('');
  console.log('🔌 WebSocket: Real-time updates enabled');
  console.log('');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log('❌ Unhandled Rejection! Shutting down...');
  console.error(err);
  server.close(() => process.exit(1));
});