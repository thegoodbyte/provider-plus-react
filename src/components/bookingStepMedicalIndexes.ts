import { MedicalArtifact, MedicalReviewRequest } from '../types';
import { getBookingStepObjectId } from './bookingStepIdentity';
import { ReviewStepConfig, reviewStepConfigByKey } from './bookingStepMedicalLinks';

export const makeBookingStepReviewContextKey = (bookingId: string, config: ReviewStepConfig) => [bookingId, config.documentStage, config.documentType, config.artifactType, config.requestType].join(':');
export const makeBookingStepArtifactContextKey = (bookingId: string, config: Pick<ReviewStepConfig, 'documentStage' | 'documentType' | 'artifactType'>) => [bookingId, config.documentStage, config.documentType, config.artifactType].join(':');
export const sortBookingStepReviewRequests = (requests: MedicalReviewRequest[]) => [...requests].sort((a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime());
export const sortBookingStepMedicalArtifacts = (artifacts: MedicalArtifact[]) => [...artifacts].sort((a, b) => new Date(b.receivedAt || b.createdAt || 0).getTime() - new Date(a.receivedAt || a.createdAt || 0).getTime());
export const getBookingStepReviewArtifactIds = (request: MedicalReviewRequest) => (request.artifactIds || []).map(getBookingStepObjectId).filter(Boolean);

export const indexBookingStepArtifactsById = (artifacts: MedicalArtifact[]) => new Map(artifacts.filter((artifact) => artifact._id).map((artifact) => [artifact._id!, artifact]));

export const indexBookingStepArtifactsByContext = (artifacts: MedicalArtifact[]) => {
  const map = new Map<string, MedicalArtifact[]>();
  artifacts.forEach((artifact) => {
    const bookingId = getBookingStepObjectId(artifact.bookingId) || getBookingStepObjectId(artifact.data?.bookingId || artifact.data?.booking_id);
    if (!bookingId || !artifact.documentStage || !artifact.documentType || !artifact.artifactType) return;
    const key = makeBookingStepArtifactContextKey(bookingId, artifact as any);
    map.set(key, [...(map.get(key) || []), artifact]);
  });
  map.forEach((values, key) => map.set(key, sortBookingStepMedicalArtifacts(values)));
  return map;
};

export const indexBookingStepReviewsByArtifact = (requests: MedicalReviewRequest[]) => {
  const map = new Map<string, MedicalReviewRequest[]>();
  requests.forEach((request) => getBookingStepReviewArtifactIds(request).forEach((artifactId) => map.set(artifactId, [...(map.get(artifactId) || []), request])));
  map.forEach((values, key) => map.set(key, sortBookingStepReviewRequests(values)));
  return map;
};

export const indexBookingStepReviewsByContext = (requests: MedicalReviewRequest[]) => {
  const map = new Map<string, MedicalReviewRequest[]>();
  requests.forEach((request) => (request.artifactIds || []).forEach((artifact) => {
    if (!artifact || typeof artifact === 'string') return;
    const bookingId = getBookingStepObjectId(artifact.bookingId);
    if (!bookingId) return;
    Object.values(reviewStepConfigByKey).forEach((config) => {
      if (request.requestType !== config.requestType || (request.documentStage && request.documentStage !== config.documentStage) || (request.documentType && request.documentType !== config.documentType) || (artifact.documentStage && artifact.documentStage !== config.documentStage) || (artifact.documentType && artifact.documentType !== config.documentType) || (artifact.artifactType && artifact.artifactType !== config.artifactType)) return;
      const key = makeBookingStepReviewContextKey(bookingId, config);
      map.set(key, [...(map.get(key) || []), request]);
    });
  }));
  map.forEach((values, key) => map.set(key, sortBookingStepReviewRequests(values)));
  return map;
};
