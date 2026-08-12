import { indexBookingStepActionLogs, indexBookingStepDocuments, indexBookingStepItems, indexBookingStepPayments, indexBookingStepTemplates } from './bookingStepIndexes';

describe('bookingStepIndexes', () => {
  it('indexes items by booking and key', () => {
    const item: any = { bookingId: { _id: 'booking' }, key: 'contract' };
    expect(indexBookingStepItems([item]).get('booking:contract')).toBe(item);
  });

  it('indexes templates by id and key while skipping absent aliases', () => {
    const first: any = { _id: 'id', key: 'key' };
    const second: any = {};
    const map = indexBookingStepTemplates([first, second]);
    expect(map.get('id')).toBe(first);
    expect(map.get('key')).toBe(first);
    expect(map.size).toBe(2);
  });

  it('groups and sorts action logs newest first', () => {
    const old: any = { bookingFlowItemId: 'item', performedAt: '2026-01-01' };
    const recent: any = { bookingFlowItemId: { _id: 'item' }, createdAt: '2026-02-01' };
    const undated: any = { bookingFlowItemId: 'item' };
    const map = indexBookingStepActionLogs([old, { createdAt: '2026-03-01' } as any, undated, recent]);
    expect(map.get('item')).toEqual([recent, old, undated]);
    expect(map.size).toBe(1);
  });

  it('indexes only populated booking documents and normalizes their type', () => {
    const old: any = { bookingId: 'booking', documentType: 'Liver Panel', files: [{}], receivedAt: '2026-01-01' };
    const recent: any = { bookingId: { _id: 'booking' }, documentType: 'liver-panel', files: [{}], createdAt: '2026-02-01' };
    const undated: any = { bookingId: 'booking', documentType: 'liver_panel', files: [{}] };
    const map = indexBookingStepDocuments([old, recent, undated, { bookingId: 'booking', documentType: 'empty', files: [] } as any, { bookingId: 'booking', documentType: '', files: [{}] } as any, { documentType: 'bad', files: [{}] } as any]);
    expect(map.get('booking:liver_panel')).toEqual([recent, old, undated]);
    expect(map.size).toBe(1);
  });

  it('groups and sorts payments by client', () => {
    const old: any = { clientId: 'client', paymentDate: '2026-01-01' };
    const recent: any = { clientId: { _id: 'client' }, paymentDate: '2026-02-01' };
    const undated: any = { clientId: 'client' };
    const map = indexBookingStepPayments([old, { amount: 1 } as any, undated, recent]);
    expect(map.get('client')).toEqual([recent, old, undated]);
    expect(map.size).toBe(1);
  });
});
