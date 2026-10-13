import { sanitizePhoneNumber, extractPhoneDigits, matchesPhoneSearch } from './phoneUtils';

describe('phoneUtils', () => {
  describe('sanitizePhoneNumber', () => {
    it('returns empty string for null, undefined, or empty', () => {
      expect(sanitizePhoneNumber(null)).toBe('');
      expect(sanitizePhoneNumber(undefined)).toBe('');
      expect(sanitizePhoneNumber('')).toBe('');
    });

    it('removes WhatsApp bidi control characters (\u202A, \u202C) and normalizes NBSP (\u00A0)', () => {
      // Client 1232 exact production phone format from WhatsApp
      const rawWhatsAppPhone = '‪+48\u00A0665\u00A0587\u00A0456‬';
      expect(sanitizePhoneNumber(rawWhatsAppPhone)).toBe('+48 665 587 456');
    });

    it('fixes macOS Option+Shift+= typo of ± into +', () => {
      expect(sanitizePhoneNumber('±48 601549620')).toBe('+48 601549620');
      expect(sanitizePhoneNumber('  \u202A±48 601549620\u202C  ')).toBe('+48 601549620');
      expect(sanitizePhoneNumber('\u00B1420 777 123 456')).toBe('+420 777 123 456');
    });

    it('collapses multiple spaces and trims', () => {
      expect(sanitizePhoneNumber('   +420   777   123   456   ')).toBe('+420 777 123 456');
    });

    it('strips other invisible Unicode characters (\u200E, \u200F, \u200B, \uFEFF)', () => {
      expect(sanitizePhoneNumber('\uFEFF\u200E+1\u200B 555 1234')).toBe('+1 555 1234');
    });
  });

  describe('extractPhoneDigits', () => {
    it('extracts only numeric digits', () => {
      expect(extractPhoneDigits('‪+48\u00A0665\u00A0587\u00A0456‬')).toBe('48665587456');
      expect(extractPhoneDigits('+1 (555) 234-5678')).toBe('15552345678');
      expect(extractPhoneDigits('')).toBe('');
      expect(extractPhoneDigits(null)).toBe('');
    });
  });

  describe('matchesPhoneSearch', () => {
    const rawClient1232Phone = '‪+48\u00A0665\u00A0587\u00A0456‬';

    it('matches WhatsApp client 1232 with standard spaces query', () => {
      expect(matchesPhoneSearch(rawClient1232Phone, '+1', '+48 665 587 456')).toBe(true);
      expect(matchesPhoneSearch(rawClient1232Phone, '+1', '665 587 456')).toBe(true);
    });

    it('matches WhatsApp client 1232 with no spaces query', () => {
      expect(matchesPhoneSearch(rawClient1232Phone, '+1', '665587456')).toBe(true);
      expect(matchesPhoneSearch(rawClient1232Phone, '+1', '+48665587456')).toBe(true);
    });

    it('matches WhatsApp client 1232 when query itself contains WhatsApp bidi or NBSP characters', () => {
      expect(matchesPhoneSearch(rawClient1232Phone, '+1', '‪+48\u00A0665\u00A0587\u00A0456‬')).toBe(true);
    });

    it('matches WhatsApp client 1232 with partial digit query', () => {
      expect(matchesPhoneSearch(rawClient1232Phone, '+1', '587456')).toBe(true);
      expect(matchesPhoneSearch(rawClient1232Phone, '+1', '587 456')).toBe(true);
      expect(matchesPhoneSearch(rawClient1232Phone, '+1', '665')).toBe(true);
    });

    it('matches with leading 00 international prefix', () => {
      expect(matchesPhoneSearch(rawClient1232Phone, '+1', '0048665587456')).toBe(true);
      expect(matchesPhoneSearch(rawClient1232Phone, '+1', '0048 665 587 456')).toBe(true);
    });

    it('matches when phone number and country code are stored separately', () => {
      expect(matchesPhoneSearch('665 587 456', '+48', '+48 665 587 456')).toBe(true);
      expect(matchesPhoneSearch('665 587 456', '+48', '+48665587456')).toBe(true);
      expect(matchesPhoneSearch('665 587 456', '+48', '665587456')).toBe(true);
    });

    it('does not match unrelated phone numbers', () => {
      expect(matchesPhoneSearch(rawClient1232Phone, '+1', '777 123 456')).toBe(false);
      expect(matchesPhoneSearch(rawClient1232Phone, '+1', '999999999')).toBe(false);
      expect(matchesPhoneSearch(rawClient1232Phone, '+1', '')).toBe(false);
      expect(matchesPhoneSearch(null, null, '665587456')).toBe(false);
    });
  });
});
