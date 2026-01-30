// Format phone number to Senegal standard (+221)
exports.formatPhoneNumber = (phone) => {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Remove leading 221 if present
  if (cleaned.startsWith('221')) {
    cleaned = cleaned.substring(3);
  }
  
  // Remove leading 0 if present
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Add country code
  return '+221' + cleaned;
};

// Validate Senegal phone number
exports.isValidSenegalPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  
  // Should be 9 digits (without country code) or 12 digits (with +221)
  if (cleaned.length === 9) return true;
  if (cleaned.length === 12 && cleaned.startsWith('221')) return true;
  
  return false;
};
