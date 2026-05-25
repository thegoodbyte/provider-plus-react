import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { medicalTrackingApi, clientMedicalApi } from '../services/api';
import FileBlobViewer from './FileBlobViewer';

const MedicalTrackingFileViewPage: React.FC = () => {
  const { id, type } = useParams<{ id: string; type: 'ekg' | 'liver-panel' }>();
  const navigate = useNavigate();
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [contentType, setContentType] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const normalizedType = type === 'liver-panel' ? 'liver-panel' : 'ekg';
  const title = useMemo(() => (normalizedType === 'ekg' ? 'EKG' : 'Liver Panel'), [normalizedType]);

  useEffect(() => {
    const load = async () => {
      if (!id) return;

      try {
        setIsLoading(true);
        setError(null);

        const record = await medicalTrackingApi.getOne(id);
        const current = record.data as any;
        const filePath = normalizedType === 'ekg' ? current.ekgFilePath : current.liverPanelFilePath;
        const currentFileName = normalizedType === 'ekg' ? current.ekgFileName : current.liverPanelFileName;
        setFileName(currentFileName || 'File');

        const response = await clientMedicalApi.getFileBlob(id, normalizedType);
        const blob = response.data as Blob;
        setContentType(blob.type || response.headers?.['content-type'] || '');

        if (filePath && !currentFileName) {
          setFileName(filePath.split('/').pop() || 'File');
        }

        const objectUrl = URL.createObjectURL(blob);
        setFileUrl(objectUrl);
      } catch (loadError: any) {
        console.error('Error loading medical file:', loadError);
        setError(loadError?.response?.data?.message || 'Unable to load the file.');
      } finally {
        setIsLoading(false);
      }
    };

    load();
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, normalizedType]);

  return (
    <FileBlobViewer
      title={`${title} File`}
      fileName={fileName}
      fileUrl={fileUrl}
      contentType={contentType}
      isLoading={isLoading}
      error={error}
      onBack={() => navigate(-1)}
    />
  );
};

export default MedicalTrackingFileViewPage;
