import { detectPhoneLocaleAutofill, findCountryByPhoneNumber, languageForCountryCode } from './countries';

describe('findCountryByPhoneNumber', () => {
  it('matches a phone number starting with a known calling code', () => {
    expect(findCountryByPhoneNumber('+48 123 456 789')?.code).toBe('PL');
    expect(findCountryByPhoneNumber('+420777123456')?.code).toBe('CZ');
  });

  it('handles WhatsApp phone numbers with bidi controls and NBSP', () => {
    expect(findCountryByPhoneNumber('‪+48\u00A0665\u00A0587\u00A0456‬')?.code).toBe('PL');
  });

  it('handles macOS option+shift+= typo of ± instead of +', () => {
    expect(findCountryByPhoneNumber('±48 601549620')?.code).toBe('PL');
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
    expect(languageForCountryCode('PL')).toBe('pl');
    expect(languageForCountryCode('CZ')).toBe('cz');
    expect(languageForCountryCode('RU')).toBe('ru');
    expect(languageForCountryCode('US')).toBe('en');
    expect(languageForCountryCode('GB')).toBe('en');
  });

  it('falls back to "other" for unmapped or missing countries', () => {
    expect(languageForCountryCode('DE')).toBe('other');
    expect(languageForCountryCode(undefined)).toBe('other');
  });
});

describe('detectPhoneLocaleAutofill', () => {
  it('resolves both the country code and language from a recognized phone prefix', () => {
    expect(detectPhoneLocaleAutofill('+48123456789')).toEqual({ countryCode: 'PL', language: 'pl' });
  });

  it('returns null when the phone number does not match any known country', () => {
    expect(detectPhoneLocaleAutofill('123456')).toBeNull();
  });
});
