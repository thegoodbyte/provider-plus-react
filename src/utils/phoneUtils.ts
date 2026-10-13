/**
 * Utilities for cleaning and searching phone numbers.
 *
 * Handles invisible Unicode control characters (e.g. \u202A, \u202C introduced by WhatsApp/Contacts),
 * non-breaking spaces (\u00A0, \u202F), common keyboard typos (e.g. ± for + on macOS),
 * and digit-based flexible matching across different spacing/formatting conventions.
 */

// Invisible Unicode marks: bidi controls (LRE, RLE, PDF, LRO, RLO, LRI, RLI, FSI, PDI, LRM, RLM),
// zero-width spaces/joiners, and byte order marks.
const UNICODE_INVISIBLE_CHARS_REGEX = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

// All Unicode whitespace characters including standard space, tabs, newlines,
// non-breaking spaces (NBSP \u00A0, narrow NBSP \u202F), and typography spaces (\u2000-\u200A, \u3000).
const UNICODE_WHITESPACE_REGEX = /[\s\u00A0\u2000-\u200A\u202F\u3000]+/g;

/**
 * Clean a phone number string by removing invisible formatting characters,
 * converting non-breaking spaces to standard ASCII spaces, correcting leading `±` to `+`,
 * collapsing repeated spaces, and trimming.
 */
export function sanitizePhoneNumber(phone: string | null | undefined): string {
  if (phone === null || phone === undefined) return '';
  return String(phone)
    .replace(UNICODE_INVISIBLE_CHARS_REGEX, '')
    .replace(UNICODE_WHITESPACE_REGEX, ' ')
    .trim()
    .replace(/^±/, '+');
}

/**
 * Extract only numeric digits from a phone number string.
 */
export function extractPhoneDigits(phone: string | null | undefined): string {
  if (phone === null || phone === undefined) return '';
  return sanitizePhoneNumber(phone).replace(/\D/g, '');
}

/**
 * Checks whether a client's phone number matches a user search term.
 *
 * Supports:
 * - Direct substring match on sanitized phone (ignoring WhatsApp \u202A/\u202C bidi markers and NBSP differences)
 * - Combined country code + phone substring match
 * - Digit sequence matching when 3+ digits are typed, allowing search with or without spaces,
 *   hyphens, parentheses, or international prefix variations (+ vs 00)
 */
export function matchesPhoneSearch(
  clientPhone: string | null | undefined,
  clientCountryCode: string | null | undefined,
  searchTerm: string | null | undefined
): boolean {
  if (!searchTerm) return false;

  const sanitizedQuery = sanitizePhoneNumber(searchTerm).toLowerCase();
  if (!sanitizedQuery) return false;

  const sanitizedPhone = sanitizePhoneNumber(clientPhone).toLowerCase();
  const sanitizedCC = sanitizePhoneNumber(clientCountryCode).toLowerCase();
  const fullPhone = [sanitizedCC, sanitizedPhone].filter(Boolean).join(' ');

  // 1. Literal substring match on sanitized strings (case-insensitive, normalized spaces)
  if (sanitizedPhone && sanitizedPhone.includes(sanitizedQuery)) return true;
  if (fullPhone && fullPhone.includes(sanitizedQuery)) return true;

  // 2. Digit-based flexible match if query has at least 3 digits
  const queryDigits = sanitizedQuery.replace(/\D/g, '');
  if (queryDigits.length >= 3 && /^[+\d\s().-]+$/.test(sanitizedQuery)) {
    const phoneDigits = sanitizedPhone.replace(/\D/g, '');
    const fullDigits = fullPhone.replace(/\D/g, '');

    if (phoneDigits && phoneDigits.includes(queryDigits)) return true;
    if (fullDigits && fullDigits.includes(queryDigits)) return true;

    // Support leading 00 international prefix equivalent to +
    if (queryDigits.startsWith('00') && queryDigits.length > 4) {
      const queryWithout00 = queryDigits.slice(2);
      if (phoneDigits.includes(queryWithout00) || fullDigits.includes(queryWithout00)) return true;
    }
  }

  return false;
}
