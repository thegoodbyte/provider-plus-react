import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';
import { API_BASE_URL } from '../config/api.config';
import { Client, MedicalArtifact, MedicalReviewRequest } from '../types';

const reviewStatusStyle: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  caution: 'bg-amber-100 text-amber-800',
  needs_resubmission: 'bg-orange-100 text-orange-800',
  completed: 'bg-gray-100 text-gray-800',
};

const decisionOptions = ['OK', 'caution', 'NOT OK'] as const;
const decisionLabels: Record<typeof decisionOptions[number], string> = {
  OK: 'OK',
  caution: 'Need more info',
  'NOT OK': 'No good',
};

const requestTypeLabels: Record<string, string> = {
  ekg: 'EKG',
  liver: 'Liver Panel',
  both: 'EKG + Liver Panel',
  ekg_review: 'Entry EKG Review',
  ceremony_ekg_review: 'Ceremony EKG Review',
  blood_pressure_review: 'Blood Pressure Review',
  liver_panel_review: 'Liver Panel Review',
  medications_review: 'Medications Review',
  questionnaire_review: 'Questionnaire Review',
  food_review: 'Food Intake Review',
  medical_question: 'Medical Question',
  general_clearance: 'General Clearance',
};

const getRequestTypeLabel = (requestType?: MedicalReviewRequest['requestType']) =>
  requestType ? requestTypeLabels[requestType] || requestType : 'Medical Review';

const artifactTypeLabels: Record<string, string> = {
  ekg: 'Entry EKG',
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
  artifactType ? artifactTypeLabels[artifactType] || artifactType : 'Medical Artifact';

const documentStageLabels: Record<NonNullable<MedicalArtifact['documentStage']>, string> = {
  entry: 'Entry',
  pre_ceremony: 'Pre-Ceremony',
  in_ceremony: 'In-Ceremony',
  post_ceremony: 'Post-Ceremony',
  additional: 'Additional',
};

const documentTypeLabels: Record<NonNullable<MedicalArtifact['documentType']>, string> = {
  BP: 'Blood Pressure',
  EKG: 'EKG',
  Liver: 'Liver panel tests',
  Medications: 'Medications',
  other: 'Other',
};

const getId = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value._id;
};

type ArtifactFile = NonNullable<MedicalArtifact['files']>[number];
type FileReviewDraft = {
  artifactId?: string;
  fileKey?: string;
  fileName?: string;
  decision?: 'OK' | 'caution' | 'NOT OK' | '';
  notes?: string;
};
type ReviewContext = {
  client?: any;
  bookings?: any[];
  screenings?: any[];
  medicalRecords?: any[];
  medications?: any[];
  artifacts?: {
    all?: MedicalArtifact[];
    entryEkg?: MedicalArtifact[];
    entryLiver?: MedicalArtifact[];
    medications?: MedicalArtifact[];
    questionnaire?: MedicalArtifact[];
    other?: MedicalArtifact[];
  };
  reviewHistory?: MedicalReviewRequest[];
};
type MedicalReviewAccessLink = {
  _id: string;
  reviewerName?: string;
  reviewerEmail?: string;
  label?: string;
  createdAt?: string;
  firstAccessedAt?: string;
  expiresAt?: string;
  lastAccessedAt?: string;
  accessCount?: number;
  firstAccessIp?: string;
  lastAccessIp?: string;
  revokedAt?: string;
  status?: string;
  url?: string;
};

const getArtifactFileUrl = (file: ArtifactFile) => file.url || file.filePath || file.s3Key || '';
const getArtifactFileKey = (file: ArtifactFile) => file.s3Key || file.filePath || file.url || file.fileName || '';
const getArtifactReviewTargets = (artifact: MedicalArtifact) => {
  if (artifact.files?.length) {
    return artifact.files.map((file) => ({
      artifact,
      file,
      fileKey: getArtifactFileKey(file),
    }));
  }
  const pseudoFile = {
    fileName: artifact.title || getArtifactTypeLabel(artifact.artifactType),
    filePath: `artifact:${artifact._id}`,
    uploadedAt: artifact.receivedAt,
  } as ArtifactFile;
  return [{ artifact, file: pseudoFile, fileKey: getArtifactFileKey(pseudoFile) }];
};
const isImageFile = (file: ArtifactFile) => Boolean(file.mimeType?.startsWith('image/')) || /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(file.fileName || '');
const isPdfFile = (file: ArtifactFile) => file.mimeType === 'application/pdf' || /\.pdf($|\?)/i.test(file.fileName || '');
const getPopulatedArtifacts = (request: MedicalReviewRequest) =>
  (request.artifactIds || []).filter((artifact): artifact is MedicalArtifact => typeof artifact !== 'string');
const getRequestDocumentMeta = (request: MedicalReviewRequest) => {
  const artifact = getPopulatedArtifacts(request)[0];
  return {
    documentStage: request.documentStage || request.artifactSnapshot?.documentStage as MedicalArtifact['documentStage'] | undefined || artifact?.documentStage,
    documentType: request.documentType || request.artifactSnapshot?.documentType as MedicalArtifact['documentType'] | undefined || artifact?.documentType,
    ceremonyNumber: request.ceremonyNumber || request.artifactSnapshot?.ceremonyNumber || artifact?.ceremonyNumber,
  };
};
const formatDocumentMeta = (request: MedicalReviewRequest) => {
  const { documentStage, documentType, ceremonyNumber } = getRequestDocumentMeta(request);
  const parts = [
    documentStage ? documentStageLabels[documentStage] : '',
    documentType ? documentTypeLabels[documentType] : '',
    ceremonyNumber ? `Ceremony #${ceremonyNumber}` : '',
  ].filter(Boolean);
  return parts.join(' • ');
};
const formatArtifactDocumentMeta = (artifact: MedicalArtifact) => {
  const parts = [
    artifact.documentStage ? documentStageLabels[artifact.documentStage] : '',
    artifact.documentType ? documentTypeLabels[artifact.documentType] : '',
    artifact.ceremonyNumber ? `Ceremony #${artifact.ceremonyNumber}` : '',
  ].filter(Boolean);
  return parts.join(' • ');
};
const formatDateTime = (value?: string | Date | null) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not set' : date.toLocaleString();
};
const labelFromKey = (value: string) =>
  value
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
const renderValue = (value: any): string => {
  if (value === null || value === undefined || value === '') return 'Not provided';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.length ? value.map((item) => renderValue(item)).join(', ') : 'Not provided';
  if (typeof value === 'object') {
    const selectedItems = Object.entries(value)
      .filter(([key, item]) => item === true && !['other'].includes(key))
      .map(([key]) => labelFromKey(key));
    const details = [value.details, value.otherDetails].filter(Boolean).join(', ');
    const other = value.other && details ? `Other: ${details}` : details;
    return [...selectedItems, other].filter(Boolean).join(', ') || 'Not provided';
  }
  return JSON.stringify(value, null, 2);
};
const getMedicationPdfUrl = (filePath?: string) => {
  if (!filePath) return '';
  return /^https?:\/\//i.test(filePath) ? filePath : `${API_BASE_URL}${filePath}`;
};

const ArtifactInlinePreview: React.FC<{ artifactId?: string; file: ArtifactFile; index: number }> = ({ artifactId, file, index }) => {
  const storedPath = file.s3Key || file.filePath || '';
  const fallbackUrl = getArtifactFileUrl(file);
  const [previewUrl, setPreviewUrl] = useState('');
  const [contentType, setContentType] = useState(file.mimeType || '');
  const [isLoading, setIsLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const fileName = file.fileName || `File ${index + 1}`;

  useEffect(() => {
    let active = true;
    let objectUrl = '';

    const loadPreview = async () => {
      if (!artifactId || !storedPath) {
        setPreviewUrl(fallbackUrl);
        return;
      }

      setIsLoading(true);
      setPreviewError('');
      try {
        const response = await medicalArtifactsApi.getFileBlob(artifactId, storedPath);
        const blob = response.data as Blob;
        objectUrl = URL.createObjectURL(blob);
        if (active) {
          setContentType(blob.type || response.headers?.['content-type'] || file.mimeType || '');
          setPreviewUrl(objectUrl);
        }
      } catch (error: any) {
        console.error('Error loading review request file preview:', error);
        if (active) {
          setPreviewError(error?.response?.data?.message || error?.message || 'Unable to load preview.');
          setPreviewUrl(fallbackUrl);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadPreview();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [artifactId, storedPath, fallbackUrl, file.mimeType]);

  const previewFile = { ...file, mimeType: contentType || file.mimeType, fileName };
  const url = previewUrl || fallbackUrl;

  return (
    <div className="mt-2 rounded-md border border-gray-200 bg-gray-50">
      {isLoading && (
        <div className="flex h-64 items-center justify-center rounded-t-md bg-white text-sm text-gray-500">Loading preview...</div>
      )}
      {!isLoading && previewError && !url && (
        <div className="p-3 text-xs text-red-600">{previewError}</div>
      )}
      {!isLoading && url && isImageFile(previewFile) && (
        <img src={url} alt={fileName} className="max-h-[520px] w-full rounded-t-md bg-white object-contain" />
      )}
      {!isLoading && url && isPdfFile(previewFile) && (
        <iframe src={url} title={fileName} className="h-[520px] w-full rounded-t-md bg-white" />
      )}
      {!isLoading && (!url || (!isImageFile(previewFile) && !isPdfFile(previewFile))) && (
        <div className="p-3 text-xs text-gray-600">Preview unavailable for this file type.</div>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-gray-200 p-2 text-xs">
        <span className="truncate text-gray-700">{fileName}</span>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="shrink-0 font-semibold text-blue-700 hover:text-blue-900">
            Open
          </a>
        )}
      </div>
    </div>
  );
};

const MedicalReviewRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { user } = useAuth();
  const isMedicalRoute = location.pathname.startsWith('/medical/');
  const isEditRoute = location.pathname.endsWith('/edit');
  const isAdvisorReviewRoute = isMedicalRoute || user?.role === 'medical_advisor';
  const isMagicReviewSession = user?.accessType === 'medical_review_magic_link';
  const canManageAccessLinks = user?.role === 'admin' || user?.role === 'medical_staff';
  const canEditReview = isEditRoute;
  const routeId = id === 'new' ? undefined : id;
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<MedicalReviewRequest[]>([]);
  const [selected, setSelected] = useState<MedicalReviewRequest | null>(null);
  const [history, setHistory] = useState<MedicalReviewRequest[]>([]);
  const [relatedArtifacts, setRelatedArtifacts] = useState<MedicalArtifact[]>([]);
  const [reviewDecision, setReviewDecision] = useState<'OK' | 'caution' | 'NOT OK' | ''>('');
  const [medicalStaffNotes, setMedicalStaffNotes] = useState('');
  const [fileReviews, setFileReviews] = useState<FileReviewDraft[]>([]);
  const [reviewContext, setReviewContext] = useState<ReviewContext | null>(null);
  const [accessLinks, setAccessLinks] = useState<MedicalReviewAccessLink[]>([]);
  const [generatedAccessUrl, setGeneratedAccessUrl] = useState('');
  const [accessLinkBusy, setAccessLinkBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | MedicalReviewRequest['status']>('all');
  const [validationError, setValidationError] = useState('');

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = isMagicReviewSession && routeId
        ? { data: [] as MedicalReviewRequest[] }
        : isAdvisorReviewRoute
          ? await medicalReviewRequestsApi.getQueue()
          : await medicalReviewRequestsApi.getAll();
      const items = response.data || [];
      setRequests(items);

      const selectedId = routeId || items[0]?._id;
      let selectedItem = selectedId ? items.find((item: MedicalReviewRequest) => item._id === selectedId) || null : null;
      if (selectedId && !selectedItem) {
        const selectedResponse = await medicalReviewRequestsApi.getOne(selectedId);
        selectedItem = selectedResponse.data || null;
        if (selectedItem) {
          items.unshift(selectedItem);
          setRequests(items);
        }
      }
      setSelected(selectedItem);

      if (selectedItem) {
        if (selectedItem._id) {
          const contextResponse = await medicalReviewRequestsApi.getContext(selectedItem._id);
          const context = contextResponse.data || null;
          setReviewContext(context);
          setHistory(context?.reviewHistory || []);
          setRelatedArtifacts(context?.artifacts?.all || getPopulatedArtifacts(selectedItem));
          if (canManageAccessLinks) {
            const linksResponse = await medicalReviewRequestsApi.getAccessLinks(selectedItem._id).catch(() => ({ data: [] }));
            setAccessLinks(linksResponse.data || []);
          } else {
            setAccessLinks([]);
          }
        } else {
          setReviewContext(null);
          setHistory([]);
          setRelatedArtifacts([]);
          setAccessLinks([]);
        }
        setReviewDecision(selectedItem.reviewDecision || '');
        setMedicalStaffNotes(selectedItem.medicalStaffNotes || selectedItem.overallNotes || selectedItem.reviewNotes || '');
        setFileReviews((selectedItem.fileReviews || []).map((review: NonNullable<MedicalReviewRequest['fileReviews']>[number]) => ({
          ...review,
          decision: review.decision || '',
        })));
      } else {
        setReviewContext(null);
        setHistory([]);
        setRelatedArtifacts([]);
        setAccessLinks([]);
      }
    } catch (error) {
      console.error('Error loading review requests:', error);
      setRequests([]);
      setSelected(null);
      setReviewContext(null);
      setHistory([]);
      setRelatedArtifacts([]);
      setAccessLinks([]);
    } finally {
      setLoading(false);
    }
  }, [routeId, isAdvisorReviewRoute, canManageAccessLinks, isMagicReviewSession]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'all') return requests;
    return requests.filter((request) => request.status === statusFilter);
  }, [requests, statusFilter]);

  const selectedHistory = useMemo(() => {
    if (!selected) return [];
    const currentId = selected._id;
    return history
      .filter((item) => item._id !== currentId)
      .sort((a, b) => (b.attemptNumber || 0) - (a.attemptNumber || 0));
  }, [history, selected]);

  const selectedArtifactIds = useMemo(() => {
    return new Set((selected?.artifactIds || []).map((artifact) => getId(artifact)));
  }, [selected]);

  const linkedArtifacts = useMemo(() => {
    if (!selected) return [];
    const populated = (selected.artifactIds || []).filter((artifact): artifact is MedicalArtifact => typeof artifact !== 'string');
    if (populated.length) return populated;
    return relatedArtifacts.filter((artifact) => artifact._id && selectedArtifactIds.has(artifact._id));
  }, [relatedArtifacts, selected, selectedArtifactIds]);

  const profileHref = useMemo(() => {
    const clientId = getId(selected?.clientId);
    if (!clientId) return undefined;
    return `${isMedicalRoute ? '/medical/client' : '/admin/medical'}/${clientId}`;
  }, [isMedicalRoute, selected]);

  const handleSelect = (request: MedicalReviewRequest) => {
    setSelected(request);
    navigate(`${isMedicalRoute ? '/medical/review-requests' : '/admin/medical-review-requests'}/${request._id}`);
  };

  const handleSaveReview = async () => {
    if (!selected?._id) return;
    setValidationError('');
    const reviewTargets = linkedArtifacts.flatMap((artifact) => getArtifactReviewTargets(artifact));
    const missingFileReview = reviewTargets.find(({ artifact, fileKey }) => {
      const review = fileReviews.find((item) => item.artifactId === artifact._id && item.fileKey === fileKey);
      return !review?.decision || !review?.notes?.trim();
    });
    const overallMedicalNotes = medicalStaffNotes.trim();
    if (!reviewDecision || !overallMedicalNotes) {
      setValidationError('Choose an overall decision and add medical staff notes before saving.');
      return;
    }
    if (missingFileReview) {
      setValidationError('Each linked file needs a decision and a comment before saving.');
      return;
    }
    const cleanedFileReviews = fileReviews
      .filter((review) => review.fileKey || review.fileName || review.notes || review.decision)
      .map((review) => ({
        ...review,
        decision: review.decision || undefined,
      }));
    await medicalReviewRequestsApi.review(selected._id, {
      status: reviewDecision === 'OK' ? 'approved' : reviewDecision === 'NOT OK' ? 'rejected' : reviewDecision === 'caution' ? 'caution' : 'in_review',
      reviewDecision: reviewDecision || undefined,
      reviewNotes: overallMedicalNotes,
      overallNotes: overallMedicalNotes,
      medicalStaffNotes: overallMedicalNotes,
      fileReviews: cleanedFileReviews,
      reviewedBy: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'medical_staff',
    });
    await loadRequests();
  };

  const handleGenerateAccessLink = async () => {
    if (!selected?._id) return;
    setAccessLinkBusy(true);
    try {
      const response = await medicalReviewRequestsApi.createAccessLink(selected._id);
      setGeneratedAccessUrl(response.data.url || '');
      const linksResponse = await medicalReviewRequestsApi.getAccessLinks(selected._id);
      setAccessLinks(linksResponse.data || []);
    } catch (error: any) {
      alert(error?.response?.data?.message || error?.message || 'Unable to generate medical review access link.');
    } finally {
      setAccessLinkBusy(false);
    }
  };

  const handleCopyAccessLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
    alert('Medical review access link copied.');
  };

  const handleRevokeAccessLink = async (accessLinkId: string) => {
    if (!window.confirm('Revoke this medical review access link?')) return;
    setAccessLinkBusy(true);
    try {
      await medicalReviewRequestsApi.revokeAccessLink(accessLinkId);
      if (selected?._id) {
        const linksResponse = await medicalReviewRequestsApi.getAccessLinks(selected._id);
        setAccessLinks(linksResponse.data || []);
      }
    } catch (error: any) {
      alert(error?.response?.data?.message || error?.message || 'Unable to revoke access link.');
    } finally {
      setAccessLinkBusy(false);
    }
  };

  const updateFileReview = (artifact: MedicalArtifact, file: ArtifactFile, patch: Partial<FileReviewDraft>) => {
    const artifactId = artifact._id;
    const fileKey = getArtifactFileKey(file);
    setFileReviews((prev) => {
      const existingIndex = prev.findIndex((review) => review.artifactId === artifactId && review.fileKey === fileKey);
      const nextReview = {
        artifactId,
        fileKey,
        fileName: file.fileName,
        ...(existingIndex >= 0 ? prev[existingIndex] : {}),
        ...patch,
      };
      if (existingIndex < 0) return [...prev, nextReview];
      return prev.map((review, index) => index === existingIndex ? nextReview : review);
    });
  };

  const getFileReview = (artifact: MedicalArtifact, file: ArtifactFile) => {
    const artifactId = artifact._id;
    const fileKey = getArtifactFileKey(file);
    return fileReviews.find((review) => review.artifactId === artifactId && review.fileKey === fileKey) || {};
  };

  const isPreCeremonyReview = useMemo(() => {
    return linkedArtifacts.some((artifact) =>
      artifact.documentStage === 'pre_ceremony'
      && (artifact.artifactType === 'ceremony_ekg' || artifact.artifactType === 'blood_pressure' || artifact.documentType === 'EKG' || artifact.documentType === 'BP')
    );
  }, [linkedArtifacts]);

  const preCeremonyClientColumns = useMemo(() => {
    const clients = new Map<string, { id: string; name: string; artifacts: MedicalArtifact[] }>();
    linkedArtifacts
      .filter((artifact) => artifact.documentStage === 'pre_ceremony')
      .forEach((artifact) => {
        const clientValue = artifact.clientId as any;
        const selectedClient = selected?.clientId as any;
        const clientId = getId(clientValue) || getId(selectedClient) || 'client';
        const clientName = clientValue && typeof clientValue === 'object'
          ? `${clientValue.firstName || ''} ${clientValue.lastName || ''}`.trim() || clientValue.email || `Client ${clientValue.display_id || ''}`.trim()
          : selectedClient && typeof selectedClient === 'object'
            ? `${selectedClient.firstName || ''} ${selectedClient.lastName || ''}`.trim() || selectedClient.email || String(clientId)
            : String(clientId);
        const current = clients.get(clientId) || { id: clientId, name: clientName, artifacts: [] as MedicalArtifact[] };
        current.artifacts.push(artifact);
        clients.set(clientId, current);
      });
    return Array.from(clients.values());
  }, [linkedArtifacts, selected?.clientId]);

  const renderArtifactReviewTarget = (artifact: MedicalArtifact, target: ReturnType<typeof getArtifactReviewTargets>[number]) => {
    const fileReview = getFileReview(artifact, target.file);
    const hasRealFile = !String(target.fileKey).startsWith('artifact:');
    return (
      <div key={`${artifact._id}-${target.fileKey}`} className="rounded-md border border-gray-200 bg-white p-2">
        <div className="text-xs font-semibold text-gray-900">{target.file.fileName || artifact.title}</div>
        <div className="text-[11px] text-gray-500">{formatDateTime(target.file.uploadedAt || artifact.receivedAt)}</div>
        {artifact.textContent && <div className="mt-2 whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs text-gray-700">{artifact.textContent}</div>}
        {artifact.data && Object.keys(artifact.data).length > 0 && (
          <pre className="mt-2 max-h-28 overflow-auto rounded bg-gray-50 p-2 text-[11px] text-gray-600">{JSON.stringify(artifact.data, null, 2)}</pre>
        )}
        {hasRealFile && <ArtifactInlinePreview artifactId={artifact._id} file={target.file} index={0} />}
        {isReadOnlyView ? (
          <div className="mt-2 rounded-md bg-gray-50 p-2 text-xs">
            <div className="font-semibold text-gray-900">{fileReview.decision || 'Not reviewed'}</div>
            <div className="mt-1 whitespace-pre-wrap text-gray-600">{fileReview.notes || 'No comment.'}</div>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap gap-1">
              {decisionOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => updateFileReview(artifact, target.file, { decision: option })}
                  className={`rounded-full px-2 py-1 text-[11px] font-semibold ${fileReview.decision === option ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {decisionLabels[option]}
                </button>
              ))}
            </div>
            <textarea
              value={fileReview.notes || ''}
              onChange={(event) => updateFileReview(artifact, target.file, { notes: event.target.value })}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
              placeholder="Required comment"
            />
          </div>
        )}
      </div>
    );
  };

  const renderPreCeremonyMatrix = () => {
    if (!isPreCeremonyReview || !preCeremonyClientColumns.length) return null;
    const sections = [
      {
        key: 'ekg',
        label: 'Pre-Ceremony EKG',
        filter: (artifact: MedicalArtifact) => artifact.artifactType === 'ceremony_ekg' || artifact.documentType === 'EKG',
      },
      {
        key: 'bp',
        label: 'Blood Pressure',
        filter: (artifact: MedicalArtifact) => artifact.artifactType === 'blood_pressure' || artifact.documentType === 'BP',
      },
    ];
    return (
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
        <div className="mb-3">
          <div className="text-sm font-semibold text-gray-900">Pre-ceremony combo review</div>
          <div className="text-xs text-gray-600">Each client column shows all EKG and BP entries linked to this request, including repeated captures.</div>
        </div>
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[760px] gap-2"
            style={{ gridTemplateColumns: `180px repeat(${preCeremonyClientColumns.length}, minmax(220px, 1fr))` }}
          >
            <div className="rounded-md bg-white p-2 text-xs font-semibold text-gray-500">Review item</div>
            {preCeremonyClientColumns.map((client) => (
              <div key={client.id} className="rounded-md bg-white p-2 text-sm font-semibold text-gray-900">{client.name}</div>
            ))}
            {sections.map((section) => (
              <React.Fragment key={section.key}>
                <div className="rounded-md bg-white p-2 text-sm font-semibold text-gray-900">{section.label}</div>
                {preCeremonyClientColumns.map((client) => {
                  const artifacts = client.artifacts.filter(section.filter);
                  return (
                    <div key={`${section.key}-${client.id}`} className="space-y-2 rounded-md bg-white/70 p-2">
                      {artifacts.length ? artifacts.map((artifact) => (
                        <div key={artifact._id || `${section.key}-${artifact.title}`} className="space-y-2">
                          <div className="text-xs font-semibold text-blue-800">
                            #{artifact.display_id || '—'} {formatArtifactDocumentMeta(artifact)}
                          </div>
                          {getArtifactReviewTargets(artifact).map((target) => renderArtifactReviewTarget(artifact, target))}
                        </div>
                      )) : <div className="text-xs text-gray-500">No {section.label.toLowerCase()} linked.</div>}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const getScreeningValue = (screening: any, ...keys: string[]) => {
    const client = reviewContext?.client || {};
    for (const key of keys) {
      const value = screening?.[key] ?? client?.screeningData?.[key] ?? client?.[key];
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return '';
  };

  const getScreeningBooleanDetails = (screening: any, flagKey: string, detailKey: string) => {
    const details = getScreeningValue(screening, detailKey);
    if (details) return details;
    const flag = getScreeningValue(screening, flagKey);
    return flag === true || flag === 'true' || flag === 'yes' || flag === 'Yes' ? 'Yes' : '';
  };

  const renderScreeningItems = (screening: any, items: Array<{ label: string; keys?: string[]; value?: any }>) => {
    const visibleItems = items
      .map((item) => ({
        label: item.label,
        value: item.value !== undefined ? item.value : getScreeningValue(screening, ...(item.keys || [])),
      }))
      .filter((item) => item.value !== undefined && item.value !== null && item.value !== '');

    if (!visibleItems.length) return null;

    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {visibleItems.map((item) => (
          <div key={item.label} className="rounded-md bg-gray-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.label}</div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{renderValue(item.value)}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderScreeningSection = (screening: any, title: string, items: Array<{ label: string; keys?: string[]; value?: any }>) => {
    const content = renderScreeningItems(screening, items);
    if (!content) return null;
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</div>
        {content}
      </div>
    );
  };

  const renderReadOnlyScreening = (screening: any) => {
    const fileUrl = getScreeningValue(screening, 'handwritingImageUrl');
    const fileName = fileUrl ? decodeURIComponent(String(fileUrl).split('/').pop() || 'Screening file') : '';

    return (
      <div key={screening._id || screening.createdAt || 'screening'} className="space-y-4 rounded-md border border-gray-200 p-3 text-sm">
        <div>
          <div className="font-semibold text-gray-900">
            {getScreeningValue(screening, 'status') || 'screening'} • {formatDateTime(getScreeningValue(screening, 'screeningCompletedDate', 'screeningDate', 'updatedAt', 'createdAt'))}
          </div>
          <div className="mt-1 text-xs font-medium text-blue-700">Read-only screening view</div>
        </div>

        {renderScreeningSection(screening, 'Screening basics', [
          { label: 'Age', keys: ['age'] },
          { label: 'Year of birth', keys: ['year_of_birth', 'yearOfBirth'] },
          { label: 'Risk level', keys: ['riskLevel'] },
          { label: 'Desired retreat', keys: ['desiredRetreat'] },
          { label: 'Quoted price', keys: ['quotedPrice'] },
          { label: 'Screened by', keys: ['screenedBy'] },
          { label: 'Phone number', keys: ['phoneNumber'] },
        ])}

        {renderScreeningSection(screening, 'Motivation and notes', [
          { label: 'Why seeking iboga', keys: ['whySeekingIboga', 'mainIntent'] },
          { label: 'What to change / risk notes', keys: ['whatToChange', 'riskNotes'] },
          { label: 'Childhood', keys: ['childhood'] },
          { label: 'Observations / general notes', keys: ['observations', 'generalNotes', 'notes'] },
        ])}

        {renderScreeningSection(screening, 'Trauma', [
          { label: 'Sexual abuse', value: getScreeningBooleanDetails(screening, 'sexualAbuse', 'sexualAbuseDetails') },
          { label: 'Physical abuse', value: getScreeningBooleanDetails(screening, 'physicalAbuse', 'physicalAbuseDetails') },
          { label: 'Psychological abuse', value: getScreeningBooleanDetails(screening, 'psychologicalAbuse', 'psychologicalAbuseDetails') },
          { label: 'Trauma history', keys: ['traumaHistory'] },
          { label: 'Mental health history', keys: ['mentalHealthHistory'] },
        ])}

        {renderScreeningSection(screening, 'Health', [
          { label: 'Heart', keys: ['heartConditions', 'heartCondition'] },
          { label: 'Liver', keys: ['liverConditions', 'liverCondition'] },
          { label: 'Asthma', keys: ['asthmaConditions', 'asthmaCondition'] },
          { label: 'Medications', keys: ['currentMedications', 'medications'] },
          { label: 'SSRIs', keys: ['ssris'] },
          { label: 'Blood pressure', keys: ['bloodPressureIssues', 'bloodPressure'] },
          { label: 'Blood pressure details', value: [getScreeningValue(screening, 'bloodPressureStatus'), getScreeningValue(screening, 'bloodPressureValue')].filter(Boolean).join(' - ') },
          { label: 'Alcohol history', keys: ['alcoholHistory', 'alcoholConsumption'] },
          { label: 'Health complications', keys: ['healthComplications'] },
          { label: 'Medical tests details', keys: ['medicalTestsDetails'] },
          { label: 'Vitamins & supplements', keys: ['vitaminsSupplements'] },
        ])}

        {renderScreeningSection(screening, 'Substances', [
          { label: 'Drug history', keys: ['drugsHistory', 'addictionHistory'] },
          { label: 'Recreational drugs', keys: ['recreationalDrugs'] },
          { label: 'Marijuana', value: getScreeningBooleanDetails(screening, 'marijuana', 'marijuanaDetails') },
          { label: 'Cocaine', value: getScreeningBooleanDetails(screening, 'cocaine', 'cocaineDetails') },
          { label: 'Meth', value: getScreeningBooleanDetails(screening, 'meth', 'methDetails') },
          { label: 'Heroin', value: getScreeningBooleanDetails(screening, 'heroin', 'heroinDetails') },
          { label: 'Benzos', value: getScreeningBooleanDetails(screening, 'benzos', 'benzosDetails') },
        ])}

        {renderScreeningSection(screening, 'Plant medicines', [
          { label: 'Previous plant medicines', keys: ['previousPlantMedicines'] },
          { label: 'Ayahuasca', value: getScreeningBooleanDetails(screening, 'ayahuasca', 'ayahuascaDetails') },
          { label: 'Iboga', value: getScreeningBooleanDetails(screening, 'iboga', 'ibogaDetails') },
          { label: 'Psilocybin', value: getScreeningBooleanDetails(screening, 'psilocybin', 'psilocybinDetails') },
          { label: 'Bufo', value: getScreeningBooleanDetails(screening, 'bufo', 'bufoDetails') },
          { label: 'Kambo', value: getScreeningBooleanDetails(screening, 'kambo', 'kamboDetails') },
          { label: 'San Pedro', value: getScreeningBooleanDetails(screening, 'sanPedro', 'sanPedroDetails') },
          { label: 'Mescaline', value: getScreeningBooleanDetails(screening, 'mescaline', 'mescalineDetails') },
          { label: 'DMT', value: getScreeningBooleanDetails(screening, 'dmt', 'dmtDetails') },
          { label: 'Ketamine', value: getScreeningBooleanDetails(screening, 'ketamine', 'ketamineDetails') },
          { label: 'MDMA', value: getScreeningBooleanDetails(screening, 'mdma', 'mdmaDetails') },
        ])}

        {fileUrl && (
          <div className="rounded-md bg-gray-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Uploaded screening file</div>
            <a href={String(fileUrl)} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm font-semibold text-blue-700 hover:text-blue-900">
              {fileName || 'Open screening file'}
            </a>
          </div>
        )}
      </div>
    );
  };

  const renderArtifactList = (artifacts: MedicalArtifact[] = [], emptyText: string) => {
    if (!artifacts.length) return <div className="text-sm text-gray-500">{emptyText}</div>;
    return (
      <div className="space-y-2">
        {artifacts.map((artifact) => (
          <div key={artifact._id || `${artifact.artifactType}-${artifact.title}`} className="rounded-md border border-gray-200 bg-white p-3 text-sm">
            <div className="font-semibold text-gray-900">#{artifact.display_id || '—'} {getArtifactTypeLabel(artifact.artifactType)}: {artifact.title}</div>
            <div className="text-xs text-gray-500">{formatDateTime(artifact.receivedAt)} • {artifact.files?.length || 0} file(s)</div>
            {artifact.textContent && <div className="mt-2 whitespace-pre-wrap text-gray-700">{artifact.textContent}</div>}
            {artifact.notes && <div className="mt-2 text-gray-600">Notes: {artifact.notes}</div>}
            {!!artifact.files?.length && (
              <div className="mt-2 space-y-3">
                {artifact.files.map((file, index) => {
                  const url = getArtifactFileUrl(file);
                  return (artifact._id && (file.s3Key || file.filePath)) || url ? (
                    <ArtifactInlinePreview key={`${file.fileName || url}-${index}`} artifactId={artifact._id} file={file} index={index} />
                  ) : (
                    <span key={`${file.fileName || index}`} className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500">{file.fileName || `File ${index + 1}`}</span>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const contextSummary = (count: number, empty = 'No records') => count ? `${count} record${count === 1 ? '' : 's'}` : empty;

  if (loading) {
    return <LoadingSpinner message="Loading medical review requests..." />;
  }

  const isDetailView = Boolean(routeId);
  const isReadOnlyView = Boolean(selected) && !canEditReview;
  const contextScreenings = reviewContext?.screenings?.length
    ? reviewContext.screenings
    : reviewContext?.client?.screeningData
      ? [reviewContext.client.screeningData]
      : [];
  const selectedClientName = selected
    ? typeof selected.clientId === 'string'
      ? selected.clientId
      : selected.clientId?.firstName
        ? `${selected.clientId.firstName} ${selected.clientId.lastName || ''}`.trim()
        : 'Unknown client'
    : '';
  const selectedRetreatName = selected
    ? typeof selected.retreatId === 'string'
      ? selected.retreatId
      : selected.retreatId?.name || 'Unknown retreat'
    : '';

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4 sm:mb-6">
        <div>
          <h1 className="text-xl font-semibold leading-tight text-gray-900 sm:text-2xl">
            {isDetailView && selected ? 'Medical Review' : 'Medical Review Requests'}
          </h1>
          {isDetailView && selected ? (
            <div className="mt-1">
              <div className="text-base font-medium text-gray-900 sm:text-lg">{selectedClientName}</div>
              <div className="text-sm text-gray-600">{getRequestTypeLabel(selected.requestType)}</div>
              {formatDocumentMeta(selected) && (
                <div className="text-xs font-medium text-blue-700 sm:text-sm">{formatDocumentMeta(selected)}</div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              {isMedicalRoute ? 'Queue for review requests. Open Review to change decisions and comments.' : 'Administrative review request queue and history.'}
            </p>
          )}
          {isDetailView && selected && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span>Request #{selected.display_id || '—'}</span>
              {selectedRetreatName && <span>{selectedRetreatName}</span>}
              <span className={`rounded-full px-2 py-1 font-semibold ${reviewStatusStyle[selected.status] || 'bg-gray-100 text-gray-700'}`}>
                {selected.status}
              </span>
            </div>
          )}
          {!isDetailView && (
            <p className="mt-1 text-xs text-gray-500 sm:text-sm">
              {canEditReview ? 'Review the linked files and record decisions and comments.' : ''}
            </p>
          )}
        </div>
        {!isMedicalRoute && !isDetailView && (
          <button
            onClick={() => navigate('/admin/medical-review-requests/new')}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            New Request
          </button>
        )}
      </div>

      {!isDetailView && (
        <div className="mb-4 flex items-center justify-end gap-2">
          <label htmlFor="review-request-status-filter" className="text-sm font-medium text-gray-700">Status</label>
          <select
            id="review-request-status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="w-full max-w-xs rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {(['all', 'pending', 'in_review', 'approved', 'rejected', 'caution', 'needs_resubmission', 'completed'] as const).map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
      )}

      <div className={isDetailView ? 'grid gap-6' : 'grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]'}>
        {!isDetailView && (
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900">Queue</div>
            <div className="max-h-[70vh] overflow-auto">
              {filteredRequests.length === 0 ? (
                <div className="p-6 text-sm text-gray-500">No review requests found.</div>
              ) : (
                filteredRequests.map((request) => (
                  <button
                    key={request._id}
                    onClick={() => handleSelect(request)}
                    className={`block w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 ${selected?._id === request._id ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900">
                          #{request.display_id || '—'} {typeof request.clientId === 'string' ? request.clientId : request.clientId?.display_id ? `#${request.clientId.display_id}` : 'Client'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {getRequestTypeLabel(request.requestType)} • Attempt {request.attemptNumber || 1} • {request.source || 'Provider Plus CRM'}
                        </div>
                        {formatDocumentMeta(request) && (
                          <div className="mt-1 text-xs font-medium text-blue-700">{formatDocumentMeta(request)}</div>
                        )}
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${reviewStatusStyle[request.status] || 'bg-gray-100 text-gray-700'}`}>
                        {request.status}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div className={isDetailView ? 'bg-white' : 'rounded-lg border border-gray-200 bg-white p-4'}>
          {!selected ? (
            <div className="p-4 text-sm text-gray-500">Select a request to review it.</div>
          ) : (
            <div className="space-y-4 sm:space-y-5">
              {!isDetailView && (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">#{selected.display_id || '—'} Review Request</h2>
                  <div className="text-sm text-gray-600">
                    {selectedClientName}
                    {' '}• {selectedRetreatName}
                  </div>
                  <div className="mt-1 text-sm font-medium text-gray-900">{getRequestTypeLabel(selected.requestType)}</div>
                  {formatDocumentMeta(selected) && (
                    <div className="mt-1 text-sm font-medium text-blue-700">{formatDocumentMeta(selected)}</div>
                  )}
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${reviewStatusStyle[selected.status] || 'bg-gray-100 text-gray-700'}`}>
                  {selected.status}
                </span>
              </div>
              )}

              {!isDetailView && (
                <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-gray-200 p-3">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Client Context</div>
                  {profileHref ? (
                    <button type="button" onClick={() => navigate(profileHref)} className="mt-1 text-sm font-semibold text-blue-700 hover:text-blue-900">
                      Open full medical profile
                    </button>
                  ) : (
                    <div className="mt-1 text-sm text-gray-900">No client profile link</div>
                  )}
                </div>
                <div className="rounded-md border border-gray-200 p-3">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Attempt</div>
                  <div className="mt-1 text-sm text-gray-900">{selected.attemptNumber || 1}</div>
                </div>
                </div>
              )}

              {canManageAccessLinks && selected._id && (
                <div className="rounded-md border border-gray-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">WhatsApp reviewer access</div>
                      <div className="text-xs text-gray-500">Magic links open only this medical review and require full login for any other page.</div>
                    </div>
                    <button
                      type="button"
                      disabled={accessLinkBusy}
                      onClick={handleGenerateAccessLink}
                      className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      Generate Link
                    </button>
                  </div>
                  {generatedAccessUrl && (
                    <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-2">
                      <div className="break-all text-xs text-blue-900">{generatedAccessUrl}</div>
                      <button
                        type="button"
                        onClick={() => handleCopyAccessLink(generatedAccessUrl)}
                        className="mt-2 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        Copy for WhatsApp
                      </button>
                    </div>
                  )}
                  <div className="mt-3 space-y-2">
                    {accessLinks.length ? accessLinks.map((link) => (
                      <div key={link._id} className="rounded-md border border-gray-200 bg-gray-50 p-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold text-gray-900">
                            {link.reviewerName || link.reviewerEmail || 'Assigned reviewer'} · {link.label || 'review'}
                          </div>
                          <span className="rounded-full bg-white px-2 py-1 font-semibold text-gray-700">{link.status || 'not_accessed'}</span>
                        </div>
                        <div className="mt-1 grid gap-1 text-gray-600 sm:grid-cols-2">
                          <div>Created: {formatDateTime(link.createdAt)}</div>
                          <div>First access: {formatDateTime(link.firstAccessedAt)}</div>
                          <div>Expires: {formatDateTime(link.expiresAt)}</div>
                          <div>Access count: {link.accessCount || 0}</div>
                          <div>First IP: {link.firstAccessIp || '-'}</div>
                          <div>Last IP: {link.lastAccessIp || '-'}</div>
                        </div>
                        {!link.revokedAt && (
                          <button
                            type="button"
                            disabled={accessLinkBusy}
                            onClick={() => handleRevokeAccessLink(link._id)}
                            className="mt-2 rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    )) : (
                      <div className="text-xs text-gray-500">No WhatsApp access links generated yet.</div>
                    )}
                  </div>
                </div>
              )}

              <div className={isDetailView ? 'space-y-2' : 'rounded-md border border-gray-200 bg-gray-50 p-3'}>
                {!isDetailView && (
                  <div className="mb-3">
                    <div className="text-sm font-semibold text-gray-900">Client medical context</div>
                    <div className="text-xs text-gray-500">Screening, booking medical requirements, medications, and questionnaire information available for this client.</div>
                  </div>
                )}
                <div className="space-y-2">
                  <details className="rounded-md border border-gray-200 bg-white p-3" open>
                    <summary className="cursor-pointer text-sm font-semibold text-gray-900">
                      Screening • {contextSummary(reviewContext?.screenings?.length || 0)}
                    </summary>
                    <div className="mt-3 space-y-3">
                      {reviewContext?.client && (
                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                          <div><span className="font-medium text-gray-700">Client:</span> {reviewContext.client.firstName} {reviewContext.client.lastName} {reviewContext.client.display_id ? `#${reviewContext.client.display_id}` : ''}</div>
                          <div><span className="font-medium text-gray-700">Medical conditions:</span> {renderValue(reviewContext.client.medicalConditions)}</div>
                          <div><span className="font-medium text-gray-700">Allergies:</span> {renderValue(reviewContext.client.allergies)}</div>
                          <div><span className="font-medium text-gray-700">Current medications:</span> {renderValue(reviewContext.client.currentMedications)}</div>
                          <div><span className="font-medium text-gray-700">Heart:</span> {renderValue(reviewContext.client.heartConditions)}</div>
                          <div><span className="font-medium text-gray-700">Liver:</span> {renderValue(reviewContext.client.liverConditions)}</div>
                        </div>
                      )}
                      {contextScreenings.length
                        ? contextScreenings.slice(0, 3).map((screening) => renderReadOnlyScreening(screening))
                        : <div className="text-sm text-gray-500">No screening record found.</div>}
                    </div>
                  </details>

                  {!isDetailView && (
                  <>
                  <details className="rounded-md border border-gray-200 bg-white p-3" open>
                    <summary className="cursor-pointer text-sm font-semibold text-gray-900">
                      Entry EKG • {contextSummary((reviewContext?.artifacts?.entryEkg?.length || 0) + (reviewContext?.medicalRecords?.filter((record) => record.ekgFileName || record.ekgStatus !== 'pending').length || 0))}
                    </summary>
                    <div className="mt-3 space-y-3">
                      {renderArtifactList(reviewContext?.artifacts?.entryEkg || [], 'No EKG artifacts found.')}
                      {reviewContext?.medicalRecords?.filter((record) => record.ekgFileName || record.ekgStatus !== 'pending').map((record) => (
                        <div key={`ekg-${record._id}`} className="rounded-md border border-gray-200 bg-white p-3 text-sm">
                          <div className="font-semibold text-gray-900">Legacy EKG record • {record.ekgStatus || 'pending'}</div>
                          <div className="text-xs text-gray-500">Received {formatDateTime(record.ekgReceivedDate)} • {record.ekgFileName || 'No file name'}</div>
                          {record.ekgAdvisorNotes && <div className="mt-2 text-gray-700">Notes: {record.ekgAdvisorNotes}</div>}
                        </div>
                      ))}
                    </div>
                  </details>

                  <details className="rounded-md border border-gray-200 bg-white p-3" open>
                    <summary className="cursor-pointer text-sm font-semibold text-gray-900">
                      Entry Liver Panel • {contextSummary((reviewContext?.artifacts?.entryLiver?.length || 0) + (reviewContext?.medicalRecords?.filter((record) => record.liverPanelFileName || record.liverPanelStatus !== 'pending').length || 0))}
                    </summary>
                    <div className="mt-3 space-y-3">
                      {renderArtifactList(reviewContext?.artifacts?.entryLiver || [], 'No liver panel artifacts found.')}
                      {reviewContext?.medicalRecords?.filter((record) => record.liverPanelFileName || record.liverPanelStatus !== 'pending').map((record) => (
                        <div key={`liver-${record._id}`} className="rounded-md border border-gray-200 bg-white p-3 text-sm">
                          <div className="font-semibold text-gray-900">Legacy liver panel record • {record.liverPanelStatus || 'pending'}</div>
                          <div className="text-xs text-gray-500">Received {formatDateTime(record.liverPanelReceivedDate)} • {record.liverPanelFileName || 'No file name'}</div>
                          {record.liverPanelAdvisorNotes && <div className="mt-2 text-gray-700">Notes: {record.liverPanelAdvisorNotes}</div>}
                        </div>
                      ))}
                    </div>
                  </details>

                  <details className="rounded-md border border-gray-200 bg-white p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-gray-900">
                      Medications • {contextSummary((reviewContext?.medications?.length || 0) + (reviewContext?.artifacts?.medications?.length || 0))}
                    </summary>
                    <div className="mt-3 space-y-3">
                      {renderArtifactList(reviewContext?.artifacts?.medications || [], 'No medication artifacts found.')}
                      {reviewContext?.medications?.length ? reviewContext.medications.map((medication) => (
                        <div key={medication._id} className="rounded-md border border-gray-200 bg-white p-3 text-sm">
                          <div className="font-semibold text-gray-900">Medication record #{medication.display_id || '—'}</div>
                          <div className="text-xs text-gray-500">Collected {formatDateTime(medication.date_collected)}</div>
                          {medication.admin_notes && <div className="mt-2 text-gray-700">Admin notes: {medication.admin_notes}</div>}
                          {medication.medstaff_review_notes && <div className="mt-2 text-gray-700">Medical review: {medication.medstaff_review_notes}</div>}
                          {medication.pdf_file && <a href={getMedicationPdfUrl(medication.pdf_file)} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-blue-700">Open PDF</a>}
                        </div>
                      )) : <div className="text-sm text-gray-500">No structured medication records found.</div>}
                    </div>
                  </details>

                  <details className="rounded-md border border-gray-200 bg-white p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-gray-900">
                      Questionnaire • {contextSummary(reviewContext?.artifacts?.questionnaire?.length || 0)}
                    </summary>
                    <div className="mt-3">
                      {renderArtifactList(reviewContext?.artifacts?.questionnaire || [], 'No questionnaire artifact found.')}
                    </div>
                  </details>
                  </>
                  )}
                </div>
              </div>

              {renderPreCeremonyMatrix()}

              {!isPreCeremonyReview && (
              <div className={isDetailView ? 'rounded-md border border-gray-200 p-3' : 'rounded-md border border-gray-200 p-3'}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Files for review</div>
                    {!isDetailView && (
                      <div className="text-xs text-gray-500">These are the stored files included in this medical review request.</div>
                    )}
                  </div>
                  {profileHref && (
                    <button type="button" onClick={() => navigate(profileHref)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                      Full Profile
                    </button>
                  )}
                </div>
                <div className={`mt-3 space-y-2 ${isDetailView ? '' : 'max-h-72 overflow-auto'}`}>
                  {linkedArtifacts.length === 0 ? (
                    <div className="text-sm text-gray-500">No linked files are available for this request.</div>
                  ) : (
                    linkedArtifacts.map((artifact) => {
                      const client = typeof artifact.clientId === 'string' ? undefined : artifact.clientId as Client;
                      return (
                        <div key={artifact._id} className="rounded-md border border-blue-300 bg-blue-50 p-3 text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-gray-900">
                                #{artifact.display_id || '—'} {getArtifactTypeLabel(artifact.artifactType)}: {artifact.title}
                              </div>
                              <div className="text-xs text-gray-500">
                                {client ? `${client.firstName} ${client.lastName}` : 'Client record'} • {artifact.receivedAt ? new Date(artifact.receivedAt).toLocaleString() : 'No received date'}
                              </div>
                              {formatArtifactDocumentMeta(artifact) && (
                                <div className="mt-1 text-xs font-medium text-blue-700">{formatArtifactDocumentMeta(artifact)}</div>
                              )}
                            </div>
                            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">This request</span>
                          </div>
                          {artifact.textContent && <div className="mt-2 whitespace-pre-wrap text-gray-700">{artifact.textContent}</div>}
                          {artifact.notes && <div className="mt-2 text-xs text-gray-600">Notes: {artifact.notes}</div>}
                          {!!artifact.files?.length && (
                            <div className="mt-2 space-y-3">
                              {artifact.files.map((file, index) => {
                                const fileReview = getFileReview(artifact, file);
                                return (
                                  <div key={`${file.fileName || file.s3Key || index}`} className="rounded-md border border-gray-200 bg-white p-3">
                                    <ArtifactInlinePreview artifactId={artifact._id} file={file} index={index} />
                                    {isReadOnlyView ? (
                                      <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
                                        <div className="font-medium text-gray-900">File decision: {fileReview.decision || 'Not reviewed'}</div>
                                        <div className="mt-1 whitespace-pre-wrap text-gray-600">{fileReview.notes || 'No file notes.'}</div>
                                      </div>
                                    ) : (
                                      <div className="mt-3 grid gap-3">
                                        <div className="flex flex-wrap gap-2">
                                          {decisionOptions.map((option) => (
                                            <button
                                              key={option}
                                              type="button"
                                              onClick={() => updateFileReview(artifact, file, { decision: option })}
                                              className={`rounded-full px-3 py-1 text-xs font-semibold ${fileReview.decision === option ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                            >
                                              {decisionLabels[option]}
                                            </button>
                                          ))}
                                        </div>
                                        <textarea
                                          value={fileReview.notes || ''}
                                          onChange={(event) => updateFileReview(artifact, file, { notes: event.target.value })}
                                          rows={2}
                                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                                          placeholder="Required comment on this file"
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {!artifact.files?.length && (
                            <div className="mt-2 text-xs text-gray-500">This linked artifact has no uploaded files.</div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              )}

              {!isDetailView && (
                <div className="rounded-md border border-gray-200 p-3">
                <div className="text-sm font-semibold text-gray-900">Other client medical artifacts</div>
                <div className="mt-3 max-h-44 space-y-2 overflow-auto">
                  {relatedArtifacts.filter((artifact) => !artifact._id || !selectedArtifactIds.has(artifact._id)).length === 0 ? (
                    <div className="text-sm text-gray-500">No additional stored artifacts found for this client.</div>
                  ) : (
                    relatedArtifacts.filter((artifact) => !artifact._id || !selectedArtifactIds.has(artifact._id)).map((artifact) => (
                      <div key={artifact._id} className="rounded-md border border-gray-200 p-3 text-sm">
                        <div className="font-semibold text-gray-900">#{artifact.display_id || '—'} {getArtifactTypeLabel(artifact.artifactType)}: {artifact.title}</div>
                        <div className="text-xs text-gray-500">{[formatArtifactDocumentMeta(artifact), `${artifact.files?.length || 0} file(s)`].filter(Boolean).join(' • ')}</div>
                      </div>
                    ))
                  )}
                </div>
                </div>
              )}

              {!isDetailView && selected.sourceSnapshot && (
                <div className="rounded-md border border-gray-200 p-3">
                  <div className="text-sm font-semibold text-gray-900">Source snapshot</div>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-gray-600">{JSON.stringify(selected.sourceSnapshot, null, 2)}</pre>
                </div>
              )}

              <div className="rounded-md border border-gray-200 p-3">
                <div className="mb-2 text-sm font-semibold text-gray-900">Review decision</div>
                {isReadOnlyView ? (
                  <div className="rounded-md bg-gray-50 p-3 text-sm">
                    <div className="font-semibold text-gray-900">{selected.reviewDecision || 'No decision recorded'}</div>
                    <div className="mt-2 whitespace-pre-wrap text-gray-600">{selected.medicalStaffNotes || selected.overallNotes || selected.reviewNotes || 'No medical staff notes.'}</div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {decisionOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setReviewDecision(option)}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${reviewDecision === option ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          {decisionLabels[option]}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={medicalStaffNotes}
                      onChange={(e) => setMedicalStaffNotes(e.target.value)}
                      rows={4}
                      className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      placeholder="Required medical staff notes"
                    />
                  </>
                )}
              </div>

              {validationError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {validationError}
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-gray-500">
                  {selected.requestedAt ? `Requested ${new Date(selected.requestedAt).toLocaleString()}` : 'No request date'}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(isMedicalRoute ? '/medical/review-requests' : '/admin/medical-review-requests')}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Back
                  </button>
                  {isReadOnlyView ? (
                    <button
                      type="button"
                      onClick={() => navigate(`${isMedicalRoute ? '/medical/review-requests' : '/admin/medical-review-requests'}/${selected._id}/edit`)}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      {isMedicalRoute ? 'Review' : 'Edit Request'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSaveReview}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Save Review
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-gray-200 p-3">
                <div className="text-sm font-semibold text-gray-900">Decision history</div>
                <div className="mt-3 space-y-2">
                  {selected.decisionHistory?.length ? (
                    selected.decisionHistory
                      .slice()
                      .reverse()
                      .map((entry, index) => (
                        <div key={`${entry.reviewedAt || index}`} className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-semibold text-gray-900">
                              {entry.decision || 'No decision'}{entry.status ? ` • ${entry.status}` : ''} • {entry.reviewedBy || 'Unknown reviewer'}
                            </div>
                            <span className="text-xs text-gray-500">{formatDateTime(entry.reviewedAt)}</span>
                          </div>
                          <div className="mt-2 rounded border border-gray-200 bg-white p-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Medical staff notes</div>
                            <div className="mt-1 whitespace-pre-wrap text-gray-700">{entry.medicalStaffNotes || entry.overallNotes || entry.notes || 'No medical staff notes'}</div>
                          </div>
                          {!!entry.fileReviews?.length && (
                            <div className="mt-2 space-y-1">
                              {entry.fileReviews.map((fileReview, fileIndex) => (
                                <div key={`${fileReview.fileKey || fileReview.fileName || fileIndex}`} className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700">
                                  <span className="font-semibold">{fileReview.fileName || fileReview.fileKey || `File ${fileIndex + 1}`}:</span> {fileReview.decision || 'No decision'}{fileReview.notes ? ` - ${fileReview.notes}` : ''}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                  ) : (
                    <div className="text-sm text-gray-500">No decision history saved yet.</div>
                  )}
                </div>
              </div>

              {!isDetailView && (
                <div className="rounded-md border border-gray-200 p-3">
                <div className="text-sm font-semibold text-gray-900">Previous requests</div>
                <div className="mt-3 space-y-2">
                  {selectedHistory.length === 0 ? (
                    <div className="text-sm text-gray-500">No previous requests found.</div>
                  ) : (
                    selectedHistory.map((item) => (
                      <div key={item._id} className="rounded-md border border-gray-200 p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-gray-900">#{item.display_id || '—'} • Attempt {item.attemptNumber || 1}</div>
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${reviewStatusStyle[item.status] || 'bg-gray-100 text-gray-700'}`}>{item.status}</span>
                        </div>
                        <div className="mt-1 text-gray-600">
                          {item.reviewDecision || 'No decision'} • {item.reviewNotes || 'No notes'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicalReviewRequestsPage;
