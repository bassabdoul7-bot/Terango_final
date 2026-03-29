const { calculateFare, getSurgeMultiplier, getTierFromRides, calculateEarnings } = require('../utils/fare');

// Mock Date to control surge multiplier in tests
const RealDate = Date;

function mockHour(hour) {
  global.Date = class extends RealDate {
    constructor(...args) {
      if (args.length) return new RealDate(...args);
      super();
    }
    getHours() {
      return hour;
    }
  };
}

afterEach(() => {
  global.Date = RealDate;
});

describe('getSurgeMultiplier', () => {
  test('returns 1.2 during morning rush (7-9)', () => {
    mockHour(8);
    expect(getSurgeMultiplier()).toBe(1.2);
  });

  test('returns 1.3 during evening rush (17-20)', () => {
    mockHour(18);
    expect(getSurgeMultiplier()).toBe(1.3);
  });

  test('returns 1.0 during off-peak hours', () => {
    mockHour(12);
    expect(getSurgeMultiplier()).toBe(1.0);
  });
});

describe('calculateFare', () => {
  test('applies minimum fare for very short rides', () => {
    mockHour(12); // no surge
    const result = calculateFare(0.5, 'standard', 2, 0);
    expect(result.fare).toBeGreaterThanOrEqual(500);
  });

  test('uses suburb rate for distance beyond 10 km', () => {
    mockHour(12);
    // Use explicit duration to isolate distance cost difference
    const shortResult = calculateFare(10, 'standard', 25, 0);
    const longResult = calculateFare(15, 'standard', 25, 0);
    // Same duration, so difference is purely distance-based
    // Extra 5 km at suburb rate (142/km) = 710
    const marginalCost = longResult.baseCost - shortResult.baseCost;
    expect(marginalCost).toBe(710);
  });

  test('comfort ride costs more than standard for same distance', () => {
    mockHour(12);
    const standard = calculateFare(8, 'standard', 20, 0);
    const comfort = calculateFare(8, 'comfort', 20, 0);
    expect(comfort.fare).toBeGreaterThan(standard.fare);
  });

  test('includes pickup fee based on pickup distance', () => {
    mockHour(12);
    const noPickup = calculateFare(5, 'standard', 10, 0);
    const withPickup = calculateFare(5, 'standard', 10, 3);
    expect(withPickup.pickupFee).toBe(150); // 3 km * 50/km
    expect(withPickup.fare).toBeGreaterThanOrEqual(noPickup.fare);
  });

  test('fare is rounded up to nearest 100', () => {
    mockHour(12);
    const result = calculateFare(5, 'standard', 10, 0);
    expect(result.fare % 100).toBe(0);
  });
});

describe('getTierFromRides', () => {
  test('returns goorgoorlu for fewer than 100 rides', () => {
    expect(getTierFromRides(50)).toBe('goorgoorlu');
  });

  test('returns jambaar for 100-499 rides', () => {
    expect(getTierFromRides(100)).toBe('jambaar');
    expect(getTierFromRides(499)).toBe('jambaar');
  });

  test('returns ndaanaan for 500+ rides', () => {
    expect(getTierFromRides(500)).toBe('ndaanaan');
  });
});

describe('calculateEarnings', () => {
  test('calculates correct 5% platform commission', () => {
    const result = calculateEarnings(10000, false, 'goorgoorlu');
    expect(result.platformCommission).toBe(500);
    expect(result.partnerCommission).toBe(0);
    expect(result.driverEarnings).toBe(9500);
  });

  test('includes partner commission when driver has partner', () => {
    const result = calculateEarnings(10000, true, 'goorgoorlu');
    expect(result.partnerCommission).toBe(300); // 3% default
    expect(result.driverEarnings).toBe(9200); // 10000 - 500 - 300
    expect(result.totalCommissionRate).toBe(8); // 5% + 3%
  });
});
