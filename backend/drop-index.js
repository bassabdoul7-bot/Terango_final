const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI);

async function dropIndex() {
  try {
    const db = mongoose.connection.db;
    await db.collection('drivers').dropIndex('vehicle.licensePlate_1');
    console.log('✅ Unique index dropped!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

mongoose.connection.once('open', dropIndex);
