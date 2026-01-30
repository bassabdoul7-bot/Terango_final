const mongoose = require('mongoose');
const Driver = require('./models/Driver');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI);

async function fixAll() {
  try {
    const result = await Driver.updateMany(
      {},
      { 
        $set: { 
          isOnline: true,
          isVerified: true,
          verificationStatus: 'approved'
        } 
      }
    );
    
    console.log('✅ Updated', result.modifiedCount, 'drivers to online and verified!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

mongoose.connection.once('open', fixAll);
