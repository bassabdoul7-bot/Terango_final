const { generateOTP, isValidOTP } = require('../utils/otp');

describe('generateOTP', () => {
  test('generates a 6-digit string', () => {
    const otp = generateOTP();
    expect(otp).toHaveLength(6);
    expect(/^\d{6}$/.test(otp)).toBe(true);
  });

  test('generates different OTPs on consecutive calls', () => {
    const otps = new Set(Array.from({ length: 20 }, () => generateOTP()));
    // With 20 random 6-digit numbers, extremely unlikely to get all the same
    expect(otps.size).toBeGreaterThan(1);
  });
});

describe('isValidOTP', () => {
  test('accepts valid 6-digit OTP', () => {
    expect(isValidOTP('123456')).toBe(true);
  });

  test('rejects non-numeric strings', () => {
    expect(isValidOTP('abcdef')).toBe(false);
  });

  test('rejects wrong length', () => {
    expect(isValidOTP('12345')).toBe(false);
    expect(isValidOTP('1234567')).toBe(false);
  });
});
