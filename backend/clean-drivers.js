require('dotenv').config();
const mongoose = require('mongoose');

async function cleanDrivers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const drivers = db.collection('drivers');

    // Delete all drivers (they'll be recreated on next login)
    const result = await drivers.deleteMany({});

    console.log(`✅ Deleted ${result.deletedCount} drivers`);
    console.log('Drivers will be recreated when they log in again');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Cleanup error:', error);
    process.exit(1);
  }
}

cleanDrivers();