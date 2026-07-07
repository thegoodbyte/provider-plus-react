import { buildBookingFlowArtifactFilters } from './bookingFlowLookup';

describe('bookingFlowLookup', () => {
  it('collects booking flow item ids and keys into csv filters', () => {
    const filters = buildBookingFlowArtifactFilters([
      { _id: { _id: 'item-1' }, key: 'ekg_received' } as any,
      { _id: 'item-2', key: 'liver_received' } as any,
      { _id: 'item-2', key: 'liver_received' } as any,
    ]);

    expect(filters).toEqual({
      bookingFlowItemId: 'item-1,item-2',
      bookingFlowItemKey: 'ekg_received,liver_received',
    });
  });
});
