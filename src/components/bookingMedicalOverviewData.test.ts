import { bookingFlowApi, medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';
import { artifactTime, compareMedicalArtifacts, findRequiredEntryFlowItem, groupMedicalArtifacts, indexMedicalReviews, latestArtifactReview, loadBookingMedicalOverview, recordsSummary, relevantMedicalArtifact, requiredEntryRows, reviewTime } from './bookingMedicalOverviewData';
jest.mock('../services/api', () => ({ bookingFlowApi: { getItems: jest.fn() }, medicalArtifactsApi: { getForBooking: jest.fn(), getAll: jest.fn() }, medicalReviewRequestsApi: { getByArtifacts: jest.fn() } }));
describe('booking medical overview data', () => {
  beforeEach(() => { jest.clearAllMocks(); (bookingFlowApi.getItems as jest.Mock).mockResolvedValue({ data: [] }); (medicalArtifactsApi.getForBooking as jest.Mock).mockResolvedValue({ data: [] }); (medicalArtifactsApi.getAll as jest.Mock).mockResolvedValue({ data: [] }); (medicalReviewRequestsApi.getByArtifacts as jest.Mock).mockResolvedValue({ data: [] }); });
  it('loads, deduplicates, scopes, sorts and reviews artifacts', async () => {
    (bookingFlowApi.getItems as jest.Mock).mockResolvedValue({ data: [{ _id: 'plan', status: 'pending', metadata: { medicationStopPlan: true } }, { _id: 'cancelled', status: 'cancelled', metadata: { medicationStopPlan: true } }] });
    (medicalArtifactsApi.getForBooking as jest.Mock).mockResolvedValue({ data: [{ _id: 'a', bookingId: 'booking', artifactType: 'ekg', documentStage: 'entry', files: [{}], createdAt: '2026-01-01' }, { _id: 'other', bookingId: 'other' }] });
    (medicalReviewRequestsApi.getByArtifacts as jest.Mock).mockResolvedValue({ data: [{ _id: 'r', artifactIds: ['a'], reviewedAt: '2026-02-01' }] });
    const result = await loadBookingMedicalOverview('booking', 'client', 'retreat'); expect(result.artifacts.map(item => item._id)).toEqual(['a']); expect(result.reviewsByArtifact.a[0]._id).toBe('r'); expect(result.medicationPlan.map((item: any) => item._id)).toEqual(['plan']); expect(result.flowItems.map((item: any) => item._id)).toEqual(['plan', 'cancelled']);
    expect(medicalArtifactsApi.getForBooking).toHaveBeenCalledTimes(1);
  });
  it('skips review requests without artifacts and uses one booking artifact endpoint', async () => { const result = await loadBookingMedicalOverview('booking'); expect(result.artifacts).toEqual([]); expect(medicalReviewRequestsApi.getByArtifacts).not.toHaveBeenCalled(); expect(medicalArtifactsApi.getForBooking).toHaveBeenCalledTimes(1); expect(medicalArtifactsApi.getAll).not.toHaveBeenCalled(); });
  it('indexes all review references in newest order', () => { const old: any = { _id: 'old', artifactIds: ['a'], medicalArtifactId: 'b', artifactId: 'c', fileReviews: [{ artifactId: 'd' }], createdAt: '2026-01-01' }; const fresh: any = { _id: 'new', artifactIds: ['a', 'a'], requestedAt: '2026-02-01' }; const result = indexMedicalReviews([old, fresh]); expect(result.a.map(item => item._id)).toEqual(['new', 'old']); expect(Object.keys(result).sort()).toEqual(['a', 'b', 'c', 'd']); expect(reviewTime({ reviewedAt: '2026-03-01' } as any)).toBeGreaterThan(reviewTime(old)); expect(reviewTime({} as any)).toBe(0); });
  it('scopes booking and retreat artifacts', () => { expect(relevantMedicalArtifact({ bookingId: 'b' } as any, 'b')).toBe(true); expect(relevantMedicalArtifact({ data: { bookingId: 'x' } } as any, 'b')).toBe(false); expect(relevantMedicalArtifact({ retreatId: 'r' } as any, 'b', 'r')).toBe(true); expect(relevantMedicalArtifact({ data: { retreatId: 'x' } } as any, 'b', 'r')).toBe(false); expect(relevantMedicalArtifact({ retreatId: 'r' } as any, 'b')).toBe(false); expect(relevantMedicalArtifact({} as any, 'b')).toBe(true); });
  it('groups stages and resolves required entry rows and latest review', () => { const ekg: any = { _id: 'e', artifactType: 'ekg', documentStage: 'entry' }; const liver: any = { _id: 'l', documentType: 'Liver' }; const reviews: any = { e: [{ _id: 'old', createdAt: '2026-01-01' }, { _id: 'new', createdAt: '2026-02-01' }] }; expect(groupMedicalArtifacts([ekg, liver]).entry).toHaveLength(2); const rows = requiredEntryRows([ekg, liver], reviews); expect(rows.map(row => row.artifact?._id)).toEqual(['e', 'l']); expect(rows[0].review?._id).toBe('new'); expect(latestArtifactReview({} as any, reviews)).toBeUndefined(); });
  it('sorts files first and then newest', () => { const old: any = { createdAt: '2026-01-01' }; const newer: any = { createdAt: '2026-02-01' }; const file: any = { createdAt: '2025-01-01', files: [{}] }; expect(compareMedicalArtifacts(file, newer)).toBeLessThan(0); expect(compareMedicalArtifacts(newer, old)).toBeLessThan(0); expect(artifactTime(newer)).toBeGreaterThan(artifactTime(old)); });
  it('summarizes record counts by decision and MRR presence', () => {
    const missing: any = {};
    const received: any = { _id: 'r1', files: [{}] };
    const decided: any = { _id: 'r2', files: [{}] };
    const reviews: any = { r2: [{ reviewDecision: 'OK', status: 'completed' }] };
    const summary = recordsSummary([missing, received, decided], reviews);
    expect(summary).toEqual({ total: 3, undecided: 2, noMrr: 2 });
  });
  it('finds the required-entry booking-flow item by key, readiness group, or expected artifact', () => {
    const items = [
      { _id: 'by-key', key: 'ekg_received' },
      { _id: 'by-group', metadata: { readinessGroup: 'liver' } },
      { _id: 'by-template', templateId: { expectedArtifact: 'ekg' } },
    ];
    expect(findRequiredEntryFlowItem(items, 'EKG')?._id).toBe('by-key');
    expect(findRequiredEntryFlowItem([items[1]], 'Liver')?._id).toBe('by-group');
    expect(findRequiredEntryFlowItem([items[2]], 'EKG')?._id).toBe('by-template');
    expect(findRequiredEntryFlowItem([], 'EKG')).toBeUndefined();
  });
});
