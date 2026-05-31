import React from 'react';
import AppleButton from './AppleButton';
import { FiArrowLeft, FiDownload } from 'react-icons/fi';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

interface FileBlobViewerProps {
  title: string;
  fileName: string;
  fileUrl: string | null;
  contentType: string;
  isLoading: boolean;
  error?: string | null;
  onBack: () => void;
}

const FileBlobViewer: React.FC<FileBlobViewerProps> = ({
  title,
  fileName,
  fileUrl,
  contentType,
  isLoading,
  error,
  onBack,
}) => {
  const isPdf = contentType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');
  const isImage = contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(fileName);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <Icon icon={FiArrowLeft} className="w-5 h-5" />
            Back
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-gray-600 truncate max-w-2xl">{fileName}</p>
          </div>
        </div>

        {fileUrl && (
          <a href={fileUrl} download={fileName} className="inline-flex">
            <AppleButton type="button">
              <Icon icon={FiDownload} className="mr-2" />
              Download
            </AppleButton>
          </a>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 min-h-[70vh] flex items-center justify-center">
        {isLoading && <div className="text-gray-500">Loading file...</div>}

        {!isLoading && error && <div className="max-w-2xl text-red-600">{error}</div>}

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

export default FileBlobViewer;
