import { bookingPaymentSummary, bookingSettlementSummary, confirmationState, hasReceivedEvidence, isActivePaymentRequest, isAccomplishedStatus, isSatisfiedStatus } from './bookingStatusSelectors';

describe('canonical booking status selectors', () => {
  it('separates sent requests from received evidence', () => {
    expect(hasReceivedEvidence('sent')).toBe(false);
    expect(isSatisfiedStatus('sent')).toBe(false);
    expect(isAccomplishedStatus('sent')).toBe(true);
    expect(isSatisfiedStatus('waived')).toBe(true);
  });

  it('combines legacy confirmation history with booking-flow state', () => {
    expect(confirmationState({ bookingConfirmationHistory: [] }, [{ key: 'booking_confirmation_sent', status: 'sent', sentAt: '2026-01-01' } as any])).toMatchObject({ sent: true, sentAt: '2026-01-01' });
    expect(confirmationState({ bookingConfirmationHistory: [] }, [{ key: 'booking_confirmation_sent', status: 'pending' } as any]).sent).toBe(false);
  });

  it('uses the same refund and currency rules for every payment view', () => {
    const summary = bookingPaymentSummary([
      { status: 'completed', amount: 500, currency: 'EUR' },
      { status: 'completed', amount: 200, refundedAmount: 50, currency: 'EUR' },
      { status: 'failed', amount: 1000, currency: 'EUR' },
      { status: 'completed', paymentType: 'refund', amount: 25, currency: 'EUR' },
      { status: 'completed', amount: 100, currency: 'USD', bookingCurrency: 'EUR', bookingCurrencyAmount: 90 },
    ] as any, 1000, 'EUR');
    expect(summary).toEqual({ received: 715, outstanding: 285, paidPercent: 72, paidInFull: false });
  });

  it('does not treat cancelled or paid requests as active', () => {
    expect(isActivePaymentRequest({ status: 'cancelled' } as any)).toBe(false);
    expect(isActivePaymentRequest({ status: 'paid' } as any)).toBe(false);
    expect(isActivePaymentRequest({ status: 'sent' } as any)).toBe(true);
  });

  it('reports an explicit USD overpayment for a mixed-currency booking', () => {
    expect(bookingSettlementSummary([
      { status: 'completed', amount: 1245, currency: 'USD', usd_amount: 1245 },
      { status: 'completed', amount: 805, currency: 'USD', usd_amount: 805 },
    ] as any, 7500, 'PLN', 1950)).toEqual({
      received: 2050, outstanding: 0, overpaid: 100, paidPercent: 100, paidInFull: true, basis: 'USD',
    });
  });

  it('reduces a stored booking-currency allocation proportionally after a partial refund', () => {
    const summary = bookingPaymentSummary([{
      status: 'completed', amount: 1000, currency: 'USD', refundedAmount: 250,
      bookingCurrency: 'PLN', bookingCurrencyAmount: 4000,
    }] as any, 5000, 'PLN');
    expect(summary.received).toBe(3000);
    expect(summary.outstanding).toBe(2000);
  });
});
