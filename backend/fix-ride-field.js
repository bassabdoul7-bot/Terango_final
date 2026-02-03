require('dotenv').config();
const mongoose = require('mongoose');

async function fixRideField() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const rides = db.collection('rides');

    // Delete all rides with driverId field
    const result = await rides.deleteMany({ driverId: { $exists: true } });
    console.log(`✅ Deleted ${result.deletedCount} rides with old driverId field`);

    // Also delete all pending/accepted rides to start fresh
    const result2 = await rides.deleteMany({ 
      status: { $in: ['pending', 'accepted', 'in_progress', 'arrived'] } 
    });
    console.log(`✅ Deleted ${result2.deletedCount} active rides`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Fix error:', error);
    process.exit(1);
  }
}

fixRideField();