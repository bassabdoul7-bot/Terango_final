require('dotenv').config();
const mongoose = require('mongoose');

async function checkRide() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const rides = db.collection('rides');

    // Get the most recent accepted ride
    const ride = await rides.findOne(
      { status: 'accepted' },
      { sort: { acceptedAt: -1 } }
    );

    console.log('Most recent accepted ride:');
    console.log(JSON.stringify(ride, null, 2));
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Check error:', error);
    process.exit(1);
  }
}

checkRide();
