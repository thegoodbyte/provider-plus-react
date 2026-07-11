type ReviewStepArtifactConfig = {
  documentStage?: string;
  documentType?: string;
  artifactType?: string;
  label?: string;
};

type BookingStepDocumentConfig = {
  documentType?: string;
  title?: string;
};

type BookingActionLogLike = {
  actionKey?: string | null;
};

export const reviewRequestStatusToBookingStepStatus = (status?: string) => {
  if (status === 'in_review') return 'in_review';
  if (status === 'needs_resubmission') return 'needs_resubmission';
  if (status === 'approved' || status === 'rejected' || status === 'caution' || status === 'completed') return 'completed';
  return 'sent_for_review';
};

export const shouldShowArtifactUploadFallback = (
  artifactStepConfig: ReviewStepArtifactConfig | undefined,
  isEditing: boolean,
  hasConfiguredUploadAction: boolean,
) => Boolean(artifactStepConfig && isEditing && !hasConfiguredUploadAction);

export const resolveBookingStepUploadTarget = (
  artifactStepConfig: ReviewStepArtifactConfig | undefined,
  documentConfig: BookingStepDocumentConfig | undefined,
) => {
  if (artifactStepConfig) return 'medical_artifact' as const;
  if (documentConfig) return 'booking_document' as const;
  return null;
};

export const hasBookingActionLog = (logs: BookingActionLogLike[] | undefined, actionKey?: string) => {
  const normalizedActionKey = String(actionKey || '').trim();
  if (!normalizedActionKey || !Array.isArray(logs) || logs.length === 0) return false;
  return logs.some((log) => String(log.actionKey || 'default_email').trim() === normalizedActionKey);
};
