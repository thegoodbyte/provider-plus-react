import {
  buildBookingStepDeadlineRows,
  filterBookingStepDeadlineRows,
  getBookingStepDeadlinesSummary,
} from './BookingStepDeadlinesPage.helpers';

describe('BookingStepDeadlinesPage helpers', () => {
  it('sorts deadlines by due date and builds readable labels', () => {
    const rows = buildBookingStepDeadlineRows([
      {
        _id: 'item-2',
        key: 'liver_received',
        title: 'Entry liver panel received',
        category: 'medical',
        dueDate: '2026-07-12T10:00:00.000Z',
        status: 'pending',
        bookingId: { _id: 'booking-2', bookingNumber: 22 },
        clientId: { _id: 'client-2', firstName: 'Barbara', lastName: 'Peicher', display_id: 1018 },
        retreatId: { _id: 'retreat-1', code: 'JNO-07-25-26', name: 'JNO Retreat' },
        notes: 'Check later',
      },
      {
        _id: 'item-1',
        key: 'ekg_received',
        title: 'Entry EKG received',
        category: 'medical',
        dueDate: '2026-07-10T10:00:00.000Z',
        status: 'received',
        bookingId: { _id: 'booking-1', bookingNumber: 21 },
        clientId: { _id: 'client-1', firstName: 'Jacek', lastName: 'Jacewicz', display_id: 1107 },
        retreatId: { _id: 'retreat-1', code: 'JNO-07-25-26', name: 'JNO Retreat' },
      },
    ] as any);

    expect(rows.map((row) => row.stepTitle)).toEqual([
      'Entry EKG received',
      'Entry liver panel received',
    ]);
    expect(rows[0].clientLabel).toBe('Jacek Jacewicz #1107');
    expect(rows[0].bookingLabel).toBe('#21');
    expect(rows[0].retreatLabel).toContain('JNO-07-25-26');
  });

  it('filters by retreat, step, date, and search text', () => {
    const rows = buildBookingStepDeadlineRows([
      {
        _id: 'item-1',
        key: 'ekg_received',
        title: 'Entry EKG received',
        category: 'medical',
        dueDate: '2026-07-10T10:00:00.000Z',
        status: 'received',
        bookingId: { _id: 'booking-1', bookingNumber: 21 },
        clientId: { _id: 'client-1', firstName: 'Jacek', lastName: 'Jacewicz' },
        retreatId: { _id: 'retreat-1', code: 'JNO-07-25-26' },
      },
      {
        _id: 'item-2',
        key: 'liver_received',
        title: 'Entry liver panel received',
        category: 'medical',
        dueDate: '2026-07-12T10:00:00.000Z',
        status: 'pending',
        bookingId: { _id: 'booking-2', bookingNumber: 22 },
        clientId: { _id: 'client-2', firstName: 'Barbara', lastName: 'Peicher' },
        retreatId: { _id: 'retreat-2', code: 'BEN-09-22-26' },
      },
    ] as any);

    expect(filterBookingStepDeadlineRows(rows, {
      search: 'jacek',
      retreatId: '',
      stepKey: '',
      dateFrom: '',
      dateTo: '',
    })).toHaveLength(1);

    expect(filterBookingStepDeadlineRows(rows, {
      search: '',
      retreatId: 'retreat-2',
      stepKey: '',
      dateFrom: '',
      dateTo: '',
    })).toHaveLength(1);

    expect(filterBookingStepDeadlineRows(rows, {
      search: '',
      retreatId: '',
      stepKey: 'ekg_received',
      dateFrom: '2026-07-11',
      dateTo: '',
    })).toHaveLength(0);
  });

  it('calculates summary counts', () => {
    const summary = getBookingStepDeadlinesSummary(
      buildBookingStepDeadlineRows([
        {
          _id: 'item-1',
          key: 'ekg_received',
          title: 'Entry EKG received',
          category: 'medical',
          dueDate: '2026-07-10T10:00:00.000Z',
          status: 'pending',
          bookingId: { _id: 'booking-1', bookingNumber: 21 },
          clientId: { _id: 'client-1', firstName: 'Jacek', lastName: 'Jacewicz' },
          retreatId: { _id: 'retreat-1', code: 'JNO-07-25-26' },
        },
      ] as any),
    );

    expect(summary.total).toBe(1);
    expect(summary.retreats).toBe(1);
    expect(summary.dueSoon).toBeGreaterThanOrEqual(0);
  });
});
