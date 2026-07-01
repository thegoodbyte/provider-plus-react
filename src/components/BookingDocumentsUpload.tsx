import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, FileText, RefreshCw, Send, Upload } from 'lucide-react';
import { bookingDocumentsApi, bookingFlowApi } from '../services/api';
import { BookingDocument, BookingDocumentType, BookingFlowActionLog, BookingFlowItem } from '../types';
import './BookingMedicalUpload.css';

interface BookingDocumentsUploadProps {
  bookingId: string;
  bookingNumber?: string;
  clientId: string;
  retreatId?: string;
  onUploadComplete?: () => void;
}

type DocumentSection = {
  type: string;
  title: string;
  description: string;
  sentItem?: BookingFlowItem;
  receivedItem?: BookingFlowItem;
};

const DEFAULT_DOCUMENT_TYPES: BookingDocumentType[] = [
  { key: 'contract', label: 'Contract', description: 'Signed client contract for this booking.', order: 10, bookingFlowReceivedStepKey: 'contract_signed' },
  { key: 'food_intake', label: 'Food Form', description: 'Food intake, allergies, and kitchen notes.', order: 20 },
  { key: 'medications_form', label: 'Medications Form', description: 'Initial or follow-up medication information.', order: 30 },
  { key: 'questionnaire', label: 'Questionnaire Form', description: 'Client questionnaire submitted for this booking.', order: 40 },
  { key: 'health_assessment', label: 'Health Assessment', description: 'General health assessment for this booking.', order: 50 },
];

const SENT_MATCH = /\bsent|send|request(ed)?\b/i;
const RECEIVED_MATCH = /\breceived|signed|submitted|uploaded|complete(d)?\b/i;

const normalizeKey = (value?: string) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const humanizeKey = (value: string) => value
  .split(/[_-]+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const getItemExpectedDocument = (item: BookingFlowItem) => normalizeKey(
  item.metadata?.expectedBookingDocument
  || item.metadata?.expectedDocument
  || item.metadata?.expectedArtifact
  || item.metadata?.expectedArtifactPurpose
  || ''
);

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
  return new Date(value).toLocaleString();
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
  const [documents, setDocuments] = useState<BookingDocument[]>([]);
  const [documentTypes, setDocumentTypes] = useState<BookingDocumentType[]>([]);
  const [flowItems, setFlowItems] = useState<BookingFlowItem[]>([]);
  const [actionLogsByItem, setActionLogsByItem] = useState<Record<string, BookingFlowActionLog[]>>({});
  const [loading, setLoading] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [sendingItemId, setSendingItemId] = useState<string | null>(null);
  const [markOnUpload, setMarkOnUpload] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const sections = useMemo<DocumentSection[]>(() => {
    const typeMap = new Map<string, BookingDocumentType>();
    [...DEFAULT_DOCUMENT_TYPES, ...documentTypes]
      .filter((type) => type.active !== false)
      .forEach((type) => typeMap.set(normalizeKey(type.key), { ...type, key: normalizeKey(type.key) }));

    flowItems.forEach((item) => {
      const expected = getItemExpectedDocument(item);
      if (expected && !typeMap.has(expected)) {
        typeMap.set(expected, {
          key: expected,
          label: humanizeKey(expected),
          description: item.description || `Document configured from booking step ${item.title}.`,
        });
      }
    });

    return Array.from(typeMap.values())
      .sort((a, b) => (a.order || 0) - (b.order || 0) || a.label.localeCompare(b.label))
      .map((type) => {
        const key = normalizeKey(type.key);
        const matchingItems = flowItems.filter((item) => {
          const expected = getItemExpectedDocument(item);
          return expected === key
            || normalizeKey(item.metadata?.documentType) === key
            || normalizeKey(item.key) === normalizeKey(type.bookingFlowReceivedStepKey)
            || normalizeKey(item.key) === normalizeKey(type.bookingFlowSentStepKey);
        });
        const sentItem = matchingItems.find((item) => normalizeKey(item.key) === normalizeKey(type.bookingFlowSentStepKey))
          || matchingItems.find((item) => SENT_MATCH.test(`${item.key} ${item.title}`));
        const receivedItem = matchingItems.find((item) => normalizeKey(item.key) === normalizeKey(type.bookingFlowReceivedStepKey))
          || matchingItems.find((item) => RECEIVED_MATCH.test(`${item.key} ${item.title}`));
        return {
          type: key,
          title: type.label || humanizeKey(key),
          description: type.description || receivedItem?.description || sentItem?.description || `Upload ${humanizeKey(key)} for this booking.`,
          sentItem,
          receivedItem,
        };
      });
  }, [documentTypes, flowItems]);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [typesResponse, documentsResponse, flowResponse] = await Promise.all([
        bookingDocumentsApi.getTypes(),
        bookingDocumentsApi.getAll({ bookingId }),
        bookingFlowApi.getItems({ bookingId }),
      ]);

      const items: BookingFlowItem[] = flowResponse.data || [];
      setDocumentTypes(typesResponse.data || []);
      setDocuments(documentsResponse.data || []);
      setFlowItems(items);

      const logEntries = await Promise.all(
        items
          .filter((item) => item._id && (getItemExpectedDocument(item) || item.metadata?.expectedArtifact))
          .map(async (item) => {
            try {
              const logsResponse = await bookingFlowApi.getItemActionLogs(item._id!);
              return [item._id!, logsResponse.data || []] as const;
            } catch {
              return [item._id!, []] as const;
            }
          })
      );
      setActionLogsByItem(Object.fromEntries(logEntries));
      setMarkOnUpload((current) => {
        const next = { ...current };
        items.forEach((item) => {
          const expected = getItemExpectedDocument(item);
          if (expected && RECEIVED_MATCH.test(`${item.key} ${item.title}`) && next[expected] === undefined) {
            next[expected] = true;
          }
        });
        return next;
      });
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Unable to load booking documents.');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const documentsByType = useMemo(() => {
    return sections.reduce<Record<string, BookingDocument[]>>((acc, section) => {
      acc[section.type] = documents
        .filter((document) => normalizeKey(document.documentType) === section.type)
        .sort((a, b) => new Date(b.receivedAt || b.createdAt || 0).getTime() - new Date(a.receivedAt || a.createdAt || 0).getTime());
      return acc;
    }, {});
  }, [documents, sections]);

  const handleUpload = async (section: DocumentSection, files: FileList | null) => {
    if (!files?.length) return;

    setUploadingType(section.type);
    setError(null);
    try {
      const fileArray = Array.from(files);
      const created = await bookingDocumentsApi.create({
        bookingId,
        clientId,
        retreatId,
        documentType: section.type,
        title: fileArray[0]?.name || `${section.title}${bookingNumber ? ` - ${bookingNumber}` : ''}`,
        description: section.description,
        bookingFlowItemId: section.receivedItem?._id,
        metadata: {
          bookingNumber,
          markBookingStepOnUpload: !!markOnUpload[section.type],
        },
      });

      if (created.data._id) {
        try {
          await bookingDocumentsApi.uploadFiles(created.data._id, fileArray);
        } catch (uploadError) {
          await bookingDocumentsApi.delete(created.data._id).catch((rollbackError) => {
            console.error('Error rolling back empty booking document:', rollbackError);
          });
          throw uploadError;
        }
      }

      if (markOnUpload[section.type] && section.receivedItem?._id) {
        await bookingFlowApi.recordItemAction(section.receivedItem._id, {
          actionType: 'artifact_received',
          actionKey: `${section.type}_uploaded`,
          statusAfter: 'received',
          notes: `${section.title} uploaded from booking documents.`,
          metadata: {
            documentType: section.type,
            bookingDocumentId: created.data._id,
            fileNames: fileArray.map((file) => file.name),
          },
        });
      }

      await loadDocuments();
      onUploadComplete?.();
    } catch (uploadError: any) {
      setError(getApiErrorMessage(uploadError));
    } finally {
      setUploadingType(null);
    }
  };

  const handleSendRequest = async (item?: BookingFlowItem) => {
    if (!item?._id) return;
    setSendingItemId(item._id);
    setError(null);
    try {
      await bookingFlowApi.sendItemEmail(item._id);
      await loadDocuments();
    } catch (sendError: any) {
      setError(sendError?.response?.data?.message || sendError?.message || 'Unable to send document request email.');
    } finally {
      setSendingItemId(null);
    }
  };

  return (
    <div className="booking-medical-upload">
      <div className="booking-documents-header">
        <div>
          <h3>Booking Documents</h3>
          <p>Upload forms tied directly to this booking. Each upload is stored as a booking document with the booking ID.</p>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={loadDocuments} disabled={loading}>
          <RefreshCw size={16} /> {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="booking-documents-grid">
        {sections.map((section) => {
          const sectionDocuments = documentsByType[section.type] || [];
          const inputId = `booking-document-${section.type}`;
          const isUploading = uploadingType === section.type;
          const sentLogs = section.sentItem?._id ? (actionLogsByItem[section.sentItem._id] || []) : [];
          const receivedLogs = section.receivedItem?._id ? (actionLogsByItem[section.receivedItem._id] || []) : [];
          const historyLogs = [...sentLogs, ...receivedLogs]
            .sort((a, b) => new Date(b.performedAt || b.createdAt || 0).getTime() - new Date(a.performedAt || a.createdAt || 0).getTime())
            .slice(0, 5);

          return (
            <div key={section.type} className="booking-document-card">
              <div className="booking-document-card-header">
                <FileText size={20} />
                <div>
                  <h4>{section.title}</h4>
                  <p>{section.description}</p>
                </div>
              </div>

              {(section.sentItem || section.receivedItem) && (
                <div className="booking-document-empty">
                  {section.sentItem && <div>Email step: {section.sentItem.title} ({section.sentItem.status})</div>}
                  {section.receivedItem && <div>Upload step: {section.receivedItem.title} ({section.receivedItem.status})</div>}
                </div>
              )}

              {section.sentItem && (
                <button
                  className="btn btn-sm btn-secondary"
                  type="button"
                  disabled={sendingItemId === section.sentItem._id}
                  onClick={() => handleSendRequest(section.sentItem)}
                >
                  <Send size={16} /> {sendingItemId === section.sentItem._id ? 'Sending...' : `Send ${section.title} Request`}
                </button>
              )}

              <div className="booking-document-files">
                {sectionDocuments.length === 0 ? (
                  <div className="booking-document-empty">No file uploaded yet.</div>
                ) : (
                  sectionDocuments.map((document) => (
                    <div key={document._id} className="booking-document-file-row">
                      <div>
                        <strong>{document.title}</strong>
                        <div className="upload-date">Received: {formatDate(document.receivedAt || document.createdAt)}</div>
                      </div>
                      <div className="booking-document-file-list">
                        {(document.files || []).map((file, index) => (
                          <button
                            key={`${file.s3Key || file.filePath || file.fileName}-${index}`}
                            type="button"
                            className="booking-document-file-link"
                            onClick={() => file.url && window.open(file.url, '_blank', 'noopener,noreferrer')}
                            disabled={!file.url}
                            title={file.url ? 'Open file' : 'File URL unavailable'}
                          >
                            <Eye size={14} /> {file.fileName || 'Uploaded file'} ({formatBytes(file.size)})
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="upload-section">
                {section.receivedItem && (
                  <label className="booking-document-empty" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={markOnUpload[section.type] !== false}
                      onChange={(event) => setMarkOnUpload((current) => ({ ...current, [section.type]: event.target.checked }))}
                    />
                    Mark "{section.receivedItem.title}" received after upload
                  </label>
                )}
                <input
                  type="file"
                  id={inputId}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic,.heif"
                  multiple
                  onChange={(event) => {
                    handleUpload(section, event.target.files);
                    event.target.value = '';
                  }}
                  disabled={Boolean(uploadingType)}
                />
                <label htmlFor={inputId} className="btn btn-sm btn-primary">
                  <Upload size={16} /> {isUploading ? 'Uploading...' : `Upload ${section.title}`}
                </label>
              </div>

              {historyLogs.length > 0 && (
                <div className="booking-document-files">
                  <strong>Step action history</strong>
                  {historyLogs.map((log) => (
                    <div key={log._id} className="booking-document-empty">
                      {formatDate(log.performedAt || log.createdAt)} - {log.actionLabel || log.actionKey || log.actionType}
                      {log.statusAfter ? ` (${log.statusAfter})` : ''}
                      {log.metadata?.sentEmailDisplayId ? ` - email #${log.metadata.sentEmailDisplayId}` : ''}
                      {log.notes ? ` - ${log.notes}` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BookingDocumentsUpload;
