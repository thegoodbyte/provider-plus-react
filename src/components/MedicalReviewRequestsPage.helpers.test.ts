import {
  getAssociatedMedicalReviewRequests,
  formatMedicalReviewDecisionLabel,
  formatMedicalReviewRequestSummary,
  normalizeMedicalReviewDecision,
  sortMedicalReviewRequestsNewestFirst,
  splitMedicalReviewRequestsByTimeline,
} from './MedicalReviewRequestsPage.helpers';
import { MedicalReviewRequest } from '../types';

const makeRequest = (overrides: Partial<MedicalReviewRequest>): MedicalReviewRequest => ({
  medicalArtifactId: 'artifact-1',
  medicalReviewerId: 'advisor-1',
  assignedBy: 'admin',
  assignedDate: '2026-07-01T10:00:00.000Z',
  reviewNotes: '',
  status: 'pending',
  previousReviewRequestId: undefined,
  ...overrides,
});

describe('splitMedicalReviewRequestsByTimeline', () => {
  it('splits previous and following requests using the linked request chain', () => {
    const previous = makeRequest({
      _id: 'req-1',
      display_id: 1,
      requestedAt: '2026-06-01T10:00:00.000Z',
    });
    const current = makeRequest({
      _id: 'req-2',
      display_id: 2,
      requestedAt: '2026-06-10T10:00:00.000Z',
      previousReviewRequestId: previous._id,
    });
    const following = makeRequest({
      _id: 'req-3',
      display_id: 3,
      requestedAt: '2026-06-20T10:00:00.000Z',
      previousReviewRequestId: current._id,
    });

    const result = splitMedicalReviewRequestsByTimeline(current, [previous, following]);

    expect(result.previousRequests.map((request) => request._id)).toEqual(['req-1']);
    expect(result.followingRequests.map((request) => request._id)).toEqual(['req-3']);
  });

  it('falls back to timestamps when the chain is missing', () => {
    const current = makeRequest({
      _id: 'req-2',
      display_id: 2,
      requestedAt: '2026-06-10T10:00:00.000Z',
    });
    const previous = makeRequest({
      _id: 'req-1',
      display_id: 1,
      requestedAt: '2026-06-01T10:00:00.000Z',
    });
    const following = makeRequest({
      _id: 'req-3',
      display_id: 3,
      requestedAt: '2026-06-20T10:00:00.000Z',
    });

    const result = splitMedicalReviewRequestsByTimeline(current, [following, previous]);

    expect(result.previousRequests.map((request) => request._id)).toEqual(['req-1']);
    expect(result.followingRequests.map((request) => request._id)).toEqual(['req-3']);
  });
});

describe('medical review request helpers', () => {
  it('formats review decisions with advisor-friendly labels', () => {
    expect(formatMedicalReviewDecisionLabel('OK')).toBe('OK');
    expect(formatMedicalReviewDecisionLabel('caution')).toBe('Caution');
    expect(formatMedicalReviewDecisionLabel('more_info_needed')).toBe('More Info Needed');
    expect(formatMedicalReviewDecisionLabel('NOT OK')).toBe('Declined');
    expect(formatMedicalReviewDecisionLabel('approved')).toBe('OK');
    expect(formatMedicalReviewDecisionLabel('declined')).toBe('Declined');
    expect(formatMedicalReviewDecisionLabel('needs_more_info')).toBe('More Info Needed');
  });

  it('normalizes legacy decision values to the canonical request-state values', () => {
    expect(normalizeMedicalReviewDecision('approved')).toBe('OK');
    expect(normalizeMedicalReviewDecision('needs_more_info')).toBe('more_info_needed');
    expect(normalizeMedicalReviewDecision('declined')).toBe('NOT OK');
  });

  it('formats a compact request summary without repeating the request type', () => {
    const request = makeRequest({
      documentStage: 'entry',
      documentType: 'EKG',
    });

    expect(formatMedicalReviewRequestSummary(request)).toBe('Entry • EKG');
  });

  it('sorts the review queue newest first', () => {
    const older = makeRequest({ _id: 'older', requestedAt: '2026-06-01T10:00:00.000Z' });
    const newer = makeRequest({ _id: 'newer', requestedAt: '2026-06-20T10:00:00.000Z' });
    expect(sortMedicalReviewRequestsNewestFirst([older, newer]).map((request) => request._id)).toEqual(['newer', 'older']);
  });

  it('returns all other client review requests in timeline order for associated links', () => {
    const older = makeRequest({
      _id: 'req-1',
      display_id: 1001,
      requestedAt: '2026-06-01T10:00:00.000Z',
      documentStage: 'entry',
      documentType: 'EKG',
    });
    const current = makeRequest({
      _id: 'req-2',
      display_id: 1002,
      requestedAt: '2026-06-10T10:00:00.000Z',
      documentStage: 'entry',
      documentType: 'Liver',
    });
    const newer = makeRequest({
      _id: 'req-3',
      display_id: 1003,
      requestedAt: '2026-06-20T10:00:00.000Z',
      documentStage: 'pre_ceremony',
      documentType: 'EKG',
    });

    expect(getAssociatedMedicalReviewRequests(current, [newer, current, older]).map((request) => request._id)).toEqual([
      'req-1',
      'req-3',
    ]);
  });
});
