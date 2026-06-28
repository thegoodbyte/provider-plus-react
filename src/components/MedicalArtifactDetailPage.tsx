import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, Eye, Plus, Save, Trash2, Upload } from 'lucide-react';
import { medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';
import { Client, MedicalArtifact, MedicalReviewRequest } from '../types';
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

const getClientLabel = (client?: string | Client) => {
  if (!client || typeof client === 'string') return client || 'Unknown client';
  const name = [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ');
  return [`#${client.display_id || '-'}`, name || client.email || 'Unknown client'].filter(Boolean).join(' ');
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingPath, setDeletingPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [reviewRequests, setReviewRequests] = useState<MedicalReviewRequest[]>([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    notes: '',
    status: 'stored' as ArtifactStatus,
    contextType: 'client' as NonNullable<MedicalArtifact['contextType']>,
    purpose: 'general' as NonNullable<MedicalArtifact['purpose']>,
    documentStage: 'entry' as NonNullable<MedicalArtifact['documentStage']>,
    documentType: 'additional' as NonNullable<MedicalArtifact['documentType']>,
  });

  useEffect(() => {
    const loadArtifact = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const response = await medicalArtifactsApi.getOne(id);
        const reviewsResponse = await medicalReviewRequestsApi.getByArtifact(id).catch(() => ({ data: [] }));
        const item = response.data;
        setArtifact(item);
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
        });
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
    setSaving(true);
    setError(null);
    try {
      const response = await medicalArtifactsApi.update(id, form);
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

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Medical Artifact #{artifact.display_id || '-'}</h1>
          <p className="text-sm text-gray-600">{getArtifactTypeLabel(artifact.artifactType)} for {getClientLabel(artifact.clientId)}</p>
        </div>
        <div className="flex items-center gap-2">
          {!isEditMode && (
            <button onClick={() => navigate(`${routePrefix}/medical-artifacts/${artifact._id}/edit`)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <Edit className="h-4 w-4" />
              Edit
            </button>
          )}
          <button onClick={() => navigate(`${routePrefix}/medical-review-requests/new?artifactId=${artifact._id}`)} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" />
            Create Medical Review
          </button>
          <button onClick={() => navigate(`${routePrefix}/medical-artifacts`)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 lg:col-span-2">
            {error}
          </div>
        )}
        {isEditMode ? (
          <form onSubmit={handleSave} className="space-y-4 rounded-md border border-gray-200 bg-white p-4">
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
                <select value={form.documentStage} onChange={(event) => setForm({ ...form, documentStage: event.target.value as typeof form.documentStage })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
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

            <div className="space-y-4 rounded-md border border-gray-200 bg-white p-4 text-sm">
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
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Document Stage</div>
                  <div className="mt-1 text-gray-900">{documentStageLabels[artifact.documentStage || 'entry'] || artifact.documentStage || '-'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Document Type</div>
                  <div className="mt-1 text-gray-900">{documentTypeLabels[artifact.documentType || 'additional'] || artifact.documentType || '-'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <aside className="space-y-4">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Record</h2>
            <dl className="space-y-2">
              <div><dt className="text-gray-500">Client</dt><dd className="font-medium text-gray-900">{getClientLabel(artifact.clientId)}</dd></div>
              <div><dt className="text-gray-500">Type</dt><dd className="font-medium text-gray-900">{getArtifactTypeLabel(artifact.artifactType)}</dd></div>
              <div><dt className="text-gray-500">Document stage</dt><dd className="font-medium text-gray-900">{documentStageLabels[artifact.documentStage || 'entry'] || artifact.documentStage || '-'}</dd></div>
              <div><dt className="text-gray-500">Document type</dt><dd className="font-medium text-gray-900">{documentTypeLabels[artifact.documentType || 'additional'] || artifact.documentType || '-'}</dd></div>
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
        </aside>
      </div>

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
            Create Medical Review
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
    </div>
  );
};

export default MedicalArtifactDetailPage;
