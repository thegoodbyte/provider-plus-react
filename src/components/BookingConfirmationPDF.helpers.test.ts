import { buildBookingConfirmationRequirementRows, fulfilledBookingFlowStatuses } from './BookingConfirmationPDF.helpers';

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
});
