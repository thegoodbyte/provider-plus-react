import { bookingFlowApi } from '../services/api';
import { fetchBookingRequirementSources } from './bookingRequirementsLoader';

jest.mock('../services/api', () => ({ bookingFlowApi: { getBookingRequirements: jest.fn() } }));

describe('fetchBookingRequirementSources', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads the complete requirements view with one request', async () => {
    (bookingFlowApi.getBookingRequirements as jest.Mock).mockResolvedValue({ data: {
      items: [{ _id: 'item-1' }], artifacts: [{ _id: 'artifact-1' }],
      documents: [{ _id: 'document-1' }], documentCandidates: [{ _id: 'candidate-1' }], reviews: [{ _id: 'review-1' }],
    } });

    await expect(fetchBookingRequirementSources('booking-1', 'client-1')).resolves.toEqual({
      items: [{ _id: 'item-1' }], artifacts: [{ _id: 'artifact-1' }],
      documents: [{ _id: 'document-1' }], documentCandidates: [{ _id: 'candidate-1' }], reviews: [{ _id: 'review-1' }],
    });
    expect(bookingFlowApi.getBookingRequirements).toHaveBeenCalledTimes(1);
    expect(bookingFlowApi.getBookingRequirements).toHaveBeenCalledWith('booking-1', { compact: true, refresh: true });
  });

  it('normalizes missing optional bundle arrays', async () => {
    (bookingFlowApi.getBookingRequirements as jest.Mock).mockResolvedValue({ data: { items: [] } });
    await expect(fetchBookingRequirementSources('booking-2')).resolves.toEqual({
      items: [], artifacts: [], documents: [], documentCandidates: [], reviews: [],
    });
  });

  it('propagates endpoint failures so the Requirements panel can show retry UI', async () => {
    (bookingFlowApi.getBookingRequirements as jest.Mock).mockRejectedValue(new Error('requirements unavailable'));
    await expect(fetchBookingRequirementSources('booking-3')).rejects.toThrow('requirements unavailable');
    expect(bookingFlowApi.getBookingRequirements).toHaveBeenCalledTimes(1);
  });
});
