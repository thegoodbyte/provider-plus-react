import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { communicationsApi, medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';
import { API_BASE_URL } from '../config/api.config';
import { Client, EmailTemplate, MedicalArtifact, MedicalReviewRequest, Retreat } from '../types';
import { AlertTriangle, ThumbsDown, ThumbsUp } from 'lucide-react';
import {
  formatMedicalReviewDecisionLabel,
  formatMedicalReviewRequestSummary,
  getAssociatedMedicalReviewRequests,
  medicalReviewDecisionLabels,
  medicalReviewDecisionOptions,
  normalizeMedicalReviewDecision,
  splitMedicalReviewRequestsByTimeline,
} from './MedicalReviewRequestsPage.helpers';

const reviewStatusStyle: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  caution: 'bg-amber-100 text-amber-800',
  needs_resubmission: 'bg-orange-100 text-orange-800',
  completed: 'bg-gray-100 text-gray-800',
};

const decisionOptions = medicalReviewDecisionOptions;
const decisionLabels = medicalReviewDecisionLabels;

const getDecisionButtonClass = (option: typeof decisionOptions[number], selected: boolean, size: 'sm' | 'lg' = 'sm') => {
  const base = size === 'lg'
    ? 'min-h-12 w-full rounded-xl px-4 py-3 text-sm font-semibold'
    : 'rounded-full px-3 py-1 text-xs font-semibold';

  if (selected) {
    if (option === 'OK') return `${base} bg-green-600 text-white`;
    if (option === 'caution') return `${base} bg-yellow-500 text-white`;
    if (option === 'more_info_needed') return `${base} bg-blue-600 text-white`;
    return `${base} bg-red-600 text-white`;
  }

  if (option === 'OK') return `${base} border border-green-200 bg-green-50 text-green-800 hover:bg-green-100`;
  if (option === 'caution') return `${base} border border-yellow-200 bg-yellow-50 text-yellow-800 hover:bg-yellow-100`;
  if (option === 'more_info_needed') return `${base} border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100`;
  return `${base} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`;
};

const requestTypeLabels: Record<string, string> = {
  ekg: 'EKG',
  liver: 'Liver Panel',
  both: 'EKG + Liver Panel',
  ekg_review: 'EKG',
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

const medicalReviewTypeFilters = [
  { value: 'all', label: 'All review types' },
  { value: 'ekg', label: 'EKG' },
  { value: 'liver', label: 'Liver' },
  { value: 'blood_pressure', label: 'Blood pressure' },
  { value: 'medications', label: 'Medications' },
  { value: 'questionnaire', label: 'Questionnaire' },
  { value: 'food', label: 'Food intake' },
  { value: 'general', label: 'General / question' },
] as const;

type MedicalReviewTypeFilter = typeof medicalReviewTypeFilters[number]['value'];

const requestTypeFilterGroups: Record<Exclude<MedicalReviewTypeFilter, 'all'>, string[]> = {
  ekg: ['ekg', 'ekg_review', 'ceremony_ekg_review'],
  liver: ['liver', 'liver_panel_review'],
  blood_pressure: ['blood_pressure_review'],
  medications: ['medications_review'],
  questionnaire: ['questionnaire_review'],
  food: ['food_review'],
  general: ['medical_question', 'general_clearance'],
};

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

const getId = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value._id;
};

const getRetreatSearchText = (retreat?: string | Retreat | null) => {
  if (!retreat) return '';
  if (typeof retreat === 'string') return retreat;
  return [
    retreat._id,
    retreat.name,
    retreat.code,
    retreat.retreatCode,
    retreat.location_town,
    retreat.location,
  ].filter(Boolean).join(' ');
};

const getClientSearchText = (client?: string | Client | null) => {
  if (!client) return '';
  if (typeof client === 'string') return client;
  return [
    client._id,
    client.display_id,
    client.firstName,
    client.lastName,
    client.fname,
    client.lname,
    client.email,
    client.phone,
  ].filter(Boolean).join(' ');
};

const requestMatchesTypeFilter = (request: MedicalReviewRequest, filter: MedicalReviewTypeFilter) => {
  if (filter === 'all') return true;
  const requestType = String(request.requestType || '').toLowerCase();
  const artifactTypes = (request.artifactIds || [])
    .filter((artifact): artifact is MedicalArtifact => typeof artifact !== 'string')
    .map((artifact) => String(artifact.artifactType || '').toLowerCase());
  const documentType = String(request.documentType || request.artifactSnapshot?.documentType || '').toLowerCase();
  const haystack = [requestType, documentType, ...artifactTypes];
  return requestTypeFilterGroups[filter].some((value) => haystack.includes(value))
    || (filter === 'ekg' && haystack.some((value) => value.includes('ekg')))
    || (filter === 'liver' && haystack.some((value) => value.includes('liver')));
};

type ArtifactFile = NonNullable<MedicalArtifact['files']>[number];
type FileReviewDraft = {
  artifactId?: string;
  fileKey?: string;
  fileName?: string;
  decision?: 'OK' | 'caution' | 'more_info_needed' | 'NOT OK' | '';
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
const sanitizeFileReviewDraft = (review: Partial<FileReviewDraft> & { reviewedAt?: string | Date; reviewedBy?: string }) => ({
  artifactId: review.artifactId || undefined,
  fileKey: review.fileKey || undefined,
  fileName: review.fileName || undefined,
  decision: normalizeMedicalReviewDecision(review.decision) || undefined,
  notes: review.notes || undefined,
  reviewedAt: review.reviewedAt || undefined,
  reviewedBy: review.reviewedBy || undefined,
});
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
const formatCompactDocumentMeta = (request: MedicalReviewRequest) => formatMedicalReviewRequestSummary(request) || formatDocumentMeta(request);
const formatArtifactDocumentMeta = (artifact: MedicalArtifact) => {
  const parts = [
    artifact.documentStage ? documentStageLabels[artifact.documentStage] : '',
    artifact.documentType ? documentTypeLabels[artifact.documentType] : '',
    artifact.ceremonyNumber ? `Ceremony #${artifact.ceremonyNumber}` : '',
  ].filter(Boolean);
  return parts.join(' • ');
};
const BloodPressureArtifactSummary: React.FC<{ artifact: MedicalArtifact }> = ({ artifact }) => {
  if (artifact.artifactType !== 'blood_pressure' && artifact.documentType !== 'BP') return null;
  const systolic = artifact.data?.systolic;
  const diastolic = artifact.data?.diastolic;
  const pulse = artifact.data?.pulse || artifact.data?.heartRate;
  if (!systolic || !diastolic) return null;
  return (
    <div className="grid grid-cols-3 gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-center">
      <div><div className="text-[11px] font-semibold uppercase text-sky-700">SYS</div><div className="text-3xl font-bold text-slate-950">{systolic}</div></div>
      <div><div className="text-[11px] font-semibold uppercase text-sky-700">DIA</div><div className="text-3xl font-bold text-slate-950">{diastolic}</div></div>
      <div><div className="text-[11px] font-semibold uppercase text-sky-700">Pulse</div><div className="text-3xl font-bold text-slate-950">{pulse || '—'}</div></div>
    </div>
  );
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

const ArtifactInlinePreview: React.FC<{ artifactId?: string; file: ArtifactFile; index: number; frame?: boolean }> = ({ artifactId, file, index, frame = true }) => {
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

  if (!frame) {
    return (
      <div className="mt-2 space-y-2">
        {isLoading && <div className="text-xs text-gray-500">Loading preview...</div>}
        {!isLoading && previewError && !url && <div className="text-xs text-red-600">{previewError}</div>}
        {!isLoading && url && isImageFile(previewFile) && (
          <img src={url} alt={fileName} className="w-full rounded-md bg-white object-contain" />
        )}
        {!isLoading && url && isPdfFile(previewFile) && (
          <iframe src={url} title={fileName} className="h-[520px] w-full rounded-md bg-white" />
        )}
        {!isLoading && (!url || (!isImageFile(previewFile) && !isPdfFile(previewFile))) && (
          <div className="text-xs text-gray-600">Preview unavailable for this file type.</div>
        )}
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="truncate text-gray-700">{fileName}</span>
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="shrink-0 font-semibold text-blue-700 hover:text-blue-900">
              Open
            </a>
          )}
        </div>
      </div>
    );
  }

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
  const canManageAccessLinks = user?.role === 'admin';
  const routeId = id === 'new' ? undefined : id;
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<MedicalReviewRequest[]>([]);
  const [selected, setSelected] = useState<MedicalReviewRequest | null>(null);
  const [history, setHistory] = useState<MedicalReviewRequest[]>([]);
  const [relatedArtifacts, setRelatedArtifacts] = useState<MedicalArtifact[]>([]);
  const [reviewDecision, setReviewDecision] = useState<(typeof decisionOptions)[number] | ''>('');
  const [medicalStaffNotes, setMedicalStaffNotes] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [resettingReview, setResettingReview] = useState(false);
  const [fileReviews, setFileReviews] = useState<FileReviewDraft[]>([]);
  const [reviewContext, setReviewContext] = useState<ReviewContext | null>(null);
  const [accessLinks, setAccessLinks] = useState<MedicalReviewAccessLink[]>([]);
  const [generatedAccessUrl, setGeneratedAccessUrl] = useState('');
  const [accessLinkBusy, setAccessLinkBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | MedicalReviewRequest['status']>('all');
  const [typeFilter, setTypeFilter] = useState<MedicalReviewTypeFilter>('all');
  const [retreatFilter, setRetreatFilter] = useState('');
  const [requestSearchFilter, setRequestSearchFilter] = useState('');
  const [validationError, setValidationError] = useState('');
  const [followUpDeadline, setFollowUpDeadline] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
  const [followUpEmailTemplateId, setFollowUpEmailTemplateId] = useState('');
  const [followUpTemplates, setFollowUpTemplates] = useState<EmailTemplate[]>([]);
  const reviewDecisionSectionRef = useRef<HTMLDivElement | null>(null);
  const canEditReview = isEditRoute || (isAdvisorReviewRoute && selected?.status === 'pending' && !isMagicReviewSession);

  useEffect(() => {
    if (reviewDecision !== 'more_info_needed') return;
    communicationsApi.getTemplates()
      .then((response) => {
        const templates = (response.data || []).filter((template: EmailTemplate) =>
          template.active !== false && (
            template.templateKey === 'medical_more_information'
            || template.category === 'medical'
          ));
        setFollowUpTemplates(templates);
        if (!followUpEmailTemplateId && templates[0]?._id) setFollowUpEmailTemplateId(templates[0]._id);
      })
      .catch(() => setFollowUpTemplates([]));
  }, [reviewDecision, followUpEmailTemplateId]);

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
      setGeneratedAccessUrl('');

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
        setReviewDecision(normalizeMedicalReviewDecision(selectedItem.reviewDecision) as (typeof decisionOptions)[number] | '');
        setMedicalStaffNotes(selectedItem.medicalStaffNotes || selectedItem.overallNotes || selectedItem.reviewNotes || '');
        setFileReviews((selectedItem.fileReviews || []).map((review: NonNullable<MedicalReviewRequest['fileReviews']>[number]) => ({
          ...sanitizeFileReviewDraft(review),
          decision: normalizeMedicalReviewDecision(review.decision) || '',
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
    const retreatSearch = retreatFilter.trim().toLowerCase();
    const requestSearch = requestSearchFilter.trim().toLowerCase();
    return requests.filter((request) => {
      if (statusFilter !== 'all' && request.status !== statusFilter) return false;
      if (!requestMatchesTypeFilter(request, typeFilter)) return false;
      if (retreatSearch && !getRetreatSearchText(request.retreatId).toLowerCase().includes(retreatSearch)) return false;
      if (requestSearch) {
        const text = [
          request.display_id,
          request._id,
          request.requestType,
          request.status,
          request.source,
          request.documentStage,
          request.documentType,
          request.reviewDecision,
          request.assignedTo,
          request.assignedToEmail,
          getClientSearchText(request.clientId),
          getRetreatSearchText(request.retreatId),
          ...(request.artifactIds || []).map((artifact) => typeof artifact === 'string' ? artifact : [
            artifact._id,
            artifact.display_id,
            artifact.title,
            artifact.artifactType,
            artifact.documentStage,
            artifact.documentType,
          ].filter(Boolean).join(' ')),
        ].filter(Boolean).join(' ').toLowerCase();
        if (!text.includes(requestSearch)) return false;
      }
      return true;
    });
  }, [requests, requestSearchFilter, retreatFilter, statusFilter, typeFilter]);

  const reviewTimeline = useMemo(() => splitMedicalReviewRequestsByTimeline(selected, history), [history, selected]);
  const associatedRequests = useMemo(
    () => getAssociatedMedicalReviewRequests(selected, history),
    [history, selected],
  );

  const selectedArtifactIds = useMemo(() => {
    return new Set((selected?.artifactIds || []).map((artifact) => getId(artifact)));
  }, [selected]);

  const linkedArtifacts = useMemo(() => {
    if (!selected) return [];
    const populated = (selected.artifactIds || []).filter((artifact): artifact is MedicalArtifact => typeof artifact !== 'string');
    const relatedById = new Map(relatedArtifacts.filter((artifact) => artifact._id).map((artifact) => [artifact._id, artifact]));
    if (populated.length) {
      return populated.map((artifact) => (artifact._id && relatedById.get(artifact._id)) || artifact);
    }
    return relatedArtifacts.filter((artifact) => artifact._id && selectedArtifactIds.has(artifact._id));
  }, [relatedArtifacts, selected, selectedArtifactIds]);

  const profileHref = useMemo(() => {
    const clientId = getId(selected?.clientId);
    if (!clientId) return undefined;
    return `${isMedicalRoute ? '/medical/client' : '/admin/medical'}/${clientId}`;
  }, [isMedicalRoute, selected]);

  const handleSelect = (request: MedicalReviewRequest) => {
    setSelected(request);
    setGeneratedAccessUrl('');
    navigate(`${isMedicalRoute ? '/medical/review-requests' : '/admin/medical-review-requests'}/${request._id}`);
  };

  const handleSaveReview = async (options?: { quickApprove?: boolean; redirectAfterSave?: boolean }) => {
    if (!selected?._id) return;
    setValidationError('');
    const effectiveDecision = options?.quickApprove ? 'OK' : reviewDecision;
    const effectiveNotes = options?.quickApprove ? (medicalStaffNotes.trim() || 'no comment') : medicalStaffNotes.trim();
    if (!effectiveDecision || effectiveNotes.length < 2) {
      setValidationError('Choose a result and enter at least 2 characters before confirming.');
      reviewDecisionSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const cleanedFileReviews = fileReviews
      .filter((review) => review.fileKey || review.fileName || review.notes || review.decision)
      .map((review) => sanitizeFileReviewDraft(review));
    try {
      setSavingReview(true);
      await medicalReviewRequestsApi.review(selected._id, {
        status: effectiveDecision === 'OK' ? 'approved' : effectiveDecision === 'NOT OK' ? 'rejected' : effectiveDecision === 'caution' ? 'caution' : 'needs_resubmission',
        reviewDecision: effectiveDecision || undefined,
        reviewNotes: effectiveNotes,
        overallNotes: effectiveNotes,
        medicalStaffNotes: effectiveNotes,
        fileReviews: cleanedFileReviews,
        reviewedBy: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'medical_staff',
        ...(effectiveDecision === 'more_info_needed' ? {
          followUpDeadline,
          followUpEmailTemplateId: followUpEmailTemplateId || undefined,
        } : {}),
      });
      await loadRequests();
      if (options?.redirectAfterSave) {
        navigate('/medical-dashboard');
      }
    } finally {
      setSavingReview(false);
    }
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

  const handleResetReview = async () => {
    if (!selected?._id || user?.role !== 'admin') return;
    const reason = window.prompt(
      `Reset the decision for MRR #${selected.display_id || selected._id}?\n\nEnter the reason for this administrative correction:`,
      'Decision entered by mistake',
    );
    if (reason === null) return;
    if (!window.confirm('This will remove the current decision and return the MRR to the pending review queue. Continue?')) return;
    try {
      setResettingReview(true);
      const response = await medicalReviewRequestsApi.resetReview(selected._id, reason.trim() || 'Decision entered by mistake');
      setSelected(response.data);
      setReviewDecision('');
      setMedicalStaffNotes('');
      setFileReviews([]);
      await loadRequests();
    } catch (error: any) {
      alert(error?.response?.data?.message || error?.message || 'Unable to reset this medical review.');
    } finally {
      setResettingReview(false);
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
        {hasRealFile && <ArtifactInlinePreview artifactId={artifact._id} file={target.file} index={0} frame={false} />}
        {isReadOnlyView ? (
          <div className="mt-2 rounded-md bg-gray-50 p-2 text-xs">
            <div className="font-semibold text-gray-900">{fileReview.decision || 'Not reviewed'}</div>
            <div className="mt-1 whitespace-pre-wrap text-gray-600">{fileReview.notes || 'No comment.'}</div>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="grid gap-2 sm:grid-cols-3">
              {decisionOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => updateFileReview(artifact, target.file, { decision: option })}
                  className={getDecisionButtonClass(option, fileReview.decision === option, 'sm')}
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
              placeholder="Optional comment"
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

  const formatAlcoholUse = (screening: any) => {
    if (getScreeningValue(screening, 'alcoholSober')) {
      return 'Sober / does not drink alcohol';
    }
    const alcoholUse = getScreeningValue(screening, 'alcoholUse');
    if (!alcoholUse || typeof alcoholUse !== 'object') return '';

    const labels: Record<string, string> = {
      wine: 'Wine',
      beer: 'Beer',
      whiskey: 'Whiskey',
      vodka: 'Vodka',
    };

    return Object.entries(labels)
      .filter(([key]) => Boolean(alcoholUse[key]?.selected))
      .map(([key, label]) => {
        const entry = alcoholUse[key] || {};
        const details = [entry.frequency, entry.amount].filter(Boolean).join(', ');
        return details ? `${label}: ${details}` : label;
      })
      .join('\n');
  };

  const formatNicotine = (screening: any) => {
    const parts = [
      getScreeningValue(screening, 'nicotineCurrent') ? 'Currently smoking / vaping' : '',
      getScreeningValue(screening, 'nicotineWantsToQuit') ? 'Wants to quit' : '',
      getScreeningValue(screening, 'nicotineSince') ? `Smoking since: ${getScreeningValue(screening, 'nicotineSince')}` : '',
      getScreeningValue(screening, 'nicotinePerDay') ? `Per day: ${getScreeningValue(screening, 'nicotinePerDay')}` : '',
      getScreeningValue(screening, 'nicotineNotes'),
    ].filter(Boolean);
    return parts.join('\n');
  };

  const renderReadOnlyScreening = (screening: any) => {
    const fileUrl = getScreeningValue(screening, 'handwritingImageUrl');

    return (
      <div key={screening._id || screening.createdAt || 'screening'} className="space-y-3 text-sm">
        {reviewContext?.client && (
          <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700">
            <span className="font-semibold text-gray-900">Client:</span>{' '}
            {reviewContext.client.firstName} {reviewContext.client.lastName}
            {reviewContext.client.display_id ? ` #${reviewContext.client.display_id}` : ''}
          </div>
        )}
        {fileUrl && (
          <a href={String(fileUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs font-semibold text-blue-700">
            Open screening file
          </a>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { label: 'Why seeking iboga', keys: ['whySeekingIboga', 'mainIntent'] },
            { label: 'Medical conditions', keys: ['medicalConditions', 'healthConditions', 'generalConditions'] },
            { label: 'Observations', keys: ['observations', 'generalNotes', 'notes'] },
            { label: 'Anxiety diagnosed since', keys: ['anxietySince'] },
            { label: 'Depression diagnosed since', keys: ['depressionSince'] },
            { label: 'Psychiatrist care', value: getScreeningBooleanDetails(screening, 'psychiatristCare', 'psychiatristCareDetails') },
            { label: 'Heart', keys: ['heartConditions', 'heartCondition'] },
            { label: 'Liver', keys: ['liverConditions', 'liverCondition'] },
            { label: 'Medications', keys: ['currentMedications', 'medications'] },
            { label: 'Blood pressure', keys: ['bloodPressureIssues', 'bloodPressure'] },
            { label: 'Alcohol use', value: formatAlcoholUse(screening) },
            { label: 'Nicotine', value: formatNicotine(screening) },
            { label: 'Drug history', keys: ['drugsHistory', 'addictionHistory'] },
            { label: 'Previous plant medicines', keys: ['previousPlantMedicines'] },
          ].map((item) => {
            const value = item.value !== undefined ? item.value : getScreeningValue(screening, ...(item.keys || []));
            if (!value) return null;
            return (
              <div key={item.label} className="rounded-md bg-gray-50 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{item.label}</div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{String(value)}</div>
              </div>
            );
          })}
        </div>
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
                    <ArtifactInlinePreview key={`${file.fileName || url}-${index}`} artifactId={artifact._id} file={file} index={index} frame={false} />
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

  const renderRelatedRequestCard = (item: MedicalReviewRequest, label: string) => (
    <button
      key={item._id}
      type="button"
      onClick={() => handleSelect(item)}
      className="block w-full rounded-md border border-gray-200 bg-white p-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-gray-900">
          #{item.display_id || '—'} • Attempt {item.attemptNumber || 1}
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${reviewStatusStyle[item.status] || 'bg-gray-100 text-gray-700'}`}>
          {item.status}
        </span>
      </div>
      <div className="mt-1 text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-sm text-gray-600">
        {formatCompactDocumentMeta(item) || getRequestTypeLabel(item.requestType)}
        {item.reviewDecision ? ` • ${formatMedicalReviewDecisionLabel(item.reviewDecision)}` : ''}
      </div>
      <div className="mt-1 text-xs text-gray-500">
        {item.reviewNotes || item.medicalStaffNotes || item.overallNotes || 'No notes saved yet.'}
      </div>
    </button>
  );

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
  const isMissingOverallDecision = Boolean(validationError && !reviewDecision);
  const isMissingMedicalStaffNotes = Boolean(validationError && medicalStaffNotes.trim().length < 2);
  const originalArtifactIds = selected
    ? Array.from(new Set([
        getId(selected.medicalArtifactId),
        ...(selected.artifactIds || []).map((artifact) => getId(artifact)),
      ].filter((artifactId): artifactId is string => Boolean(artifactId))))
    : [];
  const artifactRoutePrefix = isMedicalRoute ? '/medical' : '/admin';

  return (
    <div className="overflow-x-hidden p-0 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4 sm:mb-6">
        <div>
          <h1 className="text-xl font-semibold leading-tight text-gray-900 sm:text-2xl">
            {isDetailView && selected ? (
              <>
                <span className="sm:hidden">{selectedClientName} · MRR #{selected.display_id || '—'}</span>
                <span className="hidden sm:inline">Medical Review</span>
              </>
            ) : 'Medical Review Requests'}
          </h1>
              {isDetailView && selected ? (
                <div className="mt-1">
                  <div className="hidden text-base font-medium text-gray-900 sm:block sm:text-lg">{selectedClientName}</div>
                  <div className="text-sm text-gray-600">{formatCompactDocumentMeta(selected) || getRequestTypeLabel(selected.requestType)}</div>
                </div>
              ) : (
            <p className="text-sm text-gray-600">
              {isMedicalRoute ? 'Queue for review requests. Open Review to change decisions and comments.' : 'Administrative review request queue and history.'}
            </p>
          )}
          {isDetailView && selected && (
            <div className="mt-2 hidden flex-wrap items-center gap-2 text-xs text-gray-500 sm:flex">
              <span>Request #{selected.display_id || '—'}</span>
              <span>
                {selected.createdAt
                  ? `Created ${formatDateTime(selected.createdAt)}`
                  : selected.requestedAt
                    ? `Created ${formatDateTime(selected.requestedAt)}`
                    : 'No created date'}
              </span>
              <span className={`rounded-full px-2 py-1 font-semibold ${reviewStatusStyle[selected.status] || 'bg-gray-100 text-gray-700'}`}>
                {selected.status}
              </span>
              {originalArtifactIds.map((artifactId, index) => (
                <button
                  key={artifactId}
                  type="button"
                  onClick={() => navigate(`${artifactRoutePrefix}/medical-artifacts/${artifactId}/edit`)}
                  className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 font-semibold text-blue-700 hover:bg-blue-100"
                >
                  {originalArtifactIds.length > 1 ? `Edit original artifact ${index + 1}` : 'Edit original artifact'}
                </button>
              ))}
              {originalArtifactIds.length === 0 && (
                <span className="rounded-md bg-amber-50 px-2 py-1 font-medium text-amber-800">No original artifact linked</span>
              )}
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
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <select
              id="review-request-type-filter"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as MedicalReviewTypeFilter)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {medicalReviewTypeFilters.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              id="review-request-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {(['all', 'pending', 'in_review', 'approved', 'rejected', 'caution', 'needs_resubmission', 'completed'] as const).map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <input
              value={retreatFilter}
              onChange={(event) => setRetreatFilter(event.target.value)}
              placeholder="Retreat code or name"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              value={requestSearchFilter}
              onChange={(event) => setRequestSearchFilter(event.target.value)}
              placeholder="Search client, request, artifact..."
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTypeFilter('all');
                  setStatusFilter('all');
                  setRetreatFilter('');
                  setRequestSearchFilter('');
                }}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear filters
              </button>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Showing {filteredRequests.length} of {requests.length} review request{requests.length === 1 ? '' : 's'}
          </div>
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
                          {formatCompactDocumentMeta(request) || getRequestTypeLabel(request.requestType)} • Attempt {request.attemptNumber || 1} • {request.source || 'Provider Plus CRM'}
                        </div>
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

        <div className={isDetailView ? 'bg-white sm:rounded-lg sm:border sm:border-gray-200 sm:p-4' : 'rounded-lg border border-gray-200 bg-white p-4'}>
          {!selected ? (
            <div className="p-4 text-sm text-gray-500">Select a request to review it.</div>
          ) : (
            <>
            {isDetailView && (
              <div className="space-y-3 sm:hidden">
                <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <div className="border-b border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900">
                    {formatCompactDocumentMeta(selected) || getRequestTypeLabel(selected.requestType)}
                  </div>
                  <div className="space-y-3 p-2">
                    {linkedArtifacts.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500">No linked document is available.</div>
                    ) : linkedArtifacts.map((artifact) => (
                      <div key={artifact._id} className="min-w-0 space-y-2">
                        <div className="px-1 text-xs font-semibold text-blue-800">
                          {getArtifactTypeLabel(artifact.artifactType)}{artifact.title ? ` · ${artifact.title}` : ''}
                        </div>
                        <BloodPressureArtifactSummary artifact={artifact} />
                        {artifact.textContent && (
                          <div className="whitespace-pre-wrap rounded-md bg-gray-50 p-2 text-xs text-gray-700">{artifact.textContent}</div>
                        )}
                        {artifact.files?.length ? artifact.files.map((file, index) => (
                          <div key={`${file.fileName || file.s3Key || index}`} className="min-w-0 overflow-hidden rounded-md border border-gray-200">
                            <ArtifactInlinePreview artifactId={artifact._id} file={file} index={index} frame={false} />
                          </div>
                        )) : (
                          <div className="rounded-md bg-gray-50 p-2 text-xs text-gray-500">No uploaded picture or PDF.</div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                <section
                  ref={reviewDecisionSectionRef}
                  className={`rounded-lg border bg-white p-3 ${
                    isMissingOverallDecision || isMissingMedicalStaffNotes ? 'border-red-300' : 'border-gray-200'
                  }`}
                >
                  <div className="mb-2 text-sm font-semibold text-gray-900">Review</div>
                  {isReadOnlyView ? (
                    <div className="rounded-md bg-gray-50 p-3 text-sm">
                      <div className="font-semibold text-gray-900">{formatMedicalReviewDecisionLabel(selected.reviewDecision)}</div>
                      <div className="mt-2 whitespace-pre-wrap text-gray-600">{selected.medicalStaffNotes || selected.overallNotes || selected.reviewNotes || 'No medical staff notes.'}</div>
                      {user?.role === 'admin' && selected.reviewDecision && (
                        <button
                          type="button"
                          onClick={handleResetReview}
                          disabled={resettingReview}
                          className="mt-3 w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                        >
                          {resettingReview ? 'Resetting...' : 'Reset mistaken review'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <textarea
                        id="mobile-medical-staff-notes"
                        value={medicalStaffNotes}
                        onChange={(event) => {
                          setMedicalStaffNotes(event.target.value);
                          if (validationError && event.target.value.trim().length >= 2) setValidationError('');
                        }}
                        rows={4}
                        minLength={2}
                        className={`w-full rounded-md border px-3 py-2 text-base ${
                          isMissingMedicalStaffNotes ? 'border-red-400 ring-2 ring-red-100' : 'border-gray-300'
                        }`}
                        placeholder="Review notes and recommendations"
                      />
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {decisionOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              setReviewDecision(option);
                              if (validationError && medicalStaffNotes.trim().length >= 2) setValidationError('');
                            }}
                            className={getDecisionButtonClass(option, reviewDecision === option, 'sm')}
                          >
                            {decisionLabels[option]}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveReview()}
                        disabled={savingReview || !reviewDecision || medicalStaffNotes.trim().length < 2}
                        className="mt-2 w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingReview ? 'Saving...' : 'Save review'}
                      </button>
                    </>
                  )}
                </section>

                <details className="rounded-lg border border-gray-200 bg-white">
                  <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-gray-900">Additional information</summary>
                  <div className="space-y-3 border-t border-gray-200 p-3 text-sm">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-gray-500">Status</span><div className="font-semibold text-gray-900">{selected.status}</div></div>
                      <div><span className="text-gray-500">Created</span><div className="font-semibold text-gray-900">{formatDateTime(selected.createdAt || selected.requestedAt)}</div></div>
                      <div><span className="text-gray-500">Attempt</span><div className="font-semibold text-gray-900">{selected.attemptNumber || 1}</div></div>
                      <div><span className="text-gray-500">Request</span><div className="font-semibold text-gray-900">MRR #{selected.display_id || '—'}</div></div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {profileHref && (
                        <button type="button" onClick={() => navigate(profileHref)} className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700">
                          Full medical profile
                        </button>
                      )}
                      {originalArtifactIds.map((artifactId, index) => (
                        <button key={artifactId} type="button" onClick={() => navigate(`${artifactRoutePrefix}/medical-artifacts/${artifactId}/edit`)} className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                          {originalArtifactIds.length > 1 ? `Original artifact ${index + 1}` : 'Original artifact'}
                        </button>
                      ))}
                    </div>
                    {contextScreenings.length > 0 && (
                      <details className="rounded-md border border-gray-200">
                        <summary className="cursor-pointer px-3 py-2 font-semibold text-gray-900">Screening</summary>
                        <div className="border-t border-gray-200 p-3">{renderReadOnlyScreening(contextScreenings[0])}</div>
                      </details>
                    )}
                    {history.length > 0 && (
                      <details className="rounded-md border border-gray-200">
                        <summary className="cursor-pointer px-3 py-2 font-semibold text-gray-900">Previous MRRs ({history.length})</summary>
                        <div className="space-y-2 border-t border-gray-200 p-2">
                          {history.map((item) => renderRelatedRequestCard(item, 'Previous review'))}
                        </div>
                      </details>
                    )}
                    {associatedRequests.length > 0 && (
                      <details className="rounded-md border border-gray-200">
                        <summary className="cursor-pointer px-3 py-2 font-semibold text-gray-900">Associated reviews ({associatedRequests.length})</summary>
                        <div className="space-y-2 border-t border-gray-200 p-2">
                          {associatedRequests.map((item) => renderRelatedRequestCard(item, 'Associated review'))}
                        </div>
                      </details>
                    )}
                  </div>
                </details>
              </div>
            )}
            <div className={`${isDetailView ? 'hidden sm:block' : ''} space-y-4 sm:space-y-5`}>
              {!isDetailView && (
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">#{selected.display_id || '—'} Review Request</h2>
                  <div className="text-sm text-gray-600">
                    {selectedClientName}
                  </div>
                  <div className="mt-1 text-sm font-medium text-gray-900">{formatCompactDocumentMeta(selected) || getRequestTypeLabel(selected.requestType)}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {selected.createdAt
                      ? `Created ${formatDateTime(selected.createdAt)}`
                      : selected.requestedAt
                        ? `Created ${formatDateTime(selected.requestedAt)}`
                        : 'No created date'}
                  </div>
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

              {selected && history.length > 0 && (
                <div className="space-y-3">
                  <details className="rounded-md border border-gray-200 bg-white" open={false}>
                    <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-gray-900">
                      <span>Previous MRRs ({history.length})</span>
                      <span className="text-xs font-medium text-gray-500">Client history</span>
                    </summary>
                    <div className="border-t border-gray-200 p-3">
                      <div className="overflow-hidden rounded-md border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                            <tr>
                              <th className="px-3 py-2">Request</th>
                              <th className="px-3 py-2">Document</th>
                              <th className="px-3 py-2">Created</th>
                              <th className="px-3 py-2">Decision</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {history
                              .slice()
                              .sort((a, b) => {
                                const at = new Date(a.createdAt || a.requestedAt || 0).getTime();
                                const bt = new Date(b.createdAt || b.requestedAt || 0).getTime();
                                return bt - at;
                              })
                              .map((item) => (
                                <tr key={item._id} className="align-top">
                                  <td className="px-3 py-2 font-medium text-gray-900">#{item.display_id || '—'}</td>
                                  <td className="px-3 py-2 text-gray-700">{formatCompactDocumentMeta(item) || getRequestTypeLabel(item.requestType)}</td>
                                  <td className="px-3 py-2 text-gray-600">{formatDateTime(item.createdAt || item.requestedAt)}</td>
                                  <td className="px-3 py-2 text-gray-700">{formatMedicalReviewDecisionLabel(item.reviewDecision)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </details>
                </div>
              )}

              {selected && associatedRequests.length > 0 && (
                <div className="rounded-md border border-gray-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Associated Medical Reviews ({associatedRequests.length})</div>
                      <div className="text-xs text-gray-500">All other medical review links for this client.</div>
                    </div>
                    <div className="text-xs text-gray-500">Tap any review to switch context.</div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {associatedRequests.map((item) => (
                      renderRelatedRequestCard(item, 'Associated review')
                    ))}
                  </div>
                </div>
              )}

              {selected && (reviewTimeline.previousRequests.length > 0 || reviewTimeline.followingRequests.length > 0) && (
                <div className="space-y-3">
                  {reviewTimeline.previousRequests.length > 0 && (
                    <details className="rounded-md border border-gray-200 bg-white" open={false}>
                      <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-gray-900">
                        <span>Previous Medical Reviews ({reviewTimeline.previousRequests.length})</span>
                        <span className="text-xs font-medium text-gray-500">View history</span>
                      </summary>
                      <div className="border-t border-gray-200 p-3 space-y-2">
                        {reviewTimeline.previousRequests.map((item) => renderRelatedRequestCard(item, 'Previous review'))}
                      </div>
                    </details>
                  )}
                  {reviewTimeline.followingRequests.length > 0 && (
                    <details className="rounded-md border border-gray-200 bg-white" open={false}>
                      <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-gray-900">
                        <span>Following Requests ({reviewTimeline.followingRequests.length})</span>
                        <span className="text-xs font-medium text-gray-500">View next items</span>
                      </summary>
                      <div className="border-t border-gray-200 p-3 space-y-2">
                        {reviewTimeline.followingRequests.map((item) => renderRelatedRequestCard(item, 'Following request'))}
                      </div>
                    </details>
                  )}
                </div>
              )}

              {canManageAccessLinks && selected._id && (
                <details className="rounded-md border border-gray-200 bg-white">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-gray-900">
                    <span>Admin access codes</span>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600">
                      {accessLinks.length} link{accessLinks.length === 1 ? '' : 's'}
                    </span>
                  </summary>
                  <div className="border-t border-gray-200 p-3">
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
                        <div className="mb-1 text-xs font-semibold text-blue-900">New access link</div>
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
                            <div>First access: {link.firstAccessedAt ? formatDateTime(link.firstAccessedAt) : 'Not accessed yet'}</div>
                            <div>
                              Expires: {link.expiresAt
                                ? formatDateTime(link.expiresAt)
                                : 'One hour after first successful access'}
                            </div>
                            <div>Access count: {link.accessCount || 0}</div>
                            <div>First IP: {link.firstAccessIp || '-'}</div>
                            <div>Last IP: {link.lastAccessIp || '-'}</div>
                          </div>
                          {link.url ? (
                            <div className="mt-2 rounded-md border border-blue-100 bg-white p-2">
                              <div className="break-all text-[11px] font-medium text-blue-900">{link.url}</div>
                              <button
                                type="button"
                                onClick={() => handleCopyAccessLink(link.url!)}
                                className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                              >
                                Copy link
                              </button>
                            </div>
                          ) : (
                            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
                              This older link was stored as a hash only. Generate a new one if you need to copy it again.
                            </div>
                          )}
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
                </details>
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
                      Screening
                    </summary>
                    <div className="mt-3 space-y-3">
                      {reviewContext?.client && (
                        <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700">
                          <span className="font-semibold text-gray-900">Client:</span>{' '}
                          {reviewContext.client.firstName} {reviewContext.client.lastName}
                          {reviewContext.client.display_id ? ` #${reviewContext.client.display_id}` : ''}
                        </div>
                      )}
                      {contextScreenings.length
                        ? contextScreenings.slice(0, 1).map((screening) => renderReadOnlyScreening(screening))
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
                          <div className="mt-2"><BloodPressureArtifactSummary artifact={artifact} /></div>
                          {artifact.notes && <div className="mt-2 text-xs text-gray-600">Notes: {artifact.notes}</div>}
                          {!!artifact.files?.length && (
                            <div className="mt-2 space-y-3">
                              {artifact.files.map((file, index) => {
                                const fileReview = getFileReview(artifact, file);
                                return (
                                  <div key={`${file.fileName || file.s3Key || index}`} className="space-y-3">
                                    <ArtifactInlinePreview artifactId={artifact._id} file={file} index={index} frame={false} />
                                    {isReadOnlyView ? (
                                      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
                                        <div className="font-medium text-gray-900">File decision: {fileReview.decision || 'Not reviewed'}</div>
                                        <div className="mt-1 whitespace-pre-wrap text-gray-600">{fileReview.notes || 'No file notes.'}</div>
                                      </div>
                                    ) : (
                                      <div className="grid gap-3">
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
                                          placeholder="Optional comment on this file"
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

              <div
                ref={reviewDecisionSectionRef}
                className={`rounded-md border p-3 ${
                  isMissingOverallDecision || isMissingMedicalStaffNotes
                    ? 'border-red-300 bg-red-50/40'
                    : 'border-gray-200'
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-gray-900">Review decision</div>
                  {!isReadOnlyView && <div className="text-xs font-medium text-red-700">Overall decision and notes are required. File-level review is optional.</div>}
                </div>
                {isReadOnlyView ? (
                  <div className="rounded-md bg-gray-50 p-3 text-sm">
                    <div className="font-semibold text-gray-900">{formatMedicalReviewDecisionLabel(selected.reviewDecision)}</div>
                    <div className="mt-2 whitespace-pre-wrap text-gray-600">{selected.medicalStaffNotes || selected.overallNotes || selected.reviewNotes || 'No medical staff notes.'}</div>
                    {user?.role === 'admin' && selected.reviewDecision && (
                      <button
                        type="button"
                        onClick={handleResetReview}
                        disabled={resettingReview}
                        className="mt-3 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {resettingReview ? 'Resetting...' : 'Reset mistaken review'}
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {decisionOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => {
                            setReviewDecision(option);
                            if (validationError && medicalStaffNotes.trim().length >= 2) setValidationError('');
                          }}
                          className={getDecisionButtonClass(option, reviewDecision === option, 'lg')}
                        >
                          {option === 'OK' ? (
                            <ThumbsUp className="mx-auto mb-1 h-4 w-4" />
                          ) : option === 'NOT OK' ? (
                            <ThumbsDown className="mx-auto mb-1 h-4 w-4" />
                          ) : (
                            <AlertTriangle className="mx-auto mb-1 h-4 w-4" />
                          )}
                          {decisionLabels[option]}
                        </button>
                      ))}
                    </div>
                    {isMissingOverallDecision && (
                      <div className="mt-2 text-xs font-medium text-red-700">Pick one decision before saving.</div>
                    )}
                    {reviewDecision && (
                      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <label htmlFor="medical-staff-notes" className="block text-sm font-semibold text-gray-900">
                          Note for {decisionLabels[reviewDecision]} <span className="text-red-600">*</span>
                        </label>
                        <textarea
                          id="medical-staff-notes"
                          value={medicalStaffNotes}
                          onChange={(e) => {
                            setMedicalStaffNotes(e.target.value);
                            if (validationError && e.target.value.trim().length >= 2) setValidationError('');
                          }}
                          rows={3}
                          minLength={2}
                          autoFocus
                          className={`mt-2 w-full rounded-md border bg-white px-3 py-2 text-sm ${
                            isMissingMedicalStaffNotes
                              ? 'border-red-400 ring-2 ring-red-100'
                              : 'border-gray-300'
                          }`}
                          placeholder="Enter at least 2 characters"
                        />
                        {reviewDecision === 'more_info_needed' && (
                          <div className="mt-3 rounded-md border border-orange-200 bg-orange-50 p-3">
                            <div className="text-sm font-semibold text-orange-950">Automatic client follow-up</div>
                            <p className="mt-1 text-xs text-orange-800">The note above becomes the client instruction. The app creates a blocking booking step and coordinator task. The email is prepared but not sent automatically.</p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <label className="text-xs font-semibold text-gray-700">Deadline
                                <input
                                  type="date"
                                  value={followUpDeadline}
                                  min={new Date().toISOString().split('T')[0]}
                                  onChange={(event) => setFollowUpDeadline(event.target.value)}
                                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal"
                                />
                              </label>
                              <label className="text-xs font-semibold text-gray-700">Email template
                                <select
                                  value={followUpEmailTemplateId}
                                  onChange={(event) => setFollowUpEmailTemplateId(event.target.value)}
                                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal"
                                >
                                  <option value="">Use/create the language default</option>
                                  {followUpTemplates.map((template) => (
                                    <option key={template._id} value={template._id}>{template.name}</option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          </div>
                        )}
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <span className={`text-xs ${medicalStaffNotes.trim().length >= 2 ? 'text-gray-500' : 'font-medium text-red-700'}`}>
                            Minimum 2 characters
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSaveReview()}
                            disabled={savingReview || medicalStaffNotes.trim().length < 2}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingReview ? 'Confirming...' : 'Confirm'}
                          </button>
                        </div>
                      </div>
                    )}
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
                  ) : null}
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
                              {formatMedicalReviewDecisionLabel(entry.decision)}{entry.status ? ` • ${entry.status}` : ''} • {entry.reviewedBy || 'Unknown reviewer'}
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

            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicalReviewRequestsPage;
