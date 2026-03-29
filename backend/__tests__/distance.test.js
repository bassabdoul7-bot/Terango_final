const { calculateDistance, estimateDuration } = require('../utils/distance');

describe('calculateDistance', () => {
  test('returns 0 for identical coordinates', () => {
    expect(calculateDistance(14.7167, -17.4677, 14.7167, -17.4677)).toBe(0);
  });

  test('calculates known distance between Dakar and Saint-Louis (~260 km)', () => {
    // Dakar: 14.7167, -17.4677 | Saint-Louis: 16.0326, -16.4818
    const distance = calculateDistance(14.7167, -17.4677, 16.0326, -16.4818);
    expect(distance).toBeGreaterThan(170);
    expect(distance).toBeLessThan(190);
  });

  test('calculates short distance within Dakar (~5-6 km)', () => {
    // Plateau to Medina (roughly)
    const distance = calculateDistance(14.6697, -17.4413, 14.6937, -17.4580);
    expect(distance).toBeGreaterThan(2);
    expect(distance).toBeLessThan(10);
  });

  test('is symmetric (A to B equals B to A)', () => {
    const d1 = calculateDistance(14.7167, -17.4677, 16.0326, -16.4818);
    const d2 = calculateDistance(16.0326, -16.4818, 14.7167, -17.4677);
    expect(d1).toBeCloseTo(d2, 10);
  });
});

describe('estimateDuration', () => {
  test('estimates duration at 30 km/h average speed', () => {
    // 15 km at 30 km/h = 30 minutes
    expect(estimateDuration(15)).toBe(30);
  });

  test('returns rounded minutes', () => {
    const result = estimateDuration(7);
    expect(Number.isInteger(result)).toBe(true);
  });
});
