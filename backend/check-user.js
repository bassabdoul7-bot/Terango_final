const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI);

async function checkUser() {
  try {
    const user = await User.findOne().sort({ createdAt: -1 });
    console.log('Latest user:');
    console.log('Phone:', user.phone);
    console.log('Role:', user.role);
    console.log('ID:', user._id);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

mongoose.connection.once('open', checkUser);
