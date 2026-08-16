import { act, renderHook, waitFor } from '@testing-library/react';
import { bookingDocumentsApi, bookingFlowApi, medicalArtifactsApi } from '../services/api';
import { fetchBookingRequirementSources } from './bookingRequirementsLoader';
import { requirementDefinitions } from './bookingRequirementRows';
import { indexReviews, relevantArtifact, requirementErrorMessage, reviewTime, useBookingRequirements } from './useBookingRequirements';

jest.mock('./bookingRequirementsLoader', () => ({ fetchBookingRequirementSources: jest.fn() }));
jest.mock('../services/api', () => ({ bookingFlowApi: { updateItem: jest.fn(), getBookingRequirementDocumentCandidates: jest.fn() }, medicalArtifactsApi: { update: jest.fn() }, bookingDocumentsApi: { update: jest.fn() } }));
const source = (overrides: any = {}) => ({ items: [], artifacts: [], documents: [], documentCandidates: [], reviews: [], ...overrides });

describe('useBookingRequirements', () => {
  beforeEach(() => { jest.clearAllMocks(); (fetchBookingRequirementSources as jest.Mock).mockResolvedValue(source()); });
  it('loads, filters booking records, and reports status', async () => {
    const status = jest.fn(); (fetchBookingRequirementSources as jest.Mock).mockResolvedValue(source({ artifacts: [{ _id: 'right', bookingId: 'booking', artifactType: 'ekg', files: [{ fileName: 'x' }] }, { _id: 'wrong', bookingId: 'other', artifactType: 'ekg' }], documents: [{ _id: 'doc', bookingId: 'booking', documentType: 'contract', files: [{ fileName: 'c' }] }] }));
    const { result } = renderHook(() => useBookingRequirements({ bookingId: 'booking', refreshKey: 0, onStatusChange: status }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows.find(row => row.key === 'ekg')?.latestArtifact?._id).toBe('right');
    expect(status).toHaveBeenLastCalledWith(expect.objectContaining({ total: 6 }));
  });
  it('exposes failure and retries successfully', async () => {
    (fetchBookingRequirementSources as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(source());
    const { result } = renderHook(() => useBookingRequirements({ bookingId: 'booking', refreshKey: 0 }));
    await waitFor(() => expect(result.current.error).toBe('offline'));
    await act(async () => { await result.current.reload(); });
    expect(result.current.error).toBe(''); expect(fetchBookingRequirementSources).toHaveBeenCalledTimes(2);
  });
  it('links through an existing workflow item', async () => {
    (fetchBookingRequirementSources as jest.Mock).mockResolvedValue(source({ items: [{ _id: 'item', status: 'pending', isBlocking: true, metadata: { isRequirement: true, readinessGroup: 'ekg' } }] }));
    (bookingFlowApi.updateItem as jest.Mock).mockResolvedValue({});
    const { result } = renderHook(() => useBookingRequirements({ bookingId: 'booking', refreshKey: 0 })); await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { expect(await result.current.link(requirementDefinitions[1], 'artifact', 'artifact')).toBe(true); });
    expect(medicalArtifactsApi.update).toHaveBeenCalledWith('artifact', expect.objectContaining({ bookingId: 'booking' }));
    expect(bookingFlowApi.updateItem).toHaveBeenCalledWith('item', expect.objectContaining({ status: 'received', metadata: expect.objectContaining({ linkedMedicalArtifactId: 'artifact' }) }));
  });
  it.each([['artifact', medicalArtifactsApi.update], ['document', bookingDocumentsApi.update]] as const)('links an unconfigured %s directly', async (kind, update) => {
    (update as jest.Mock).mockResolvedValue({}); const { result } = renderHook(() => useBookingRequirements({ bookingId: 'booking', clientId: 'client', retreatId: 'retreat', refreshKey: 0 })); await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.link(requirementDefinitions[0], kind, 'record'); }); expect(update).toHaveBeenCalled();
  });
  it('links a contract with one mutation and does not wait for the library refresh', async () => {
    (fetchBookingRequirementSources as jest.Mock).mockResolvedValueOnce(source({ items: [{ _id: 'contract-item', status: 'pending', metadata: { isRequirement: true, readinessGroup: 'contract' } }] }));
    let finishRefresh: ((value: any) => void) | undefined;
    (bookingDocumentsApi.update as jest.Mock).mockResolvedValue({});
    const { result } = renderHook(() => useBookingRequirements({ bookingId: 'booking', refreshKey: 0 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    (fetchBookingRequirementSources as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; }));

    await act(async () => { expect(await result.current.link(requirementDefinitions[0], 'document', 'contract')).toBe(true); });

    expect(bookingDocumentsApi.update).toHaveBeenCalledTimes(1);
    expect(bookingFlowApi.updateItem).not.toHaveBeenCalled();
    expect(result.current.linkingRecordId).toBe('');
    expect(result.current.loading).toBe(false);
    await act(async () => { finishRefresh?.(source()); });
  });
  it('returns false and exposes linking errors', async () => {
    (medicalArtifactsApi.update as jest.Mock).mockRejectedValue({ response: { data: { message: 'cannot link' } } }); const { result } = renderHook(() => useBookingRequirements({ bookingId: 'booking', refreshKey: 0 })); await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { expect(await result.current.link(requirementDefinitions[1], 'artifact', 'bad')).toBe(false); }); expect(result.current.error).toBe('cannot link'); expect(result.current.linkingRecordId).toBe('');
  });

  it('reloads when the refresh key changes', async () => {
    const { result, rerender } = renderHook(({ refreshKey }) => useBookingRequirements({ bookingId: 'booking', refreshKey }), { initialProps: { refreshKey: 0 } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ refreshKey: 1 });
    await waitFor(() => expect(fetchBookingRequirementSources).toHaveBeenCalledTimes(2));
  });
});

describe('booking requirement hook helpers', () => {
  it('indexes every review artifact reference and sorts newest first', () => {
    const older: any = { _id: 'old', artifactIds: ['a'], medicalArtifactId: 'b', artifactId: 'c', fileReviews: [{ artifactId: 'd' }], requestedAt: '2026-01-01' };
    const newer: any = { _id: 'new', artifactIds: ['a', 'a'], reviewedAt: '2026-02-01' };
    const indexed = indexReviews([older, newer]);
    expect(indexed.a.map(review => review._id)).toEqual(['new', 'old']);
    expect(Object.keys(indexed).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(reviewTime({ createdAt: '2025-01-01' } as any)).toBeGreaterThan(0);
    expect(reviewTime({} as any)).toBe(0);
  });

  it('scopes artifacts by booking first, then retreat', () => {
    expect(relevantArtifact({ bookingId: 'booking' } as any, 'booking', 'retreat')).toBe(true);
    expect(relevantArtifact({ data: { bookingId: 'other' } } as any, 'booking', 'retreat')).toBe(false);
    expect(relevantArtifact({ retreatId: 'retreat' } as any, 'booking', 'retreat')).toBe(true);
    expect(relevantArtifact({ data: { retreatId: 'other' } } as any, 'booking', 'retreat')).toBe(false);
    expect(relevantArtifact({ retreatId: 'retreat' } as any, 'booking')).toBe(false);
    expect(relevantArtifact({} as any, 'booking')).toBe(true);
  });

  it('prefers API errors, then ordinary errors, then fallback text', () => {
    expect(requirementErrorMessage({ response: { data: { message: 'api' } }, message: 'local' }, 'fallback')).toBe('api');
    expect(requirementErrorMessage(new Error('local'), 'fallback')).toBe('local');
    expect(requirementErrorMessage({}, 'fallback')).toBe('fallback');
  });
});
