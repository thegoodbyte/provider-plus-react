import { indexBookingStepArtifactsByContext, indexBookingStepArtifactsById, indexBookingStepReviewsByArtifact, indexBookingStepReviewsByContext, makeBookingStepArtifactContextKey, makeBookingStepReviewContextKey, sortBookingStepMedicalArtifacts, sortBookingStepReviewRequests } from './bookingStepMedicalIndexes';
import { reviewStepConfigByKey } from './bookingStepMedicalLinks';

describe('bookingStepMedicalIndexes', () => {
  const config = reviewStepConfigByKey.ekg_sent_for_review;
  const artifact = (overrides: any = {}) => ({ _id: 'a', bookingId: 'b', documentStage: 'entry', documentType: 'EKG', artifactType: 'ekg', receivedAt: '2026-02-01', ...overrides });
  const request = (overrides: any = {}) => ({ _id: 'r', requestType: 'ekg_review', artifactIds: [artifact()], requestedAt: '2026-02-01', ...overrides });

  it('builds stable context keys and sorts without mutating inputs', () => {
    expect(makeBookingStepReviewContextKey('b', config)).toBe('b:entry:EKG:ekg:ekg_review');
    expect(makeBookingStepArtifactContextKey('b', config)).toBe('b:entry:EKG:ekg');
    const artifacts: any[] = [artifact({ _id: 'old', receivedAt: '2026-01-01' }), artifact({ _id: 'new', receivedAt: undefined, createdAt: '2026-03-01' }), artifact({ _id: 'none', receivedAt: undefined })];
    expect(sortBookingStepMedicalArtifacts(artifacts).map((x) => x._id)).toEqual(['new', 'old', 'none']);
    expect(artifacts[0]._id).toBe('old');
    const requests: any[] = [request({ _id: 'old', requestedAt: '2026-01-01' }), request({ _id: 'new' }), request({ _id: 'none', requestedAt: undefined })];
    expect(sortBookingStepReviewRequests(requests).map((x) => x._id)).toEqual(['new', 'old', 'none']);
  });

  it('indexes valid artifacts by id and booking context', () => {
    const fromData = artifact({ _id: 'data', bookingId: undefined, data: { booking_id: 'b' }, receivedAt: '2026-03-01' });
    const noId = artifact({ _id: undefined });
    expect(indexBookingStepArtifactsById([artifact(), noId] as any).size).toBe(1);
    const map = indexBookingStepArtifactsByContext([artifact(), fromData, artifact({ documentType: undefined }), artifact({ bookingId: undefined, data: {} })] as any);
    expect(map.get('b:entry:EKG:ekg')?.map((x) => x._id)).toEqual(['data', 'a']);
  });

  it('indexes reviews by populated and string artifact ids', () => {
    const old = request({ _id: 'old', artifactIds: ['a'], requestedAt: '2026-01-01' });
    const recent = request({ _id: 'new' });
    expect(indexBookingStepReviewsByArtifact([old, recent] as any).get('a')?.map((x) => x._id)).toEqual(['new', 'old']);
  });

  it('indexes only reviews matching complete medical context', () => {
    const valid = request();
    const mismatches = [
      request({ requestType: 'liver_panel_review' }), request({ documentStage: 'additional' }), request({ documentType: 'Liver' }),
      request({ artifactIds: [artifact({ documentStage: 'additional' })] }), request({ artifactIds: [artifact({ documentType: 'Liver' })] }), request({ artifactIds: [artifact({ artifactType: 'liver_panel' })] }),
      request({ artifactIds: ['a'] }), request({ artifactIds: [artifact({ bookingId: undefined })] }), request({ artifactIds: [null] }),
    ];
    const map = indexBookingStepReviewsByContext([valid, ...mismatches] as any);
    expect(map.get('b:entry:EKG:ekg:ekg_review')).toEqual([valid]);
  });
});
