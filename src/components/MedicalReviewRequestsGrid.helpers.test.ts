import { formatMedicalReviewCreatedAt, getClientProfileHref, groupWhatsappHandledByRetreat, matchesReviewRequestFilters, getReviewRequestFilterText, sortMedicalReviewPacketsByExpiry, sortMedicalReviewsPendingFirst } from './MedicalReviewRequestsGrid.helpers';

describe('MedicalReviewRequestsGrid helpers', () => {
  const request: any = {
    display_id: 1012,
    clientName: 'Marta Legezinska',
    retreatName: 'JNO-07-25-26',
    requestType: 'ekg_review',
    documentStage: 'entry',
    documentType: 'EKG',
    source: 'medical-artifacts',
    requestedAt: '2026-07-10T10:00:00.000Z',
  };

  it('builds searchable text across request fields', () => {
    const text = getReviewRequestFilterText(request);
    expect(text).toContain('marta legezinska');
    expect(text).toContain('ekg_review');
    expect(text).toContain('jno-07-25-26');
  });

  it('matches text, type, and date filters', () => {
    expect(matchesReviewRequestFilters(request, { searchTerm: 'marta', typeFilter: 'all' })).toBe(true);
    expect(matchesReviewRequestFilters(request, { searchTerm: 'liver', typeFilter: 'all' })).toBe(false);
    expect(matchesReviewRequestFilters(request, { searchTerm: 'marta', typeFilter: 'ekg' })).toBe(true);
    expect(matchesReviewRequestFilters(request, { searchTerm: '', typeFilter: 'liver' })).toBe(false);
    expect(matchesReviewRequestFilters(request, { searchTerm: '', typeFilter: 'ekg', dateFrom: '2026-07-11' })).toBe(false);
    expect(matchesReviewRequestFilters(request, { searchTerm: '', typeFilter: 'ekg', dateFrom: '2026-07-09', dateTo: '2026-07-11' })).toBe(true);
  });

  it('sorts pending reviews first and packets by ascending expiry', () => {
    expect(sortMedicalReviewsPendingFirst([
      { _id: 'approved', status: 'approved', display_id: 3 },
      { _id: 'caution', status: 'caution', display_id: 2 },
      { _id: 'pending', status: 'pending', display_id: 1 },
    ] as any).map((item) => item._id)).toEqual(['pending', 'caution', 'approved']);

    expect(sortMedicalReviewPacketsByExpiry([
      { _id: 'later', title: 'Later', endDate: '2026-11-01' },
      { _id: 'none', title: 'No expiry' },
      { _id: 'earlier', title: 'Earlier', endDate: '2026-09-01' },
    ] as any).map((item) => item._id)).toEqual(['earlier', 'later', 'none']);
  });

  it('formats the MRR creation timestamp and handles missing or invalid values', () => {
    expect(formatMedicalReviewCreatedAt('2026-09-02T16:15:00.000Z', 'en-US', 'UTC')).toMatch(/Sep 2, 2026.*4:15 PM/);
    expect(formatMedicalReviewCreatedAt(undefined, 'en-US', 'UTC')).toBe('—');
    expect(formatMedicalReviewCreatedAt('not-a-date', 'en-US', 'UTC')).toBe('—');
  });
});

describe('getClientProfileHref (PPVC-692)', () => {
  it('links to the admin medical client view from the admin route', () => {
    expect(getClientProfileHref({ clientId: 'client-1' }, false)).toBe('/admin/medical/client-1');
    expect(getClientProfileHref({ clientId: { _id: 'client-2' } as any }, false)).toBe('/admin/medical/client-2');
  });

  it('links to the medical-context client view from the advisor /medical route', () => {
    expect(getClientProfileHref({ clientId: 'client-1' }, true)).toBe('/medical/client/client-1');
  });

  it('returns undefined when there is no resolvable client id', () => {
    expect(getClientProfileHref({ clientId: undefined }, false)).toBeUndefined();
    expect(getClientProfileHref({ clientId: {} as any }, false)).toBeUndefined();
  });
});

describe('groupWhatsappHandledByRetreat (PPVC-695)', () => {
  const retreatOptions: any = [
    { _id: 'retreat-soon', retreatCode: 'JNO-01-15-27', startDate: '2027-01-15' },
    { _id: 'retreat-later', retreatCode: 'JNO-03-01-27', startDate: '2027-03-01' },
  ];

  const requests: any[] = [
    { _id: 'r1', display_id: 1, retreatId: 'retreat-later', reviewChannel: 'whatsapp', whatsappStatus: 'responded', whatsappSentAt: '2026-12-01T10:00:00.000Z' },
    { _id: 'r2', display_id: 2, retreatId: 'retreat-soon', reviewChannel: 'whatsapp', whatsappStatus: 'awaiting_response', whatsappSentAt: '2026-12-05T10:00:00.000Z' },
    { _id: 'r3', display_id: 3, retreatId: 'retreat-soon', reviewChannel: 'whatsapp', whatsappStatus: 'responded', whatsappSentAt: '2026-12-03T10:00:00.000Z' },
    { _id: 'r4', display_id: 4, retreatId: 'retreat-soon', reviewChannel: 'internal' },
  ];

  it('only includes MRRs handled via WhatsApp, grouped by retreat, retreats sorted soonest first', () => {
    const groups = groupWhatsappHandledByRetreat(requests, retreatOptions);
    expect(groups.map((group) => group.retreatId)).toEqual(['retreat-soon', 'retreat-later']);
    expect(groups[0].retreatName).toBe('JNO-01-15-27');
    expect(groups[0].requests.map((request) => request._id)).toEqual(['r2', 'r3']);
    expect(groups[1].requests.map((request) => request._id)).toEqual(['r1']);
  });

  it('sorts each retreat group by most-recently-sent first', () => {
    const groups = groupWhatsappHandledByRetreat(requests, retreatOptions);
    const soon = groups.find((group) => group.retreatId === 'retreat-soon')!;
    expect(soon.requests[0]._id).toBe('r2');
    expect(soon.requests[1]._id).toBe('r3');
  });

  it('puts a retreat with no known start date last', () => {
    const undated: any = { _id: 'r5', display_id: 5, retreatId: 'retreat-undated', reviewChannel: 'whatsapp', whatsappSentAt: '2026-12-01T10:00:00.000Z' };
    const groups = groupWhatsappHandledByRetreat([...requests, undated], retreatOptions);
    expect(groups.map((group) => group.retreatId)).toEqual(['retreat-soon', 'retreat-later', 'retreat-undated']);
    expect(groups[2].retreatName).toBe('Unknown Retreat');
  });

  it('applies the shared search/type/date filters before grouping', () => {
    const groups = groupWhatsappHandledByRetreat(requests, retreatOptions, { searchTerm: 'nomatch' });
    expect(groups).toEqual([]);
  });

  it('returns an empty list when nothing has been handled via WhatsApp', () => {
    expect(groupWhatsappHandledByRetreat([{ _id: 'r1', reviewChannel: 'internal' }] as any, retreatOptions)).toEqual([]);
  });
});
