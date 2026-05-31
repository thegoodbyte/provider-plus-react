import React, { useEffect, useMemo, useState } from 'react';
import { FileText, RefreshCw, Upload } from 'lucide-react';
import { medicalArtifactsApi } from '../services/api';
import { MedicalArtifact } from '../types';
import './BookingMedicalUpload.css';

type BookingDocumentType = 'contract' | 'food_intake' | 'medications_form' | 'questionnaire';

interface BookingDocumentsUploadProps {
  bookingId: string;
  bookingNumber?: string;
  clientId: string;
  retreatId?: string;
  onUploadComplete?: () => void;
}

const documentSections: Array<{
  type: BookingDocumentType;
  title: string;
  description: string;
}> = [
  { type: 'contract', title: 'Contract', description: 'Signed client contract for this booking.' },
  { type: 'food_intake', title: 'Food Form', description: 'Food intake, allergies, and kitchen notes.' },
  { type: 'medications_form', title: 'Medications Form', description: 'Initial or follow-up medication information.' },
  { type: 'questionnaire', title: 'Questionnaire Form', description: 'Client questionnaire submitted for this booking.' },
];

const getApiErrorMessage = (error: any) => {
  const status = error?.response?.status;
  const message = error?.response?.data?.message || error?.message;
  if (status === 503 || /s3|storage|configured|configuration/i.test(message || '')) {
    return 'Upload error: storage is misconfigured. Check Settings and configure the S3 bucket before uploading files.';
  }
  return message || 'Upload error. Please try again.';
};

const formatDate = (value?: Date | string) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
};

const formatBytes = (size?: number) => {
  if (!size) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const BookingDocumentsUpload: React.FC<BookingDocumentsUploadProps> = ({
  bookingId,
  bookingNumber,
  clientId,
  retreatId,
  onUploadComplete,
}) => {
  const [artifacts, setArtifacts] = useState<MedicalArtifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadingType, setUploadingType] = useState<BookingDocumentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await medicalArtifactsApi.getAll({ bookingId });
      const bookingArtifacts: MedicalArtifact[] = response.data || [];
      setArtifacts(bookingArtifacts.filter((artifact) => documentSections.some((section) => section.type === artifact.artifactType)));
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Unable to load booking documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [bookingId]);

  const artifactsByType = useMemo(() => {
    return documentSections.reduce<Record<BookingDocumentType, MedicalArtifact[]>>((acc, section) => {
      acc[section.type] = artifacts
        .filter((artifact) => artifact.artifactType === section.type)
        .sort((a, b) => new Date(b.receivedAt || b.createdAt || 0).getTime() - new Date(a.receivedAt || a.createdAt || 0).getTime());
      return acc;
    }, {
      contract: [],
      food_intake: [],
      medications_form: [],
      questionnaire: [],
    });
  }, [artifacts]);

  const handleUpload = async (type: BookingDocumentType, files: FileList | null) => {
    if (!files?.length) return;

    setUploadingType(type);
    setError(null);
    try {
      const section = documentSections.find((item) => item.type === type);
      const fileArray = Array.from(files);
      const created = await medicalArtifactsApi.create({
        clientId,
        retreatId,
        bookingId,
        artifactType: type,
        title: fileArray[0]?.name || `${section?.title || 'Booking document'}${bookingNumber ? ` - ${bookingNumber}` : ''}`,
        description: section?.description,
        source: 'admin_upload',
        status: 'stored',
      });

      if (created.data._id) {
        await medicalArtifactsApi.uploadFiles(created.data._id, fileArray);
      }

      await loadDocuments();
      onUploadComplete?.();
    } catch (uploadError: any) {
      setError(getApiErrorMessage(uploadError));
    } finally {
      setUploadingType(null);
    }
  };

  return (
    <div className="booking-medical-upload">
      <div className="booking-documents-header">
        <div>
          <h3>Booking Documents</h3>
          <p>Upload forms tied directly to this booking. Each upload is stored as a medical artifact with the booking ID.</p>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={loadDocuments} disabled={loading}>
          <RefreshCw size={16} /> {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="booking-documents-grid">
        {documentSections.map((section) => {
          const sectionArtifacts = artifactsByType[section.type];
          const inputId = `booking-document-${section.type}`;
          const isUploading = uploadingType === section.type;

          return (
            <div key={section.type} className="booking-document-card">
              <div className="booking-document-card-header">
                <FileText size={20} />
                <div>
                  <h4>{section.title}</h4>
                  <p>{section.description}</p>
                </div>
              </div>

              <div className="booking-document-files">
                {sectionArtifacts.length === 0 ? (
                  <div className="booking-document-empty">No file uploaded yet.</div>
                ) : (
                  sectionArtifacts.map((artifact) => (
                    <div key={artifact._id} className="booking-document-file-row">
                      <div>
                        <strong>{artifact.title}</strong>
                        <div className="upload-date">Received: {formatDate(artifact.receivedAt || artifact.createdAt)}</div>
                      </div>
                      <div className="booking-document-file-list">
                        {(artifact.files || []).map((file, index) => (
                          <span key={`${file.s3Key || file.filePath || file.fileName}-${index}`}>
                            {file.fileName || 'Uploaded file'} ({formatBytes(file.size)})
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="upload-section">
                <input
                  type="file"
                  id={inputId}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic,.heif"
                  multiple
                  onChange={(event) => {
                    handleUpload(section.type, event.target.files);
                    event.target.value = '';
                  }}
                  disabled={Boolean(uploadingType)}
                />
                <label htmlFor={inputId} className="btn btn-sm btn-primary">
                  <Upload size={16} /> {isUploading ? 'Uploading...' : `Upload ${section.title}`}
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BookingDocumentsUpload;
