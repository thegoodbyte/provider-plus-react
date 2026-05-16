import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { medicalTrackingApi, clientMedicalApi } from '../services/api';
import AppleButton from './AppleButton';
import { FiArrowLeft, FiExternalLink, FiDownload } from 'react-icons/fi';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

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

  const isPdf = contentType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');
  const isImage = contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(fileName);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <Icon icon={FiArrowLeft} className="w-5 h-5" />
            Back
          </button>
          <div>
            <h1 className="text-2xl font-bold">{title} File</h1>
            <p className="text-sm text-gray-600 truncate max-w-2xl">{fileName}</p>
          </div>
        </div>

        {fileUrl && (
          <div className="flex items-center gap-2">
            <AppleButton type="button" variant="secondary" onClick={() => window.open(fileUrl, '_blank', 'noopener,noreferrer')}>
              <Icon icon={FiExternalLink} className="mr-2" />
              Open in new tab
            </AppleButton>
            <a href={fileUrl} download={fileName} className="inline-flex">
              <AppleButton type="button">
                <Icon icon={FiDownload} className="mr-2" />
                Download
              </AppleButton>
            </a>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 min-h-[70vh] flex items-center justify-center">
        {isLoading && <div className="text-gray-500">Loading file...</div>}

        {!isLoading && error && <div className="text-red-600">{error}</div>}

        {!isLoading && !error && fileUrl && isImage && (
          <img
            src={fileUrl}
            alt={fileName}
            className="max-w-full max-h-[calc(70vh-2rem)] object-contain"
          />
        )}

        {!isLoading && !error && fileUrl && isPdf && (
          <iframe
            src={fileUrl}
            title={fileName}
            className="w-full h-[70vh] border-0"
          />
        )}

        {!isLoading && !error && fileUrl && !isImage && !isPdf && (
          <div className="text-gray-700">
            Preview unavailable for this file type.
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicalTrackingFileViewPage;
