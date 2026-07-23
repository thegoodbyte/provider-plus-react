/**
 * User and Role Configuration Constants
 * Centralized configuration for user roles, permissions, and related settings
 */

// User Roles Configuration
export const USER_ROLES = {
  ADMIN: 'admin',
  MEDICAL_ADVISOR: 'medical_advisor',
  COOK: 'cook',
  FACILITATOR: 'facilitator',
  CLIENT: 'client',
  STAFF: 'staff',
  USER: 'user'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// Staff Roles Configuration
export const STAFF_ROLES = {
  FACILITATOR: 'facilitator',
  COOK: 'cook',
  CLEANER: 'cleaner',
  MEDICAL_ADVISOR: 'medical_advisor',
  ASSISTANT: 'assistant',
  DRIVER: 'driver',
  SUPPORT_STAFF: 'support_staff',
  ADMIN: 'admin'
} as const;

export type StaffRole = typeof STAFF_ROLES[keyof typeof STAFF_ROLES];

// Client Status Configuration
export const CLIENT_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  PENDING: 'pending',
  ARCHIVED: 'archived'
} as const;

export type ClientStatus = typeof CLIENT_STATUSES[keyof typeof CLIENT_STATUSES];

// Booking Status Configuration
export const BOOKING_STATUSES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  ON_HOLD: 'on_hold',
  WAITLIST: 'waitlist'
} as const;

export type BookingStatus = typeof BOOKING_STATUSES[keyof typeof BOOKING_STATUSES];

// Payment Status Configuration
export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled',
  PARTIAL: 'partial'
} as const;

export type PaymentStatus = typeof PAYMENT_STATUSES[keyof typeof PAYMENT_STATUSES];

// Payment Types Configuration
export const PAYMENT_TYPES = {
  DEPOSIT: 'deposit',
  FULL_PAYMENT: 'full_payment',
  PARTIAL_PAYMENT: 'partial_payment',
  REFUND: 'refund',
  ADJUSTMENT: 'adjustment',
  OTHER: 'other'
} as const;

export type PaymentType = typeof PAYMENT_TYPES[keyof typeof PAYMENT_TYPES];

// Currency Configuration
export const CURRENCIES = {
  EUR: 'EUR',
  USD: 'USD',
  CZK: 'CZK',
  PLN: 'PLN',
  GBP: 'GBP'
} as const;

export type Currency = typeof CURRENCIES[keyof typeof CURRENCIES];

// Country Configuration
export const COUNTRIES = {
  US: { code: 'US', name: 'United States', phoneCode: '+1' },
  UK: { code: 'UK', name: 'United Kingdom', phoneCode: '+44' },
  CA: { code: 'CA', name: 'Canada', phoneCode: '+1' },
  CZ: { code: 'CZ', name: 'Czech Republic', phoneCode: '+420' },
  PL: { code: 'PL', name: 'Poland', phoneCode: '+48' },
  DE: { code: 'DE', name: 'Germany', phoneCode: '+49' },
  FR: { code: 'FR', name: 'France', phoneCode: '+33' },
  ES: { code: 'ES', name: 'Spain', phoneCode: '+34' },
  IT: { code: 'IT', name: 'Italy', phoneCode: '+39' },
  NL: { code: 'NL', name: 'Netherlands', phoneCode: '+31' },
  AU: { code: 'AU', name: 'Australia', phoneCode: '+61' },
  NZ: { code: 'NZ', name: 'New Zealand', phoneCode: '+64' }
} as const;

export type CountryCode = keyof typeof COUNTRIES;

// Source/Referral Options
export const REFERRAL_SOURCES = {
  GOOGLE: 'Google',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  REFERRAL: 'Referral',
  WEBSITE: 'Website',
  FRIEND: 'Friend',
  RETURNING_CLIENT: 'Returning client',
  OTHER: 'Other'
} as const;

export type ReferralSource = typeof REFERRAL_SOURCES[keyof typeof REFERRAL_SOURCES];

// Priority Levels
export const PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
} as const;

export type PriorityLevel = typeof PRIORITY_LEVELS[keyof typeof PRIORITY_LEVELS];

// Task Status Configuration
export const TASK_STATUSES = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  ON_HOLD: 'on_hold'
} as const;

export type TaskStatus = typeof TASK_STATUSES[keyof typeof TASK_STATUSES];

// Helper functions for user configurations

export const getUserRoleLabel = (role: UserRole): string => {
  const labels: Record<UserRole, string> = {
    [USER_ROLES.ADMIN]: 'Administrator',
    [USER_ROLES.MEDICAL_ADVISOR]: 'Medical Advisor',
    [USER_ROLES.COOK]: 'Cook',
    [USER_ROLES.FACILITATOR]: 'Facilitator',
    [USER_ROLES.CLIENT]: 'Client',
    [USER_ROLES.STAFF]: 'Staff Member',
    [USER_ROLES.USER]: 'User'
  };
  return labels[role] || role;
};

export const getStatusColor = (status: string, type: 'booking' | 'payment' | 'client' = 'booking'): string => {
  if (type === 'booking') {
    const colors: Record<BookingStatus, string> = {
      [BOOKING_STATUSES.PENDING]: 'bg-yellow-100 text-yellow-800',
      [BOOKING_STATUSES.CONFIRMED]: 'bg-green-100 text-green-800',
      [BOOKING_STATUSES.CANCELLED]: 'bg-red-100 text-red-800',
      [BOOKING_STATUSES.COMPLETED]: 'bg-blue-100 text-blue-800',
      [BOOKING_STATUSES.ON_HOLD]: 'bg-orange-100 text-orange-800',
      [BOOKING_STATUSES.WAITLIST]: 'bg-purple-100 text-purple-800'
    };
    return colors[status as BookingStatus] || 'bg-gray-100 text-gray-800';
  }

  if (type === 'payment') {
    const colors: Record<PaymentStatus, string> = {
      [PAYMENT_STATUSES.PENDING]: 'bg-yellow-100 text-yellow-800',
      [PAYMENT_STATUSES.COMPLETED]: 'bg-green-100 text-green-800',
      [PAYMENT_STATUSES.FAILED]: 'bg-red-100 text-red-800',
      [PAYMENT_STATUSES.REFUNDED]: 'bg-purple-100 text-purple-800',
      [PAYMENT_STATUSES.CANCELLED]: 'bg-gray-100 text-gray-800',
      [PAYMENT_STATUSES.PARTIAL]: 'bg-orange-100 text-orange-800'
    };
    return colors[status as PaymentStatus] || 'bg-gray-100 text-gray-800';
  }

  if (type === 'client') {
    const colors: Record<ClientStatus, string> = {
      [CLIENT_STATUSES.ACTIVE]: 'bg-green-100 text-green-800',
      [CLIENT_STATUSES.INACTIVE]: 'bg-gray-100 text-gray-800',
      [CLIENT_STATUSES.SUSPENDED]: 'bg-red-100 text-red-800',
      [CLIENT_STATUSES.PENDING]: 'bg-yellow-100 text-yellow-800',
      [CLIENT_STATUSES.ARCHIVED]: 'bg-purple-100 text-purple-800'
    };
    return colors[status as ClientStatus] || 'bg-gray-100 text-gray-800';
  }

  return 'bg-gray-100 text-gray-800';
};

export const getPriorityColor = (priority: PriorityLevel): string => {
  const colors: Record<PriorityLevel, string> = {
    [PRIORITY_LEVELS.LOW]: 'bg-blue-100 text-blue-800',
    [PRIORITY_LEVELS.MEDIUM]: 'bg-yellow-100 text-yellow-800',
    [PRIORITY_LEVELS.HIGH]: 'bg-orange-100 text-orange-800',
    [PRIORITY_LEVELS.URGENT]: 'bg-red-100 text-red-800'
  };
  return colors[priority] || 'bg-gray-100 text-gray-800';
};

// Lists for dropdowns and selectors

export const USER_ROLE_OPTIONS = Object.entries(USER_ROLES).map(([key, value]) => ({
  value,
  label: getUserRoleLabel(value)
}));

export const STAFF_ROLE_OPTIONS = Object.entries(STAFF_ROLES).map(([key, value]) => ({
  value,
  label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
}));

export const CLIENT_STATUS_OPTIONS = Object.entries(CLIENT_STATUSES).map(([key, value]) => ({
  value,
  label: key.charAt(0) + key.slice(1).toLowerCase()
}));

export const BOOKING_STATUS_OPTIONS = Object.entries(BOOKING_STATUSES).map(([key, value]) => ({
  value,
  label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
}));

export const PAYMENT_TYPE_OPTIONS = Object.entries(PAYMENT_TYPES).map(([key, value]) => ({
  value,
  label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
}));

export const CURRENCY_OPTIONS = Object.entries(CURRENCIES).map(([key, value]) => ({
  value,
  label: value
}));

export const COUNTRY_OPTIONS = Object.entries(COUNTRIES).map(([key, country]) => ({
  value: country.code,
  label: country.name,
  phoneCode: country.phoneCode
}));

export const REFERRAL_SOURCE_OPTIONS = Object.entries(REFERRAL_SOURCES).map(([key, value]) => ({
  value,
  label: value
}));

export const PRIORITY_OPTIONS = Object.entries(PRIORITY_LEVELS).map(([key, value]) => ({
  value,
  label: key.charAt(0) + key.slice(1).toLowerCase()
}));

// Validation helpers

export const isValidUserRole = (role: string): role is UserRole => {
  return Object.values(USER_ROLES).includes(role as UserRole);
};

export const isValidClientStatus = (status: string): status is ClientStatus => {
  return Object.values(CLIENT_STATUSES).includes(status as ClientStatus);
};

export const isValidBookingStatus = (status: string): status is BookingStatus => {
  return Object.values(BOOKING_STATUSES).includes(status as BookingStatus);
};

export const isValidPaymentStatus = (status: string): status is PaymentStatus => {
  return Object.values(PAYMENT_STATUSES).includes(status as PaymentStatus);
};

export const isValidCurrency = (currency: string): currency is Currency => {
  return Object.values(CURRENCIES).includes(currency as Currency);
};