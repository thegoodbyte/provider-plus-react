import type { MedicalArtifact, MedicalArtifactCreateInput } from '../types';

export type ClientMedicalArtifactUploadContext = {
  bookingId?: string;
  retreatId?: string;
};

export const getMedicalArtifactEntityId = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value._id || value.id || '');
};

export const getClientEntryMedicalArtifacts = (
  artifacts: MedicalArtifact[] = [],
  clientId: string,
  artifactType: 'ekg' | 'liver_panel',
  documentType: 'EKG' | 'Liver',
) => artifacts
  .filter((artifact) => (
    getMedicalArtifactEntityId(artifact.clientId) === clientId
    && (artifact.documentStage === 'entry' || !artifact.documentStage)
    && (artifact.documentType === documentType || artifact.artifactType === artifactType)
    && artifact.status !== 'voided'
  ))
  .sort((a, b) => new Date(b.receivedAt || b.createdAt || 0).getTime() - new Date(a.receivedAt || a.createdAt || 0).getTime());

export const upsertMedicalArtifact = (artifacts: MedicalArtifact[], artifact: MedicalArtifact) => {
  const artifactId = getMedicalArtifactEntityId(artifact._id);
  if (!artifactId) return [artifact, ...artifacts];
  return [artifact, ...artifacts.filter((candidate) => getMedicalArtifactEntityId(candidate._id) !== artifactId)];
};

export const getClientMedicalArtifactUploadContext = (
  bookings: any[] = [],
  medicalInfo: any = null,
): ClientMedicalArtifactUploadContext => {
  const booking = bookings[0];
  const bookingId = getValueId(booking?._id);
  const retreatId = getValueId(
    medicalInfo?.retreatId
      || booking?.retreatId
      || booking?.retreat?._id,
  );

  return {
    bookingId: bookingId || undefined,
    retreatId: retreatId || undefined,
  };
};

export const buildClientMedicalArtifactInput = (params: {
  clientId: string;
  title: string;
  artifactType: NonNullable<MedicalArtifact['artifactType']>;
  documentType: NonNullable<MedicalArtifact['documentType']>;
  context: ClientMedicalArtifactUploadContext;
}): MedicalArtifactCreateInput => {
  const { clientId, title, artifactType, documentType, context } = params;

  return {
    clientId,
    title,
    artifactType,
    documentType,
    documentStage: 'entry',
    contextType: context.bookingId ? 'booking' : 'client',
    purpose: context.bookingId ? 'booking_requirement' : 'general',
    status: 'pending_review',
    source: 'admin_upload',
    receivedAt: new Date().toISOString(),
    ...(context.bookingId ? { bookingId: context.bookingId } : {}),
    ...(context.retreatId ? { retreatId: context.retreatId } : {}),
  };
};

const getValueId = (value: any) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};
