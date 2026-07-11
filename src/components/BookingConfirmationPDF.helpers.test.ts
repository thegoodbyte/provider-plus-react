import { buildBookingConfirmationRequirementRows, formatPaymentRequestDisplayLabel, fulfilledBookingFlowStatuses } from './BookingConfirmationPDF.helpers';

describe('BookingConfirmationPDF helpers', () => {
  it('prefers booking flow step deadlines over fallback payment-based dates', () => {
    const rows = buildBookingConfirmationRequirementRows(
      [
        {
          key: 'ekg_received',
          title: 'Entry EKG received',
          status: 'received',
          dueDate: '2026-07-31T00:00:00.000Z',
        } as any,
        {
          key: 'liver_received',
          title: 'Entry liver panel received',
          status: 'pending',
          dueDate: '2026-07-31T00:00:00.000Z',
        } as any,
        {
          key: 'contract_signed',
          title: 'Contract received',
          status: 'received',
          dueDate: '2026-07-13T00:00:00.000Z',
          metadata: { requirementType: 'contract_signed' },
        } as any,
      ],
      {
        ekg: new Date('2026-06-19T00:00:00.000Z'),
        liver: new Date('2026-06-19T00:00:00.000Z'),
        contract: new Date('2026-06-01T00:00:00.000Z'),
      }
    );

    expect(rows.map((row) => row.deadline?.toISOString())).toEqual([
      '2026-07-31T00:00:00.000Z',
      '2026-07-31T00:00:00.000Z',
      '2026-07-13T00:00:00.000Z',
    ]);
    expect(rows.map((row) => row.complete)).toEqual([true, false, true]);
  });

  it('treats fulfilled booking flow statuses as completed', () => {
    expect(fulfilledBookingFlowStatuses.has('received')).toBe(true);
    expect(fulfilledBookingFlowStatuses.has('reviewed')).toBe(true);
    expect(fulfilledBookingFlowStatuses.has('pending')).toBe(false);
  });

  it('formats a payment request label from invoice number, display id, or raw string', () => {
    expect(formatPaymentRequestDisplayLabel({ invoiceNumber: 'PR-1042' })).toBe('PR-1042');
    expect(formatPaymentRequestDisplayLabel({ display_id: 1042 })).toBe('1042');
    expect(formatPaymentRequestDisplayLabel({ _id: '507f1f77bcf86cd799439011' })).toBe('507f1f77bcf86cd799439011');
    expect(formatPaymentRequestDisplayLabel(' custom-id ')).toBe('custom-id');
    expect(formatPaymentRequestDisplayLabel(null)).toBe('');
  });
});
