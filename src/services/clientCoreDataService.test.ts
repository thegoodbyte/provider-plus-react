import { loadClientCoreData } from './clientCoreDataService';
import { bookingsApi, clientMedicalApi, clientsApi } from './api';

jest.mock('./api', () => ({
  clientsApi: { getOne: jest.fn() },
  clientMedicalApi: { getByClient: jest.fn() },
  bookingsApi: { getByClient: jest.fn() },
}));

it('loads the canonical client, medical record, and bookings together', async () => {
  (clientsApi.getOne as jest.Mock).mockResolvedValue({ data: { _id: 'client-1' } });
  (clientMedicalApi.getByClient as jest.Mock).mockResolvedValue({ data: { status: 'active' } });
  (bookingsApi.getByClient as jest.Mock).mockResolvedValue({ data: [{ _id: 'booking-1' }] });
  await expect(loadClientCoreData('client-1')).resolves.toEqual({
    client: { _id: 'client-1' }, medical: { status: 'active' }, bookings: [{ _id: 'booking-1' }],
  });
});

it('keeps the client page available when optional medical or booking calls fail', async () => {
  (clientsApi.getOne as jest.Mock).mockResolvedValue({ data: { _id: 'client-1' } });
  (clientMedicalApi.getByClient as jest.Mock).mockRejectedValue(new Error('legacy row missing'));
  (bookingsApi.getByClient as jest.Mock).mockRejectedValue(new Error('booking lookup unavailable'));
  await expect(loadClientCoreData('client-1')).resolves.toEqual({ client: { _id: 'client-1' }, medical: null, bookings: [] });
});

it('rejects an empty client identity before making requests', async () => {
  await expect(loadClientCoreData('')).rejects.toThrow('Client ID is required');
});
