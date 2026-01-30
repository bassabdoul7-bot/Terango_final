// Calculate ride fare based on distance and ride type
exports.calculateFare = (distance, rideType = 'standard') => {
  const baseFares = {
    standard: 500,  // 500 FCFA base
    comfort: 800,   // 800 FCFA base
    xl: 1200        // 1200 FCFA base
  };
  
  const perKmRates = {
    standard: 300,  // 300 FCFA per km
    comfort: 400,   // 400 FCFA per km
    xl: 550         // 550 FCFA per km
  };
  
  const baseFare = baseFares[rideType] || baseFares.standard;
  const perKmRate = perKmRates[rideType] || perKmRates.standard;
  
  const totalFare = baseFare + (distance * perKmRate);
  
  return Math.round(totalFare);
};

// Calculate commission and driver earnings
exports.calculateEarnings = (fare) => {
  const commissionRate = parseFloat(process.env.PLATFORM_COMMISSION_RATE) || 12;
  const commission = (fare * commissionRate) / 100;
  const driverEarnings = fare - commission;
  
  return {
    fare,
    platformCommission: Math.round(commission),
    driverEarnings: Math.round(driverEarnings)
  };
};
