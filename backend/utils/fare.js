// TeranGO Fare Calculation - March 2026
// Yango published rates x 0.95 + time-based surge + pickup fee
// Yango: base 485, city 77/km, suburb 150/km, 30/min
// TeranGO: base 461, city 73/km, suburb 142/km, 29/min

function getSurgeMultiplier() {
  var hour = new Date().getHours();
  if (hour >= 7 && hour < 9) return 1.2;
  if (hour >= 17 && hour < 20) return 1.3;
  return 1.0;
}

exports.getSurgeMultiplier = getSurgeMultiplier;

exports.calculateFare = function(distance, rideType, durationMinutes, pickupDistanceKm) {
  if (!rideType) rideType = 'standard';
  if (!durationMinutes) durationMinutes = 0;
  if (!pickupDistanceKm) pickupDistanceKm = 0;

  var baseFares = { standard: 461, comfort: 665, xl: 1045 };
  var perKmRates = { standard: 73, comfort: 100, xl: 140 };
  var perMinRates = { standard: 29, comfort: 38, xl: 48 };
  var suburbPerKmRates = { standard: 142, comfort: 180, xl: 220 };
  var pickupPerKm = { standard: 50, comfort: 60, xl: 70 };

  var baseFare = baseFares[rideType] || baseFares.standard;
  var distanceFare;

  if (distance > 10) {
    var cityRate = perKmRates[rideType] || perKmRates.standard;
    var suburbRate = suburbPerKmRates[rideType] || suburbPerKmRates.standard;
    distanceFare = (10 * cityRate) + ((distance - 10) * suburbRate);
  } else {
    distanceFare = distance * (perKmRates[rideType] || perKmRates.standard);
  }

  var timeFare = (durationMinutes || Math.round(distance * 2.5)) * (perMinRates[rideType] || perMinRates.standard);
  var rideCost = baseFare + distanceFare + timeFare;

  var surge = getSurgeMultiplier();
  var surgedCost = Math.round(rideCost * surge);

  var pickupFee = Math.round(pickupDistanceKm * (pickupPerKm[rideType] || pickupPerKm.standard));
  var totalFare = surgedCost + pickupFee;

  var fare = Math.ceil(totalFare / 100) * 100;
  var minimums = { standard: 500, comfort: 700, xl: 1000 };
  fare = Math.max(fare, minimums[rideType] || 500);

  return {
    fare: fare,
    baseCost: rideCost,
    surgeMultiplier: surge,
    pickupFee: pickupFee
  };
};

var TIER_RATES = { goorgoorlu: 5, jambaar: 5, ndaanaan: 5 };

exports.getTierFromRides = function(completedRides) {
  if (completedRides >= 500) return 'ndaanaan';
  if (completedRides >= 100) return 'jambaar';
  return 'goorgoorlu';
};

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
