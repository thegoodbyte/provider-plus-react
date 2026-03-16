/**
 * Generates a random alphanumeric hash of specified length
 * @param length - Length of the hash to generate (default: 20)
 * @returns Random alphanumeric string
 */
export const generateHash = (length: number = 20): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
};

/**
 * Generates a booking hash with the format: BH + 18 random alphanumeric characters
 * Example: BH7x9mP4nQ8wR2kL5jM3
 */
export const generateBookingHash = (): string => {
  return 'BH' + generateHash(18);
};

/**
 * Validates if a string is a valid booking hash format
 * @param hash - The hash to validate
 * @returns boolean indicating if the hash is valid
 */
export const isValidBookingHash = (hash: string): boolean => {
  // Must be exactly 20 characters, start with 'BH', followed by 18 alphanumeric characters
  const pattern = /^BH[A-Za-z0-9]{18}$/;
  return pattern.test(hash);
};

/**
 * Formats a booking hash for display (adds spaces for readability)
 * Example: BH7x9mP4nQ8wR2kL5jM3 -> BH-7x9m-P4nQ-8wR2-kL5j-M3
 */
export const formatBookingHashForDisplay = (hash: string): string => {
  if (!hash || hash.length !== 20) return hash;

  return `${hash.slice(0, 2)}-${hash.slice(2, 6)}-${hash.slice(6, 10)}-${hash.slice(10, 14)}-${hash.slice(14, 18)}-${hash.slice(18)}`;
};