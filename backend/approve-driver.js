require('dotenv').config();
const mongoose = require('mongoose');

async function approveDriver() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const drivers = db.collection('drivers');

    // Approve all drivers
    const result = await drivers.updateMany(
      {},
      { $set: { verificationStatus: 'approved' } }
    );

    console.log(`✅ Approved ${result.modifiedCount} drivers`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Approval error:', error);
    process.exit(1);
  }
}

approveDriver();