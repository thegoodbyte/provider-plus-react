import { getMedicalDocumentType } from './MedicalDocumentTypeIcon';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronDown, Eye, FileText, Pencil, Plus, RefreshCw, Send, Trash2, UserCheck, XCircle, Zap } from 'lucide-react';
import { medicalArtifactsApi, medicalReviewRequestsApi, retreatsApi } from '../services/api';
import { usersApi, User } from '../services/usersApi';
import { Client, MedicalArtifact, MedicalReviewRequest, Retreat, RetreatArtifactSubmissionRow, RetreatArtifactSubmissionsResponse, RetreatClient } from '../types';
import { parseCalendarDate } from '../utils/dateFormat';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import { useToast } from '../hooks/useToast';
import Toast from './Toast';
import LoadingSpinner from './LoadingSpinner';
import ClientAvatar from './ClientAvatar';

const artifactTypeLabels: Record<NonNullable<MedicalArtifact['artifactType']>, string> = {
  ekg: 'EKG',
  ceremony_ekg: 'Ceremony EKG',
  blood_pressure: 'Blood Pressure',
  liver_panel: 'Liver Panel',
  medications_form: 'Medications Form',
  medication_list: 'Medication List',
  questionnaire: 'Health Questionnaire',
  food_intake: 'Food Intake',
  contract: 'Contract',
  question: 'Question',
  other: 'Other',
};

const getArtifactTypeLabel = (artifactType?: MedicalArtifact['artifactType']) =>
  artifactType ? artifactTypeLabels[artifactType] : 'Medical Artifact';

const documentStageLabels: Record<NonNullable<MedicalArtifact['documentStage']>, string> = {
  entry: 'Entry',
  pre_ceremony: 'Pre-Ceremony',
  in_ceremony: 'In-Ceremony',
  post_ceremony: 'Post-Ceremony',
  other: 'Other',
  additional: 'Additional',
};

const documentTypeLabels: Record<NonNullable<MedicalArtifact['documentType']>, string> = {
  EKG: 'EKG',
  BP: 'Blood Pressure',
  meds: 'Meds',
  questionnaire: 'Health Questionnaire',
  additional: 'Additional',
  Liver: 'Liver panel tests',
  Medications: 'Medications',
  other: 'Other',
};

const getDocumentStageLabel = (stage?: MedicalArtifact['documentStage']) =>
  stage ? documentStageLabels[stage] : 'Entry';

const getDocumentTypeLabel = (type?: MedicalArtifact['documentType'], artifactType?: MedicalArtifact['artifactType']) =>
  type ? documentTypeLabels[type] : getArtifactTypeLabel(artifactType);

const getSourceLabel = (source?: MedicalArtifact['source']) =>
  source === 'client_upload' ? 'Client (IR)' : 'Admin (RE)';

const getObjectId = (value: any) => typeof value === 'object' ? value?._id || value?.id : value;

const clientNameBackgrounds = [
  'bg-blue-100 text-blue-900 ring-blue-200',
  'bg-emerald-100 text-emerald-900 ring-emerald-200',
  'bg-amber-100 text-amber-900 ring-amber-200',
  'bg-violet-100 text-violet-900 ring-violet-200',
  'bg-cyan-100 text-cyan-900 ring-cyan-200',
  'bg-rose-100 text-rose-900 ring-rose-200',
];

const getClientNameBackgroundClass = (clientId?: string) => {
  if (!clientId) return clientNameBackgrounds[0];
  let hash = 0;
  for (let index = 0; index < clientId.length; index += 1) {
    hash = (hash * 31 + clientId.charCodeAt(index)) % clientNameBackgrounds.length;
  }
  return clientNameBackgrounds[Math.abs(hash) % clientNameBackgrounds.length];
};

const getClientName = (client?: string | Client) => {
  if (!client || typeof client === 'string') return 'Unknown client';
  return [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ') || client.email || 'Unknown client';
};

const getClientLabel = (client?: string | Client) => {
  const name = getClientName(client);
  if (!client || typeof client === 'string') return name;
  return client.display_id ? `#${client.display_id} ${name}` : name;
};

const getRetreatLabel = (retreat?: string | Retreat) => {
  if (!retreat || typeof retreat === 'string') return retreat ? `Retreat ${String(retreat).slice(-6)}` : '';
  return retreat.retreatCode || retreat.code || retreat.name || getObjectId(retreat);
};

const getBookingLabel = (booking?: string | RetreatClient) => {
  if (!booking || typeof booking === 'string') return booking ? `Booking ${String(booking).slice(-6)}` : '';
  return booking.bookingNumber ? `Booking #${booking.bookingNumber}` : `Booking ${getObjectId(booking).slice(-6)}`;
};

const getRetreatCode = (retreat?: string | Retreat) => {
  if (!retreat || typeof retreat === 'string') return '';
  return retreat.retreatCode || retreat.code || retreat.name || '';
};

const getRetreatSearchText = (retreat?: string | Retreat) => {
  if (!retreat) return '';
  if (typeof retreat === 'string') return retreat;
  return [
    retreat.retreatCode,
    retreat.code,
    retreat.name,
    getObjectId(retreat),
  ].filter(Boolean).join(' ');
};

export const isRetreatFuture = (retreat?: Retreat, now = new Date()) => {
  if (!retreat) return true;
  const end = parseCalendarDate(retreat.endDate || retreat.dates?.endDate || retreat.startDate || retreat.dates?.startDate || null);
  if (!end) return true;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  return end.getTime() >= startOfToday.getTime();
};

const getCompactDocumentType = (artifact: MedicalArtifact) => getMedicalDocumentType(artifact.artifactType, artifact.documentType);

const getSearchText = (artifact: MedicalArtifact) => [
  artifact.display_id,
  artifact._id,
  artifact.title,
  artifact.artifactType,
  artifact.documentStage,
  artifact.documentType,
  artifact.status,
  getSourceLabel(artifact.source),
  getClientName(artifact.clientId),
  typeof artifact.clientId === 'object' ? artifact.clientId.email : '',
  typeof artifact.clientId === 'object' ? artifact.clientId.display_id : '',
  getObjectId(artifact.clientId),
  getBookingLabel(artifact.bookingId),
  getObjectId(artifact.bookingId),
  getRetreatLabel(artifact.retreatId),
  getRetreatSearchText(artifact.retreatId),
  getObjectId(artifact.retreatId),
  artifact.ceremonyNumber ? `ceremony ${artifact.ceremonyNumber}` : '',
].filter(Boolean).join(' ').toLowerCase();

const getReviewTime = (review: MedicalReviewRequest) =>
  new Date(review.reviewedAt || review.requestedAt || review.createdAt || 0).getTime();

const getReviewLabel = (review: MedicalReviewRequest) =>
  `MRR #${review.display_id || review._id?.slice(-6) || 'linked'}`;

const quickReviewTypeForArtifact = (artifactType?: MedicalArtifact['artifactType']): NonNullable<MedicalReviewRequest['requestType']> => {
  if (artifactType === 'ekg' || artifactType === 'ceremony_ekg') return artifactType === 'ceremony_ekg' ? 'ceremony_ekg_review' : 'ekg_review';
  if (artifactType === 'blood_pressure') return 'blood_pressure_review';
  if (artifactType === 'liver_panel') return 'liver_panel_review';
  if (artifactType === 'medications_form' || artifactType === 'medication_list') return 'medications_review';
  if (artifactType === 'questionnaire') return 'questionnaire_review';
  if (artifactType === 'food_intake') return 'food_review';
  if (artifactType === 'question') return 'medical_question';
  return 'general_clearance';
};

const getReviewArtifactIds = (review: MedicalReviewRequest): string[] => {
  const ids = new Set<string>();
  const addId = (value: any) => {
    const id = getObjectId(value);
    if (id) ids.add(String(id));
  };

  (review.artifactIds || []).forEach(addId);
  addId((review as any).medicalArtifactId);
  addId((review as any).artifactId);
  (review.fileReviews || []).forEach((fileReview) => addId(fileReview.artifactId));
  return Array.from(ids);
};

const getReviewDecision = (review?: MedicalReviewRequest) => {
  const decision = review?.reviewDecision;
  if (decision === 'OK') return 'OK';
  if (decision === 'NOT OK') return 'NOT OK';
  if (decision === 'caution') return 'caution';
  if (review?.status === 'approved' || review?.status === 'completed') return 'OK';
  if (review?.status === 'rejected' || review?.status === 'needs_resubmission') return 'NOT OK';
  if (review?.status === 'caution') return 'caution';
  return '';
};

const getArtifactOutcome = (artifact: MedicalArtifact, latestReview?: MedicalReviewRequest) => {
  const decision = getReviewDecision(latestReview);
  if (decision === 'NOT OK') return 'declined';
  if (decision === 'caution') return 'caution';
  if (decision === 'OK') return 'ok';
  if (latestReview?.status === 'needs_resubmission') return 'needs_info';
  if (latestReview && ['pending', 'assigned', 'in_progress', 'in_review'].includes(latestReview.status || '')) return 'pending';
  if (artifact.status === 'rejected' || artifact.status === 'needs_resubmission') return artifact.status === 'needs_resubmission' ? 'needs_info' : 'declined';
  if (artifact.status === 'pending_review') return 'pending';
  return '';
};

const outcomeLabel: Record<string, string> = { declined: 'Declined', needs_info: 'Needs info', pending: 'Pending', ok: 'OK', caution: 'Caution' };

const ReviewResultBadge: React.FC<{ review?: MedicalReviewRequest }> = ({ review }) => {
  if (!review) {
    return <span className="text-xs text-gray-400">No review</span>;
  }

  const decision = getReviewDecision(review);
  if (decision === 'OK') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
        <CheckCircle2 className="h-3.5 w-3.5" />
        OK
      </span>
    );
  }
  if (decision === 'NOT OK') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
        <XCircle className="h-3.5 w-3.5" />
        Declined
      </span>
    );
  }
  if (decision === 'caution') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800">
        <AlertTriangle className="h-3.5 w-3.5" />
        Caution
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
      {review.status || 'pending'}
    </span>
  );
};

const SubmissionStatusBadge: React.FC<{ row: RetreatArtifactSubmissionRow }> = ({ row }) => {
  if (row.status === 'received') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Received
      </span>
    );
  }
  if (row.status === 'missing_file') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800">
        <AlertTriangle className="h-3.5 w-3.5" />
        No file uploaded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
      <XCircle className="h-3.5 w-3.5" />
      Missing
    </span>
  );
};

export type RetreatSubmissionMrrFilter = 'all' | 'with_mrr' | 'without_mrr';

export const filterRetreatSubmissionRowsByMrr = (
  rows: RetreatArtifactSubmissionRow[],
  filter: RetreatSubmissionMrrFilter,
) => {
  if (filter === 'with_mrr') return rows.filter((row) => Boolean(row.reviewRequestId));
  if (filter === 'without_mrr') return rows.filter((row) => !row.reviewRequestId && Boolean(row.artifactId));
  return rows;
};

const MedicalArtifactsPage: React.FC = () => {
  const { toast, showSuccess, showError, dismiss: dismissToast } = useToast();
  const navigate = useNavigate();
  const [artifacts, setArtifacts] = useState<MedicalArtifact[]>([]);
  const [reviewRequests, setReviewRequests] = useState<MedicalReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [bookingIdFilter, setBookingIdFilter] = useState('');
  const [clientIdFilter, setClientIdFilter] = useState('');
  const [retreatIdFilter, setRetreatIdFilter] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | NonNullable<MedicalArtifact['documentStage']>>('all');
  const [documentTypeFilter, setDocumentTypeFilter] = useState<'all' | NonNullable<MedicalArtifact['documentType']>>('all');
  const [artifactTypeFilter, setArtifactTypeFilter] = useState<'all' | NonNullable<MedicalArtifact['artifactType']>>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | NonNullable<MedicalArtifact['status']>>('all');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'has_review' | 'no_review'>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'declined' | 'needs_info' | 'pending'>('all');
  const [futureRetreatsOnly, setFutureRetreatsOnly] = useState(true);
  const [artifactSortKey, setArtifactSortKey] = useState<'id' | 'client' | 'stage' | 'documentType' | 'source' | 'retreat' | 'received' | 'files'>('received');
  const [artifactSortDirection, setArtifactSortDirection] = useState<'asc' | 'desc'>('desc');
  const [activeView, setActiveView] = useState<'artifacts' | 'retreat_submissions'>('artifacts');
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [submissionRetreatFilter, setSubmissionRetreatFilter] = useState('');
  const [submissionArtifactTypeFilter, setSubmissionArtifactTypeFilter] = useState<'all' | NonNullable<MedicalArtifact['artifactType']>>('all');
  const [submissionStageFilter, setSubmissionStageFilter] = useState<'all' | NonNullable<MedicalArtifact['documentStage']>>('all');
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<'all' | 'missing' | 'received'>('all');
  const [submissionMrrFilter, setSubmissionMrrFilter] = useState<RetreatSubmissionMrrFilter>('all');
  const [submissionSearchFilter, setSubmissionSearchFilter] = useState('');
  const [submissionSort, setSubmissionSort] = useState<'client' | 'type' | 'stage' | 'status'>('client');
  const [submissionData, setSubmissionData] = useState<RetreatArtifactSubmissionsResponse | null>(null);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState('');
  const [deletingArtifactId, setDeletingArtifactId] = useState('');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [quickMrrArtifact, setQuickMrrArtifact] = useState<MedicalArtifact | null>(null);
  const [quickMrrAdvisors, setQuickMrrAdvisors] = useState<User[]>([]);
  const [quickMrrGroups, setQuickMrrGroups] = useState<any[]>([]);
  const [quickMrrTypes, setQuickMrrTypes] = useState<Array<{ key: NonNullable<MedicalReviewRequest['requestType']>; label: string }>>([]);
  const [quickMrrForm, setQuickMrrForm] = useState({ requestType: 'general_clearance' as NonNullable<MedicalReviewRequest['requestType']>, advisorId: '', groupId: '', notifyClient: true });
  const [quickMrrSaving, setQuickMrrSaving] = useState(false);
  const [selectedArtifactIds, setSelectedArtifactIds] = useState<Set<string>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkAssignAdvisors, setBulkAssignAdvisors] = useState<User[]>([]);
  const [bulkAssignGroups, setBulkAssignGroups] = useState<any[]>([]);
  const [bulkAssignTypes, setBulkAssignTypes] = useState<Array<{ key: NonNullable<MedicalReviewRequest['requestType']>; label: string }>>([]);
  const [bulkAssignForm, setBulkAssignForm] = useState({ requestType: 'general_clearance' as NonNullable<MedicalReviewRequest['requestType']>, advisorId: '', groupId: '', notifyClient: true });
  const [bulkAssignSaving, setBulkAssignSaving] = useState(false);
  const [bulkAssignError, setBulkAssignError] = useState('');
  const [bulkAssignProgress, setBulkAssignProgress] = useState<{ completed: number; total: number } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [artifactsResponse, retreatsResponse, reviewsResponse] = await Promise.all([
        medicalArtifactsApi.getAll(),
        retreatsApi.getAll().catch(() => ({ data: [] as Retreat[] })),
        medicalReviewRequestsApi.getAll(),
      ]);
      setArtifacts(artifactsResponse.data || []);
      setRetreats(retreatsResponse.data || []);
      setReviewRequests(reviewsResponse.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadRetreatSubmissions = useCallback(async () => {
    const retreat = submissionRetreatFilter.trim();
    if (!retreat) {
      setSubmissionsError('Enter a retreat code or ID.');
      setSubmissionData(null);
      return;
    }
    setSubmissionsLoading(true);
    setSubmissionsError('');
    try {
      const response = await medicalArtifactsApi.getRetreatSubmissions({
        retreat,
        artifactType: submissionArtifactTypeFilter,
        documentStage: submissionStageFilter,
        status: submissionStatusFilter,
        search: submissionSearchFilter,
      });
      setSubmissionData(response.data);
    } catch (error: any) {
      setSubmissionsError(error?.response?.data?.message || 'Could not load retreat submissions.');
      setSubmissionData(null);
    } finally {
      setSubmissionsLoading(false);
    }
  }, [submissionArtifactTypeFilter, submissionRetreatFilter, submissionSearchFilter, submissionStageFilter, submissionStatusFilter]);

  useEffect(() => {
    if (activeView !== 'retreat_submissions' || !submissionRetreatFilter.trim()) return;
    const timeout = window.setTimeout(() => {
      loadRetreatSubmissions();
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [activeView, loadRetreatSubmissions, submissionRetreatFilter]);

  const reviewsByArtifactId = useMemo(() => {
    const grouped = new Map<string, MedicalReviewRequest[]>();
    reviewRequests.forEach((review) => {
      getReviewArtifactIds(review).forEach((artifactId) => {
        const existing = grouped.get(artifactId) || [];
        existing.push(review);
        grouped.set(artifactId, existing);
      });
    });

    grouped.forEach((reviews, artifactId) => {
      grouped.set(artifactId, [...reviews].sort((a, b) => getReviewTime(b) - getReviewTime(a)));
    });
    return grouped;
  }, [reviewRequests]);

  const retreatsById = useMemo(() => {
    const map = new Map<string, Retreat>();
    retreats.forEach((retreat) => {
      const id = String(retreat._id || '').trim();
      if (id) map.set(id, retreat);
    });
    return map;
  }, [retreats]);

  const resolveArtifactRetreat = useCallback((retreatValue?: string | Retreat): Retreat | undefined => {
    if (!retreatValue) return undefined;
    if (typeof retreatValue === 'object') return retreatValue;
    return retreatsById.get(retreatValue);
  }, [retreatsById]);

  const filteredArtifacts = useMemo(() => {
    const search = searchFilter.trim().toLowerCase();
    const bookingId = bookingIdFilter.trim().toLowerCase();
    const clientId = clientIdFilter.trim().toLowerCase();
    const retreatId = retreatIdFilter.trim().toLowerCase();

    return artifacts.filter((artifact) => {
      const artifactBookingId = String(getObjectId(artifact.bookingId) || '').toLowerCase();
      const artifactClientId = String(getObjectId(artifact.clientId) || '').toLowerCase();
      const artifactRetreatSearch = getRetreatSearchText(artifact.retreatId).toLowerCase();
      const artifactReviews = artifact._id ? reviewsByArtifactId.get(artifact._id) || [] : [];
      const outcome = getArtifactOutcome(artifact, artifactReviews[0]);

      if (search && !getSearchText(artifact).includes(search)) return false;
      if (bookingId && !artifactBookingId.includes(bookingId)) return false;
      if (clientId && !artifactClientId.includes(clientId)) return false;
      if (retreatId && !artifactRetreatSearch.includes(retreatId)) return false;
      if (stageFilter !== 'all' && (artifact.documentStage || 'entry') !== stageFilter) return false;
      if (documentTypeFilter !== 'all' && (artifact.documentType || 'other') !== documentTypeFilter) return false;
      if (artifactTypeFilter !== 'all' && artifact.artifactType !== artifactTypeFilter) return false;
      if (statusFilter !== 'all' && (artifact.status || 'stored') !== statusFilter) return false;
      if (reviewFilter === 'has_review' && artifactReviews.length === 0) return false;
      if (reviewFilter === 'no_review' && artifactReviews.length > 0) return false;
      if (outcomeFilter !== 'all' && outcome !== outcomeFilter) return false;
      if (futureRetreatsOnly && !isRetreatFuture(resolveArtifactRetreat(artifact.retreatId))) return false;
      return true;
    });
  }, [artifacts, artifactTypeFilter, bookingIdFilter, clientIdFilter, documentTypeFilter, futureRetreatsOnly, outcomeFilter, resolveArtifactRetreat, retreatIdFilter, reviewFilter, reviewsByArtifactId, searchFilter, stageFilter, statusFilter]);

  useEffect(() => {
    setSelectedArtifactIds((prev) => {
      if (prev.size === 0) return prev;
      const visibleIds = new Set(filteredArtifacts.map((artifact) => artifact._id).filter(Boolean) as string[]);
      const next = new Set(Array.from(prev).filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filteredArtifacts]);

  const toggleSelectArtifact = (artifactId: string) => {
    setSelectedArtifactIds((prev) => {
      const next = new Set(prev);
      if (next.has(artifactId)) next.delete(artifactId); else next.add(artifactId);
      return next;
    });
  };

  const allVisibleSelected = filteredArtifacts.length > 0 && filteredArtifacts.every((artifact) => artifact._id && selectedArtifactIds.has(artifact._id));

  const toggleSelectAllVisible = () => {
    setSelectedArtifactIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filteredArtifacts.forEach((artifact) => { if (artifact._id) next.delete(artifact._id); });
      } else {
        filteredArtifacts.forEach((artifact) => { if (artifact._id) next.add(artifact._id); });
      }
      return next;
    });
  };

  const openBulkAssign = async () => {
    const selectedArtifacts = artifacts.filter((artifact) => artifact._id && selectedArtifactIds.has(artifact._id));
    if (!selectedArtifacts.length) return;
    const suggestedTypes = new Set(selectedArtifacts.map((artifact) => quickReviewTypeForArtifact(artifact.artifactType)));
    const fallbackType = suggestedTypes.size === 1 ? (Array.from(suggestedTypes)[0] as NonNullable<MedicalReviewRequest['requestType']>) : 'general_clearance';
    setBulkAssignForm({ requestType: fallbackType, advisorId: '', groupId: '', notifyClient: true });
    setBulkAssignError('');
    setBulkAssignOpen(true);
    try {
      const [users, groups, types] = await Promise.all([usersApi.getAll(), medicalReviewRequestsApi.getGroups(), medicalReviewRequestsApi.getRequestTypes()]);
      const advisors = (users.data || []).filter((item) => item.role === 'medical_advisor' && item.isActive !== false);
      const retreatIds = new Set(selectedArtifacts.map((artifact) => getObjectId(artifact.retreatId)).filter(Boolean));
      const matchingGroup = retreatIds.size === 1
        ? (groups.data || []).find((group: any) => getObjectId(group.retreatId) === Array.from(retreatIds)[0])
        : undefined;
      setBulkAssignAdvisors(advisors);
      setBulkAssignGroups(groups.data || []);
      setBulkAssignTypes(types.data || []);
      setBulkAssignForm((prev) => ({ ...prev, advisorId: advisors[0]?._id || '', groupId: matchingGroup?._id || groups.data?.[0]?._id || '' }));
    } catch (error: any) {
      setBulkAssignError(error?.response?.data?.message || 'Unable to load the assignment form.');
    }
  };

  const submitBulkAssign = async () => {
    const ids = Array.from(selectedArtifactIds);
    if (!ids.length || !bulkAssignForm.advisorId || !bulkAssignForm.groupId) return;
    setBulkAssignSaving(true);
    setBulkAssignError('');
    setBulkAssignProgress({ completed: 0, total: ids.length });
    const failures: string[] = [];
    for (const artifactId of ids) {
      const artifact = artifacts.find((item) => item._id === artifactId);
      try {
        await medicalReviewRequestsApi.createFromArtifact(artifactId, bulkAssignForm.requestType, {
          assignedToUserId: bulkAssignForm.advisorId,
          medicalReviewGroupId: bulkAssignForm.groupId,
          documentStage: artifact?.documentStage,
          sentForReviewAt: new Date().toISOString(),
          notifyClientOnSubmission: bulkAssignForm.notifyClient,
        });
      } catch (error: any) {
        failures.push(`#${artifact?.display_id || artifactId.slice(-6)}: ${error?.response?.data?.message || 'failed'}`);
      } finally {
        setBulkAssignProgress((prev) => (prev ? { ...prev, completed: prev.completed + 1 } : prev));
      }
    }
    setBulkAssignSaving(false);
    setBulkAssignProgress(null);
    if (failures.length) {
      setBulkAssignError(`Some artifacts could not be assigned: ${failures.join('; ')}`);
    } else {
      setBulkAssignOpen(false);
      setSelectedArtifactIds(new Set());
    }
    await loadData();
  };

  const outcomeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: artifacts.length, declined: 0, needs_info: 0, pending: 0 };
    artifacts.forEach((artifact) => {
      const latest = artifact._id ? (reviewsByArtifactId.get(artifact._id) || [])[0] : undefined;
      const outcome = getArtifactOutcome(artifact, latest);
      if (outcome === 'declined' || outcome === 'needs_info' || outcome === 'pending') counts[outcome] += 1;
    });
    return counts;
  }, [artifacts, reviewsByArtifactId]);

  const retreatOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string }>();
    retreats.forEach((retreat) => {
      if (futureRetreatsOnly && !isRetreatFuture(retreat)) return;
      const value = String(retreat._id || '').trim();
      if (!value) return;
      const label = getRetreatCode(retreat) || retreat.name || value;
      map.set(value, { value, label });
    });

    artifacts.forEach((artifact) => {
      const retreat = artifact.retreatId;
      if (!retreat) return;
      if (futureRetreatsOnly && !isRetreatFuture(resolveArtifactRetreat(retreat))) return;
      if (typeof retreat === 'string') {
        const value = retreat.trim();
        if (value && !map.has(value)) {
          map.set(value, { value, label: `Retreat ${value.slice(-6)}` });
        }
        return;
      }
      const value = String(retreat._id || '').trim();
      if (!value) return;
      const label = getRetreatCode(retreat) || retreat.name || value;
      map.set(value, { value, label });
    });

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [artifacts, futureRetreatsOnly, resolveArtifactRetreat, retreats]);

  const getArtifactSortValue = (artifact: MedicalArtifact, key: typeof artifactSortKey) => {
    switch (key) {
      case 'id':
        return Number(artifact.display_id) || 0;
      case 'client':
        return getClientName(artifact.clientId).toLowerCase();
      case 'stage':
        return getDocumentStageLabel(artifact.documentStage).toLowerCase();
      case 'documentType':
        return getDocumentTypeLabel(artifact.documentType, artifact.artifactType).toLowerCase();
      case 'source':
        return getSourceLabel(artifact.source).toLowerCase();
      case 'retreat':
        return (getRetreatCode(artifact.retreatId as any) || getRetreatLabel(artifact.retreatId)).toLowerCase();
      case 'received':
        return artifact.receivedAt ? new Date(artifact.receivedAt).getTime() : 0;
      case 'files':
        return artifact.files?.filter((file) => file.variant !== 'english_translation').length || 0;
      default:
        return '';
    }
  };

  const sortedArtifacts = useMemo(() => {
    return [...filteredArtifacts].sort((a, b) => {
      const aValue = getArtifactSortValue(a, artifactSortKey);
      const bValue = getArtifactSortValue(b, artifactSortKey);
      const direction = artifactSortDirection === 'asc' ? 1 : -1;
      if (typeof aValue === 'number' && typeof bValue === 'number') return (aValue - bValue) * direction;
      return String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: 'base' }) * direction;
    });
  }, [artifactSortDirection, artifactSortKey, filteredArtifacts]);

  const handleArtifactSort = (key: typeof artifactSortKey) => {
    if (artifactSortKey === key) {
      setArtifactSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
      return;
    }
    setArtifactSortKey(key);
    setArtifactSortDirection(key === 'received' || key === 'id' || key === 'files' ? 'desc' : 'asc');
  };

  const renderArtifactSortableHeader = (key: typeof artifactSortKey, label: string) => (
    <button
      type="button"
      onClick={() => handleArtifactSort(key)}
      className="inline-flex items-center gap-1 text-xs font-semibold uppercase text-gray-500 hover:text-gray-900"
    >
      {label}
      <ChevronDown className={`h-3 w-3 transition-transform ${artifactSortKey === key && artifactSortDirection === 'asc' ? 'rotate-180' : ''} ${artifactSortKey === key ? 'opacity-100' : 'opacity-35'}`} />
    </button>
  );

  const sortedSubmissionRows = useMemo(() => {
    const rows = [...filterRetreatSubmissionRowsByMrr(submissionData?.rows || [], submissionMrrFilter)];
    const compareText = (a = '', b = '') => a.localeCompare(b, undefined, { sensitivity: 'base' });
    return rows.sort((a, b) => {
      if (submissionSort === 'type') {
        return compareText(getArtifactTypeLabel(a.artifactType), getArtifactTypeLabel(b.artifactType)) || compareText(a.clientName, b.clientName);
      }
      if (submissionSort === 'stage') {
        return compareText(getDocumentStageLabel(a.documentStage), getDocumentStageLabel(b.documentStage)) || compareText(a.clientName, b.clientName);
      }
      if (submissionSort === 'status') {
        return compareText(a.status, b.status) || compareText(a.clientName, b.clientName);
      }
      return compareText(a.clientName, b.clientName) || compareText(getArtifactTypeLabel(a.artifactType), getArtifactTypeLabel(b.artifactType));
    });
  }, [submissionData, submissionMrrFilter, submissionSort]);

  const handleRequestReview = async (artifact: MedicalArtifact) => {
    if (!artifact._id) return;
    navigate(`/admin/medical-review-requests/new?artifactId=${artifact._id}`);
  };

  const openQuickMrr = async (artifact: MedicalArtifact) => {
    const fallbackType = quickReviewTypeForArtifact(artifact.artifactType);
    setQuickMrrForm({ requestType: fallbackType, advisorId: '', groupId: '', notifyClient: true });
    setQuickMrrArtifact(artifact);
    try {
      const [users, groups, types] = await Promise.all([usersApi.getAll(), medicalReviewRequestsApi.getGroups(), medicalReviewRequestsApi.getRequestTypes()]);
      const advisors = (users.data || []).filter((item) => item.role === 'medical_advisor' && item.isActive !== false);
      const matchingGroup = (groups.data || []).find((group: any) => getObjectId(group.retreatId) === getObjectId(artifact.retreatId)) || groups.data?.[0];
      setQuickMrrAdvisors(advisors);
      setQuickMrrGroups(groups.data || []);
      setQuickMrrTypes(types.data || []);
      setQuickMrrForm({ requestType: quickReviewTypeForArtifact(artifact.artifactType), advisorId: advisors[0]?._id || '', groupId: matchingGroup?._id || '', notifyClient: true });
    } catch (error: any) {
      showError(apiErrorMessage(error, 'Unable to load the Quick MRR form.'));
    }
  };

  const createQuickMrr = async () => {
    if (!quickMrrArtifact?._id || !quickMrrForm.advisorId || !quickMrrForm.groupId) return;
    setQuickMrrSaving(true);
    try {
      await medicalReviewRequestsApi.createFromArtifact(quickMrrArtifact._id, quickMrrForm.requestType, { assignedToUserId: quickMrrForm.advisorId, medicalReviewGroupId: quickMrrForm.groupId, documentStage: quickMrrArtifact.documentStage, sentForReviewAt: new Date().toISOString(), notifyClientOnSubmission: quickMrrForm.notifyClient });
      setQuickMrrArtifact(null);
      await loadData();
      showSuccess('Medical review request created.');
    } catch (error: any) {
      showError(apiErrorMessage(error, 'Unable to create the medical review request.'));
    } finally { setQuickMrrSaving(false); }
  };

  const handleDeleteArtifact = async (artifact: MedicalArtifact) => {
    if (!artifact._id) return;
    const label = `#${artifact.display_id || artifact._id.slice(-6)} ${artifact.title || getArtifactTypeLabel(artifact.artifactType)}`;
    const confirmed = window.confirm(`Delete medical artifact ${label}? This removes the artifact record from Provider Plus.`);
    if (!confirmed) return;

    setDeletingArtifactId(artifact._id);
    try {
      await medicalArtifactsApi.delete(artifact._id);
      setArtifacts((current) => current.filter((item) => item._id !== artifact._id));
      const reviewsResponse = await medicalReviewRequestsApi.getAll().catch(() => ({ data: reviewRequests }));
      setReviewRequests(reviewsResponse.data || []);
      showSuccess('Medical artifact deleted.');
    } catch (error: any) {
      showError(apiErrorMessage(error, 'Unable to delete this medical artifact.'));
    } finally {
      setDeletingArtifactId('');
    }
  };

  const handleUploadMissingSubmission = (row: RetreatArtifactSubmissionRow) => {
    const params = new URLSearchParams({
      clientId: row.clientId,
      bookingId: row.bookingId,
      retreatId: row.retreatId,
      artifactType: row.artifactType,
      documentStage: row.documentStage,
    });
    if (row.documentType) params.set('documentType', row.documentType);
    navigate(`new?${params.toString()}`);
  };

  if (loading) {
    return <LoadingSpinner message="Loading medical artifacts..." />;
  }

  return (
    <div className="min-h-full bg-slate-50 p-3 md:p-6">
      <Toast toast={toast} onDismiss={dismissToast} />
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"><span className="rounded bg-rose-100 px-2 py-1 text-rose-700">Admin</span><span>Medical records</span></div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">Medical Artifacts</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">Stored EKGs, liver panels, medication forms, questionnaires, and other medical records.</p>
        </div>
        <div className="flex flex-row-reverse items-center justify-end gap-2 md:flex-row">
          <button onClick={loadData} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button onClick={() => navigate('new')} className="inline-flex items-center gap-2 rounded-md bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add New Artifact</span><span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      <div className="mb-5 flex w-full border-b border-slate-200 bg-white px-2 pt-2 md:max-w-fit md:rounded-t-md md:border md:border-b-0">
        <button
          type="button"
          onClick={() => setActiveView('artifacts')}
          className={`border-b-2 px-3 py-3 text-sm font-semibold ${activeView === 'artifacts' ? 'border-cyan-700 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          Uploaded artifacts <span className="ml-1 text-slate-400">{artifacts.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveView('retreat_submissions')}
          className={`border-b-2 px-3 py-3 text-sm font-semibold ${activeView === 'retreat_submissions' ? 'border-cyan-700 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
        >
          Retreat submissions
        </button>
      </div>

      {activeView === 'artifacts' ? (
        <>
      <div className="mb-4 md:hidden">
        <input value={searchFilter} onChange={(event) => setSearchFilter(event.target.value)} placeholder="Client, booking, retreat or artifact #" className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base shadow-sm" />
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {(['all', 'declined', 'needs_info', 'pending'] as const).map((value) => (
            <button key={value} type="button" onClick={() => setOutcomeFilter(value)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${outcomeFilter === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-600'}`}>
              {value === 'all' ? 'All' : outcomeLabel[value]} <span className={outcomeFilter === value ? 'text-slate-300' : 'text-slate-400'}>{value === 'all' ? outcomeCounts.all : outcomeCounts[value]}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setMobileFiltersOpen((open) => !open)} className="mt-3 text-sm font-semibold uppercase tracking-wider text-cyan-700">☷ {mobileFiltersOpen ? 'Hide filters' : 'More filters'}</button>
        {mobileFiltersOpen && <div className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-white p-3">
          <select value={retreatIdFilter} onChange={(event) => setRetreatIdFilter(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="">All retreats</option>{retreatOptions.map((retreat) => <option key={retreat.value} value={retreat.value}>{retreat.label}</option>)}</select>
          <select value={documentTypeFilter} onChange={(event) => setDocumentTypeFilter(event.target.value as typeof documentTypeFilter)} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="all">All document types</option>{Object.entries(documentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as typeof stageFilter)} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="all">All stages</option>{Object.entries(documentStageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <label className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm"><input type="checkbox" checked={futureRetreatsOnly} onChange={(event) => setFutureRetreatsOnly(event.target.checked)} /> Future retreats only</label>
          <button type="button" onClick={() => { setSearchFilter(''); setRetreatIdFilter(''); setDocumentTypeFilter('all'); setStageFilter('all'); setOutcomeFilter('all'); setFutureRetreatsOnly(false); }} className="text-left text-sm font-semibold text-cyan-700">Clear filters</button>
        </div>}
      </div>
      <div className="mb-4 hidden rounded-md border border-gray-200 bg-white p-3 md:block">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={searchFilter}
            onChange={(event) => setSearchFilter(event.target.value)}
            placeholder="Search client, booking, retreat, artifact..."
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={bookingIdFilter}
            onChange={(event) => setBookingIdFilter(event.target.value)}
            placeholder="Booking ID"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={clientIdFilter}
            onChange={(event) => setClientIdFilter(event.target.value)}
            placeholder="Client ID"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={retreatIdFilter}
            onChange={(event) => setRetreatIdFilter(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All retreats</option>
            {retreatOptions.map((retreat) => (
              <option key={retreat.value} value={retreat.value}>
                {retreat.label}
              </option>
            ))}
          </select>
          <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as typeof stageFilter)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="all">All document stages</option>
            {Object.entries(documentStageLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select value={documentTypeFilter} onChange={(event) => setDocumentTypeFilter(event.target.value as typeof documentTypeFilter)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="all">All document types</option>
            {Object.entries(documentTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select value={artifactTypeFilter} onChange={(event) => setArtifactTypeFilter(event.target.value as typeof artifactTypeFilter)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="all">All artifact types</option>
            {Object.entries(artifactTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as typeof reviewFilter)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="all">All MRR states</option>
            <option value="has_review">Has MRR</option>
            <option value="no_review">No MRR</option>
          </select>
          <label className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700">
            <input type="checkbox" checked={futureRetreatsOnly} onChange={(event) => setFutureRetreatsOnly(event.target.checked)} />
            Future retreats only
          </label>
          <button
            type="button"
            onClick={() => {
              setSearchFilter('');
              setBookingIdFilter('');
              setClientIdFilter('');
              setRetreatIdFilter('');
              setStageFilter('all');
              setDocumentTypeFilter('all');
              setArtifactTypeFilter('all');
              setStatusFilter('all');
              setReviewFilter('all');
              setOutcomeFilter('all');
              setFutureRetreatsOnly(false);
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Clear filters
          </button>
          <div className="flex items-center text-sm text-gray-500">
            Showing {filteredArtifacts.length} of {artifacts.length}
          </div>
        </div>
      </div>

      {selectedArtifactIds.size > 0 && (
        <div className="mb-4 hidden items-center justify-between gap-3 rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 md:flex">
          <span className="text-sm font-semibold text-cyan-900">{selectedArtifactIds.size} artifact{selectedArtifactIds.size === 1 ? '' : 's'} selected</span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setSelectedArtifactIds(new Set())} className="text-sm font-medium text-cyan-800 hover:underline">Clear selection</button>
            <button type="button" onClick={openBulkAssign} className="inline-flex items-center gap-2 rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800">
              <UserCheck className="h-4 w-4" />
              Assign to reviewer
            </button>
          </div>
        </div>
      )}
      <div className="hidden max-w-full overflow-x-auto rounded-md border border-gray-200 md:block">
        <table className="min-w-[1280px] divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all visible artifacts"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </th>
              <th className="px-4 py-3">{renderArtifactSortableHeader('id', 'ID')}</th>
              <th className="min-w-[170px] px-4 py-3">MRR</th>
              <th className="sticky right-0 z-20 min-w-[184px] border-l border-gray-200 bg-gray-50 px-4 py-3">Actions</th>
              <th className="px-4 py-3">Preview</th>
              <th className="hidden px-4 py-3 sm:table-cell">{renderArtifactSortableHeader('stage', 'Stage')}</th>
              <th className="px-4 py-3">{renderArtifactSortableHeader('documentType', 'Document Type')}</th>
              <th className="px-4 py-3">{renderArtifactSortableHeader('source', 'Source')}</th>
              <th className="px-4 py-3">{renderArtifactSortableHeader('client', 'Client')}</th>
              <th className="px-4 py-3">{renderArtifactSortableHeader('retreat', 'Booking / Retreat')}</th>
              <th className="px-4 py-3">{renderArtifactSortableHeader('received', 'Received')}</th>
              <th className="px-4 py-3">{renderArtifactSortableHeader('files', 'Files')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {sortedArtifacts.map((artifact) => {
              const artifactReviews = artifact._id ? reviewsByArtifactId.get(artifact._id) || [] : [];
              const latestReview = artifactReviews[0];
              const compactDocumentType = getCompactDocumentType(artifact);
              const retreatCode = getRetreatCode(artifact.retreatId as any);
              return (
              <tr key={artifact._id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Select artifact #${artifact.display_id}`}
                    checked={artifact._id ? selectedArtifactIds.has(artifact._id) : false}
                    onChange={() => artifact._id && toggleSelectArtifact(artifact._id)}
                    disabled={!artifact._id}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {artifact._id ? (
                    <button
                      type="button"
                        onClick={() => navigate(`${artifact._id}`)}
                      className="bg-transparent p-0 font-semibold text-gray-900 hover:text-blue-700 hover:underline"
                    >
                      #{artifact.display_id}
                    </button>
                  ) : (
                    `#${artifact.display_id}`
                  )}
                </td>
                <td className="min-w-[170px] px-4 py-3">
                  <div className="flex flex-col gap-1">
                    {latestReview?._id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/medical-review-requests/${latestReview._id}`)}
                          className="w-fit text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                        >
                          {getReviewLabel(latestReview)}
                        </button>
                        <span className="text-[11px] text-gray-500">
                          {latestReview.requestType?.replace(/_/g, ' ') || 'medical review'} · {latestReview.status || 'pending'}
                        </span>
                        {artifactReviews.length > 1 && (
                          <button
                            type="button"
                            onClick={() => navigate(`${artifact._id}`)}
                            className="w-fit text-[11px] font-medium text-gray-500 hover:text-gray-800 hover:underline"
                            title="Open artifact to see full medical review history"
                          >
                            {artifactReviews.length} MRRs total
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2"><button
                        type="button"
                        onClick={() => handleRequestReview(artifact)}
                        className="w-fit text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                      >
                        Create MRR
                      </button><button type="button" title="Quick MRR" aria-label={`Quick MRR for artifact #${artifact.display_id}`} onClick={() => openQuickMrr(artifact)} disabled={!artifact._id} className="inline-flex h-6 w-6 items-center justify-center rounded border border-amber-300 bg-amber-50 text-amber-800"><Zap className="h-3.5 w-3.5" /></button></div>
                    )}
                    <ReviewResultBadge review={latestReview} />
                  </div>
                </td>
                <td className="sticky right-0 z-10 min-w-[184px] border-l border-gray-200 bg-white px-4 py-3 shadow-[-6px_0_10px_-10px_rgba(15,23,42,0.6)]">
                  <div className="flex justify-start gap-2">
                    <button
                      type="button"
                      title="View artifact"
                      onClick={() => navigate(`${artifact._id}`)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Edit artifact"
                      aria-label={`Edit medical artifact #${artifact.display_id}`}
                      onClick={() => navigate(`${artifact._id}/edit`)}
                      disabled={!artifact._id}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {latestReview?._id ? (
                      <button
                        type="button"
                        title={`Open ${getReviewLabel(latestReview)}`}
                        onClick={() => navigate(`/admin/medical-review-requests/${latestReview._id}`)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        title="Send for medical review"
                        onClick={() => handleRequestReview(artifact)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Delete artifact"
                      onClick={() => handleDeleteArtifact(artifact)}
                      disabled={!artifact._id || deletingArtifactId === artifact._id}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {artifact.files?.find((file) => file.thumbnailUrl)?.thumbnailUrl ? (
                    <img
                      src={artifact.files.find((file) => file.thumbnailUrl)?.thumbnailUrl}
                      alt={artifact.title}
                      className="h-[60px] w-[80px] rounded border border-gray-200 object-contain"
                    />
                  ) : (
                    <div className="flex h-[60px] w-[80px] items-center justify-center rounded border border-dashed border-gray-200 text-xs text-gray-400">No thumb</div>
                  )}
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    {getDocumentStageLabel(artifact.documentStage)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 sm:hidden">
                      {getDocumentStageLabel(artifact.documentStage)}
                    </span>
                    <span className={`inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold ${compactDocumentType.className}`}>
                      <compactDocumentType.Icon aria-hidden="true" className="h-6 w-6 shrink-0" />
                      {compactDocumentType.label}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${artifact.source === 'client_upload' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>
                    {getSourceLabel(artifact.source)}
                  </span>
                </td>
                <td className="px-4 py-3">{getClientLabel(artifact.clientId)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1 text-xs text-gray-600">
                    <span>{getBookingLabel(artifact.bookingId) || '-'}</span>
                    {retreatCode ? <span className="font-semibold text-gray-800">{retreatCode}</span> : getRetreatLabel(artifact.retreatId) ? <span>{getRetreatLabel(artifact.retreatId)}</span> : null}
                    {artifact.ceremonyNumber ? <span>Ceremony #{artifact.ceremonyNumber}</span> : null}
                  </div>
                </td>
                <td className="px-4 py-3">{artifact.receivedAt ? new Date(artifact.receivedAt).toLocaleDateString() : '-'}</td>
                <td className="px-4 py-3">
                  {(() => {
                    const originalFileCount = artifact.files?.filter((file) => file.variant !== 'english_translation').length || 0;
                    return originalFileCount ? originalFileCount : <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800"><AlertTriangle className="h-3.5 w-3.5" />No file uploaded</span>;
                  })()}
                </td>
              </tr>
              );
            })}
            {filteredArtifacts.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-gray-500">No medical artifacts yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        <div className="border-t-4 border-slate-900 bg-white px-3 py-3 text-sm text-slate-500">{filteredArtifacts.length} of {artifacts.length} artifacts</div>
        {sortedArtifacts.map((artifact) => {
          const artifactReviews = artifact._id ? reviewsByArtifactId.get(artifact._id) || [] : [];
          const latestReview = artifactReviews[0];
          const outcome = getArtifactOutcome(artifact, latestReview);
          const tone = outcome === 'declined' ? 'border-rose-600 bg-rose-50 text-rose-800' : outcome === 'needs_info' ? 'border-cyan-700 bg-cyan-50 text-cyan-800' : outcome === 'pending' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-emerald-600 bg-emerald-50 text-emerald-800';
          const compactDocumentType = getCompactDocumentType(artifact);
          return <article key={artifact._id} className={`overflow-hidden rounded-md border-l-4 bg-white shadow-sm ${tone.split(' ')[0]}`}>
            <div className={`flex items-center justify-between px-3 py-2 ${tone.split(' ').slice(1).join(' ')}`}><span className="font-bold">#{artifact.display_id} <span className="ml-1 text-sm uppercase">{outcomeLabel[outcome] || 'Stored'}</span></span><span className="rounded border border-current px-2 py-1 text-xs font-bold uppercase">{getDocumentStageLabel(artifact.documentStage)}</span></div>
            <div className="p-3">
              <div className="flex gap-3"><div className="flex h-16 w-14 shrink-0 items-center justify-center rounded border border-slate-200 text-xs font-bold text-slate-400">PDF</div><div className="min-w-0"><button type="button" onClick={() => navigate(`${artifact._id}`)} className="text-left text-lg font-bold text-cyan-700">{getClientName(artifact.clientId)}</button><div className="text-sm text-slate-500">Client #{typeof artifact.clientId === 'object' ? artifact.clientId.display_id || String(getObjectId(artifact.clientId) || '').slice(-6) : String(getObjectId(artifact.clientId) || '').slice(-6)}</div><div className="text-sm text-slate-500">{getBookingLabel(artifact.bookingId) || 'No booking linked'}</div></div></div>
              <div className="mt-3 border-t border-slate-100 pt-3"><div className="flex items-center gap-2 text-base font-semibold text-slate-800"><compactDocumentType.Icon aria-hidden="true" className="h-6 w-6 shrink-0" />{getDocumentTypeLabel(artifact.documentType, artifact.artifactType)}</div><div className="text-sm text-slate-500">{artifact.title || 'Medical artifact'} · {artifact.files?.length || 0} file(s)</div>{latestReview ? <div className="mt-2 text-sm text-slate-600">{latestReview.requestType?.replace(/_/g, ' ')} · {latestReview.status || 'pending'}</div> : <div className="mt-2 flex items-center gap-2"><button type="button" onClick={() => handleRequestReview(artifact)} className="text-sm font-semibold text-cyan-700">Create MRR</button><button type="button" title="Quick MRR" aria-label={`Quick MRR for artifact #${artifact.display_id}`} onClick={() => openQuickMrr(artifact)} disabled={!artifact._id} className="inline-flex h-6 w-6 items-center justify-center rounded border border-amber-300 bg-amber-50 text-amber-800"><Zap className="h-3.5 w-3.5" /></button></div>}{latestReview?._id && <button type="button" onClick={() => navigate(`/admin/medical-review-requests/${latestReview._id}`)} className="mt-1 text-sm font-semibold text-cyan-700">Open {getReviewLabel(latestReview)}</button>}</div>
              <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => navigate(`${artifact._id}`)} className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold">View</button><button type="button" onClick={() => navigate(`${artifact._id}/edit`)} className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold">Edit</button></div>
            </div>
          </article>;
        })}
      </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border border-gray-200 bg-white p-3">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
              <input
                value={submissionRetreatFilter}
                onChange={(event) => setSubmissionRetreatFilter(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') loadRetreatSubmissions();
                }}
                placeholder="Retreat code or ID"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm xl:col-span-2"
              />
              <select value={submissionArtifactTypeFilter} onChange={(event) => setSubmissionArtifactTypeFilter(event.target.value as typeof submissionArtifactTypeFilter)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="all">All artifact types</option>
                {Object.entries(artifactTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select value={submissionStageFilter} onChange={(event) => setSubmissionStageFilter(event.target.value as typeof submissionStageFilter)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="all">All stages</option>
                {Object.entries(documentStageLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select value={submissionStatusFilter} onChange={(event) => setSubmissionStatusFilter(event.target.value as typeof submissionStatusFilter)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="missing">Missing only</option>
                <option value="received">Received only</option>
                <option value="all">All submissions</option>
              </select>
              <select value={submissionMrrFilter} onChange={(event) => setSubmissionMrrFilter(event.target.value as RetreatSubmissionMrrFilter)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="all">All MRR statuses</option>
                <option value="without_mrr">Received without MRR</option>
                <option value="with_mrr">With MRR</option>
              </select>
              <button
                type="button"
                onClick={loadRetreatSubmissions}
                disabled={submissionsLoading}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${submissionsLoading ? 'animate-spin' : ''}`} />
                Load
              </button>
              <input
                value={submissionSearchFilter}
                onChange={(event) => setSubmissionSearchFilter(event.target.value)}
                placeholder="Search client, booking, artifact..."
                className="rounded-md border border-gray-300 px-3 py-2 text-sm xl:col-span-2"
              />
              <select value={submissionSort} onChange={(event) => setSubmissionSort(event.target.value as typeof submissionSort)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="client">Sort by client</option>
                <option value="type">Sort by type</option>
                <option value="stage">Sort by stage</option>
                <option value="status">Sort by status</option>
              </select>
              <div className="flex items-center text-sm text-gray-500 xl:col-span-3">
                {submissionData?.retreat ? (
                  <span>
                    {submissionData.retreat.code || submissionData.retreat.name}: {submissionData.totals.bookings} bookings, {submissionData.totals.missing} missing ({submissionData.totals.missingFiles || 0} no file), {submissionData.totals.received} received
                  </span>
                ) : (
                  <span>Enter a retreat code to see missing and received submissions.</span>
                )}
              </div>
            </div>
            {submissionsError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submissionsError}</div>
            )}
          </div>

          <div className="overflow-hidden rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Booking / Retreat</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Document Type</th>
                  <th className="px-4 py-3">Submission</th>
                  <th className="px-4 py-3">Medical Review</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {sortedSubmissionRows.map((row) => {
                  const compactDocumentType = getCompactDocumentType({
                    artifactType: row.artifactType,
                    documentType: row.documentType || 'other',
                    documentStage: row.documentStage,
                    clientId: row.clientId,
                    title: row.label,
                  } as MedicalArtifact);
                  const clientNameClass = getClientNameBackgroundClass(row.clientId);
                  return (
                    <tr key={row.id} className={row.status === 'missing' ? 'bg-red-50/40 hover:bg-red-50' : row.status === 'missing_file' ? 'bg-orange-50/50 hover:bg-orange-50' : 'bg-green-50/40 hover:bg-green-50'}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ClientAvatar
                            client={{ _id: row.clientId, profilePictureUrl: row.clientProfilePictureUrl, profilePictureS3Key: row.clientProfilePictureS3Key, profilePictureFileUploadId: row.clientProfilePictureFileUploadId }}
                            name={row.clientName}
                          />
                          <div className="min-w-0">
                            <div className={`inline-flex max-w-full items-center rounded px-2 py-1 text-sm font-medium ring-1 ring-inset ${clientNameClass}`}>
                              <span className="truncate">{row.clientName}</span>
                            </div>
                            {/* PPVC-713: never show a raw ID hash as a stand-in for the client number. */}
                            <div className="text-xs text-gray-500">
                              {row.clientDisplayId ? `Client #${row.clientDisplayId}` : ''}{row.clientEmail ? ` · ${row.clientEmail}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-blue-700">Booking #{row.bookingNumber || row.bookingId.slice(-6)}</div>
                        <div className="text-xs font-semibold text-gray-700">{row.retreatCode || row.retreatName || row.retreatId.slice(-6)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          {getDocumentStageLabel(row.documentStage)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold ${compactDocumentType.className}`}>
                          <compactDocumentType.Icon aria-hidden="true" className="h-6 w-6 shrink-0" />
                          {compactDocumentType.label}
                        </span>
                        <div className="mt-1 text-xs text-gray-500">{row.label}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <SubmissionStatusBadge row={row} />
                          {row.artifactId ? (
                            <button
                              type="button"
                              onClick={() => navigate(`${row.artifactId}`)}
                              className="w-fit text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                            >
                              Artifact #{row.artifactDisplayId || row.artifactId.slice(-6)}
                            </button>
                          ) : null}
                          {row.receivedAt ? <span className="text-xs text-gray-500">{new Date(row.receivedAt).toLocaleDateString()} · {row.fileCount || 0} file(s)</span> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {row.reviewRequestId ? (
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => navigate(`/admin/medical-review-requests/${row.reviewRequestId}`)}
                              className="w-fit text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                            >
                              MRR #{row.reviewRequestDisplayId || row.reviewRequestId.slice(-6)}
                            </button>
                            <span className="text-xs text-gray-500">{row.reviewDecision || row.reviewStatus || 'pending'}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No MRR</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {row.artifactId ? (
                            <button
                              type="button"
                              title="View artifact"
                              onClick={() => navigate(`${row.artifactId}`)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              title="Upload missing document"
                              onClick={() => handleUploadMissingSubmission(row)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {row.artifactId && !row.reviewRequestId ? (
                            <button
                              type="button"
                              title="Create MRR"
                              onClick={() => navigate(`/admin/medical-review-requests/new?artifactId=${row.artifactId}`)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50"
                            >
                              <Send className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!submissionsLoading && sortedSubmissionRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      {submissionData ? 'No submissions match these filters.' : 'Load a retreat to see artifact submissions.'}
                    </td>
                  </tr>
                )}
                {submissionsLoading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading retreat submissions...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {quickMrrArtifact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Create quick medical review request">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-slate-900">Quick MRR</h2><p className="mt-1 text-sm text-slate-500">Artifact #{quickMrrArtifact.display_id} · {getDocumentTypeLabel(quickMrrArtifact.documentType, quickMrrArtifact.artifactType)}</p></div><button type="button" onClick={() => setQuickMrrArtifact(null)} className="text-2xl leading-none text-slate-400 hover:text-slate-700" aria-label="Close">×</button></div>
            <div className="mt-5 grid gap-4">
              <label className="text-sm font-medium text-slate-700">Review type<select className="mt-1 w-full rounded-md border border-slate-300 p-2" value={quickMrrForm.requestType} onChange={(event) => setQuickMrrForm({ ...quickMrrForm, requestType: event.target.value as NonNullable<MedicalReviewRequest['requestType']> })}>{(quickMrrTypes.length ? quickMrrTypes : [{ key: 'general_clearance', label: 'General clearance' }]).map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}</select></label>
              <label className="text-sm font-medium text-slate-700">Medical advisor<select className="mt-1 w-full rounded-md border border-slate-300 p-2" value={quickMrrForm.advisorId} onChange={(event) => setQuickMrrForm({ ...quickMrrForm, advisorId: event.target.value })}><option value="">Select advisor</option>{quickMrrAdvisors.map((advisor) => <option key={advisor._id} value={advisor._id}>{[advisor.firstName, advisor.lastName].filter(Boolean).join(' ') || advisor.email}</option>)}</select></label>
              <label className="text-sm font-medium text-slate-700">Review pocket<select className="mt-1 w-full rounded-md border border-slate-300 p-2" value={quickMrrForm.groupId} onChange={(event) => setQuickMrrForm({ ...quickMrrForm, groupId: event.target.value })}><option value="">Select pocket</option>{quickMrrGroups.map((group) => <option key={group._id} value={group._id}>{group.title}</option>)}</select></label>
              <label className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-slate-700"><input type="checkbox" checked={quickMrrForm.notifyClient} onChange={(event) => setQuickMrrForm({ ...quickMrrForm, notifyClient: event.target.checked })} /> Notify client that the record was submitted for review</label>
            </div>
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setQuickMrrArtifact(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Cancel</button><button type="button" onClick={createQuickMrr} disabled={quickMrrSaving || !quickMrrForm.advisorId || !quickMrrForm.groupId} className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{quickMrrSaving ? 'Creating…' : 'Create MRR'}</button></div>
          </div>
        </div>
      )}
      {bulkAssignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Assign artifacts to reviewer">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Assign to reviewer</h2>
                <p className="mt-1 text-sm text-slate-500">{selectedArtifactIds.size} artifact{selectedArtifactIds.size === 1 ? '' : 's'} selected</p>
              </div>
              <button type="button" onClick={() => !bulkAssignSaving && setBulkAssignOpen(false)} className="text-2xl leading-none text-slate-400 hover:text-slate-700" aria-label="Close">×</button>
            </div>
            <div className="mt-3 flex max-h-24 flex-wrap gap-1 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2">
              {Array.from(selectedArtifactIds).map((artifactId) => {
                const artifact = artifacts.find((item) => item._id === artifactId);
                return (
                  <span key={artifactId} className="inline-block rounded bg-white px-2 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
                    #{artifact?.display_id || artifactId.slice(-6)}
                  </span>
                );
              })}
            </div>
            <div className="mt-5 grid gap-4">
              <label className="text-sm font-medium text-slate-700">Review type<select className="mt-1 w-full rounded-md border border-slate-300 p-2" value={bulkAssignForm.requestType} onChange={(event) => setBulkAssignForm({ ...bulkAssignForm, requestType: event.target.value as NonNullable<MedicalReviewRequest['requestType']> })}>{(bulkAssignTypes.length ? bulkAssignTypes : [{ key: 'general_clearance', label: 'General clearance' }]).map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}</select></label>
              <label className="text-sm font-medium text-slate-700">Medical advisor<select className="mt-1 w-full rounded-md border border-slate-300 p-2" value={bulkAssignForm.advisorId} onChange={(event) => setBulkAssignForm({ ...bulkAssignForm, advisorId: event.target.value })}><option value="">Select advisor</option>{bulkAssignAdvisors.map((advisor) => <option key={advisor._id} value={advisor._id}>{[advisor.firstName, advisor.lastName].filter(Boolean).join(' ') || advisor.email}</option>)}</select></label>
              <label className="text-sm font-medium text-slate-700">Review pocket<select className="mt-1 w-full rounded-md border border-slate-300 p-2" value={bulkAssignForm.groupId} onChange={(event) => setBulkAssignForm({ ...bulkAssignForm, groupId: event.target.value })}><option value="">Select pocket</option>{bulkAssignGroups.map((group) => <option key={group._id} value={group._id}>{group.title}</option>)}</select></label>
              <label className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-slate-700"><input type="checkbox" checked={bulkAssignForm.notifyClient} onChange={(event) => setBulkAssignForm({ ...bulkAssignForm, notifyClient: event.target.checked })} /> Notify clients that their records were submitted for review</label>
            </div>
            {bulkAssignError && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{bulkAssignError}</div>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setBulkAssignOpen(false)} disabled={bulkAssignSaving} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={submitBulkAssign} disabled={bulkAssignSaving || !bulkAssignForm.advisorId || !bulkAssignForm.groupId} className="rounded-md bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {bulkAssignSaving ? `Assigning ${bulkAssignProgress?.completed ?? 0}/${bulkAssignProgress?.total ?? selectedArtifactIds.size}…` : `Assign ${selectedArtifactIds.size} artifact${selectedArtifactIds.size === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalArtifactsPage;
