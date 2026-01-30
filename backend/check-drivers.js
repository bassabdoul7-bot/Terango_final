const mongoose = require('mongoose');
const Driver = require('./models/Driver');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI);

async function check() {
  try {
    const drivers = await Driver.find().sort({ createdAt: -1 }).limit(3);
    
    console.log('Found', drivers.length, 'drivers:');
    drivers.forEach((d, i) => {
      console.log(`\nDriver ${i+1}:`);
      console.log('  ID:', d._id);
      console.log('  isOnline:', d.isOnline);
      console.log('  isVerified:', d.isVerified);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

mongoose.connection.once('open', check);
