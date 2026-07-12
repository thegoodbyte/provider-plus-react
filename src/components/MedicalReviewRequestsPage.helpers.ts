import { MedicalReviewRequest } from '../types';

const documentStageLabels: Record<NonNullable<MedicalReviewRequest['documentStage']>, string> = {
  entry: 'Entry',
  pre_ceremony: 'Pre-Ceremony',
  in_ceremony: 'In-Ceremony',
  post_ceremony: 'Post-Ceremony',
  other: 'Other',
  additional: 'Additional',
};

const documentTypeLabels: Record<NonNullable<MedicalReviewRequest['documentType']>, string> = {
  EKG: 'EKG',
  BP: 'Blood Pressure',
  meds: 'Meds',
  additional: 'Additional',
  Liver: 'Liver panel tests',
  Medications: 'Medications',
  other: 'Other',
};

const getRequestId = (request?: MedicalReviewRequest | string | null) => {
  if (!request) return '';
  if (typeof request === 'string') return request;
  return request._id || '';
};

const getRequestSortKey = (request: MedicalReviewRequest) => {
  const value = request.requestedAt || request.reviewedAt || request.assignedDate || request.createdAt;
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
};

const getAttemptKey = (request: MedicalReviewRequest) => request.attemptNumber || 0;

const sortByTimeline = (a: MedicalReviewRequest, b: MedicalReviewRequest) =>
  getRequestSortKey(a) - getRequestSortKey(b) || getAttemptKey(a) - getAttemptKey(b) || String(a.display_id || '').localeCompare(String(b.display_id || ''));

const splitByTime = (current: MedicalReviewRequest, relatedRequests: MedicalReviewRequest[]) => {
  const currentTime = getRequestSortKey(current);
  const currentAttempt = getAttemptKey(current);
  const sorted = [...relatedRequests].sort(sortByTimeline);

  if (currentTime > 0) {
    const previousRequests = sorted.filter((request) => getRequestSortKey(request) > 0 && getRequestSortKey(request) < currentTime);
    const previousIds = new Set(previousRequests.map((request) => getRequestId(request)));
    return {
      previousRequests,
      followingRequests: sorted.filter((request) => !previousIds.has(getRequestId(request))),
    };
  }

  if (currentAttempt > 0) {
    const previousRequests = sorted.filter((request) => getAttemptKey(request) > 0 && getAttemptKey(request) < currentAttempt);
    const previousIds = new Set(previousRequests.map((request) => getRequestId(request)));
    return {
      previousRequests,
      followingRequests: sorted.filter((request) => !previousIds.has(getRequestId(request))),
    };
  }

  return {
    previousRequests: [],
    followingRequests: sorted,
  };
};

export interface MedicalReviewRequestTimeline {
  previousRequests: MedicalReviewRequest[];
  followingRequests: MedicalReviewRequest[];
}

export const formatMedicalReviewDecisionLabel = (decision?: string) => {
  if (!decision) return 'No decision recorded';
  if (decision === 'OK') return 'Approve';
  if (decision === 'NOT OK') return 'Decline';
  if (decision === 'caution') return 'Need more info';
  return decision;
};

export const formatMedicalReviewRequestSummary = (request: MedicalReviewRequest) => {
  const documentStage = request.documentStage || (request.artifactSnapshot?.documentStage as MedicalReviewRequest['documentStage'] | undefined);
  const documentType = request.documentType || (request.artifactSnapshot?.documentType as MedicalReviewRequest['documentType'] | undefined);
  const parts = [
    documentStage ? documentStageLabels[documentStage] : '',
    documentType ? documentTypeLabels[documentType] : '',
  ].filter(Boolean);
  return parts.join(' • ');
};

export const splitMedicalReviewRequestsByTimeline = (
  currentRequest: MedicalReviewRequest | null | undefined,
  reviewHistory: MedicalReviewRequest[] = [],
): MedicalReviewRequestTimeline => {
  if (!currentRequest?._id) {
    return { previousRequests: [], followingRequests: [...reviewHistory].sort(sortByTimeline) };
  }

  const currentId = currentRequest._id;
  const relatedRequests = reviewHistory.filter((request) => getRequestId(request) !== currentId);
  const relatedById = new Map(
    relatedRequests
      .map((request) => [getRequestId(request), request] as const)
      .filter(([requestId]) => Boolean(requestId)),
  );

  const previousRequests: MedicalReviewRequest[] = [];
  const seen = new Set<string>();
  let cursorId = getRequestId(currentRequest.previousReviewRequestId);

  while (cursorId && !seen.has(cursorId)) {
    const ancestor = relatedById.get(cursorId);
    if (!ancestor) break;
    previousRequests.unshift(ancestor);
    seen.add(cursorId);
    cursorId = getRequestId(ancestor.previousReviewRequestId);
  }

  const childMap = new Map<string, MedicalReviewRequest[]>();
  for (const request of relatedRequests) {
    const parentId = getRequestId(request.previousReviewRequestId);
    if (!parentId) continue;
    const bucket = childMap.get(parentId) || [];
    bucket.push(request);
    childMap.set(parentId, bucket);
  }

  const followingRequests: MedicalReviewRequest[] = [];
  const queue = [...(childMap.get(currentId) || [])];
  while (queue.length) {
    const request = queue.shift();
    if (!request) continue;
    const requestId = getRequestId(request);
    if (!requestId || seen.has(requestId)) continue;
    followingRequests.push(request);
    seen.add(requestId);
    queue.push(...(childMap.get(requestId) || []));
  }

  if (!previousRequests.length || !followingRequests.length) {
    const fallback = splitByTime(currentRequest, relatedRequests);
    return {
      previousRequests: previousRequests.length ? previousRequests : fallback.previousRequests,
      followingRequests: followingRequests.length ? followingRequests : fallback.followingRequests,
    };
  }

  return {
    previousRequests: previousRequests.sort(sortByTimeline),
    followingRequests: followingRequests.sort(sortByTimeline),
  };
};
