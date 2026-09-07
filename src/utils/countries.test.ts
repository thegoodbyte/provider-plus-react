import { detectPhoneLocaleAutofill, findCountryByPhoneNumber, languageForCountryCode } from './countries';

describe('findCountryByPhoneNumber', () => {
  it('matches a phone number starting with a known calling code', () => {
    expect(findCountryByPhoneNumber('+48 123 456 789')?.code).toBe('PL');
    expect(findCountryByPhoneNumber('+420777123456')?.code).toBe('CZ');
  });

  it('prefers the longest matching prefix so a 3-digit code is not shadowed by a shorter one', () => {
    expect(findCountryByPhoneNumber('+421 900 111 222')?.code).toBe('SK');
  });

  it('returns undefined for a number with no matching prefix or no leading +', () => {
    expect(findCountryByPhoneNumber('123456789')).toBeUndefined();
    expect(findCountryByPhoneNumber('+999999')).toBeUndefined();
    expect(findCountryByPhoneNumber('')).toBeUndefined();
  });
});

describe('languageForCountryCode', () => {
  it('maps known countries to their client-portal language', () => {
    expect(languageForCountryCode('PL')).toBe('PL');
    expect(languageForCountryCode('CZ')).toBe('CZ');
    expect(languageForCountryCode('RU')).toBe('RU');
    expect(languageForCountryCode('US')).toBe('EN');
    expect(languageForCountryCode('GB')).toBe('EN');
  });

  it('falls back to OTHER for unmapped or missing countries', () => {
    expect(languageForCountryCode('DE')).toBe('OTHER');
    expect(languageForCountryCode(undefined)).toBe('OTHER');
  });
});

describe('detectPhoneLocaleAutofill', () => {
  it('resolves both the country code and language from a recognized phone prefix', () => {
    expect(detectPhoneLocaleAutofill('+48123456789')).toEqual({ countryCode: 'PL', language: 'PL' });
  });

  it('returns null when the phone number does not match any known country', () => {
    expect(detectPhoneLocaleAutofill('123456')).toBeNull();
  });
});
