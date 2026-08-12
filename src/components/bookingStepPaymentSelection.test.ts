import { buildBookingStepPaymentSelection, resolveBookingStepPaymentDate } from './bookingStepPaymentSelection';

describe('bookingStepPaymentSelection', () => {
  const now = new Date('2026-08-12T12:00:00.000Z');
  const payment: any = { _id: 'payment', display_id: 42, amount: 100, currency: 'EUR', paymentDate: '2026-08-10T10:00:00.000Z', paymentMethod: 'bank_transfer', status: 'completed' };

  it('uses valid payment dates and falls back to now for absent or invalid dates', () => {
    expect(resolveBookingStepPaymentDate(payment, now)).toBe('2026-08-10T10:00:00.000Z');
    expect(resolveBookingStepPaymentDate({ ...payment, paymentDate: undefined }, now)).toBe(now.toISOString());
    expect(resolveBookingStepPaymentDate({ ...payment, paymentDate: 'invalid' }, now)).toBe(now.toISOString());
  });

  it('rejects missing items, ids, and unknown payments', () => {
    expect(buildBookingStepPaymentSelection(undefined, 'payment', [payment], now)).toBeNull();
    expect(buildBookingStepPaymentSelection({ status: 'pending' } as any, 'payment', [payment], now)).toBeNull();
    expect(buildBookingStepPaymentSelection({ _id: 'item' } as any, '', [payment], now)).toBeNull();
    expect(buildBookingStepPaymentSelection({ _id: 'item' } as any, 'missing', [payment], now)).toBeNull();
  });

  it('builds received update metadata and an auditable action', () => {
    const result = buildBookingStepPaymentSelection({ _id: 'item', status: 'pending', metadata: { retained: true } } as any, 'payment', [payment], now)!;
    expect(result.payment).toBe(payment);
    expect(result.metadata).toMatchObject({ retained: true, paymentId: 'payment', paymentDisplayId: 42, paymentAmount: 100, paymentCurrency: 'EUR', paymentMethod: 'bank_transfer', paymentStatus: 'completed' });
    expect(result.update).toEqual({ status: 'received', receivedAt: '2026-08-10T10:00:00.000Z', metadata: result.metadata });
    expect(result.action).toMatchObject({ actionType: 'manual_mark', actionKey: 'payment_selected', actionLabel: 'Payment selected', statusAfter: 'received', notes: 'Payment #42 selected for Payment received.', metadata: result.metadata });
  });

  it('uses the internal payment id in audit notes without a display id', () => {
    const result = buildBookingStepPaymentSelection({ _id: 'item' } as any, 'payment', [{ ...payment, display_id: undefined }], now)!;
    expect(result.action.notes).toBe('Payment payment selected for Payment received.');
  });
});
