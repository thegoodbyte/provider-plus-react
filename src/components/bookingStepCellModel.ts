import { BookingDocument, BookingFlowItem, MedicalArtifact, MedicalReviewRequest, Payment } from '../types';
import { artifactStepConfigByKey, getArtifactLinkCandidates, getArtifactStepConfig, getReviewStepConfig, reviewStatusToDecision } from './bookingStepMedicalLinks';
import { getBookingStepClientId, getBookingStepObjectId } from './bookingStepIdentity';
import { BookingStepMatrixRow } from './bookingStepRows';
import { makeBookingStepArtifactContextKey, makeBookingStepReviewContextKey } from './bookingStepMedicalIndexes';
import { bookingDocumentTypeByStep, getLinkedBookingStepArtifactId, resolveBookingStepDocumentType, resolveConfiguredBookingStepDocumentType } from './bookingStepControlRules';
import { normalizeBookingStepKey } from './bookingStepActions';
import { formatStepDateInput, getStepStatusDateField } from './bookingStepPresentation';

export type BookingStepCellModelInput = {
  booking: any; item?: BookingFlowItem; row: BookingStepMatrixRow; itemMap: Map<string, BookingFlowItem>;
  datePickerDrafts: Record<string, string>; paymentsByClientId: Map<string, Payment[]>; reviewRequests: MedicalReviewRequest[];
  reviewRequestsByArtifactId: Map<string, MedicalReviewRequest[]>; reviewRequestsByBookingContext: Map<string, MedicalReviewRequest[]>;
  bookingDocumentMap: Map<string, BookingDocument[]>; medicalArtifacts: MedicalArtifact[]; medicalArtifactById: Map<string, MedicalArtifact>;
  medicalArtifactsByBookingContext: Map<string, MedicalArtifact[]>;
};

export const buildBookingStepCellModel = ({ booking, item, row, itemMap, datePickerDrafts, paymentsByClientId, reviewRequests, reviewRequestsByArtifactId, reviewRequestsByBookingContext, bookingDocumentMap, medicalArtifacts, medicalArtifactById, medicalArtifactsByBookingContext }: BookingStepCellModelInput) => {
  const bookingId = getBookingStepObjectId(booking);
  const dateField = item ? getStepStatusDateField(item.status) : 'dueDate';
  const dateValue = item ? item[dateField as keyof BookingFlowItem] as Date | string | null | undefined : undefined;
  const confirmedDateInputValue = formatStepDateInput(dateValue);
  const pendingDateInputValue = item?._id ? datePickerDrafts[item._id] : undefined;
  const hasPendingDateInput = Boolean(item?._id && pendingDateInputValue !== undefined && pendingDateInputValue !== confirmedDateInputValue);
  const isPaymentReceivedStep = row.key === 'payment_received';
  const bookingPayments = paymentsByClientId.get(getBookingStepClientId(booking)) || [];
  const selectedPaymentId = String(item?.metadata?.paymentId || '');
  const reviewStepConfig = getReviewStepConfig(row);
  const receivedItem = reviewStepConfig ? itemMap.get(`${bookingId}:${reviewStepConfig.receivedStepKey}`) : undefined;
  const linkedArtifactId = getLinkedBookingStepArtifactId(item) || getLinkedBookingStepArtifactId(receivedItem);
  const metadataReviewRequestId = item?.metadata?.medicalReviewRequestId ? String(item.metadata.medicalReviewRequestId) : '';
  const requestsLinkedToThisStep = item?._id ? reviewRequests.filter(request => getBookingStepObjectId(request.bookingFlowItemId) === item._id) : [];
  const relatedReviewRequests = reviewStepConfig ? [
    ...requestsLinkedToThisStep,
    ...(linkedArtifactId ? (reviewRequestsByArtifactId.get(linkedArtifactId) || []).filter(request => request.requestType === reviewStepConfig.requestType) : []),
    ...(reviewRequestsByBookingContext.get(makeBookingStepReviewContextKey(bookingId, reviewStepConfig)) || []),
  ].filter((request, index, requests) => Boolean(request._id) && requests.findIndex(candidate => candidate._id === request._id) === index) : requestsLinkedToThisStep;
  const finalReviewRequest = relatedReviewRequests.find(request => Boolean(request.reviewDecision || reviewStatusToDecision(request.status)));
  const resolvedReviewDecision = item?.reviewDecision || finalReviewRequest?.reviewDecision || reviewStatusToDecision(finalReviewRequest?.status);
  const resolvedReviewNotes = item?.reviewNotes || finalReviewRequest?.reviewNotes || finalReviewRequest?.overallNotes || '';
  const resolvedReviewReviewedAt = item?.reviewedAt || finalReviewRequest?.reviewedAt;
  const existingReviewRequest = relatedReviewRequests.find(request => request._id === metadataReviewRequestId) || relatedReviewRequests[0];
  const existingReviewRequestId = metadataReviewRequestId || existingReviewRequest?._id || '';
  const existingReviewRequestDisplay = item?.metadata?.medicalReviewRequestDisplayId || existingReviewRequest?.display_id || '';
  const documentTypeForStep = item ? resolveBookingStepDocumentType(item) : normalizeBookingStepKey(row.key);
  const relatedBookingDocument = bookingDocumentMap.get(`${bookingId}:${documentTypeForStep}`)?.[0];
  const artifactStepConfig = getArtifactStepConfig(row) || (reviewStepConfig ? artifactStepConfigByKey[reviewStepConfig.receivedStepKey] : undefined);
  const configuredBookingDocumentType = row.key === 'questionnaire_sent' ? '' : item ? resolveConfiguredBookingStepDocumentType(item, Boolean(artifactStepConfig)) : normalizeBookingStepKey(bookingDocumentTypeByStep[row.key] || '');
  const linkableArtifacts = artifactStepConfig ? getArtifactLinkCandidates(booking, medicalArtifacts, artifactStepConfig) : [];
  const relatedMedicalArtifact = linkedArtifactId ? medicalArtifactById.get(linkedArtifactId) : artifactStepConfig ? medicalArtifactsByBookingContext.get(makeBookingStepArtifactContextKey(bookingId, artifactStepConfig))?.[0] : undefined;
  return { dateField, confirmedDateInputValue, pendingDateInputValue, hasPendingDateInput, isPaymentReceivedStep, bookingPayments, selectedPaymentId, reviewStepConfig, receivedItem, linkedArtifactId, relatedReviewRequests, resolvedReviewDecision, resolvedReviewNotes, resolvedReviewReviewedAt, existingReviewRequestId, existingReviewRequestDisplay, documentTypeForStep, relatedBookingDocument, artifactStepConfig, configuredBookingDocumentType, linkableArtifacts, relatedMedicalArtifact, relatedMedicalArtifactId: relatedMedicalArtifact?._id || linkedArtifactId };
};
