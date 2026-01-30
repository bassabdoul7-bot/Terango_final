// Generate random 6-digit OTP
exports.generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Validate OTP format
exports.isValidOTP = (otp) => {
  return /^\d{6}$/.test(otp);
};
