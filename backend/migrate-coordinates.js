require('dotenv').config();
const mongoose = require('mongoose');

async function migrateCoordinates() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const drivers = db.collection('drivers');

    // Update all drivers with old array format to new object format
    const result = await drivers.updateMany(
      { 'currentLocation.coordinates.0': { $exists: true } },
      [
        {
          $set: {
            'currentLocation.coordinates': {
              latitude: { $arrayElemAt: ['$currentLocation.coordinates', 1] },
              longitude: { $arrayElemAt: ['$currentLocation.coordinates', 0] }
            }
          }
        }
      ]
    );

    console.log(`✅ Migrated ${result.modifiedCount} drivers`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

migrateCoordinates();