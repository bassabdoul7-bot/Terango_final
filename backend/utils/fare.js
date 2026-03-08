// Yango-matched pricing with 5% reduction for riders
// City rates: 73 FCFA/km + 28 FCFA/min (Yango: 77/km + 30/min)
// Suburb rates: 142 FCFA/km + 28 FCFA/min (Yango: 150/km + 30/min)

exports.calculateFare = (distance, rideType = 'standard', durationMinutes = 0) => {
  var baseFares = {
    standard: 460,   // Yango: 485
    comfort: 700,     // Premium tier
    xl: 1000          // Large vehicle
  };
  var perKmRates = {
    standard: 73,     // Yango city: 77
    comfort: 100,
    xl: 140
  };
  var perMinRates = {
    standard: 28,     // Yango: 30
    comfort: 35,
    xl: 45
  };
  // Suburb rates kick in beyond 10km from center
  var suburbPerKmRates = {
    standard: 142,    // Yango suburbs: 150
    comfort: 180,
    xl: 220
  };

  var baseFare = baseFares[rideType] || baseFares.standard;
  var isSuburb = distance > 10;
  var perKmRate;
  var distanceFare;

  if (isSuburb) {
    var cityKm = 10;
    var suburbKm = distance - 10;
    var cityRate = perKmRates[rideType] || perKmRates.standard;
    var suburbRate = suburbPerKmRates[rideType] || suburbPerKmRates.standard;
    distanceFare = (cityKm * cityRate) + (suburbKm * suburbRate);
  } else {
    perKmRate = perKmRates[rideType] || perKmRates.standard;
    distanceFare = distance * perKmRate;
  }

  var perMinRate = perMinRates[rideType] || perMinRates.standard;
  var timeFare = (durationMinutes || Math.round(distance * 2)) * perMinRate;

  var totalFare = baseFare + distanceFare + timeFare;

  // Round up to nearest 100 (same as Yango)
  var fare = Math.ceil(totalFare / 100) * 100;

  // Minimum fares
  var minimums = { standard: 500, comfort: 700, xl: 1000 };
  var minFare = minimums[rideType] || minimums.standard;
  if (fare < minFare) fare = minFare;

  return fare;
};

// Tier commission rates
var TIER_RATES = {
  goorgoorlu: 5,
  jambaar: 5,
  ndaanaan: 5
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
  var platformRate = TIER_RATES[driverTier] || 5;
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