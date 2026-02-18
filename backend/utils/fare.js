// Calculate ride fare based on distance and ride type
exports.calculateFare = (distance, rideType = 'standard') => {
  const baseFares = {
    standard: 500,
    comfort: 800,
    xl: 1200
  };
  const perKmRates = {
    standard: 300,
    comfort: 400,
    xl: 550
  };
  const baseFare = baseFares[rideType] || baseFares.standard;
  const perKmRate = perKmRates[rideType] || perKmRates.standard;
  const totalFare = baseFare + (distance * perKmRate);
  return Math.round(totalFare);
};

// Tier commission rates
var TIER_RATES = {
  goorgoorlu: 13,
  jambaar: 12,
  ndaanaan: 11
};

// Get tier from completed rides
exports.getTierFromRides = function(completedRides) {
  if (completedRides >= 500) return 'ndaanaan';
  if (completedRides >= 100) return 'jambaar';
  return 'goorgoorlu';
};

// Calculate commission and driver earnings
exports.calculateEarnings = function(fare, hasPartner, driverTier) {
  if (hasPartner === undefined) hasPartner = false;
  if (driverTier === undefined) driverTier = 'goorgoorlu';
  var platformRate = TIER_RATES[driverTier] || 13;
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
    totalCommissionRate: platformRate + partnerRate,
    tier: driverTier
  };
};