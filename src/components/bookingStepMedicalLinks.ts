import { BookingFlowItem, MedicalArtifact, MedicalReviewRequest } from '../types';
import { normalizeBookingStepKey } from './bookingStepActions';

const objectId = (value: any): string => !value ? '' : typeof value === 'string' ? value : value._id || value.id || '';
const bookingClientId = (booking: any) => objectId(booking?.clientId || booking?.client);
const bookingNumber = (booking: any) => String(booking?.bookingNumber || booking?.displayNumber || objectId(booking).slice(-6));

export type ReviewStepConfig = { receivedStepKey: string; requestType: NonNullable<MedicalReviewRequest['requestType']>; documentStage: MedicalArtifact['documentStage']; documentType: MedicalArtifact['documentType']; artifactType: NonNullable<MedicalArtifact['artifactType']>; label: string; };
export type ArtifactLinkConfig = Pick<ReviewStepConfig, 'documentStage' | 'documentType' | 'artifactType' | 'label'>;

export const reviewStepConfigByKey: Record<string, ReviewStepConfig> = {
  ekg_sent_for_review: { receivedStepKey: 'ekg_received', requestType: 'ekg_review', documentStage: 'entry', documentType: 'EKG', artifactType: 'ekg', label: 'Entry EKG review' },
  liver_panel_sent_for_review: { receivedStepKey: 'liver_received', requestType: 'liver_panel_review', documentStage: 'entry', documentType: 'Liver', artifactType: 'liver_panel', label: 'Liver panel review' },
  medications_form_mrr_sent: { receivedStepKey: 'medications_form_initial_received', requestType: 'medications_review', documentStage: 'entry', documentType: 'Medications', artifactType: 'medications_form', label: 'Medication form review' },
  medications_form_review_result: { receivedStepKey: 'medications_form_initial_received', requestType: 'medications_review', documentStage: 'entry', documentType: 'Medications', artifactType: 'medications_form', label: 'Medication form review' },
};
export const artifactStepConfigByKey: Record<string, ArtifactLinkConfig> = {
  ekg_received: { documentStage: 'entry', documentType: 'EKG', artifactType: 'ekg', label: 'Entry EKG' }, liver_received: { documentStage: 'entry', documentType: 'Liver', artifactType: 'liver_panel', label: 'Entry liver panel' }, medications_form_initial_received: { documentStage: 'entry', documentType: 'Medications', artifactType: 'medications_form', label: 'Medication form' }, medications_form_30_day_received: { documentStage: 'additional', documentType: 'Medications', artifactType: 'medications_form', label: '30-day medications form' },
};

export const getArtifactStepConfig = (item: Pick<BookingFlowItem, 'key' | 'title' | 'metadata'>): ArtifactLinkConfig | undefined => {
  if (artifactStepConfigByKey[item.key]) return artifactStepConfigByKey[item.key];
  const metadata = item.metadata || {}; const normalized = normalizeBookingStepKey([item.key, item.title, metadata.expectedArtifact, metadata.expectedDocument, metadata.expectedBookingDocument].filter(Boolean).join(' '));
  if (normalized.includes('review') || normalized.includes('sent_for_review')) return undefined;
  if (['medication', 'medical_form', 'meds_form', 'med_form'].some(value => normalized.includes(value))) return artifactStepConfigByKey.medications_form_initial_received;
  if (normalized.includes('entry_ekg') || normalized === 'ekg_received') return artifactStepConfigByKey.ekg_received;
  if (normalized.includes('liver') && normalized.includes('received')) return artifactStepConfigByKey.liver_received;
  return undefined;
};
export const getReviewStepConfig = (row: { key: string; title: string }): ReviewStepConfig | undefined => {
  if (reviewStepConfigByKey[row.key]) return reviewStepConfigByKey[row.key];
  const normalized = normalizeBookingStepKey(`${row.key} ${row.title}`); if (!normalized.includes('review') || !['sent', 'send', 'medical'].some(value => normalized.includes(value))) return undefined;
  if (normalized.includes('ekg')) return reviewStepConfigByKey.ekg_sent_for_review;
  if (normalized.includes('liver')) return reviewStepConfigByKey.liver_panel_sent_for_review;
  if (normalized.includes('medication') || normalized.includes('meds')) return reviewStepConfigByKey.medications_form_mrr_sent;
  return undefined;
};
export const getArtifactLinkCandidates = (booking: any, artifacts: MedicalArtifact[], config?: ArtifactLinkConfig) => {
  if (!config) return []; const id = objectId(booking); const clientId = bookingClientId(booking); const retreatId = objectId(booking?.retreatId || booking?.retreat); const number = bookingNumber(booking).trim().toLowerCase();
  return artifacts.filter(artifact => { if (!artifact._id) return false; if (!(artifact.artifactType === config.artifactType || (artifact.documentStage === 'entry' && artifact.documentType === config.documentType))) return false; const artifactBooking = objectId(artifact.bookingId); const artifactClient = objectId(artifact.clientId); const artifactRetreat = objectId(artifact.retreatId); const numberMatch = [artifact.title, artifact.description, artifact.notes, artifact.textContent, artifact.data?.bookingNumber, artifact.data?.booking_number, artifact.data?.bookingNo].some(value => String(value || '').toLowerCase().includes(number)); return artifactBooking === id || artifactClient === clientId || Boolean(retreatId && artifactRetreat === retreatId) || numberMatch || (!artifactBooking && !artifactClient && !artifactRetreat); }).sort((a, b) => new Date(b.receivedAt || b.createdAt || 0).getTime() - new Date(a.receivedAt || a.createdAt || 0).getTime());
};
export const reviewStatusToDecision = (status?: MedicalReviewRequest['status']) => status === 'approved' ? 'OK' : status === 'rejected' ? 'NOT OK' : status === 'caution' ? 'caution' : status === 'needs_resubmission' ? 'more_info_needed' : '';
export const reviewDecisionToLabel = (decision?: string) => decision === 'OK' ? 'OK' : decision === 'NOT OK' ? 'Declined' : decision === 'caution' ? 'Caution' : decision === 'more_info_needed' ? 'More info needed' : '';
export const reviewDecisionToClassName = (decision?: string) => decision === 'OK' ? 'border-green-300 bg-green-200 text-green-950' : decision === 'NOT OK' ? 'border-red-300 bg-red-200 text-red-950' : decision === 'caution' ? 'border-yellow-300 bg-yellow-200 text-yellow-950' : decision === 'more_info_needed' ? 'border-amber-300 bg-amber-200 text-amber-950' : '';
export const getReviewRequestLinkCandidates = (booking: any, requests: MedicalReviewRequest[], config?: ReviewStepConfig, itemId?: string) => { const clientId = bookingClientId(booking); const retreatId = objectId(booking?.retreatId || booking?.retreat); const id = objectId(booking); return requests.filter(request => { const linkedItem = objectId(request.bookingFlowItemId); if (linkedItem && itemId && linkedItem !== itemId) return false; if (![objectId(request.clientId) === clientId && Boolean(clientId), objectId(request.retreatId) === retreatId && Boolean(retreatId), linkedItem === itemId && Boolean(itemId)].some(Boolean)) return false; if (!config) return true; if (request.requestType !== config.requestType || (request.documentStage && request.documentStage !== config.documentStage) || (request.documentType && request.documentType !== config.documentType)) return false; const artifact = (request.artifactIds || []).find(candidate => typeof candidate !== 'string') as MedicalArtifact | undefined; return !artifact || !((artifact.bookingId && objectId(artifact.bookingId) && objectId(artifact.bookingId) !== id) || (artifact.documentStage && artifact.documentStage !== config.documentStage) || (artifact.documentType && artifact.documentType !== config.documentType) || (artifact.artifactType && artifact.artifactType !== config.artifactType)); }).sort((a, b) => new Date(b.requestedAt || b.createdAt || 0).getTime() - new Date(a.requestedAt || a.createdAt || 0).getTime()); };
