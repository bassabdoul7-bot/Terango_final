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
// hasPartner = true: 15% total (12% platform + 3% partner)
// hasPartner = false: 12% platform only
exports.calculateEarnings = function(fare, hasPartner) {
  if (hasPartner === undefined) hasPartner = false;
  var platformRate = parseFloat(process.env.PLATFORM_COMMISSION_RATE) || 12;
  var partnerRate = hasPartner ? (parseFloat(process.env.PARTNER_COMMISSION_RATE) || 3) : 0;
  var totalCommission = (fare * (platformRate + partnerRate)) / 100;
  var platformCommission = (fare * platformRate) / 100;
  var partnerCommission = (fare * partnerRate) / 100;
  var driverEarnings = fare - totalCommission;

  return {
    fare: fare,
    platformCommission: Math.round(platformCommission),
    partnerCommission: Math.round(partnerCommission),
    driverEarnings: Math.round(driverEarnings),
    totalCommissionRate: platformRate + partnerRate
  };
};