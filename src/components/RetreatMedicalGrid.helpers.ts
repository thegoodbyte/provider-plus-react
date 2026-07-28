import { MedicalArtifact, MedicalReviewRequest, RetreatClient } from '../types';

export type RetreatMedicalStageKey = 'ekg' | 'liver' | 'medications';

export type RetreatMedicalDecisionTone = 'green' | 'yellow' | 'red' | 'neutral';

export interface RetreatMedicalStageDefinition {
  key: RetreatMedicalStageKey;
  label: string;
  shortLabel: string;
  iconLabel: string;
  requestTypes: MedicalReviewRequest['requestType'][];
  artifactTypes: NonNullable<MedicalArtifact['artifactType']>[];
  documentTypes: NonNullable<MedicalArtifact['documentType']>[];
  accentClass: string;
}

export interface RetreatMedicalClientColumn {
  bookingId: string;
  bookingNumber: string;
  clientId: string;
  clientDisplayId?: number;
  clientName: string;
  bookingStatus?: string;
  profilePictureUrl?: string;
}

export interface RetreatMedicalCell {
  status: 'missing' | 'artifact_only' | 'pending' | 'reviewed';
  artifact?: MedicalArtifact | null;
  review?: MedicalReviewRequest | null;
  artifactLabel?: string;
  reviewLabel?: string;
  submittedAt?: string;
  decisionLabel?: string;
  decisionTone: RetreatMedicalDecisionTone;
  notes?: string;
  artifacts: MedicalArtifact[];
  reviews: MedicalReviewRequest[];
}

export interface RetreatMedicalRow {
  key: RetreatMedicalStageKey;
  label: string;
  shortLabel: string;
  iconLabel: string;
  accentClass: string;
  cells: RetreatMedicalCell[];
}

export interface RetreatMedicalGridData {
  clients: RetreatMedicalClientColumn[];
  rows: RetreatMedicalRow[];
  retreatName: string;
  retreatCode: string;
  totals: {
    clients: number;
    artifacts: number;
    reviews: number;
    missing: number;
  };
}

const stageDefinitions: RetreatMedicalStageDefinition[] = [
  {
    key: 'ekg',
    label: 'EKG',
    shortLabel: 'EKG',
    iconLabel: 'heart',
    requestTypes: ['ekg_review', 'ceremony_ekg_review', 'ekg'],
    artifactTypes: ['ekg', 'ceremony_ekg'],
    documentTypes: ['EKG'],
    accentClass: 'medical-stage-ekg',
  },
  {
    key: 'liver',
    label: 'Liver',
    shortLabel: 'LVR',
    iconLabel: 'leaf',
    requestTypes: ['liver_panel_review', 'liver', 'both'],
    artifactTypes: ['liver_panel'],
    documentTypes: ['Liver'],
    accentClass: 'medical-stage-liver',
  },
  {
    key: 'medications',
    label: 'Medication Form',
    shortLabel: 'MEDS',
    iconLabel: 'file',
    requestTypes: ['medications_review'],
    artifactTypes: ['medications_form', 'medication_list'],
    documentTypes: ['Medications', 'meds'],
    accentClass: 'medical-stage-medications',
  },
];

export const retreatMedicalStages = stageDefinitions;

const getObjectId = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

const getDateValue = (value?: Date | string | null) => {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const getClientName = (booking: RetreatClient): string => {
  const client = booking.clientId as any;
  const name = [client?.firstName || client?.fname, client?.lastName || client?.lname].filter(Boolean).join(' ').trim();
  return name || client?.email || `Client ${getObjectId(booking).slice(-6)}`;
};

const getBookingNumber = (booking: RetreatClient): string => {
  return String(booking.bookingNumber || (booking as any).displayNumber || getObjectId(booking).slice(-6));
};

const getRequestSortKey = (request: MedicalReviewRequest) =>
  getDateValue(request.reviewedAt || request.decisionDate || request.requestedAt || request.assignedDate || request.createdAt);

const getArtifactSortKey = (artifact: MedicalArtifact) =>
  getDateValue(artifact.receivedAt || artifact.createdAt || artifact.updatedAt);

const normalizeText = (value: unknown) => String(value || '').toLowerCase();

const getReviewDecision = (request?: MedicalReviewRequest | null): 'OK' | 'caution' | 'more_info_needed' | 'NOT OK' | '' => {
  if (!request) return '';
  if (request.reviewDecision === 'OK' || request.decision === 'approved' || request.status === 'approved' || request.status === 'completed') return 'OK';
  if (request.reviewDecision === 'more_info_needed' || request.decision === 'need_more_info' || request.status === 'needs_resubmission') return 'more_info_needed';
  if (request.reviewDecision === 'NOT OK' || request.decision === 'declined' || request.status === 'rejected') return 'NOT OK';
  if (request.reviewDecision === 'caution' || request.decision === 'caution' || request.status === 'caution') return 'caution';
  return '';
};

const getDecisionTone = (decision: 'OK' | 'caution' | 'more_info_needed' | 'NOT OK' | ''): RetreatMedicalDecisionTone => {
  if (decision === 'OK') return 'green';
  if (decision === 'caution') return 'yellow';
  if (decision === 'more_info_needed') return 'yellow';
  if (decision === 'NOT OK') return 'red';
  return 'neutral';
};

const getDecisionLabel = (decision: 'OK' | 'caution' | 'more_info_needed' | 'NOT OK' | '', request?: MedicalReviewRequest | null) => {
  if (decision === 'OK') return 'OK';
  if (decision === 'caution') return 'Caution';
  if (decision === 'more_info_needed') return 'More info needed';
  if (decision === 'NOT OK') return 'Declined';
  if (request?.status === 'pending' || request?.status === 'assigned' || request?.status === 'in_progress' || request?.status === 'in_review') {
    return request.status.replace(/_/g, ' ');
  }
  return '';
};

const matchesStageArtifact = (artifact: MedicalArtifact, stage: RetreatMedicalStageDefinition) => {
  const artifactText = normalizeText([
    artifact.artifactType,
    artifact.documentType,
    artifact.documentStage,
    artifact.title,
    artifact.description,
    artifact.textContent,
  ].join(' '));

  return stage.artifactTypes.some((value) => artifact.artifactType === value)
    || stage.documentTypes.some((value) => artifact.documentType === value)
    || artifactText.includes(stage.key);
};

const matchesStageReview = (request: MedicalReviewRequest, stage: RetreatMedicalStageDefinition) => {
  const requestText = normalizeText([
    request.requestType,
    request.documentType,
    request.documentStage,
    request.reviewNotes,
    request.overallNotes,
    request.medicalStaffNotes,
    request.artifactSnapshot?.documentType,
    request.artifactSnapshot?.notes,
  ].join(' '));

  return stage.requestTypes.includes(request.requestType as any)
    || stage.documentTypes.includes(request.documentType as any)
    || requestText.includes(stage.key);
};

const latestBySortKey = <T extends { _id?: string }>(items: T[], getKey: (item: T) => number) =>
  [...items].sort((a, b) => getKey(b) - getKey(a))[0] || null;

const pickMatchingReview = (
  reviews: MedicalReviewRequest[],
  stage: RetreatMedicalStageDefinition,
  booking: RetreatClient,
  artifact?: MedicalArtifact | null,
) => {
  const bookingClientId = getObjectId(booking.clientId);
  const bookingId = getObjectId(booking);
  const artifactId = getObjectId(artifact);

  const stageReviews = reviews.filter((request) => {
    if (!matchesStageReview(request, stage)) return false;

    const requestClientId = getObjectId(request.clientId);
    const requestBookingId = getObjectId((request as any).bookingId);
    const requestMedicalArtifactId = getObjectId(request.medicalArtifactId);
    const reviewArtifactIds = (request.artifactIds || []).map(getObjectId);

    const sameClient = requestClientId && requestClientId === bookingClientId;
    const sameBooking = requestBookingId && requestBookingId === bookingId;
    const linkedArtifact = artifactId && (requestMedicalArtifactId === artifactId || reviewArtifactIds.includes(artifactId));

    return sameClient || sameBooking || linkedArtifact;
  });

  if (artifactId) {
    const artifactLinked = stageReviews.filter((request) => {
      const requestMedicalArtifactId = getObjectId(request.medicalArtifactId);
      const reviewArtifactIds = (request.artifactIds || []).map(getObjectId);
      return requestMedicalArtifactId === artifactId || reviewArtifactIds.includes(artifactId);
    });
    const latestLinked = latestBySortKey(artifactLinked, getRequestSortKey);
    if (latestLinked) return latestLinked;
  }

  return latestBySortKey(stageReviews, getRequestSortKey);
};

const pickMatchingArtifact = (
  artifacts: MedicalArtifact[],
  stage: RetreatMedicalStageDefinition,
  booking: RetreatClient,
) => {
  const bookingClientId = getObjectId(booking.clientId);
  const bookingRetreatId = getObjectId(booking.retreatId);
  const bookingId = getObjectId(booking);

  const stageArtifacts = artifacts.filter((artifact) => {
    if (!matchesStageArtifact(artifact, stage)) return false;

    const artifactClientId = getObjectId(artifact.clientId);
    const artifactBookingId = getObjectId(artifact.bookingId);

    return artifactClientId === bookingClientId
      || artifactBookingId === bookingId;
  });

  return latestBySortKey(stageArtifacts, getArtifactSortKey);
};

export const buildRetreatMedicalGridData = (
  bookings: RetreatClient[],
  artifacts: MedicalArtifact[],
  reviews: MedicalReviewRequest[],
  retreat?: { name?: string; code?: string; retreatCode?: string } | null,
): RetreatMedicalGridData => {
  const clients = [...bookings]
    .sort((a, b) => {
      const aNumber = Number(a.bookingNumber || Number.MAX_SAFE_INTEGER);
      const bNumber = Number(b.bookingNumber || Number.MAX_SAFE_INTEGER);
      if (aNumber !== bNumber) return aNumber - bNumber;
      return getClientName(a).localeCompare(getClientName(b), undefined, { sensitivity: 'base' });
    })
    .map((booking) => ({
      bookingId: getObjectId(booking),
      bookingNumber: getBookingNumber(booking),
      clientId: getObjectId(booking.clientId),
      clientDisplayId: (booking.clientId as any)?.display_id,
      clientName: getClientName(booking),
      bookingStatus: booking.status,
      profilePictureUrl: (booking.clientId as any)?.profilePictureUrl || '',
    }));

  const rows = stageDefinitions.map((stage) => ({
    key: stage.key,
    label: stage.label,
    shortLabel: stage.shortLabel,
    iconLabel: stage.iconLabel,
    accentClass: stage.accentClass,
    cells: clients.map((client) => {
      const booking = bookings.find((entry) => getObjectId(entry) === client.bookingId) || bookings.find((entry) => getObjectId(entry.clientId) === client.clientId);
      const artifact = booking ? pickMatchingArtifact(artifacts, stage, booking) : null;
      const review = booking ? pickMatchingReview(reviews, stage, booking, artifact) : null;
      const bookingClientId = booking ? getObjectId(booking.clientId) : '';
      const bookingId = booking ? getObjectId(booking) : '';
      const matchingArtifacts = artifacts
        .filter((item) => matchesStageArtifact(item, stage)
          && (getObjectId(item.clientId) === bookingClientId || getObjectId(item.bookingId) === bookingId))
        .sort((a, b) => getArtifactSortKey(b) - getArtifactSortKey(a));
      const matchingReviews = reviews
        .filter((item) => matchesStageReview(item, stage)
          && (getObjectId(item.clientId) === bookingClientId || getObjectId((item as any).bookingId) === bookingId
            || (item.artifactIds || []).some((id) => matchingArtifacts.some((entry) => getObjectId(entry) === getObjectId(id)))))
        .sort((a, b) => getRequestSortKey(b) - getRequestSortKey(a));
      const decision = getReviewDecision(review);
      const notes = review?.reviewNotes || review?.overallNotes || review?.medicalStaffNotes || artifact?.notes || '';
      const submittedAt = review?.requestedAt || review?.assignedDate || review?.createdAt || artifact?.receivedAt || '';
      const reviewLabel = review ? `MRR #${review.display_id || review._id?.slice(-6) || 'linked'}` : '';
      const artifactLabel = artifact ? `Artifact #${artifact.display_id || artifact._id?.slice(-6) || 'linked'}` : '';

      let status: RetreatMedicalCell['status'] = 'missing';
      if (review) status = 'reviewed';
      else if (artifact) status = 'artifact_only';

      if (review && (!decision || review.status === 'pending' || review.status === 'assigned' || review.status === 'in_progress' || review.status === 'in_review')) {
        status = 'pending';
      }

      return {
        status,
        artifact,
        review,
        artifactLabel,
        reviewLabel,
        submittedAt: submittedAt ? new Date(submittedAt).toLocaleDateString() : '',
        decisionLabel: getDecisionLabel(decision, review),
        decisionTone: getDecisionTone(decision),
        notes,
        artifacts: matchingArtifacts,
        reviews: matchingReviews,
      };
    }),
  }));

  const totals = rows.reduce(
    (acc, row) => {
      row.cells.forEach((cell) => {
        if (cell.review) acc.reviews += 1;
        if (cell.artifact) acc.artifacts += 1;
        if (cell.status === 'missing') acc.missing += 1;
      });
      return acc;
    },
    { clients: clients.length, artifacts: 0, reviews: 0, missing: 0 },
  );

  return {
    clients,
    rows,
    retreatName: retreat?.name || '',
    retreatCode: retreat?.retreatCode || retreat?.code || retreat?.name || '',
    totals,
  };
};
