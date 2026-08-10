import {
  USER_ROLES,
  STAFF_ROLES,
  CLIENT_STATUSES,
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  CURRENCIES,
  COUNTRIES,
  REFERRAL_SOURCES,
  PRIORITY_LEVELS,
  TASK_STATUSES,
  getUserRoleLabel,
  getStatusColor,
  getPriorityColor,
  isValidUserRole,
  isValidClientStatus,
  isValidBookingStatus,
  isValidPaymentStatus,
  isValidCurrency,
  USER_ROLE_OPTIONS,
  STAFF_ROLE_OPTIONS,
  CLIENT_STATUS_OPTIONS,
  BOOKING_STATUS_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
  CURRENCY_OPTIONS,
  COUNTRY_OPTIONS,
  REFERRAL_SOURCE_OPTIONS,
  PRIORITY_OPTIONS
} from '../user.constants';

describe('User Constants', () => {
  describe('User Roles', () => {
    it('should have all required user roles', () => {
      expect(USER_ROLES.ADMIN).toBe('admin');
      expect(USER_ROLES.MEDICAL_ADVISOR).toBe('medical_advisor');
      expect(USER_ROLES.COOK).toBe('cook');
      expect(USER_ROLES.FACILITATOR).toBe('facilitator');
      expect(USER_ROLES.CLIENT).toBe('client');
    });

    it('should validate user roles correctly', () => {
      expect(isValidUserRole('admin')).toBe(true);
      expect(isValidUserRole('medical_advisor')).toBe(true);
      expect(isValidUserRole('invalid_role')).toBe(false);
      expect(isValidUserRole('')).toBe(false);
    });

    it('should return correct role labels', () => {
      expect(getUserRoleLabel(USER_ROLES.ADMIN)).toBe('Administrator');
      expect(getUserRoleLabel(USER_ROLES.MEDICAL_ADVISOR)).toBe('Medical Advisor');
      expect(getUserRoleLabel(USER_ROLES.COOK)).toBe('Cook');
      expect(getUserRoleLabel('unknown' as any)).toBe('unknown');
    });

    it('should generate correct role options', () => {
      expect(USER_ROLE_OPTIONS).toContainEqual({
        value: 'admin',
        label: 'Administrator'
      });
      expect(USER_ROLE_OPTIONS).toContainEqual({
        value: 'medical_advisor',
        label: 'Medical Advisor'
      });
    });
  });

  describe('Staff Roles', () => {
    it('should have all required staff roles', () => {
      expect(STAFF_ROLES.FACILITATOR).toBe('facilitator');
      expect(STAFF_ROLES.COOK).toBe('cook');
      expect(STAFF_ROLES.MEDICAL_ADVISOR).toBe('medical_advisor');
      expect(STAFF_ROLES.DRIVER).toBe('driver');
    });

    it('should generate correct staff role options', () => {
      expect(STAFF_ROLE_OPTIONS).toContainEqual({
        value: 'facilitator',
        label: 'Facilitator'
      });
      expect(STAFF_ROLE_OPTIONS).toContainEqual({
        value: 'medical_advisor',
        label: 'Medical Advisor'
      });
    });
  });

  describe('Client Statuses', () => {
    it('should have all required client statuses', () => {
      expect(CLIENT_STATUSES.ACTIVE).toBe('active');
      expect(CLIENT_STATUSES.INACTIVE).toBe('inactive');
      expect(CLIENT_STATUSES.SUSPENDED).toBe('suspended');
      expect(CLIENT_STATUSES.PENDING).toBe('pending');
    });

    it('should validate client statuses correctly', () => {
      expect(isValidClientStatus('active')).toBe(true);
      expect(isValidClientStatus('suspended')).toBe(true);
      expect(isValidClientStatus('invalid')).toBe(false);
    });

    it('should return correct client status colors', () => {
      expect(getStatusColor('active', 'client')).toBe('bg-green-100 text-green-800');
      expect(getStatusColor('suspended', 'client')).toBe('bg-red-100 text-red-800');
      expect(getStatusColor('pending', 'client')).toBe('bg-yellow-100 text-yellow-800');
    });
  });

  describe('Booking Statuses', () => {
    it('should have all required booking statuses', () => {
      expect(BOOKING_STATUSES.PENDING).toBe('pending');
      expect(BOOKING_STATUSES.CONFIRMED).toBe('confirmed');
      expect(BOOKING_STATUSES.CANCELLED).toBe('cancelled');
      expect(BOOKING_STATUSES.COMPLETED).toBe('completed');
    });

    it('should validate booking statuses correctly', () => {
      expect(isValidBookingStatus('confirmed')).toBe(true);
      expect(isValidBookingStatus('cancelled')).toBe(true);
      expect(isValidBookingStatus('invalid')).toBe(false);
    });

    it('should return correct booking status colors', () => {
      expect(getStatusColor('confirmed', 'booking')).toBe('bg-green-100 text-green-800');
      expect(getStatusColor('cancelled', 'booking')).toBe('bg-red-100 text-red-800');
      expect(getStatusColor('pending', 'booking')).toBe('bg-yellow-100 text-yellow-800');
      expect(getStatusColor('completed', 'booking')).toBe('bg-blue-100 text-blue-800');
    });
  });

  describe('Payment Statuses', () => {
    it('should have all required payment statuses', () => {
      expect(PAYMENT_STATUSES.PENDING).toBe('pending');
      expect(PAYMENT_STATUSES.COMPLETED).toBe('completed');
      expect(PAYMENT_STATUSES.FAILED).toBe('failed');
      expect(PAYMENT_STATUSES.REFUNDED).toBe('refunded');
    });

    it('should validate payment statuses correctly', () => {
      expect(isValidPaymentStatus('completed')).toBe(true);
      expect(isValidPaymentStatus('refunded')).toBe(true);
      expect(isValidPaymentStatus('invalid')).toBe(false);
    });

    it('should return correct payment status colors', () => {
      expect(getStatusColor('completed', 'payment')).toBe('bg-green-100 text-green-800');
      expect(getStatusColor('failed', 'payment')).toBe('bg-red-100 text-red-800');
      expect(getStatusColor('refunded', 'payment')).toBe('bg-purple-100 text-purple-800');
    });
  });

  describe('Payment Types', () => {
    it('should have all required payment types', () => {
      expect(PAYMENT_TYPES.DEPOSIT).toBe('deposit');
      expect(PAYMENT_TYPES.FULL_PAYMENT).toBe('full_payment');
      expect(PAYMENT_TYPES.PARTIAL_PAYMENT).toBe('partial_payment');
      expect(PAYMENT_TYPES.REFUND).toBe('refund');
    });

    it('should generate correct payment type options', () => {
      expect(PAYMENT_TYPE_OPTIONS).toContainEqual({
        value: 'deposit',
        label: 'Deposit'
      });
      expect(PAYMENT_TYPE_OPTIONS).toContainEqual({
        value: 'full_payment',
        label: 'Full Payment'
      });
    });
  });

  describe('Currencies', () => {
    it('should have all required currencies', () => {
      expect(CURRENCIES.EUR).toBe('EUR');
      expect(CURRENCIES.USD).toBe('USD');
      expect(CURRENCIES.CZK).toBe('CZK');
      expect(CURRENCIES.PLN).toBe('PLN');
    });

    it('should validate currencies correctly', () => {
      expect(isValidCurrency('EUR')).toBe(true);
      expect(isValidCurrency('USD')).toBe(true);
      expect(isValidCurrency('XXX')).toBe(false);
    });

    it('should generate correct currency options', () => {
      expect(CURRENCY_OPTIONS).toContainEqual({
        value: 'EUR',
        label: 'EUR'
      });
      expect(CURRENCY_OPTIONS).toContainEqual({
        value: 'USD',
        label: 'USD'
      });
    });
  });

  describe('Countries', () => {
    it('should have country information with codes and phone codes', () => {
      expect(COUNTRIES.US).toEqual({
        code: 'US',
        name: 'United States',
        phoneCode: '+1'
      });
      expect(COUNTRIES.UK).toEqual({
        code: 'UK',
        name: 'United Kingdom',
        phoneCode: '+44'
      });
      expect(COUNTRIES.CZ).toEqual({
        code: 'CZ',
        name: 'Czech Republic',
        phoneCode: '+420'
      });
    });

    it('should generate correct country options', () => {
      expect(COUNTRY_OPTIONS).toContainEqual({
        value: 'US',
        label: 'United States',
        phoneCode: '+1'
      });
      expect(COUNTRY_OPTIONS).toContainEqual({
        value: 'CZ',
        label: 'Czech Republic',
        phoneCode: '+420'
      });
    });
  });

  describe('Referral Sources', () => {
    it('should have all common referral sources', () => {
      expect(REFERRAL_SOURCES.GOOGLE).toBe('Google');
      expect(REFERRAL_SOURCES.FACEBOOK).toBe('Facebook');
      expect(REFERRAL_SOURCES.REFERRAL).toBe('Referral');
      expect(REFERRAL_SOURCES.RETURNING_CLIENT).toBe('Returning client');
    });

    it('should generate correct referral source options', () => {
      expect(REFERRAL_SOURCE_OPTIONS).toContainEqual({
        value: 'Google',
        label: 'Google'
      });
      expect(REFERRAL_SOURCE_OPTIONS).toContainEqual({
        value: 'Referral',
        label: 'Referral'
      });
    });
  });

  describe('Priority Levels', () => {
    it('should have all priority levels', () => {
      expect(PRIORITY_LEVELS.LOW).toBe('low');
      expect(PRIORITY_LEVELS.MEDIUM).toBe('medium');
      expect(PRIORITY_LEVELS.HIGH).toBe('high');
      expect(PRIORITY_LEVELS.URGENT).toBe('urgent');
    });

    it('should return correct priority colors', () => {
      expect(getPriorityColor(PRIORITY_LEVELS.LOW)).toBe('bg-blue-100 text-blue-800');
      expect(getPriorityColor(PRIORITY_LEVELS.MEDIUM)).toBe('bg-yellow-100 text-yellow-800');
      expect(getPriorityColor(PRIORITY_LEVELS.HIGH)).toBe('bg-orange-100 text-orange-800');
      expect(getPriorityColor(PRIORITY_LEVELS.URGENT)).toBe('bg-red-100 text-red-800');
    });

    it('should generate correct priority options', () => {
      expect(PRIORITY_OPTIONS).toContainEqual({
        value: 'low',
        label: 'Low'
      });
      expect(PRIORITY_OPTIONS).toContainEqual({
        value: 'urgent',
        label: 'Urgent'
      });
    });
  });

  describe('Task Statuses', () => {
    it('should have all required task statuses', () => {
      expect(TASK_STATUSES.TODO).toBe('todo');
      expect(TASK_STATUSES.IN_PROGRESS).toBe('in_progress');
      expect(TASK_STATUSES.COMPLETED).toBe('completed');
      expect(TASK_STATUSES.CANCELLED).toBe('cancelled');
    });
  });

  describe('Status Color Helper', () => {
    it('should return default color for invalid status', () => {
      expect(getStatusColor('invalid', 'booking')).toBe('bg-gray-100 text-gray-800');
      expect(getStatusColor('invalid', 'payment')).toBe('bg-gray-100 text-gray-800');
      expect(getStatusColor('invalid', 'client')).toBe('bg-gray-100 text-gray-800');
    });

    it('should return default color for invalid type', () => {
      expect(getStatusColor('pending', 'invalid' as any)).toBe('bg-gray-100 text-gray-800');
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety for user roles', () => {
      const testRole: typeof USER_ROLES[keyof typeof USER_ROLES] = USER_ROLES.ADMIN;
      expect(testRole).toBe('admin');
    });

    it('should maintain type safety for currencies', () => {
      const testCurrency: typeof CURRENCIES[keyof typeof CURRENCIES] = CURRENCIES.EUR;
      expect(testCurrency).toBe('EUR');
    });

    it('should maintain type safety for country codes', () => {
      const testCountry: keyof typeof COUNTRIES = 'US';
      expect(COUNTRIES[testCountry].code).toBe('US');
    });
  });
});