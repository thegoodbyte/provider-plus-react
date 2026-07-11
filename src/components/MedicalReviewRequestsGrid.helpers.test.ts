import { matchesReviewRequestFilters, getReviewRequestFilterText } from './MedicalReviewRequestsGrid.helpers';

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
});
