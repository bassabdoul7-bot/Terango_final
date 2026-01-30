const mongoose = require('mongoose');
const Driver = require('./models/Driver');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI);

async function verifyDriver() {
  try {
    const driver = await Driver.findOne().sort({ createdAt: -1 });
    
    if (!driver) {
      console.log('No driver found');
      process.exit(0);
    }

    driver.isVerified = true;
    driver.verificationStatus = 'approved';
    await driver.save();

    console.log('✅ Driver verified!');
    console.log('Driver ID:', driver._id);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

mongoose.connection.once('open', verifyDriver);
