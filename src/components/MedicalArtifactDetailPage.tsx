import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, Edit, Eye, Plus, Save, Trash2, Upload } from 'lucide-react';
import { bookingsApi, medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';
import { usersApi, User } from '../services/usersApi';
import { Client, MedicalArtifact, MedicalReviewGroup, MedicalReviewRequest, RetreatClient } from '../types';
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

const contextTypeLabels: Record<NonNullable<MedicalArtifact['contextType']>, string> = {
  client: 'Client profile',
  booking: 'Booking',
  ceremony: 'Ceremony',
};

const purposeLabels: Record<NonNullable<MedicalArtifact['purpose']>, string> = {
  paid_review: 'Paid Review',
  booking_requirement: 'Booking Requirement',
  pre_ceremony: 'Pre-Ceremony',
  repeat_test: 'Repeat Test',
  correction: 'Correction',
  general: 'General',
};

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

type ArtifactStatus = NonNullable<MedicalArtifact['status']>;
type DocumentStage = NonNullable<MedicalArtifact['documentStage']>;

const ceremonyStages = new Set<DocumentStage>(['pre_ceremony', 'in_ceremony', 'post_ceremony']);

const getObjectId = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

const getClientLabel = (client?: string | Client) => {
  if (!client || typeof client === 'string') return client || 'Unknown client';
  const name = [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ');
  return [`#${client.display_id || '-'}`, name || client.email || 'Unknown client'].filter(Boolean).join(' ');
};

const getBookingLabel = (booking: RetreatClient) => {
  const parts = [
    booking.bookingNumber ? `Booking #${booking.bookingNumber}` : 'Booking',
    booking.status,
    booking.checkInDate ? new Date(booking.checkInDate).toLocaleDateString() : '',
  ].filter(Boolean);
  return parts.join(' - ');
};

const formatBytes = (size?: number) => {
  if (!size) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const getFileStoredPath = (file: NonNullable<MedicalArtifact['files']>[number]) => file.s3Key || file.filePath || '';

const getFileName = (file: NonNullable<MedicalArtifact['files']>[number]) => {
  const storedPath = getFileStoredPath(file);
  return file.fileName || storedPath.split('/').pop() || 'Medical artifact file';
};

const readableAnswerKey = (key: string) => String(key || '').replace(/^q\d+_/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()).trim() || key;

const formatAnswerValue = (value: any): string => {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

const getUploadErrorMessage = (error: any) => {
  const data = error?.response?.data;
  const details = data?.details;
  const storageDetails = details?.storageDetails;
  const message = data?.message || storageDetails?.message || error?.message;
  if (error?.response?.status === 503 || /storage|s3|configured|configuration/i.test(message || '')) {
    const storageCode = storageDetails?.errorName || storageDetails?.code || details?.code;
    const bucket = details?.bucket || storageDetails?.bucket;
    const region = storageDetails?.region;
    return [
      'Upload error: storage is misconfigured.',
      storageCode ? `Storage error: ${storageCode}.` : '',
      bucket ? `Bucket: ${bucket}.` : '',
      region ? `Region: ${region}.` : '',
      'Open the browser console for the full upload diagnostics.',
    ].filter(Boolean).join(' ');
  }
  return message || 'Failed to upload selected files.';
};

const isPreviewableFile = (file: NonNullable<MedicalArtifact['files']>[number]) => {
  const fileName = getFileName(file).toLowerCase();
  const mimeType = file.mimeType || '';
  return mimeType.startsWith('image/') || mimeType.includes('pdf') || /\.(png|jpe?g|gif|webp|bmp|heic|heif|pdf)$/i.test(fileName);
};

const getReviewSortTime = (review: MedicalReviewRequest) =>
  new Date(review.reviewedAt || review.requestedAt || review.createdAt || 0).getTime();

const formatDateTime = (value?: Date | string) => value ? new Date(value).toLocaleString() : '-';

const getReviewRequestLabel = (request: MedicalReviewRequest) =>
  request.requestType?.replace(/_/g, ' ') || 'medical review';

const getReviewDecision = (request: MedicalReviewRequest) =>
  request.reviewDecision || request.decision || request.status || 'pending';

const MedicalArtifactInlinePreview: React.FC<{
  artifactId: string;
  file: NonNullable<MedicalArtifact['files']>[number];
}> = ({ artifactId, file }) => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState(file.mimeType || '');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const storedPath = getFileStoredPath(file);
  const fileName = getFileName(file);
  const isPdf = contentType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');
  const isImage = contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(fileName);

  useEffect(() => {
    let active = true;
    let createdUrl = '';

    const loadPreview = async () => {
      if (!storedPath) {
        setError('No storage path is recorded for this file.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const response = await medicalArtifactsApi.getFileBlob(artifactId, storedPath);
        const blob = response.data as Blob;
        createdUrl = URL.createObjectURL(blob);
        if (active) {
          setContentType(blob.type || response.headers?.['content-type'] || file.mimeType || '');
          setFileUrl(createdUrl);
        }
      } catch (previewError: any) {
        console.error('Error loading medical artifact preview:', previewError);
        if (active) {
          setError(previewError?.response?.data?.message || previewError?.message || 'Unable to load this file preview.');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadPreview();

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [artifactId, storedPath, file.mimeType]);

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-900">{fileName}</div>
          <div className="text-xs text-gray-500">{contentType || file.mimeType || 'Unknown type'} · {formatBytes(file.size)}</div>
        </div>
      </div>

      <div className="flex min-h-[360px] items-center justify-center rounded-md border border-gray-100 bg-gray-50">
        {isLoading && <div className="text-sm text-gray-500">Loading preview...</div>}
        {!isLoading && error && <div className="max-w-xl px-4 text-sm text-red-600">{error}</div>}
        {!isLoading && !error && fileUrl && isImage && (
          <img
            src={fileUrl}
            alt={fileName}
            className="max-h-[620px] max-w-full object-contain"
          />
        )}
        {!isLoading && !error && fileUrl && isPdf && (
          <iframe
            src={fileUrl}
            title={fileName}
            className="h-[620px] w-full border-0"
          />
        )}
        {!isLoading && !error && fileUrl && !isImage && !isPdf && (
          <div className="px-4 text-sm text-gray-600">Preview unavailable for this file type.</div>
        )}
      </div>
    </div>
  );
};

const MedicalArtifactDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = location.pathname.startsWith('/medical/') ? '/medical' : '/admin';
  const isEditMode = location.pathname.endsWith('/edit');
  const [artifact, setArtifact] = useState<MedicalArtifact | null>(null);
  const [captureMode, setCaptureMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingPath, setDeletingPath] = useState('');
  const [deletingArtifact, setDeletingArtifact] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translationLanguage, setTranslationLanguage] = useState('pl');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [reviewRequests, setReviewRequests] = useState<MedicalReviewRequest[]>([]);
  const [quickMrrOpen, setQuickMrrOpen] = useState(false);
  const [quickMrrSaving, setQuickMrrSaving] = useState(false);
  const [quickMrrAdvisors, setQuickMrrAdvisors] = useState<User[]>([]);
  const [quickMrrGroups, setQuickMrrGroups] = useState<MedicalReviewGroup[]>([]);
  const [quickMrrTypes, setQuickMrrTypes] = useState<Array<{ key: NonNullable<MedicalReviewRequest['requestType']>; label: string }>>([]);
  const [quickMrr, setQuickMrr] = useState<{ requestType: NonNullable<MedicalReviewRequest['requestType']>; advisorId: string; groupId: string }>({ requestType: 'general_clearance', advisorId: '', groupId: '' });
  const [bookings, setBookings] = useState<RetreatClient[]>([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    notes: '',
    status: 'stored' as ArtifactStatus,
    contextType: 'client' as NonNullable<MedicalArtifact['contextType']>,
    purpose: 'general' as NonNullable<MedicalArtifact['purpose']>,
    documentStage: 'entry' as NonNullable<MedicalArtifact['documentStage']>,
    documentType: 'additional' as NonNullable<MedicalArtifact['documentType']>,
    bookingId: '',
    ceremonyNumber: '' as number | '',
  });

  useEffect(() => {
    document.body.classList.toggle('medical-artifact-capture-mode', captureMode);
    return () => document.body.classList.remove('medical-artifact-capture-mode');
  }, [captureMode]);

  useEffect(() => {
    const loadArtifact = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const response = await medicalArtifactsApi.getOne(id);
        const reviewsResponse = await medicalReviewRequestsApi.getByArtifact(id).catch(() => ({ data: [] }));
        const item = response.data;
        setArtifact(item);
        setTranslationLanguage(item.translation?.sourceLanguage || item.data?.sourceLanguage || 'pl');
        setReviewRequests(((reviewsResponse.data || []) as MedicalReviewRequest[]).sort((a, b) => getReviewSortTime(b) - getReviewSortTime(a)));
        setForm({
          title: item.title || '',
          description: item.description || '',
          notes: item.notes || '',
          status: item.status || 'stored',
          contextType: item.contextType || 'client',
          purpose: item.purpose || 'general',
          documentStage: item.documentStage || 'entry',
          documentType: item.documentType || 'additional',
          bookingId: getObjectId(item.bookingId),
          ceremonyNumber: item.ceremonyNumber || '',
        });
        const clientId = getObjectId(item.clientId);
        if (clientId) {
          const bookingsResponse = await bookingsApi.getByClient(clientId).catch(() => ({ data: [] as RetreatClient[] }));
          setBookings(bookingsResponse.data || []);
        }
      } finally {
        setLoading(false);
      }
    };
    loadArtifact();
  }, [id]);

  const storagePaths = useMemo(() => {
    return artifact?.files?.map((file) => file.s3Key || file.filePath).filter(Boolean) || [];
  }, [artifact]);

  const previewFiles = useMemo(() => {
    return artifact?.files?.filter((file) => getFileStoredPath(file) && isPreviewableFile(file)) || [];
  }, [artifact]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id) return;
    const requiresBooking = form.documentStage !== 'entry';
    const isCeremonyStage = ceremonyStages.has(form.documentStage);
    if (requiresBooking && !form.bookingId) {
      setError('Select a booking. Only entry-level medical records can be saved without a booking.');
      return;
    }
    if (isCeremonyStage && !form.ceremonyNumber) {
      setError('Pre-, in-, and post-ceremony medical records require a ceremony number.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await medicalArtifactsApi.update(id, {
        ...form,
        bookingId: form.bookingId || undefined,
        ceremonyNumber: isCeremonyStage && form.ceremonyNumber ? Number(form.ceremonyNumber) : undefined,
      });
      setArtifact(response.data);
      if (selectedFiles.length > 0) {
        setUploading(true);
        await medicalArtifactsApi.uploadFiles(id, selectedFiles, {
          reviewRequestNumber: reviewRequests[0]?.display_id,
        });
        setSelectedFiles([]);
        await reloadArtifact();
      }
    } catch (saveError: any) {
      setError(getUploadErrorMessage(saveError));
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const reloadArtifact = async () => {
    if (!id) return;
    const [response, reviewsResponse] = await Promise.all([
      medicalArtifactsApi.getOne(id),
      medicalReviewRequestsApi.getByArtifact(id).catch(() => ({ data: [] })),
    ]);
    setArtifact(response.data);
    setReviewRequests(((reviewsResponse.data || []) as MedicalReviewRequest[]).sort((a, b) => getReviewSortTime(b) - getReviewSortTime(a)));
  };

  const openQuickMrr = async () => {
    try {
      const [users, groups, types] = await Promise.all([usersApi.getAll(), medicalReviewRequestsApi.getGroups(), medicalReviewRequestsApi.getRequestTypes()]);
      const advisors = (users.data || []).filter((item) => item.role === 'medical_advisor' && item.isActive !== false);
      const savedAdvisor = window.localStorage.getItem('provider-plus.default-medical-advisor') || '';
      setQuickMrrAdvisors(advisors);
      setQuickMrrGroups(groups.data || []);
      setQuickMrrTypes(types.data || []);
      setQuickMrr({ requestType: types.data?.[0]?.key || 'general_clearance', advisorId: advisors.some((item) => item._id === savedAdvisor) ? savedAdvisor : advisors.length === 1 ? advisors[0]._id || '' : '', groupId: '' });
      setQuickMrrOpen(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to load the quick MRR form.');
    }
  };

  const createQuickMrr = async () => {
    if (!artifact?._id || !quickMrr.advisorId || !quickMrr.groupId) return;
    setQuickMrrSaving(true);
    try {
      await medicalReviewRequestsApi.createFromArtifact(artifact._id, quickMrr.requestType, { assignedToUserId: quickMrr.advisorId, medicalReviewGroupId: quickMrr.groupId, retreatId: getObjectId(artifact.retreatId) || undefined, clientId: getObjectId(artifact.clientId) || undefined });
      setQuickMrrOpen(false);
      await reloadArtifact();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to create the medical review request.');
    } finally { setQuickMrrSaving(false); }
  };

  const handleUploadFiles = async () => {
    if (!id || selectedFiles.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      await medicalArtifactsApi.uploadFiles(id, selectedFiles, {
        reviewRequestNumber: reviewRequests[0]?.display_id,
      });
      setSelectedFiles([]);
      await reloadArtifact();
    } catch (uploadError: any) {
      setError(getUploadErrorMessage(uploadError));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (file: NonNullable<MedicalArtifact['files']>[number]) => {
    if (!id) return;
    const storedPath = getFileStoredPath(file);
    if (!storedPath) return;
    const confirmed = window.confirm(`Delete ${file.fileName || 'this file'} from this medical artifact?`);
    if (!confirmed) return;

    setDeletingPath(storedPath);
    setError(null);
    try {
      const response = await medicalArtifactsApi.deleteFile(id, storedPath);
      setArtifact(response.data);
    } catch (deleteError: any) {
      setError(deleteError?.response?.data?.message || deleteError?.message || 'Failed to delete this file.');
    } finally {
      setDeletingPath('');
    }
  };

  const handleDeleteArtifact = async () => {
    if (!id || !artifact?._id) return;
    const label = `#${artifact.display_id || artifact._id.slice(-6)} ${artifact.title || getArtifactTypeLabel(artifact.artifactType)}`;
    const confirmed = window.confirm(`Delete medical artifact ${label}? This removes the artifact record from Provider Plus.`);
    if (!confirmed) return;

    setDeletingArtifact(true);
    setError(null);
    try {
      await medicalArtifactsApi.delete(artifact._id);
      navigate(`${routePrefix}/medical-artifacts`);
    } catch (deleteError: any) {
      setError(deleteError?.response?.data?.message || deleteError?.message || 'Failed to delete this medical artifact.');
      setDeletingArtifact(false);
    }
  };

  const handleGenerateEnglish = async () => {
    if (!id) return;
    setTranslating(true);
    setError(null);
    try {
      const response = await medicalArtifactsApi.generateEnglishTranslation(id, translationLanguage, artifact?.translation?.status === 'ready');
      setArtifact(response.data);
    } catch (translationError: any) {
      setError(translationError?.response?.data?.message || translationError?.message || 'English translation could not be generated.');
    } finally {
      setTranslating(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading medical artifact..." />;
  }

  if (!artifact) {
    return (
      <div className="p-6">
        <button onClick={() => navigate(`${routePrefix}/medical-artifacts`)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="mt-6 rounded-md border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">Medical artifact not found.</div>
      </div>
    );
  }

  const artifactId = artifact._id || id || '';
  const requiresBooking = form.documentStage !== 'entry';
  const isCeremonyStage = ceremonyStages.has(form.documentStage);
  const clientLabel = getClientLabel(artifact.clientId);
  const bookingLabel = getObjectId(artifact.bookingId)
    ? (typeof artifact.bookingId === 'object' ? getBookingLabel(artifact.bookingId as RetreatClient) : `Booking #${getObjectId(artifact.bookingId)}`)
    : '-';
  const detailItems = [
    { label: 'Title', value: artifact.title || '-' },
    { label: 'Description', value: artifact.description || '-' },
    { label: 'Type', value: getArtifactTypeLabel(artifact.artifactType) },
    { label: 'Stage', value: documentStageLabels[artifact.documentStage || 'entry'] || artifact.documentStage || '-' },
    { label: 'Client', value: clientLabel },
    { label: 'Retreat', value: artifact.retreatId ? String(typeof artifact.retreatId === 'object' ? (artifact.retreatId as any).name || (artifact.retreatId as any).code || artifact.retreatId._id : artifact.retreatId) : '-' },
    { label: 'Booking', value: bookingLabel },
  ];

  const renderRecordSummary = () => (
    <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {detailItems.map((item) => (
        <div key={item.label} className="rounded-md border border-gray-200 bg-white p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{item.label}</div>
          <div className="mt-1 text-sm font-medium text-gray-900">{item.value}</div>
        </div>
      ))}
    </div>
    {['questionnaire', 'medications_form', 'medication_list', 'food_intake', 'other'].includes(String(artifact.artifactType)) && (
      <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><div className="font-semibold text-blue-950">English advisor version</div><div className="mt-1 text-sm text-blue-900">{artifact.translation?.status === 'ready' ? `Ready · translated from ${artifact.translation.sourceLanguage.toUpperCase()}` : artifact.translation?.status === 'failed' ? `Failed: ${artifact.translation.error || 'Retry translation'}` : 'Generate an English equivalent while preserving the signed original.'}</div></div>
          <div className="flex items-end gap-2"><label className="text-xs font-semibold text-blue-900">Original language<select value={translationLanguage} onChange={(event) => setTranslationLanguage(event.target.value)} className="mt-1 block rounded-md border border-blue-300 bg-white px-3 py-2 text-sm"><option value="pl">Polish</option><option value="cs">Czech</option><option value="de">German</option><option value="es">Spanish</option><option value="fr">French</option><option value="other">Other</option></select></label><button type="button" onClick={handleGenerateEnglish} disabled={translating} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{translating ? 'Generating…' : artifact.translation?.status === 'ready' ? 'Regenerate English' : 'Generate English'}</button></div>
        </div>
        {artifact.translation?.status === 'ready' && <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">AI-generated translation. The original signed submission remains authoritative.</div>}
      </div>
    )}</>
  );

  const renderFilesSection = (mobile = false) => (
    <div className={mobile ? 'md:hidden' : 'hidden md:block'}>
      {mobile ? (
        <details className="border-y border-gray-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-gray-900">
            <span>Files</span>
            <span className="text-xs font-medium text-gray-500">{artifact.files?.length || 0} file(s)</span>
          </summary>
          <div className="px-4 pb-4">
            {artifact.files?.length ? (
              <div className="space-y-3">
                {artifact.files.map((file, index) => {
                  const storedPath = getFileStoredPath(file);
                  return (
                    <div key={`${file.fileName || storedPath || index}`} className="rounded-md border border-gray-200 p-3">
                      <div className="font-medium text-gray-900">{getFileName(file) || `File ${index + 1}`}</div>
                      <div className="mt-1 text-xs text-gray-500">{file.mimeType || 'Unknown type'} · {formatBytes(file.size)}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`${routePrefix}/medical-artifacts/${artifact._id}/files/${index}`)}
                          disabled={!storedPath}
                          className="inline-flex items-center gap-1 rounded-md border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                        >
                          <Eye className="h-3 w-3" />
                          View File
                        </button>
                        {isEditMode && (
                          <button
                            type="button"
                            onClick={() => handleDeleteFile(file)}
                            disabled={!storedPath || deletingPath === storedPath}
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-3 w-3" />
                            {deletingPath === storedPath ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-gray-500">No files attached.</div>
            )}
          </div>
        </details>
      ) : (
        <div className="rounded-md border border-gray-200 bg-white p-4 text-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Files</h2>
          {isEditMode && (
            <div className="mb-4 rounded-md border border-dashed border-gray-300 bg-gray-50 p-3">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <Upload className="h-4 w-4" />
                Upload more files
              </label>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic,.heif"
                onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs"
              />
              {selectedFiles.length > 0 && (
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  {selectedFiles.map((file) => (
                    <div key={`${file.name}-${file.size}`}>{file.name} ({formatBytes(file.size)})</div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={handleUploadFiles}
                disabled={uploading || selectedFiles.length === 0}
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-black disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                {uploading ? 'Uploading...' : 'Upload Selected'}
              </button>
            </div>
          )}
          {artifact.files?.length ? (
            <div className="space-y-3">
              {artifact.files.map((file, index) => {
                const storedPath = getFileStoredPath(file);
                return (
                  <div key={`${file.fileName || storedPath || index}`} className="rounded-md border border-gray-200 p-3">
                    <div className="font-medium text-gray-900">{getFileName(file) || `File ${index + 1}`}</div>
                    <div className="mt-1 text-xs text-gray-500">{file.mimeType || 'Unknown type'} · {formatBytes(file.size)}</div>
                    <div className="mt-2 break-all rounded bg-gray-50 p-2 text-xs text-gray-600">
                      <div className="font-semibold text-gray-500">S3 path</div>
                      {storedPath || 'No storage path recorded'}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`${routePrefix}/medical-artifacts/${artifact._id}/files/${index}`)}
                        disabled={!storedPath}
                        className="inline-flex items-center gap-1 rounded-md border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                      >
                        <Eye className="h-3 w-3" />
                        View File
                      </button>
                      {isEditMode && (
                      <button
                        type="button"
                        onClick={() => handleDeleteFile(file)}
                        disabled={!storedPath || deletingPath === storedPath}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                        {deletingPath === storedPath ? 'Deleting...' : 'Delete'}
                      </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-gray-500">No files attached.</div>
          )}
          {storagePaths.length > 0 && (
            <div className="mt-3 text-xs text-gray-500">Storage paths are recorded from the upload response, so the app does not guess bucket paths later.</div>
          )}
        </div>
      )}
    </div>
  );

  const renderHistorySection = (mobile = false) => (
    <div className={mobile ? 'md:hidden' : 'hidden md:block'}>
      {mobile ? (
        <details className="border-y border-gray-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-gray-900">
            <span>History</span>
            <span className="text-xs font-medium text-gray-500">{reviewRequests.length} review(s)</span>
          </summary>
          <div className="px-4 pb-4">
            {reviewRequests.length > 0 ? (
              <div className="space-y-3">
                {reviewRequests.map((request) => (
                  <div key={request._id} className="rounded-md border border-gray-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`${routePrefix}/medical-review-requests/${request._id}`)}
                        className="text-left text-sm font-semibold text-blue-700 hover:text-blue-900"
                      >
                        Medical Review #{request.display_id || request._id}
                      </button>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        {String(getReviewDecision(request)).replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="mt-1 text-xs capitalize text-gray-500">
                      {getReviewRequestLabel(request)} · {request.status?.replace(/_/g, ' ') || 'pending'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-3 text-gray-600">
                No medical review requests are linked to this artifact.
              </div>
            )}
          </div>
        </details>
      ) : (
        <section className="mt-6 rounded-md border border-gray-200 bg-white p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Medical Review History</h2>
              <p className="text-sm text-gray-500">All medical review requests linked to this artifact.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`${routePrefix}/medical-review-requests/new?artifactId=${artifact._id}`)}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Create MRR
            </button>
          </div>

          {reviewRequests.length > 0 ? (
            <div className="space-y-4">
              {reviewRequests.map((request) => (
                <div key={request._id} className="rounded-md border border-gray-200 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <button
                        type="button"
                        onClick={() => navigate(`${routePrefix}/medical-review-requests/${request._id}`)}
                        className="text-left text-base font-semibold text-blue-700 hover:text-blue-900"
                      >
                        Medical Review #{request.display_id || request._id}
                      </button>
                      <div className="mt-1 text-sm capitalize text-gray-600">
                        {getReviewRequestLabel(request)} · Attempt {request.attemptNumber || 1}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold capitalize text-gray-700">
                        {request.status?.replace(/_/g, ' ') || 'pending'}
                      </span>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        {String(getReviewDecision(request)).replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Requested</dt>
                      <dd className="mt-1 text-gray-900">{formatDateTime(request.requestedAt || request.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Assigned</dt>
                      <dd className="mt-1 text-gray-900">{request.assignedToEmail || request.medicalReviewerName || request.assignedTo || '-'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reviewed</dt>
                      <dd className="mt-1 text-gray-900">{formatDateTime(request.reviewedAt || request.decisionDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reviewer</dt>
                      <dd className="mt-1 text-gray-900">{request.reviewedBy || '-'}</dd>
                    </div>
                  </dl>

                  {(request.reviewNotes || request.overallNotes || request.medicalStaffNotes) && (
                    <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                      {request.reviewNotes && (
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Review Notes</div>
                          <div className="mt-1 whitespace-pre-wrap text-gray-800">{request.reviewNotes}</div>
                        </div>
                      )}
                      {request.overallNotes && (
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Overall Notes</div>
                          <div className="mt-1 whitespace-pre-wrap text-gray-800">{request.overallNotes}</div>
                        </div>
                      )}
                      {request.medicalStaffNotes && (
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Medical Staff Notes</div>
                          <div className="mt-1 whitespace-pre-wrap text-gray-800">{request.medicalStaffNotes}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {request.decisionHistory?.length ? (
                    <div className="mt-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Decision History</div>
                      <div className="space-y-2">
                        {request.decisionHistory.map((entry, index) => (
                          <div key={`${entry.reviewedAt || index}`} className="rounded-md bg-gray-50 p-3 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold capitalize text-gray-900">{entry.status?.replace(/_/g, ' ') || 'updated'}</span>
                              {entry.decision && <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-700">{entry.decision}</span>}
                              <span className="text-xs text-gray-500">{formatDateTime(entry.reviewedAt)}</span>
                              {entry.reviewedBy && <span className="text-xs text-gray-500">by {entry.reviewedBy}</span>}
                            </div>
                            {(entry.notes || entry.overallNotes || entry.medicalStaffNotes) && (
                              <div className="mt-2 whitespace-pre-wrap text-gray-700">
                                {[entry.notes, entry.overallNotes, entry.medicalStaffNotes].filter(Boolean).join('\n')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
              <div className="font-medium text-gray-700">No medical reviews yet.</div>
              <div className="mt-1 text-sm text-gray-500">Create a medical review request to send this artifact for review.</div>
            </div>
          )}
        </section>
      )}
    </div>
  );

  return (
    <div className="medical-artifact-page -mx-4 px-4 pb-6 sm:mx-0 sm:p-6">
      <div className="medical-artifact-page-actions mb-4 flex items-start justify-between gap-3 sm:mb-6">
        <button onClick={() => navigate(`${routePrefix}/medical-artifacts`)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={() => setCaptureMode((current) => !current)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Camera className="h-4 w-4" />
            {captureMode ? 'Exit capture mode' : 'Capture full page'}
          </button>
          {!isEditMode && (
            <button onClick={() => navigate(`${routePrefix}/medical-artifacts/${artifact._id}/edit`)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <Edit className="h-4 w-4" />
              Edit
            </button>
          )}
          <button onClick={openQuickMrr} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" />
            Quick MRR
          </button>
          <button onClick={() => navigate(`${routePrefix}/medical-review-requests/new?artifactId=${artifact._id}`)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Plus className="h-4 w-4" />
            Full MRR
          </button>
          {routePrefix === '/admin' && (
            <button
              type="button"
              onClick={handleDeleteArtifact}
              disabled={deletingArtifact}
              className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {deletingArtifact ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </div>
      {quickMrrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="quick-mrr-title">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="quick-mrr-title" className="text-lg font-semibold">Quick medical review request</h2>
              <button type="button" aria-label="Close" onClick={() => setQuickMrrOpen(false)} className="text-2xl leading-none text-gray-500 hover:text-gray-900">×</button>
            </div>
            <p className="mb-4 text-sm text-gray-500">Assign this artifact without opening the full request editor.</p>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Request type
                <select className="mt-1 w-full rounded border p-2" value={quickMrr.requestType} onChange={(e) => setQuickMrr({ ...quickMrr, requestType: e.target.value as NonNullable<MedicalReviewRequest['requestType']> })}>
                  {(quickMrrTypes.length ? quickMrrTypes : [
                    { key: 'ekg_review', label: 'EKG' },
                    { key: 'liver_panel_review', label: 'Liver panel' },
                    { key: 'medications_review', label: 'Medications' },
                    { key: 'questionnaire_review', label: 'Questionnaire' },
                    { key: 'general_clearance', label: 'General clearance' },
                  ]).map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">Medical advisor
                <select className="mt-1 w-full rounded border p-2" value={quickMrr.advisorId} onChange={(e) => { window.localStorage.setItem('provider-plus.default-medical-advisor', e.target.value); setQuickMrr({ ...quickMrr, advisorId: e.target.value }); }}>
                  <option value="">Select advisor</option>
                  {quickMrrAdvisors.map((item) => <option key={item._id} value={item._id}>{[item.firstName, item.lastName].filter(Boolean).join(' ') || item.email}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">Review pocket
                <select className="mt-1 w-full rounded border p-2" value={quickMrr.groupId} onChange={(e) => setQuickMrr({ ...quickMrr, groupId: e.target.value })}>
                  <option value="">Select pocket</option>
                  {quickMrrGroups.map((group) => <option key={group._id} value={group._id}>{group.title}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setQuickMrrOpen(false)} className="rounded border px-3 py-2">Cancel</button>
              <button type="button" onClick={createQuickMrr} disabled={quickMrrSaving || !quickMrr.advisorId || !quickMrr.groupId} className="rounded bg-blue-600 px-3 py-2 font-medium text-white disabled:opacity-50">{quickMrrSaving ? 'Creating…' : 'Assign MRR'}</button>
            </div>
          </div>
        </div>
      )}
      <div className="mb-5 space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">Medical Artifact #{artifact.display_id || '-'}</h1>
        <p className="text-sm text-gray-600">{getArtifactTypeLabel(artifact.artifactType)} for {clientLabel}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 lg:col-span-2">
            {error}
          </div>
        )}
        <div className="md:hidden lg:col-span-2">
          <div className="border-y border-gray-200 bg-white px-4 py-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Quick Info</div>
            {renderRecordSummary()}
          </div>
        </div>
        {isEditMode ? (
          <form onSubmit={handleSave} className="space-y-4 rounded-none border-x-0 border-y border-gray-200 bg-white p-4 md:rounded-md md:border">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-gray-700">
                Title
                <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Status
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ArtifactStatus })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="stored">Stored</option>
                  <option value="pending_review">Pending Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="needs_resubmission">Needs Resubmission</option>
                  <option value="superseded">Superseded</option>
                  <option value="voided">Voided</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Context
                <select value={form.contextType} onChange={(event) => setForm({ ...form, contextType: event.target.value as typeof form.contextType })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  {Object.entries(contextTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Document stage
                <select
                  value={form.documentStage}
                  onChange={(event) => {
                    const nextStage = event.target.value as typeof form.documentStage;
                    setForm({
                      ...form,
                      documentStage: nextStage,
                      ceremonyNumber: ceremonyStages.has(nextStage) ? form.ceremonyNumber : '',
                    });
                  }}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {Object.entries(documentStageLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Document type
                <select value={form.documentType} onChange={(event) => setForm({ ...form, documentType: event.target.value as typeof form.documentType })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  {Object.entries(documentTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Booking {requiresBooking && <span className="text-red-600">*</span>}
                <select
                  value={form.bookingId}
                  onChange={(event) => setForm({ ...form, bookingId: event.target.value })}
                  required={requiresBooking}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">{requiresBooking ? 'Select booking' : 'No booking link'}</option>
                  {bookings.map((booking) => (
                    <option key={booking._id} value={booking._id}>{getBookingLabel(booking)}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Ceremony # {isCeremonyStage && <span className="text-red-600">*</span>}
                <input
                  type="number"
                  min="1"
                  value={form.ceremonyNumber}
                  onChange={(event) => setForm({ ...form, ceremonyNumber: event.target.value ? Number(event.target.value) : '' })}
                  disabled={!isCeremonyStage}
                  required={isCeremonyStage}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                  placeholder="1"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Purpose
                <select value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value as typeof form.purpose })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  {Object.entries(purposeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block text-sm font-medium text-gray-700">
              Description
              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Short description of what this artifact contains" />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Admin notes
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={6} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Internal notes about this artifact" />
            </label>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => navigate(`${routePrefix}/medical-artifacts/${artifact._id}`)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={saving || uploading || !form.title.trim()} className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50">
                <Save className="h-4 w-4" />
                {uploading ? 'Uploading files...' : saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {artifact.data?.answers && Object.keys(artifact.data.answers).length > 0 && (
              <section className="rounded-none border-x-0 border-y border-gray-200 bg-white p-4 md:rounded-md md:border" aria-labelledby="artifact-answers-heading">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h2 id="artifact-answers-heading" className="text-sm font-semibold uppercase tracking-wide text-gray-500">Submitted answers</h2>
                    <p className="mt-1 text-xs text-gray-500">Question-and-answer data saved with this medical artifact.</p>
                  </div>
                  {artifact.data.language && <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">Language: {String(artifact.data.language).toUpperCase()}</span>}
                </div>
                <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
                  {Object.entries(artifact.data.answers as Record<string, any>).filter(([key]) => key !== 'pretty').map(([key, value]) => (
                    <div key={key} className="grid gap-1 px-3 py-3 sm:grid-cols-[minmax(180px,0.35fr)_minmax(0,1fr)] sm:gap-4">
                      <div className="text-sm font-semibold text-gray-700">{readableAnswerKey(key)}</div>
                      <div className="whitespace-pre-wrap break-words text-sm text-gray-900">{formatAnswerValue(value)}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {previewFiles.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Preview</h2>
                {previewFiles.map((file, index) => (
                  <MedicalArtifactInlinePreview
                    key={`${getFileStoredPath(file)}-${index}`}
                    artifactId={artifactId}
                    file={file}
                  />
                ))}
              </div>
            )}
            <div className="space-y-4 rounded-none border-x-0 border-y border-gray-200 bg-white p-4 text-sm md:rounded-md md:border">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Title</div>
                <div className="mt-1 text-base font-semibold text-gray-900">{artifact.title || '-'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Description</div>
                <div className="mt-1 whitespace-pre-wrap text-gray-800">{artifact.description || '-'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Admin Notes</div>
                <div className="mt-1 whitespace-pre-wrap text-gray-800">{artifact.notes || '-'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</div>
                <div className="mt-1 capitalize text-gray-900">{artifact.status || 'stored'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Document Stage</div>
                <div className="mt-1 text-gray-900">{documentStageLabels[artifact.documentStage || 'entry'] || artifact.documentStage || '-'}</div>
              </div>
            </div>
          </div>
        )}

        <aside className="hidden space-y-4 md:block">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Record</h2>
            <dl className="space-y-2">
              <div><dt className="text-gray-500">Client</dt><dd className="font-medium text-gray-900">{getClientLabel(artifact.clientId)}</dd></div>
              <div><dt className="text-gray-500">Type</dt><dd className="font-medium text-gray-900">{getArtifactTypeLabel(artifact.artifactType)}</dd></div>
              <div><dt className="text-gray-500">Document stage</dt><dd className="font-medium text-gray-900">{documentStageLabels[artifact.documentStage || 'entry'] || artifact.documentStage || '-'}</dd></div>
              <div>
                <dt className="text-gray-500">Booking</dt>
                <dd className="font-medium text-gray-900">
                  {getObjectId(artifact.bookingId) ? (
                    <button type="button" onClick={() => navigate(`${routePrefix}/bookings/${getObjectId(artifact.bookingId)}`)} className="text-blue-700 hover:text-blue-900 hover:underline">
                      {typeof artifact.bookingId === 'object' ? getBookingLabel(artifact.bookingId as RetreatClient) : artifact.bookingId}
                    </button>
                  ) : (
                    '-'
                  )}
                </dd>
              </div>
              <div><dt className="text-gray-500">Ceremony #</dt><dd className="font-medium text-gray-900">{artifact.ceremonyNumber || '-'}</dd></div>
              <div><dt className="text-gray-500">Context</dt><dd className="font-medium text-gray-900">{contextTypeLabels[artifact.contextType || 'client']}</dd></div>
              <div><dt className="text-gray-500">Purpose</dt><dd className="font-medium text-gray-900">{purposeLabels[artifact.purpose || 'general']}</dd></div>
              {artifact.reviewFeeAmount ? (
                <div>
                  <dt className="text-gray-500">Review Fee</dt>
                  <dd className="font-medium text-gray-900">
                    {artifact.reviewFeeAmount} {artifact.reviewFeeCurrency || 'EUR'} · {artifact.reviewFeePaid ? 'Paid' : 'Due'}
                  </dd>
                </div>
              ) : null}
              <div><dt className="text-gray-500">Received</dt><dd className="font-medium text-gray-900">{artifact.receivedAt ? new Date(artifact.receivedAt).toLocaleString() : '-'}</dd></div>
              <div><dt className="text-gray-500">Source</dt><dd className="font-medium capitalize text-gray-900">{artifact.source || 'manual'}</dd></div>
              <div><dt className="text-gray-500">Version</dt><dd className="font-medium text-gray-900">{artifact.version || 1}</dd></div>
            </dl>
          </div>
        </aside>
      </div>
      {renderFilesSection(true)}
      {renderHistorySection(true)}
      {renderFilesSection(false)}
      {renderHistorySection(false)}
    </div>
  );
};

export default MedicalArtifactDetailPage;
