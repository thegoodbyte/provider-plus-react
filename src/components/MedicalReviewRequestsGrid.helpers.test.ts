import { matchesReviewRequestFilters, getReviewRequestFilterText, sortMedicalReviewPacketsByExpiry, sortMedicalReviewsPendingFirst } from './MedicalReviewRequestsGrid.helpers';

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
});
