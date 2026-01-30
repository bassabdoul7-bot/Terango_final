const mongoose = require('mongoose');
const Driver = require('./models/Driver');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI);

async function fixOnline() {
  try {
    const driver = await Driver.findOne().sort({ createdAt: -1 });
    
    console.log('Current isOnline:', driver.isOnline);
    
    driver.isOnline = true;
    await driver.save();

    console.log('✅ Driver set to online!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

mongoose.connection.once('open', fixOnline);
