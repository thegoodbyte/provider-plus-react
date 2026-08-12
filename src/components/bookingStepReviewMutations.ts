import { BookingFlowAction, BookingFlowItem, MedicalReviewRequest } from '../types';
import { User } from '../services/usersApi';
import { reviewRequestStatusToBookingStepStatus } from './BookingStepsMatrix.helpers';

export const buildBookingStepReviewCreation = (item: BookingFlowItem, review: MedicalReviewRequest, artifactId: string, advisorId: string, advisor?: User) => {
  const metadata = { ...(item.metadata || {}), medicalReviewRequestId: review._id, medicalReviewRequestDisplayId: review.display_id, medicalReviewRequestType: review.requestType, medicalReviewArtifactId: artifactId, medicalReviewAssignedToUserId: advisorId, medicalReviewAssignedToEmail: advisor?.email };
  return {
    update: { status: 'sent_for_review', sentAt: new Date().toISOString(), metadata } as Partial<BookingFlowItem>,
    action: { actionType: 'manual_mark', actionKey: 'medical_review_request_created', actionLabel: 'Medical review request created', statusAfter: 'sent_for_review', notes: `Created medical review request #${review.display_id || review._id} for ${advisor?.email || 'selected medical advisor'}.`, metadata: { medicalReviewRequestId: review._id, medicalReviewRequestDisplayId: review.display_id, medicalReviewRequestType: review.requestType, artifactId, assignedToUserId: advisorId, assignedToEmail: advisor?.email } },
  };
};

export const buildBookingStepReviewLink = (item: BookingFlowItem, review: MedicalReviewRequest, bookingNumber: string, action?: BookingFlowAction, now = new Date()) => {
  const nextStatus = reviewRequestStatusToBookingStepStatus(review.status) as BookingFlowItem['status'];
  const timestamp = now.toISOString();
  const metadata = { ...(item.metadata || {}), medicalReviewRequestId: review._id, medicalReviewRequestDisplayId: review.display_id, medicalReviewRequestType: review.requestType, medicalReviewBookingFlowItemId: item._id, medicalReviewAssignedToUserId: review.assignedToUserId || item.metadata?.medicalReviewAssignedToUserId, medicalReviewAssignedToEmail: review.assignedToEmail || item.metadata?.medicalReviewAssignedToEmail };
  return {
    nextStatus,
    update: { status: nextStatus, sentAt: ['sent_for_review', 'in_review'].includes(nextStatus) ? timestamp : item.sentAt, reviewedAt: ['completed', 'needs_resubmission', 'in_review'].includes(nextStatus) ? timestamp : item.reviewedAt, completedAt: nextStatus === 'completed' ? timestamp : item.completedAt, approvedAt: nextStatus === 'approved' ? timestamp : item.approvedAt, metadata } as Partial<BookingFlowItem>,
    action: { actionType: 'manual_mark', actionKey: action?.key || 'link_existing_mrr', actionLabel: action?.label || 'Link existing MRR', statusAfter: nextStatus, notes: `Linked existing medical review request #${review.display_id || review._id} to booking #${bookingNumber}.`, metadata: { medicalReviewRequestId: review._id, medicalReviewRequestDisplayId: review.display_id, medicalReviewRequestType: review.requestType, medicalReviewBookingFlowItemId: item._id } },
  };
};
