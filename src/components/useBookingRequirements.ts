import { useCallback, useEffect, useMemo, useState } from 'react';
import { bookingDocumentsApi, bookingFlowApi, medicalArtifactsApi } from '../services/api';
import { BookingDocument, BookingFlowItem, MedicalArtifact, MedicalReviewRequest } from '../types';
import { fetchBookingRequirementSources } from './bookingRequirementsLoader';
import { buildBookingRequirementRows, mergeArtifacts, objectId, RequirementDefinition } from './bookingRequirementRows';

export const reviewTime = (review: MedicalReviewRequest) => new Date(review.reviewedAt || review.requestedAt || review.createdAt || 0).getTime();
export const indexReviews = (reviews: MedicalReviewRequest[]) => {
  const result: Record<string, MedicalReviewRequest[]> = {};
  reviews.forEach(review => Array.from(new Set([...(review.artifactIds || []), review.medicalArtifactId, (review as any).artifactId, ...(review.fileReviews || []).map(file => file.artifactId)].map(objectId).filter(Boolean))).forEach(id => { result[id] = [...(result[id] || []), review].sort((a, b) => reviewTime(b) - reviewTime(a)); }));
  return result;
};
export const relevantArtifact = (artifact: MedicalArtifact, bookingId: string, retreatId?: string) => {
  const artifactBooking = objectId(artifact.bookingId) || objectId(artifact.data?.bookingId);
  if (artifactBooking) return artifactBooking === bookingId;
  const artifactRetreat = objectId(artifact.retreatId) || objectId(artifact.data?.retreatId);
  return artifactRetreat ? Boolean(retreatId) && artifactRetreat === retreatId : true;
};

export const requirementErrorMessage = (cause: any, fallback: string) =>
  cause?.response?.data?.message || cause?.message || fallback;

export const useBookingRequirements = ({ bookingId, clientId, retreatId, refreshKey, onStatusChange }: {
  bookingId: string; clientId?: string; retreatId?: string; refreshKey: number;
  onStatusChange?: (status: { missing: number; total: number }) => void;
}) => {
  const [items, setItems] = useState<BookingFlowItem[]>([]); const [artifacts, setArtifacts] = useState<MedicalArtifact[]>([]);
  const [libraryArtifacts, setLibraryArtifacts] = useState<MedicalArtifact[]>([]); const [documents, setDocuments] = useState<BookingDocument[]>([]);
  const [libraryDocuments, setLibraryDocuments] = useState<BookingDocument[]>([]); const [reviews, setReviews] = useState<Record<string, MedicalReviewRequest[]>>({});
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [linkingRecordId, setLinkingRecordId] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); setError('');
    try {
      const sources = await fetchBookingRequirementSources(bookingId, clientId);
      const allArtifacts = mergeArtifacts([sources.artifacts]);
      setItems(sources.items); setArtifacts(allArtifacts.filter(artifact => relevantArtifact(artifact, bookingId, retreatId)));
      setLibraryArtifacts(allArtifacts); setDocuments(sources.documents.filter(document => objectId(document.bookingId) === bookingId));
      setLibraryDocuments(sources.documentCandidates || sources.documents); setReviews(indexReviews(sources.reviews));
    } catch (cause: any) { setError(requirementErrorMessage(cause, 'Unable to load booking requirements.')); }
    finally { if (!silent) setLoading(false); }
  }, [bookingId, clientId, retreatId]);

  useEffect(() => { load(); }, [load, refreshKey]);
  const rows = useMemo(() => buildBookingRequirementRows(items, artifacts, libraryArtifacts, documents, libraryDocuments, reviews), [items, artifacts, libraryArtifacts, documents, libraryDocuments, reviews]);
  const missing = rows.filter(row => row.required && !row.satisfied).length; const total = rows.filter(row => row.required).length;
  useEffect(() => { if (!loading && !error) onStatusChange?.({ missing, total }); }, [error, loading, missing, onStatusChange, total]);

  const link = useCallback(async (definition: RequirementDefinition, kind: 'artifact' | 'document', recordId: string) => {
    const row = rows.find(candidate => candidate.key === definition.key); const flowItem = row?.relatedItems.find(item => item._id) || row?.relatedItems[0];
    setLinkingRecordId(`${kind}:${recordId}`); setError('');
    try {
      if (kind === 'document') {
        // Updating a booking document already reconciles the matching booking-flow
        // requirement on the API. Do not repeat that mutation or make the modal
        // wait for the much larger requirements/library bundle to reload.
        await bookingDocumentsApi.update(recordId, { bookingId });
        void load(true);
        return true;
      }
      await medicalArtifactsApi.update(recordId, { bookingId, retreatId, clientId } as Partial<MedicalArtifact>);
      if (flowItem?._id) await bookingFlowApi.updateItem(flowItem._id, { status: 'received', completedAt: new Date().toISOString(), metadata: { ...(flowItem.metadata || {}), linkedMedicalArtifactId: recordId, linkedMedicalArtifactIds: [recordId], linkedRequirementLibrary: 'medical_artifacts', linkedRequirementKey: definition.key } });
      await load(); return true;
    } catch (cause: any) { setError(requirementErrorMessage(cause, 'Unable to link the selected record.')); return false; }
    finally { setLinkingRecordId(''); }
  }, [bookingId, clientId, load, retreatId, rows]);

  return { rows, items, libraryArtifacts, libraryDocuments, loading, error, linkingRecordId, reload: () => load(), link };
};
