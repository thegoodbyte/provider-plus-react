import { MedicalReviewRequest } from '../types';

export type MedicalReviewTypeFilter = 'all' | 'ekg' | 'liver' | 'both' | 'questionnaire' | 'general';

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

export const getReviewRequestFilterText = (request: MedicalReviewRequest & { clientName?: string; retreatName?: string }) => {
  const pieces = [
    request.display_id ? `#${request.display_id}` : '',
    request.clientName || '',
    request.retreatName || '',
    request.requestType || '',
    request.documentStage || '',
    request.documentType || '',
    request.source || '',
    request.artifactSnapshot?.documentStage || '',
    request.artifactSnapshot?.documentType || '',
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
