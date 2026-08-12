import { bookingDocumentsApi, bookingFlowApi, medicalArtifactsApi } from '../services/api';
import { BookingDocument, BookingFlowItem, MedicalArtifact } from '../types';

export interface BookingRequirementSources {
  items: BookingFlowItem[];
  artifacts: MedicalArtifact[];
  documents: BookingDocument[];
}

export const fetchBookingRequirementSources = async (
  bookingId: string,
  clientId?: string,
): Promise<BookingRequirementSources> => {
  const [itemsResponse, artifactsResponse, documentsResponse] = await Promise.all([
    bookingFlowApi.getItems({ bookingId }),
    clientId ? medicalArtifactsApi.getAll({ clientId }) : medicalArtifactsApi.getForBooking(bookingId),
    clientId ? bookingDocumentsApi.getAll({ clientId }) : bookingDocumentsApi.getAll({ bookingId }),
  ]);

  return {
    items: itemsResponse.data || [],
    artifacts: artifactsResponse.data || [],
    documents: documentsResponse.data || [],
  };
};
