import { MedicalReviewGroup, MedicalReviewRequest } from '../types';

export type MedicalReviewTypeFilter = 'all' | 'ekg' | 'liver' | 'both' | 'questionnaire' | 'general';

export const medicalReviewStatusPriority = (status?: string) => ({
  pending: 0,
  in_review: 1,
  caution: 2,
  needs_resubmission: 3,
  approved: 4,
  rejected: 5,
  completed: 6,
}[String(status || '').trim().toLowerCase()] ?? 7);

export const sortMedicalReviewsPendingFirst = <T extends MedicalReviewRequest>(requests: T[]) => [...requests].sort((a, b) =>
  medicalReviewStatusPriority(a.status) - medicalReviewStatusPriority(b.status)
  || Number(b.display_id || 0) - Number(a.display_id || 0));

export const sortMedicalReviewPacketsByExpiry = <T extends MedicalReviewGroup>(groups: T[]) => [...groups].sort((a, b) => {
  const expiry = (group: MedicalReviewGroup) => {
    const timestamp = group.endDate ? new Date(group.endDate).getTime() : Number.POSITIVE_INFINITY;
    return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
  };
  return expiry(a) - expiry(b) || String(a.title || '').localeCompare(String(b.title || ''));
});

const requestTypeGroups: Record<Exclude<MedicalReviewTypeFilter, 'all'>, string[]> = {
  ekg: ['ekg', 'ekg_review', 'ceremony_ekg_review'],
  liver: ['liver', 'liver_panel_review'],
  both: ['both'],
  questionnaire: ['questionnaire_review'],
  general: ['medical_question', 'general_clearance'],
};

const getStringDate = (value?: string | Date | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString().toLowerCase();
};

const parseLocalDate = (value: string) => {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) return NaN;
  return new Date(year, month - 1, day).getTime();
};

const getObjectText = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((item) => getObjectText(item)).filter(Boolean).join(' ');
  return [
    value._id,
    value.id,
    value.display_id,
    value.bookingNumber,
    value.bookingHash,
    value.code,
    value.retreatCode,
    value.name,
    value.email,
    value.firstName,
    value.lastName,
    value.title,
    value.key,
    value.metadata ? getObjectText(value.metadata) : '',
  ].filter(Boolean).join(' ');
};

export const getReviewRequestFilterText = (request: MedicalReviewRequest & { clientName?: string; retreatName?: string; bookingName?: string; bookingNumber?: string }) => {
  const pieces = [
    request.display_id ? `#${request.display_id}` : '',
    request.clientName || '',
    request.retreatName || '',
    request.bookingName || '',
    request.bookingNumber || '',
    request.requestType || '',
    request.documentStage || '',
    request.documentType || '',
    request.source || '',
    request.status || '',
    request.reviewDecision || '',
    request.reviewNotes || '',
    request.medicalStaffNotes || '',
    request.overallNotes || '',
    request.assignedTo || '',
    request.assignedToEmail || '',
    request.artifactSnapshot?.documentStage || '',
    request.artifactSnapshot?.documentType || '',
    request.artifactSnapshot?.clientName || '',
    request.artifactSnapshot?.retreatName || '',
    request.artifactSnapshot?.fileName || '',
    request.artifactSnapshot?.notes || '',
    getObjectText((request as any).bookingId),
    getObjectText((request as any).bookingFlowItemId),
    getObjectText((request as any).artifactIds),
    getStringDate(request.requestedAt),
    getStringDate(request.reviewedAt),
    getStringDate(request.assignedDate),
    getStringDate(request.createdAt),
    getStringDate(request.decisionDate),
  ];

  return pieces.filter(Boolean).join(' ').toLowerCase();
};

export const matchesReviewRequestFilters = (
  request: MedicalReviewRequest & { clientName?: string; retreatName?: string },
  filters: {
    searchTerm?: string;
    typeFilter?: MedicalReviewTypeFilter;
    dateFrom?: string;
    dateTo?: string;
  },
) => {
  const search = String(filters.searchTerm || '').trim().toLowerCase();
  if (search && !getReviewRequestFilterText(request).includes(search)) {
    return false;
  }

  const typeFilter = filters.typeFilter || 'all';
  if (typeFilter !== 'all') {
    const requestType = String(request.requestType || '').toLowerCase();
    const documentType = String(request.documentType || request.artifactSnapshot?.documentType || '').toLowerCase();
    const documentStage = String(request.documentStage || request.artifactSnapshot?.documentStage || '').toLowerCase();
    const typeMatches = requestTypeGroups[typeFilter].some((value) => requestType.includes(value) || documentType.includes(value) || documentStage.includes(value));
    if (!typeMatches) return false;
  }

  const requestDate = request.requestedAt || request.reviewedAt || request.assignedDate || request.createdAt || request.decisionDate;
  const timestamp = requestDate ? new Date(requestDate).getTime() : NaN;
  if (filters.dateFrom) {
    const from = parseLocalDate(filters.dateFrom);
    if (!Number.isNaN(timestamp) && timestamp < from) return false;
  }
  if (filters.dateTo) {
    const to = parseLocalDate(filters.dateTo);
    if (!Number.isNaN(to)) {
      const endOfDay = to + (24 * 60 * 60 * 1000) - 1;
      if (!Number.isNaN(timestamp) && timestamp > endOfDay) return false;
    }
  }

  return true;
};
