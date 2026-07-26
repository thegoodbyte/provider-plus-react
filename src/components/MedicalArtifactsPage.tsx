import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Eye, FileText, HeartPulse, Leaf, Pencil, Plus, RefreshCw, Send, Trash2, XCircle } from 'lucide-react';
import { medicalArtifactsApi, medicalReviewRequestsApi, retreatsApi } from '../services/api';
import { Client, MedicalArtifact, MedicalReviewRequest, Retreat, RetreatArtifactSubmissionRow, RetreatArtifactSubmissionsResponse, RetreatClient } from '../types';
import LoadingSpinner from './LoadingSpinner';

const artifactTypeLabels: Record<NonNullable<MedicalArtifact['artifactType']>, string> = {
  ekg: 'EKG',
  ceremony_ekg: 'Ceremony EKG',
  blood_pressure: 'Blood Pressure',
  liver_panel: 'Liver Panel',
  medications_form: 'Medications Form',
  medication_list: 'Medication List',
  questionnaire: 'Questionnaire',
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

const getCompactDocumentType = (artifact: MedicalArtifact) => {
  const artifactType = artifact.artifactType;
  const documentType = artifact.documentType;
  if (artifactType === 'ekg' || artifactType === 'ceremony_ekg' || documentType === 'EKG') {
    return { label: 'EKG', Icon: HeartPulse, className: 'bg-red-50 text-red-700' };
  }
  if (artifactType === 'liver_panel' || documentType === 'Liver') {
    return { label: 'LVR', Icon: Leaf, className: 'bg-emerald-50 text-emerald-700' };
  }
  return { label: getDocumentTypeLabel(documentType, artifactType), Icon: FileText, className: 'bg-gray-100 text-gray-700' };
};

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
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
      <XCircle className="h-3.5 w-3.5" />
      Missing
    </span>
  );
};

const MedicalArtifactsPage: React.FC = () => {
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
  const [activeView, setActiveView] = useState<'artifacts' | 'retreat_submissions'>('artifacts');
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [submissionRetreatFilter, setSubmissionRetreatFilter] = useState('');
  const [submissionArtifactTypeFilter, setSubmissionArtifactTypeFilter] = useState<'all' | NonNullable<MedicalArtifact['artifactType']>>('all');
  const [submissionStageFilter, setSubmissionStageFilter] = useState<'all' | NonNullable<MedicalArtifact['documentStage']>>('all');
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<'all' | 'missing' | 'received'>('all');
  const [submissionSearchFilter, setSubmissionSearchFilter] = useState('');
  const [submissionSort, setSubmissionSort] = useState<'client' | 'type' | 'stage' | 'status'>('client');
  const [submissionData, setSubmissionData] = useState<RetreatArtifactSubmissionsResponse | null>(null);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState('');
  const [deletingArtifactId, setDeletingArtifactId] = useState('');

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
      return true;
    });
  }, [artifacts, artifactTypeFilter, bookingIdFilter, clientIdFilter, documentTypeFilter, retreatIdFilter, reviewFilter, reviewsByArtifactId, searchFilter, stageFilter, statusFilter]);

  const retreatOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string }>();
    retreats.forEach((retreat) => {
      const value = String(retreat._id || '').trim();
      if (!value) return;
      const label = getRetreatCode(retreat) || retreat.name || value;
      map.set(value, { value, label });
    });

    artifacts.forEach((artifact) => {
      const retreat = artifact.retreatId;
      if (!retreat) return;
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
  }, [artifacts, retreats]);

  const sortedSubmissionRows = useMemo(() => {
    const rows = [...(submissionData?.rows || [])];
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
  }, [submissionData, submissionSort]);

  const handleRequestReview = async (artifact: MedicalArtifact) => {
    if (!artifact._id) return;
    navigate(`/admin/medical-review-requests/new?artifactId=${artifact._id}`);
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
    } catch (error: any) {
      alert(error?.response?.data?.message || error?.message || 'Unable to delete this medical artifact.');
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
    <div className="p-3 md:p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Medical Artifacts</h1>
          <p className="text-sm text-gray-600">Stored EKGs, liver panels, medication forms, questions, and other medical records.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('new')} className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black">
            <Plus className="h-4 w-4" />
            Add New
          </button>
          <button onClick={loadData} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-4 inline-flex rounded-md border border-gray-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setActiveView('artifacts')}
          className={`rounded px-3 py-2 text-sm font-medium ${activeView === 'artifacts' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
        >
          Uploaded Artifacts
        </button>
        <button
          type="button"
          onClick={() => setActiveView('retreat_submissions')}
          className={`rounded px-3 py-2 text-sm font-medium ${activeView === 'retreat_submissions' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
        >
          Retreat Submissions
        </button>
      </div>

      {activeView === 'artifacts' ? (
        <>
      <div className="mb-4 rounded-md border border-gray-200 bg-white p-3">
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

      <div className="max-w-full overflow-x-auto rounded-md border border-gray-200">
        <table className="min-w-[1280px] divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="min-w-[170px] px-4 py-3">MRR</th>
              <th className="sticky right-0 z-20 min-w-[184px] border-l border-gray-200 bg-gray-50 px-4 py-3">Actions</th>
              <th className="px-4 py-3">Preview</th>
              <th className="hidden px-4 py-3 sm:table-cell">Stage</th>
              <th className="px-4 py-3">Document Type</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Booking / Retreat</th>
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3">Files</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filteredArtifacts.map((artifact) => {
              const artifactReviews = artifact._id ? reviewsByArtifactId.get(artifact._id) || [] : [];
              const latestReview = artifactReviews[0];
              const compactDocumentType = getCompactDocumentType(artifact);
              const retreatCode = getRetreatCode(artifact.retreatId as any);
              return (
              <tr key={artifact._id} className="hover:bg-gray-50">
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
                      <button
                        type="button"
                        onClick={() => handleRequestReview(artifact)}
                        className="w-fit text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                      >
                        Create MRR
                      </button>
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
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${compactDocumentType.className}`}>
                      <compactDocumentType.Icon className="h-3.5 w-3.5" />
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
                <td className="px-4 py-3">{artifact.files?.length || 0}</td>
              </tr>
              );
            })}
            {filteredArtifacts.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-gray-500">No medical artifacts yet.</td>
              </tr>
            )}
          </tbody>
        </table>
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
                    {submissionData.retreat.code || submissionData.retreat.name}: {submissionData.totals.bookings} bookings, {submissionData.totals.missing} missing, {submissionData.totals.received} received
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
                    <tr key={row.id} className={row.status === 'missing' ? 'bg-red-50/40 hover:bg-red-50' : 'bg-green-50/40 hover:bg-green-50'}>
                      <td className="px-4 py-3">
                        <div className={`inline-flex max-w-full items-center rounded px-2 py-1 text-sm font-medium ring-1 ring-inset ${clientNameClass}`}>
                          <span className="truncate">{row.clientName}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {row.clientDisplayId ? `Client #${row.clientDisplayId}` : row.clientId.slice(-6)}{row.clientEmail ? ` · ${row.clientEmail}` : ''}
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
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${compactDocumentType.className}`}>
                          <compactDocumentType.Icon className="h-3.5 w-3.5" />
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
    </div>
  );
};

export default MedicalArtifactsPage;
