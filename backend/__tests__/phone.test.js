const { formatPhoneNumber, isValidSenegalPhone } = require('../utils/phone');

describe('formatPhoneNumber', () => {
  test('adds +221 prefix to 9-digit number', () => {
    expect(formatPhoneNumber('771234567')).toBe('+221771234567');
  });

  test('strips existing 221 prefix and re-adds with +', () => {
    expect(formatPhoneNumber('221771234567')).toBe('+221771234567');
  });

  test('removes leading 0 and formats correctly', () => {
    expect(formatPhoneNumber('0771234567')).toBe('+221771234567');
  });

  test('strips non-numeric characters', () => {
    expect(formatPhoneNumber('+221 77-123-4567')).toBe('+221771234567');
  });
});

describe('isValidSenegalPhone', () => {
  test('accepts valid 9-digit number', () => {
    expect(isValidSenegalPhone('771234567')).toBe(true);
  });

  test('accepts valid 12-digit number with 221 prefix', () => {
    expect(isValidSenegalPhone('221771234567')).toBe(true);
  });

  test('rejects number with wrong length', () => {
    expect(isValidSenegalPhone('12345')).toBe(false);
  });

  test('rejects 12-digit number without 221 prefix', () => {
    expect(isValidSenegalPhone('123456789012')).toBe(false);
  });
});
