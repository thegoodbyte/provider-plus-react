import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Eye, FileText, HeartPulse, Leaf, Plus, RefreshCw, Send, XCircle } from 'lucide-react';
import { medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';
import { Client, MedicalArtifact, MedicalReviewRequest, Retreat, RetreatClient } from '../types';
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

const getObjectId = (value: any) => typeof value === 'object' ? value?._id || value?.id : value;

const getClientName = (client?: string | Client) => {
  if (!client || typeof client === 'string') return 'Unknown client';
  return [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ') || client.email || 'Unknown client';
};

const getRetreatLabel = (retreat?: string | Retreat) => {
  if (!retreat || typeof retreat === 'string') return retreat ? `Retreat ${String(retreat).slice(-6)}` : '';
  return retreat.name || retreat.retreatCode || retreat.code || getObjectId(retreat);
};

const getBookingLabel = (booking?: string | RetreatClient) => {
  if (!booking || typeof booking === 'string') return booking ? `Booking ${String(booking).slice(-6)}` : '';
  return booking.bookingNumber ? `Booking #${booking.bookingNumber}` : `Booking ${getObjectId(booking).slice(-6)}`;
};

const getRetreatCode = (retreat?: string | Retreat) => {
  if (!retreat || typeof retreat === 'string') return '';
  return retreat.retreatCode || retreat.code || retreat.name || '';
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
  getClientName(artifact.clientId),
  typeof artifact.clientId === 'object' ? artifact.clientId.email : '',
  typeof artifact.clientId === 'object' ? artifact.clientId.display_id : '',
  getObjectId(artifact.clientId),
  getBookingLabel(artifact.bookingId),
  getObjectId(artifact.bookingId),
  getRetreatLabel(artifact.retreatId),
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [artifactsResponse, reviewsResponse] = await Promise.all([
        medicalArtifactsApi.getAll(),
        medicalReviewRequestsApi.getAll(),
      ]);
      setArtifacts(artifactsResponse.data || []);
      setReviewRequests(reviewsResponse.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
      const artifactRetreatId = String(getObjectId(artifact.retreatId) || '').toLowerCase();
      const artifactReviews = artifact._id ? reviewsByArtifactId.get(artifact._id) || [] : [];

      if (search && !getSearchText(artifact).includes(search)) return false;
      if (bookingId && !artifactBookingId.includes(bookingId)) return false;
      if (clientId && !artifactClientId.includes(clientId)) return false;
      if (retreatId && !artifactRetreatId.includes(retreatId)) return false;
      if (stageFilter !== 'all' && (artifact.documentStage || 'entry') !== stageFilter) return false;
      if (documentTypeFilter !== 'all' && (artifact.documentType || 'other') !== documentTypeFilter) return false;
      if (artifactTypeFilter !== 'all' && artifact.artifactType !== artifactTypeFilter) return false;
      if (statusFilter !== 'all' && (artifact.status || 'stored') !== statusFilter) return false;
      if (reviewFilter === 'has_review' && artifactReviews.length === 0) return false;
      if (reviewFilter === 'no_review' && artifactReviews.length > 0) return false;
      return true;
    });
  }, [artifacts, artifactTypeFilter, bookingIdFilter, clientIdFilter, documentTypeFilter, retreatIdFilter, reviewFilter, reviewsByArtifactId, searchFilter, stageFilter, statusFilter]);

  const handleRequestReview = async (artifact: MedicalArtifact) => {
    if (!artifact._id) return;
    navigate(`/admin/medical-review-requests/new?artifactId=${artifact._id}`);
  };

  if (loading) {
    return <LoadingSpinner message="Loading medical artifacts..." />;
  }

  return (
    <div className="p-6">
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
          <input
            value={retreatIdFilter}
            onChange={(event) => setRetreatIdFilter(event.target.value)}
            placeholder="Retreat ID"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
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

      <div className="overflow-hidden rounded-md border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Actions</th>
              <th className="px-4 py-3">Preview</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Document Type</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Booking / Retreat</th>
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3">Files</th>
              <th className="px-4 py-3">Medical Review</th>
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
                <td className="px-4 py-3">
                  <div className="flex justify-start gap-2">
                    <button
                      type="button"
                      title="View artifact"
                      onClick={() => navigate(`${artifact._id}`)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    >
                      <Eye className="h-3.5 w-3.5" />
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
                <td className="px-4 py-3">
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    {getDocumentStageLabel(artifact.documentStage)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${compactDocumentType.className}`}>
                    <compactDocumentType.Icon className="h-3.5 w-3.5" />
                    {compactDocumentType.label}
                  </span>
                </td>
                <td className="px-4 py-3">{getClientName(artifact.clientId)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1 text-xs text-gray-600">
                    <span>{getBookingLabel(artifact.bookingId) || '-'}</span>
                    {retreatCode ? <span className="font-semibold text-gray-800">{retreatCode}</span> : getRetreatLabel(artifact.retreatId) ? <span>{getRetreatLabel(artifact.retreatId)}</span> : null}
                    {artifact.ceremonyNumber ? <span>Ceremony #{artifact.ceremonyNumber}</span> : null}
                  </div>
                </td>
                <td className="px-4 py-3">{artifact.receivedAt ? new Date(artifact.receivedAt).toLocaleDateString() : '-'}</td>
                <td className="px-4 py-3">{artifact.files?.length || 0}</td>
                <td className="px-4 py-3">
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
              </tr>
              );
            })}
            {filteredArtifacts.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">No medical artifacts yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MedicalArtifactsPage;
