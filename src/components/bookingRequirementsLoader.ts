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
  const response = await bookingFlowApi.getBookingRequirements(bookingId, { compact: true });

  return {
    items: response.data.items || [],
    artifacts: response.data.artifacts || [],
    documents: response.data.documents || [],
    reviews: response.data.reviews || [],
  };
};
