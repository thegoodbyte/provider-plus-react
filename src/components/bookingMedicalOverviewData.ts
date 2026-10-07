import { bookingFlowApi, medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';
import { MedicalArtifact, MedicalReviewRequest } from '../types';
import { mergeArtifacts, objectId } from './bookingRequirementRows';
import { getFlowReadinessGroup, getFlowReceiptKey } from './BookingMedicalUpload';
import { deriveMedicalItemState } from './medicalItemStatus';

export const medicalStageLabels: Record<MedicalArtifact['documentStage'], string> = { entry: 'Entry', pre_ceremony: 'Pre-ceremony', in_ceremony: 'In-ceremony', post_ceremony: 'Post-ceremony', other: 'Other', additional: 'Additional' };
export const medicalStageOrder: MedicalArtifact['documentStage'][] = ['entry', 'pre_ceremony', 'in_ceremony', 'post_ceremony', 'other', 'additional'];
export const reviewedMedicalStatuses = new Set(['reviewed', 'approved', 'completed', 'caution', 'rejected', 'needs_resubmission']);

export const artifactTime = (artifact: MedicalArtifact) => new Date(artifact.receivedAt || artifact.createdAt || 0).getTime();
export const compareMedicalArtifacts = (a: MedicalArtifact, b: MedicalArtifact) => Number(Boolean(b.files?.length)) - Number(Boolean(a.files?.length)) || artifactTime(b) - artifactTime(a);
export const reviewTime = (review: MedicalReviewRequest) => new Date(review.reviewedAt || review.requestedAt || review.createdAt || 0).getTime();
export const latestArtifactReview = (artifact: MedicalArtifact, reviews: Record<string, MedicalReviewRequest[]>) => artifact._id ? [...(reviews[artifact._id] || [])].sort((a, b) => reviewTime(b) - reviewTime(a))[0] : undefined;
export const relevantMedicalArtifact = (artifact: MedicalArtifact, bookingId: string, retreatId?: string) => {
  const artifactBookingId = objectId(artifact.bookingId) || objectId(artifact.data?.bookingId);
  if (artifactBookingId) return artifactBookingId === bookingId;
  const artifactRetreatId = objectId(artifact.retreatId) || objectId(artifact.data?.retreatId);
  return artifactRetreatId ? Boolean(retreatId) && artifactRetreatId === retreatId : true;
};
export const indexMedicalReviews = (reviews: MedicalReviewRequest[]) => {
  const result: Record<string, MedicalReviewRequest[]> = {};
  reviews.forEach(review => Array.from(new Set([...(review.artifactIds || []), review.medicalArtifactId, (review as any).artifactId, ...(review.fileReviews || []).map(file => file.artifactId)].map(objectId).filter(Boolean))).forEach(id => { result[id] = [...(result[id] || []), review].sort((a, b) => reviewTime(b) - reviewTime(a)); }));
  return result;
};
export const groupMedicalArtifacts = (artifacts: MedicalArtifact[]) => medicalStageOrder.reduce((result, stage) => ({ ...result, [stage || 'other']: artifacts.filter(artifact => (artifact.documentStage || 'entry') === stage) }), {} as Record<string, MedicalArtifact[]>);
export const requiredEntryRows = (artifacts: MedicalArtifact[], reviews: Record<string, MedicalReviewRequest[]>) => ['EKG', 'Liver'].map(documentType => { const expected = documentType === 'EKG' ? 'ekg' : 'liver_panel'; const artifact = artifacts.find(item => (item.documentStage || 'entry') === 'entry' && (item.artifactType === expected || String(item.documentType || '').toLowerCase() === documentType.toLowerCase())); return { documentType, artifact, review: artifact ? latestArtifactReview(artifact, reviews) : undefined }; });

export const recordsSummary = (artifacts: MedicalArtifact[], reviews: Record<string, MedicalReviewRequest[]>) => {
  const states = artifacts.map(artifact => deriveMedicalItemState(artifact, latestArtifactReview(artifact, reviews)));
  return {
    total: artifacts.length,
    undecided: states.filter(state => state === 'missing' || state === 'received' || state === 'pending').length,
    noMrr: artifacts.filter(artifact => !(artifact._id && reviews[artifact._id]?.length)).length,
  };
};

export const findRequiredEntryFlowItem = (items: any[], documentType: 'EKG' | 'Liver') => {
  const sectionType = documentType === 'EKG' ? 'ekg' : 'liver_panel';
  const key = getFlowReceiptKey(sectionType);
  const group = getFlowReadinessGroup(sectionType);
  return items.find((item: any) => {
    const template = typeof item.templateId === 'object' ? item.templateId : undefined;
    return item.key === key
      || (item.metadata?.readinessGroup || template?.readinessGroup) === group
      || (item.metadata?.expectedArtifact || template?.expectedArtifact) === sectionType;
  });
};

export const loadBookingMedicalOverview = async (bookingId: string, clientId?: string, retreatId?: string) => {
  const itemsResponse = await bookingFlowApi.getItems({ bookingId }); const items = itemsResponse.data || [];
  const response = await medicalArtifactsApi.getForBooking(bookingId);
  const artifacts = mergeArtifacts([response.data || []]).filter(item => relevantMedicalArtifact(item, bookingId, retreatId)).sort(compareMedicalArtifacts);
  const ids = artifacts.map(item => item._id).filter(Boolean) as string[];
  const reviewResponse = ids.length ? await medicalReviewRequestsApi.getByArtifacts(ids) : { data: [] };
  return { artifacts, reviewsByArtifact: indexMedicalReviews(reviewResponse.data || []), medicationPlan: items.filter((item: any) => item.metadata?.medicationStopPlan && item.status !== 'cancelled') as any[], flowItems: items as any[] };
};
