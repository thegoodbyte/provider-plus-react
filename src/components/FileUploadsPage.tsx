import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { configSummaryApi, fileUploadsApi, storageSettingsApi, S3ReadOverrideSettings } from '../services/api';
import { FileUpload } from '../types';
import LoadingSpinner from './LoadingSpinner';
import AppleButton from './AppleButton';
import { Card, Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from './ui';

const formatBytes = (size?: number) => {
  if (!size) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const isImageFile = (file: FileUpload) =>
  file.mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(file.originalFileName || file.storedFileName || '');

const isPdfFile = (file: FileUpload) =>
  file.mimeType?.includes('pdf') || /\.pdf$/i.test(file.originalFileName || file.storedFileName || '');

const FilePreview: React.FC<{ file: FileUpload }> = ({ file }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState('');
  const canPreview = isImageFile(file) || isPdfFile(file);

  useEffect(() => {
    let active = true;
    let objectUrl = '';

    const loadPreview = async () => {
      if (!canPreview || !file.fileHash) return;
      try {
        setPreviewError('');
        const response = await fileUploadsApi.getViewBlob(file.fileHash);
        objectUrl = URL.createObjectURL(response.data as Blob);
        if (active) setPreviewUrl(objectUrl);
      } catch (error: any) {
        console.error('Error loading file preview:', error);
        if (active) {
          setPreviewError(error?.response?.data?.message || error?.message || 'Preview unavailable');
        }
      }
    };

    loadPreview();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [canPreview, file.fileHash]);

  if (!canPreview) {
    return <div className="text-xs text-gray-400">No preview</div>;
  }

  if (previewError) {
    return (
      <div className="max-w-[120px] text-xs text-red-500" title={previewError}>
        Preview unavailable
      </div>
    );
  }

  if (!previewUrl) {
    return <div className="text-xs text-gray-400">Loading...</div>;
  }

  if (isImageFile(file)) {
    return (
      <a href={previewUrl} target="_blank" rel="noreferrer" className="block h-20 w-20 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
        <img src={previewUrl} alt={file.originalFileName} className="h-full w-full object-cover" loading="lazy" />
      </a>
    );
  }

  return (
    <a href={previewUrl} target="_blank" rel="noreferrer" className="block h-20 w-20 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
      <iframe src={previewUrl} title={file.originalFileName} className="h-full w-full pointer-events-none border-0" />
    </a>
  );
};

const FileUploadsPage: React.FC = () => {
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [configSummary, setConfigSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<'all' | FileUpload['documentKind']>('all');
  const [s3Override, setS3Override] = useState<S3ReadOverrideSettings | null>(null);
  const [s3OverrideForm, setS3OverrideForm] = useState({ enabled: false, bucketOverride: '', reason: '', expiresAt: '' });
  const [s3OverrideSaving, setS3OverrideSaving] = useState(false);
  const [s3OverrideError, setS3OverrideError] = useState('');

  const applyS3OverrideToForm = (settings: S3ReadOverrideSettings) => {
    setS3Override(settings);
    setS3OverrideForm({
      enabled: settings.enabled,
      bucketOverride: settings.bucketOverride || '',
      reason: settings.reason || '',
      expiresAt: settings.expiresAt ? new Date(settings.expiresAt).toISOString().slice(0, 16) : '',
    });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [filesResponse, configResponse, s3OverrideResponse] = await Promise.all([
        fileUploadsApi.getAll({ isActive: true }),
        configSummaryApi.get().catch(() => null),
        storageSettingsApi.getS3ReadOverride().catch(() => null),
      ]);
      setFiles(filesResponse.data || []);
      setConfigSummary(configResponse?.data || null);
      if (s3OverrideResponse?.data) applyS3OverrideToForm(s3OverrideResponse.data);
    } finally {
      setLoading(false);
    }
  };

  const saveS3Override = async () => {
    setS3OverrideSaving(true);
    setS3OverrideError('');
    try {
      const response = await storageSettingsApi.updateS3ReadOverride({
        enabled: s3OverrideForm.enabled,
        bucketOverride: s3OverrideForm.bucketOverride,
        reason: s3OverrideForm.reason,
        expiresAt: s3OverrideForm.expiresAt ? new Date(s3OverrideForm.expiresAt).toISOString() : undefined,
      });
      applyS3OverrideToForm(response.data);
    } catch (error: any) {
      setS3OverrideError(error?.response?.data?.message || 'Failed to save the S3 read override.');
    } finally {
      setS3OverrideSaving(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredFiles = useMemo(() => {
    if (kindFilter === 'all') return files;
    return files.filter((file) => file.documentKind === kindFilter);
  }, [files, kindFilter]);

  if (loading) {
    return <LoadingSpinner message="Loading file uploads..." />;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">File Uploads</h1>
          <p className="text-sm text-gray-600">Registry of uploaded files, storage paths, thumbnails, sizes, and related records.</p>
        </div>
        <AppleButton variant="secondary" onClick={loadData}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </AppleButton>
      </div>

      <div className="mb-4">
        <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as typeof kindFilter)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="all">All sections</option>
          <option value="medical_artifact">Medical artifacts</option>
          <option value="medical_tracking">Medical tracking</option>
          <option value="client_medical">Client medical</option>
          <option value="client_profile_picture">Client profile pictures</option>
          <option value="retreat_document">Retreat documents</option>
          <option value="other">Other</option>
        </select>
      </div>

      <Card className="mb-6">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Upload Storage Config</h2>
          <p className="text-sm text-gray-600">Current generated paths for uploaded files. Use this to review the bucket layout before changing directory conventions.</p>
        </div>

        {configSummary ? (
          <div className="grid gap-4 text-sm md:grid-cols-2">
            <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
              <div><strong>Provider:</strong> {configSummary.storage?.provider || 'unavailable'}</div>
              <div><strong>Bucket:</strong> {configSummary.storage?.bucket || 'not configured'}</div>
              <div><strong>Region:</strong> {configSummary.storage?.region || '-'}</div>
              <div><strong>S3 variables:</strong> {configSummary.storage?.s3Configured ? 'configured' : 'missing'}</div>
              <div><strong>S3 connection:</strong> {configSummary.storage?.connectionOk ? 'reachable' : 'not verified / failing'}</div>
              {configSummary.storage?.connectionError && (
                <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-red-700">
                  <div><strong>{configSummary.storage.connectionError.name || 'S3 error'}</strong></div>
                  <div>{configSummary.storage.connectionError.message}</div>
                </div>
              )}
            </div>
            <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
              <div><strong>Thumbnail size:</strong> {configSummary.uploads?.thumbnailWidth || 160} x {configSummary.uploads?.thumbnailHeight || 120}</div>
              <div><strong>Required env:</strong> {configSummary.storage?.requiredEnvironment?.join(', ') || '-'}</div>
            </div>
            {(configSummary.uploads?.sections || []).map((section: any) => (
              <div key={section.section} className="rounded-md border border-gray-100 bg-gray-50 p-3 md:col-span-2">
                <div className="mb-2 font-semibold text-gray-900">{section.section}</div>
                <div className="break-all"><strong>Document kind:</strong> {section.documentKind}</div>
                <div className="break-all"><strong>File path:</strong> {section.filePathPattern}</div>
                <div className="break-all"><strong>Thumbnail path:</strong> {section.thumbnailPathPattern}</div>
                {section.examples?.length > 0 && (
                  <div className="mt-2">
                    <div className="font-medium text-gray-700">Examples</div>
                    {section.examples.map((example: string) => (
                      <div key={example} className="break-all font-mono text-xs text-gray-600">{example}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Configuration summary is only visible to admins or could not be loaded.</p>
        )}
      </Card>

      {configSummary && configSummary.runtime?.nodeEnv !== 'production' && (
        <Card className="mb-6">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-gray-900">S3 Read Override (PPVC-64)</h2>
            <p className="text-sm text-gray-600">
              Temporarily point file <strong>reads</strong> (viewing/downloading) at a different bucket -- e.g. prod's -- to
              inspect data brought into this environment. Uploads always go to this environment's own bucket regardless of
              this setting. Not available in production.
            </p>
          </div>

          <div className="grid gap-3 text-sm md:grid-cols-2">
            <label className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={s3OverrideForm.enabled}
                onChange={(event) => setS3OverrideForm((current) => ({ ...current, enabled: event.target.checked }))}
              />
              <span className="font-medium text-gray-900">Enable read override</span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Bucket to read from</span>
              <input
                type="text"
                value={s3OverrideForm.bucketOverride}
                onChange={(event) => setS3OverrideForm((current) => ({ ...current, bucketOverride: event.target.value }))}
                placeholder="e.g. prod-provider-plus-uploads"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Reason (for the audit log)</span>
              <input
                type="text"
                value={s3OverrideForm.reason}
                onChange={(event) => setS3OverrideForm((current) => ({ ...current, reason: event.target.value }))}
                placeholder="e.g. investigating PPVC-123"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Expires at (defaults to +24h if left blank)</span>
              <input
                type="datetime-local"
                value={s3OverrideForm.expiresAt}
                onChange={(event) => setS3OverrideForm((current) => ({ ...current, expiresAt: event.target.value }))}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          {s3OverrideError && <p className="mt-3 text-sm text-red-600">{s3OverrideError}</p>}
          {s3Override?.enabled && (
            <p className="mt-3 flex items-center gap-2 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              Currently reading from <strong>{s3Override.bucketOverride}</strong>
              {s3Override.expiresAt && <> until {new Date(s3Override.expiresAt).toLocaleString()}</>}.
            </p>
          )}

          <AppleButton
            variant="secondary"
            className="mt-4"
            onClick={saveS3Override}
            disabled={s3OverrideSaving}
          >
            {s3OverrideSaving ? 'Saving...' : 'Save'}
          </AppleButton>
        </Card>
      )}

      <Card padding="none" className="overflow-hidden">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Uploaded</TableHeaderCell>
              <TableHeaderCell>Preview</TableHeaderCell>
              <TableHeaderCell>Original Name</TableHeaderCell>
              <TableHeaderCell>Section</TableHeaderCell>
              <TableHeaderCell>Stored Name</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Size</TableHeaderCell>
              <TableHeaderCell>Thumbnail</TableHeaderCell>
              <TableHeaderCell>Path</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredFiles.map((file) => (
              <TableRow key={file._id || file.fileHash}>
                <TableCell className="whitespace-nowrap">{file.uploadedAt ? new Date(file.uploadedAt).toLocaleString() : '-'}</TableCell>
                <TableCell><FilePreview file={file} /></TableCell>
                <TableCell className="font-medium text-gray-900">{file.originalFileName}</TableCell>
                <TableCell>
                  <div className="capitalize text-gray-900">{file.documentKind.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-gray-500">{file.section || file.foreignKey}</div>
                </TableCell>
                <TableCell>{file.storedFileName}</TableCell>
                <TableCell>{file.mimeType}</TableCell>
                <TableCell>{formatBytes(file.fileSize)}</TableCell>
                <TableCell>
                  {file.thumbnailPath ? (
                    <div>
                      <div>{file.thumbnailFileName || 'Thumbnail'}</div>
                      <div className="text-xs text-gray-500">{file.thumbnailConfig?.width || 160} x {file.thumbnailConfig?.height || 120}</div>
                    </div>
                  ) : '-'}
                </TableCell>
                <TableCell className="max-w-xs break-all text-xs text-gray-600">{file.filePath}</TableCell>
              </TableRow>
            ))}
            {filteredFiles.length === 0 && (
              <TableRow>
                <TableCell className="py-8 text-center text-gray-500" colSpan={9}>No file uploads found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default FileUploadsPage;
