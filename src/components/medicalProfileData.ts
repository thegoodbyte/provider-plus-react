import { MedicalArtifact, MedicalReviewRequest } from '../types';

export interface ProfileDocument {
  present: boolean;
  status: string;
  receivedAt?: string;
  fileName?: string;
  filePath?: string;
  fileIndex?: number;
  notes?: string;
  artifact?: MedicalArtifact;
  review?: MedicalReviewRequest;
  legacyReview: boolean;
}
export const objectId = (value: any): string => typeof value === 'string' ? value : value?._id || '';
const time = (value: any) => { const n = new Date(value || 0).getTime(); return Number.isFinite(n) ? n : 0; };
const iso = (value: any) => time(value) ? new Date(value).toISOString() : undefined;
const usable = (artifact: MedicalArtifact) => !['superseded', 'voided'].includes(artifact.status || '');
const typeOf = (artifact: MedicalArtifact) => String(artifact.documentType || artifact.artifactType || '').toLowerCase();
const reviewTime = (review: MedicalReviewRequest) => time(review.createdAt || review.requestedAt || review.assignedDate || review.reviewedAt);

export function medicalProfileStatus(review: MedicalReviewRequest, stage: 'ekg' | 'liver'): string {
  // A queued/reopened review is not an approval, even if old decision fields remain.
  if (review.status === 'awaiting_whatsapp') return 'awaiting_whatsapp';
  if (['pending', 'assigned', 'in_progress', 'in_review'].includes(review.status)) return review.status;
  const decision = (stage === 'ekg' ? review.ekgReviewDecision : review.liverReviewDecision)
    || review.reviewDecision || review.decision || (review.whatsappStatus === 'responded' ? review.whatsappDecision : '');
  if (decision === 'caution') return 'caution';
  if (decision === 'NOT OK' || decision === 'declined') return 'declined';
  if (decision === 'more_info_needed' || decision === 'need_more_info') return 'needs_more_info';
  if (decision === 'OK' || decision === 'approved') return 'approved';
  return ({ approved: 'approved', rejected: 'declined', caution: 'caution', needs_resubmission: 'needs_more_info', completed: 'reviewed' } as Record<string, string>)[review.status] || 'received';
}

export function resolveMedicalProfile(input: {
  clientId: string; legacyRecords: any[]; artifacts: MedicalArtifact[]; reviews: MedicalReviewRequest[];
  legacyAvailable?: boolean; artifactsAvailable?: boolean;
}) {
  const { clientId } = input;
  const records = input.legacyRecords.filter(record => !record.clientId || objectId(record.clientId) === clientId);
  const legacy = [...records].sort((a, b) => time(b.updatedAt || b.createdAt || b.testDate) - time(a.updatedAt || a.createdAt || a.testDate))[0] || {};
  const artifacts = input.artifacts.filter(artifact => objectId(artifact.clientId) === clientId && usable(artifact));
  const document = (stage: 'ekg' | 'liver'): ProfileDocument => {
    const prefix = stage === 'ekg' ? 'ekg' : 'liverPanel';
    const matchesType = (artifact: MedicalArtifact) => (stage === 'ekg' ? ['ekg', 'ceremony_ekg'] : ['liver', 'liver_panel']).includes(typeOf(artifact));
    const artifact = [...artifacts].filter(matchesType).sort((a, b) => time(b.receivedAt || b.createdAt || b.updatedAt) - time(a.receivedAt || a.createdAt || a.updatedAt))[0];
    const legacyPresent = Boolean(legacy[prefix + 'FileName'] || legacy[prefix + 'FilePath'] || legacy[prefix + 'ReceivedDate']
      || ['received', 'reviewed', 'approved', 'declined', 'caution', 'needs_more_info'].includes(legacy[prefix + 'Status']));
    // Never carry an older legacy approval over to a different, newer upload.
    if (artifact && (!legacyPresent || time(artifact.receivedAt || artifact.createdAt) >= time(legacy[prefix + 'ReceivedDate']))) {
      const review = input.reviews.filter(item => {
        if (objectId(item.clientId || item.artifactSnapshot?.clientId) !== clientId || (item.status === 'wont_do' || item.reviewDecision === 'WONT_DO')) return false;
        if (item.retreatId && artifact.retreatId && objectId(item.retreatId) !== objectId(artifact.retreatId)) return false;
        const ids = [...(item.artifactIds || []).map(objectId), objectId(item.medicalArtifactId), ...(item.fileReviews || []).map(file => file.artifactId || '')];
        return Boolean(artifact._id && ids.includes(artifact._id));
      }).sort((a, b) => reviewTime(b) - reviewTime(a) || (b.display_id || 0) - (a.display_id || 0))[0];
      const fileIndex = artifact.files?.findIndex(file => file.variant !== 'english_translation') ?? -1;
      const file = fileIndex >= 0 ? artifact.files?.[fileIndex] : undefined;
      const status = review ? medicalProfileStatus(review, stage)
        : ({ approved: 'approved', rejected: 'declined', needs_resubmission: 'needs_more_info', missing_file: 'file_unavailable' } as Record<string, string>)[artifact.status || ''] || 'received';
      return { present: true, status, receivedAt: iso(artifact.receivedAt || artifact.createdAt), fileName: file?.fileName || artifact.title,
        fileIndex: file && (file.s3Key || file.filePath) ? fileIndex : undefined, artifact, review,
        notes: review?.reviewNotes || review?.overallNotes || artifact.notes || artifact.description, legacyReview: false };
    }
    return { present: legacyPresent, status: legacyPresent ? legacy[prefix + 'Status'] || 'received'
      : input.legacyAvailable === false || input.artifactsAvailable === false ? 'unavailable' : 'pending',
      receivedAt: iso(legacy[prefix + 'ReceivedDate']), fileName: legacy[prefix + 'FileName'], filePath: legacy[prefix + 'FilePath'],
      notes: legacy[prefix + 'AdvisorNotes'], legacyReview: legacyPresent && Boolean(objectId(legacy.retreatId)) };
  };
  const retreats = new Map<string, any>();
  [...records, ...artifacts].forEach(record => {
    if (record.retreatId && typeof record.retreatId === 'object' && record.retreatId._id) retreats.set(record.retreatId._id, record.retreatId);
  });
  return { legacy, ekg: document('ekg'), liver: document('liver'), retreats: [...retreats.values()] };
}

export const medicalProfileStatusLabel = (status?: string) => ({
  approved: 'Approved', declined: 'Declined', received: 'Received', reviewed: 'Reviewed', caution: 'Caution',
  needs_more_info: 'More information needed', awaiting_whatsapp: 'Awaiting WhatsApp response', pending: 'Pending',
  assigned: 'Assigned', in_progress: 'In progress', in_review: 'In review', unavailable: 'Status unavailable', file_unavailable: 'File unavailable',
} as Record<string, string>)[status || 'pending'] || status?.replace(/_/g, ' ') || 'Pending';
