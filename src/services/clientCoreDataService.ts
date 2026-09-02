import { bookingsApi, clientMedicalApi, clientsApi } from './api';

export interface ClientCoreData {
  client: any;
  medical: any | null;
  bookings: any[];
}

export const loadClientCoreData = async (clientId: string): Promise<ClientCoreData> => {
  if (!clientId) throw new Error('Client ID is required');
  const [clientResponse, medicalResponse, bookingsResponse] = await Promise.all([
    clientsApi.getOne(clientId),
    clientMedicalApi.getByClient(clientId).catch(() => ({ data: null })),
    bookingsApi.getByClient(clientId).catch(() => ({ data: [] })),
  ]);
  return {
    client: clientResponse.data,
    medical: medicalResponse.data || null,
    bookings: bookingsResponse.data || [],
  };
};
