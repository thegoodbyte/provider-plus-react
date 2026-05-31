import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import FileBlobViewer from './FileBlobViewer';
import { medicalArtifactsApi } from '../services/api';
import { MedicalArtifact } from '../types';

const getStoredPath = (file: NonNullable<MedicalArtifact['files']>[number]) => file.s3Key || file.filePath || '';

const MedicalArtifactFileViewPage: React.FC = () => {
  const { id, fileIndex } = useParams<{ id: string; fileIndex: string }>();
  const navigate = useNavigate();
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('Medical artifact file');
  const [contentType, setContentType] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const index = useMemo(() => Number(fileIndex || 0), [fileIndex]);

  useEffect(() => {
    let active = true;
    let createdUrl = '';

    const load = async () => {
      if (!id || !Number.isFinite(index)) return;

      try {
        setIsLoading(true);
        setError(null);

        const artifactResponse = await medicalArtifactsApi.getOne(id);
        const artifact = artifactResponse.data;
        const file = artifact.files?.[index];
        if (!file) {
          throw new Error('File not found on this medical artifact.');
        }

        const storedPath = getStoredPath(file);
        if (!storedPath) {
          throw new Error('No storage path is recorded for this file.');
        }

        setFileName(file.fileName || storedPath.split('/').pop() || 'Medical artifact file');
        const response = await medicalArtifactsApi.getFileBlob(id, storedPath);
        const blob = response.data as Blob;
        setContentType(blob.type || response.headers?.['content-type'] || file.mimeType || '');
        createdUrl = URL.createObjectURL(blob);
        if (active) setFileUrl(createdUrl);
      } catch (loadError: any) {
        console.error('Error loading medical artifact file:', loadError);
        if (active) setError(loadError?.response?.data?.message || loadError?.message || 'Unable to load the file.');
      } finally {
        if (active) setIsLoading(false);
      }
    };

    load();

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [id, index]);

  return (
    <FileBlobViewer
      title="Medical Artifact File"
      fileName={fileName}
      fileUrl={fileUrl}
      contentType={contentType}
      isLoading={isLoading}
      error={error}
      onBack={() => navigate(-1)}
    />
  );
};

export default MedicalArtifactFileViewPage;
