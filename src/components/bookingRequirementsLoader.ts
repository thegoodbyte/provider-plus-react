import { bookingFlowApi } from '../services/api';
import { BookingDocument, BookingFlowItem, MedicalArtifact, MedicalReviewRequest } from '../types';

export interface BookingRequirementSources {
  items: BookingFlowItem[];
  artifacts: MedicalArtifact[];
  documents: BookingDocument[];
  reviews: MedicalReviewRequest[];
}

export const fetchBookingRequirementSources = async (
  bookingId: string,
  _clientId?: string,
): Promise<BookingRequirementSources> => {
  // IR can add documents while the admin application is already open. Always
  // bypass the local bundle cache when the Requirements panel loads/refreshes.
  const response = await bookingFlowApi.getBookingRequirements(bookingId, { compact: true, refresh: true });

  return {
    items: response.data.items || [],
    artifacts: response.data.artifacts || [],
    documents: response.data.documents || [],
    reviews: response.data.reviews || [],
  };
};
