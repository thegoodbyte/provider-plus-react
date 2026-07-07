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
