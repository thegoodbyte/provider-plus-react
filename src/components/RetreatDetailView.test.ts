import { getEffectivePaidAmount, getPaymentAmountInBookingCurrency } from './retreatPaymentUtils';
import { filterRetreatEmailTemplates, normalizeTemplateLanguage, retreatEmailTemplateSearchText } from './retreatEmailTemplateFilters';
import { isTabAvailableForRetreat, percentOf } from './RetreatDetailView';
import { Payment } from '../types';

const payment = (overrides: Partial<Payment>): Payment => ({
  clientId: 'client-1',
  retreatId: 'retreat-1',
  amount: 0,
  currency: 'EUR',
  status: 'completed',
  paymentMethod: 'bank_transfer',
  paymentType: 'regular_payment',
  paymentDate: '2026-08-08',
  isDeposit: false,
  isFinalPayment: false,
  isRefundable: false,
  ...overrides,
});

describe('getPaymentAmountInBookingCurrency', () => {
  it('uses the stored booking-currency amount for a cross-currency payment', () => {
    expect(getPaymentAmountInBookingCurrency(payment({
      amount: 800,
      currency: 'EUR',
      bookingCurrency: 'PLN',
      bookingCurrencyAmount: 3323.08,
    }), 'PLN')).toBeCloseTo(3323.08);
  });

  it('does not invent a booking-currency value when the recorded conversion is missing', () => {
    expect(getPaymentAmountInBookingCurrency(payment({ amount: 800, currency: 'EUR' }), 'PLN')).toBe(0);
  });

  it('subtracts refunds and ignores incomplete payments', () => {
    expect(getPaymentAmountInBookingCurrency(payment({ amount: 1000, refundedAmount: 250 }), 'EUR')).toBe(750);
    expect(getPaymentAmountInBookingCurrency(payment({ amount: 1000, status: 'pending' }), 'EUR')).toBe(0);
    expect(getPaymentAmountInBookingCurrency(payment({ amount: 100, paymentType: 'refund' }), 'EUR')).toBe(-100);
  });
});

describe('getEffectivePaidAmount', () => {
  it('does not invent a booking-currency payment from legacy USD totals', () => {
    expect(getEffectivePaidAmount(9500, 2470, 0, 2470)).toBe(0);
  });

  it('keeps the recorded booking-currency amount despite higher USD snapshots', () => {
    expect(getEffectivePaidAmount(45000, 2000, 18000, 2065)).toBe(18000);
  });
});

describe('retreat email template language filtering', () => {
  const templates = [
    { _id: 'en', name: 'English', subject: '', bodyText: '', language: 'en' },
    { _id: 'cz', name: 'Czech', subject: '', bodyText: '', language: 'cs' },
    { _id: 'pl', name: 'Polish', subject: '', bodyText: '', language: 'pl' },
    { _id: 'default', name: 'Default English', subject: '', bodyText: '' },
  ];

  it('normalizes supported template language aliases', () => {
    expect(normalizeTemplateLanguage('CS')).toBe('cz');
    expect(normalizeTemplateLanguage('cz')).toBe('cz');
    expect(normalizeTemplateLanguage(undefined)).toBe('en');
  });

  it('returns only templates for the selected language and preserves all-language mode', () => {
    expect(filterRetreatEmailTemplates(templates, 'cz').map((template) => template._id)).toEqual(['cz']);
    expect(filterRetreatEmailTemplates(templates, 'en').map((template) => template._id)).toEqual(['en', 'default']);
    expect(filterRetreatEmailTemplates(templates, 'all')).toHaveLength(4);
  });

  it('searches by template name, key, subject, display id and language', () => {
    const template: any = { display_id: 42, name: 'Arrival address', templateKey: 'arrival_address', subject: 'Your retreat location', language: 'en' };
    const searchText = retreatEmailTemplateSearchText(template);
    expect(searchText).toContain('arrival_address');
    expect(searchText).toContain('your retreat location');
    expect(searchText).toContain('42');
  });
});

describe('isTabAvailableForRetreat', () => {
  it('allows all tabs when retreat is null or undefined', () => {
    expect(isTabAvailableForRetreat('ceremonies', null)).toBe(true);
    expect(isTabAvailableForRetreat('drugScreening', undefined)).toBe(true);
  });

  it('allows all tabs for regular retreat', () => {
    const regularRetreat: any = { type: 'regular' };
    expect(isTabAvailableForRetreat('ceremonies', regularRetreat)).toBe(true);
    expect(isTabAvailableForRetreat('drugScreening', regularRetreat)).toBe(true);
    expect(isTabAvailableForRetreat('holisticView', regularRetreat)).toBe(true);
    expect(isTabAvailableForRetreat('clients', regularRetreat)).toBe(true);
    expect(isTabAvailableForRetreat('foodMatrix', regularRetreat)).toBe(true);
  });

  it('hides ceremonies, drugScreening, and holisticView for learning_weekend and workshop', () => {
    const weekendRetreat: any = { type: 'learning_weekend' };
    expect(isTabAvailableForRetreat('ceremonies', weekendRetreat)).toBe(false);
    expect(isTabAvailableForRetreat('drugScreening', weekendRetreat)).toBe(false);
    expect(isTabAvailableForRetreat('holisticView', weekendRetreat)).toBe(false);
    expect(isTabAvailableForRetreat('clients', weekendRetreat)).toBe(true);
    expect(isTabAvailableForRetreat('foodMatrix', weekendRetreat)).toBe(true);
    expect(isTabAvailableForRetreat('payments', weekendRetreat)).toBe(true);

    const workshopRetreat: any = { type: 'workshop' };
    expect(isTabAvailableForRetreat('ceremonies', workshopRetreat)).toBe(false);
    expect(isTabAvailableForRetreat('drugScreening', workshopRetreat)).toBe(false);
  });

  it('strictly respects availableTabs when provided on capabilities', () => {
    const customRetreat: any = {
      type: 'custom',
      capabilities: {
        availableTabs: ['clients', 'payments', 'tasks'],
      },
    };
    expect(isTabAvailableForRetreat('clients', customRetreat)).toBe(true);
    expect(isTabAvailableForRetreat('payments', customRetreat)).toBe(true);
    expect(isTabAvailableForRetreat('tasks', customRetreat)).toBe(true);
    expect(isTabAvailableForRetreat('ceremonies', customRetreat)).toBe(false);
    expect(isTabAvailableForRetreat('drugScreening', customRetreat)).toBe(false);
    expect(isTabAvailableForRetreat('foodMatrix', customRetreat)).toBe(false);
  });
});

describe('percentOf', () => {
  it('rounds the share of part against whole', () => {
    expect(percentOf(13936, 15730)).toBe(89);
    expect(percentOf(13936, 16900)).toBe(82);
    expect(percentOf(0, 1170)).toBe(0);
  });

  it('is safe against a zero or negative whole instead of dividing by it', () => {
    expect(percentOf(100, 0)).toBe(0);
    expect(percentOf(100, -5)).toBe(0);
  });

  it('clamps to the 0-100 range', () => {
    expect(percentOf(150, 100)).toBe(100);
    expect(percentOf(-10, 100)).toBe(0);
  });
});
