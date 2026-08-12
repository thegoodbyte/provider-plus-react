import { bookingDocumentsApi, bookingFlowApi, medicalArtifactsApi } from '../services/api';
import { fetchBookingRequirementSources } from './bookingRequirementsLoader';

jest.mock('../services/api', () => ({
  bookingFlowApi: { getItems: jest.fn() },
  medicalArtifactsApi: { getAll: jest.fn(), getForBooking: jest.fn() },
  bookingDocumentsApi: { getAll: jest.fn() },
}));

describe('fetchBookingRequirementSources', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads each source once and starts all requests in parallel', async () => {
    let resolveItems: (value: any) => void = () => undefined;
    let resolveArtifacts: (value: any) => void = () => undefined;
    let resolveDocuments: (value: any) => void = () => undefined;
    (bookingFlowApi.getItems as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveItems = resolve; }));
    (medicalArtifactsApi.getAll as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveArtifacts = resolve; }));
    (bookingDocumentsApi.getAll as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveDocuments = resolve; }));

    const loading = fetchBookingRequirementSources('booking-1', 'client-1');

    expect(bookingFlowApi.getItems).toHaveBeenCalledTimes(1);
    expect(bookingFlowApi.getItems).toHaveBeenCalledWith({ bookingId: 'booking-1' });
    expect(medicalArtifactsApi.getAll).toHaveBeenCalledTimes(1);
    expect(medicalArtifactsApi.getAll).toHaveBeenCalledWith({ clientId: 'client-1' });
    expect(bookingDocumentsApi.getAll).toHaveBeenCalledTimes(1);
    expect(bookingDocumentsApi.getAll).toHaveBeenCalledWith({ clientId: 'client-1' });

    resolveItems({ data: [{ _id: 'item-1' }] });
    resolveArtifacts({ data: [{ _id: 'artifact-1' }] });
    resolveDocuments({ data: [{ _id: 'document-1' }] });

    await expect(loading).resolves.toEqual({
      items: [{ _id: 'item-1' }],
      artifacts: [{ _id: 'artifact-1' }],
      documents: [{ _id: 'document-1' }],
    });
  });

  it('uses booking-scoped fallbacks when the client is unavailable', async () => {
    (bookingFlowApi.getItems as jest.Mock).mockResolvedValue({ data: [] });
    (medicalArtifactsApi.getForBooking as jest.Mock).mockResolvedValue({ data: [] });
    (bookingDocumentsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });

    await fetchBookingRequirementSources('booking-2');

    expect(medicalArtifactsApi.getForBooking).toHaveBeenCalledWith('booking-2');
    expect(medicalArtifactsApi.getAll).not.toHaveBeenCalled();
    expect(bookingDocumentsApi.getAll).toHaveBeenCalledWith({ bookingId: 'booking-2' });
  });
});
