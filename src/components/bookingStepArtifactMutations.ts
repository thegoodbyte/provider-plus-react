import { BookingFlowItem, MedicalArtifact } from '../types';

export const buildBookingStepArtifactLink = (item: BookingFlowItem, selected: MedicalArtifact, linked: MedicalArtifact, context: { bookingId: string; clientId: string; retreatId: string; bookingNumber: string; label: string }, now = new Date()) => {
  const artifactId = linked._id || selected._id || '';
  const displayId = linked.display_id || selected.display_id;
  const artifactType = linked.artifactType || selected.artifactType;
  const documentStage = linked.documentStage || selected.documentStage;
  const documentType = linked.documentType || selected.documentType;
  const description = `Linked existing ${context.label} artifact #${displayId || artifactId}.`;
  const metadata = { ...(item.metadata || {}), linkedMedicalArtifactId: artifactId, linkedMedicalArtifactIds: Array.from(new Set([...((item.metadata?.linkedMedicalArtifactIds || []) as string[]), artifactId])), latestArtifactId: artifactId, linkedMedicalArtifactDisplayId: displayId, linkedMedicalArtifactType: artifactType, linkedMedicalArtifactStage: documentStage, linkedMedicalArtifactDocumentType: documentType, linkedMedicalArtifactAt: now.toISOString() };
  return {
    artifactId,
    update: { status: 'received', receivedAt: selected.receivedAt || now.toISOString(), notes: item.notes?.trim() ? `${item.notes.trim()}\n${description}` : description, metadata } as Partial<BookingFlowItem>,
    action: { actionType: 'manual_mark', actionKey: 'existing_artifact_linked', actionLabel: 'Existing artifact linked', statusAfter: 'received', notes: `Linked existing artifact #${displayId || artifactId} to ${item.title} for booking #${context.bookingNumber}.`, metadata: { artifactId, artifactDisplayId: displayId, artifactType, documentStage, documentType, bookingId: context.bookingId, clientId: context.clientId, retreatId: context.retreatId } },
  };
};

export const buildBookingStepArtifactUploadUpdate = (item: BookingFlowItem, artifact: MedicalArtifact, fileName: string | undefined, config: { artifactType: string; documentStage: string; documentType: string }, now = new Date()): Partial<BookingFlowItem> => ({ status: 'received', receivedAt: now.toISOString(), metadata: { ...(item.metadata || {}), latestArtifactId: artifact._id, latestArtifactDisplayId: artifact.display_id, latestFileName: fileName, linkedMedicalArtifactId: artifact._id, linkedMedicalArtifactDisplayId: artifact.display_id, linkedMedicalArtifactType: config.artifactType, linkedMedicalArtifactStage: config.documentStage, linkedMedicalArtifactDocumentType: config.documentType, linkedMedicalArtifactAt: now.toISOString() } });
