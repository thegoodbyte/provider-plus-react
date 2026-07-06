import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { configSummaryApi, fileUploadsApi } from '../services/api';
import { FileUpload } from '../types';
import LoadingSpinner from './LoadingSpinner';

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
        <img src={previewUrl} alt={file.originalFileName} className="h-full w-full object-cover" />
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [filesResponse, configResponse] = await Promise.all([
        fileUploadsApi.getAll({ isActive: true }),
        configSummaryApi.get().catch(() => null),
      ]);
      setFiles(filesResponse.data || []);
      setConfigSummary(configResponse?.data || null);
    } finally {
      setLoading(false);
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
        <button onClick={loadData} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
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

      <div className="mb-6 rounded-md border border-gray-200 bg-white p-4">
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
      </div>

      <div className="overflow-hidden rounded-md border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Uploaded</th>
              <th className="px-4 py-3">Preview</th>
              <th className="px-4 py-3">Original Name</th>
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3">Stored Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Thumbnail</th>
              <th className="px-4 py-3">Path</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filteredFiles.map((file) => (
              <tr key={file._id || file.fileHash} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-gray-700">{file.uploadedAt ? new Date(file.uploadedAt).toLocaleString() : '-'}</td>
                <td className="px-4 py-3 text-gray-700"><FilePreview file={file} /></td>
                <td className="px-4 py-3 font-medium text-gray-900">{file.originalFileName}</td>
                <td className="px-4 py-3">
                  <div className="capitalize text-gray-900">{file.documentKind.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-gray-500">{file.section || file.foreignKey}</div>
                </td>
                <td className="px-4 py-3 text-gray-700">{file.storedFileName}</td>
                <td className="px-4 py-3 text-gray-700">{file.mimeType}</td>
                <td className="px-4 py-3 text-gray-700">{formatBytes(file.fileSize)}</td>
                <td className="px-4 py-3 text-gray-700">
                  {file.thumbnailPath ? (
                    <div>
                      <div>{file.thumbnailFileName || 'Thumbnail'}</div>
                      <div className="text-xs text-gray-500">{file.thumbnailConfig?.width || 160} x {file.thumbnailConfig?.height || 120}</div>
                    </div>
                  ) : '-'}
                </td>
                <td className="max-w-xs break-all px-4 py-3 text-xs text-gray-600">{file.filePath}</td>
              </tr>
            ))}
            {filteredFiles.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-gray-500" colSpan={9}>No file uploads found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FileUploadsPage;
