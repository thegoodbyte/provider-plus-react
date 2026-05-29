import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { fileUploadsApi } from '../services/api';
import { FileUpload } from '../types';
import LoadingSpinner from './LoadingSpinner';

const formatBytes = (size?: number) => {
  if (!size) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const FileUploadsPage: React.FC = () => {
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<'all' | FileUpload['documentKind']>('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fileUploadsApi.getAll({ isActive: true });
      setFiles(response.data || []);
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
          <option value="retreat_document">Retreat documents</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-md border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Uploaded</th>
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
                <td className="px-4 py-8 text-center text-gray-500" colSpan={8}>No file uploads found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FileUploadsPage;
