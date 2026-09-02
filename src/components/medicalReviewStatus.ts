export const medicalReviewStatuses = [
  'pending',
  'in_review',
  'caution',
  'needs_resubmission',
  'approved',
  'rejected',
  'completed',
] as const;

export type NormalizedMedicalReviewStatus = typeof medicalReviewStatuses[number];

export const normalizeMedicalReviewStatus = (status?: string) =>
  String(status || '').trim().toLowerCase();

export const isPendingMedicalReviewStatus = (status?: string) => {
  const normalized = normalizeMedicalReviewStatus(status);
  return normalized === 'pending' || normalized === 'in_review';
};

export const medicalReviewStatusPriority = (status?: string) => {
  const priority: Record<string, number> = {
    pending: 0,
    in_review: 1,
    caution: 2,
    needs_resubmission: 3,
    approved: 4,
    rejected: 5,
    completed: 6,
  };
  return priority[normalizeMedicalReviewStatus(status)] ?? 7;
};

export const compareMedicalReviewStatuses = (left?: string, right?: string) =>
  medicalReviewStatusPriority(left) - medicalReviewStatusPriority(right);

export const medicalReviewStatusPresentation: Record<string, {
  badgeClass: string;
  rowClass: string;
  icon: 'clock' | 'thumbs-up' | 'thumbs-down' | 'alert' | 'check';
}> = {
  pending: {
    badgeClass: 'border border-blue-200 bg-blue-100 text-blue-800',
    rowClass: 'border-l-4 border-l-blue-500 bg-blue-50/80',
    icon: 'clock',
  },
  in_review: {
    badgeClass: 'bg-blue-100 text-blue-800',
    rowClass: 'border-l-4 border-l-sky-500 bg-sky-50/80',
    icon: 'clock',
  },
  caution: {
    badgeClass: 'bg-amber-100 text-amber-800',
    rowClass: 'border-l-4 border-l-amber-500 bg-amber-50/90',
    icon: 'alert',
  },
  needs_resubmission: {
    badgeClass: 'bg-orange-100 text-orange-800',
    rowClass: 'border-l-4 border-l-orange-500 bg-orange-50/80',
    icon: 'alert',
  },
  approved: {
    badgeClass: 'bg-green-100 text-green-800',
    rowClass: 'border-l-4 border-l-green-500 bg-green-50/80',
    icon: 'thumbs-up',
  },
  rejected: {
    badgeClass: 'bg-red-100 text-red-800',
    rowClass: 'border-l-4 border-l-red-500 bg-red-50/80',
    icon: 'thumbs-down',
  },
  completed: {
    badgeClass: 'bg-gray-100 text-gray-800',
    rowClass: 'border-l-4 border-l-gray-400 bg-gray-50',
    icon: 'check',
  },
};

export const getMedicalReviewStatusPresentation = (status?: string) =>
  medicalReviewStatusPresentation[normalizeMedicalReviewStatus(status)] || {
    badgeClass: 'bg-gray-100 text-gray-700',
    rowClass: 'bg-white',
    icon: 'clock' as const,
  };
