import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, FileText, RefreshCw, Send, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { bookingFlowApi, medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';
import { BookingFlowActionLog, BookingFlowItem, MedicalArtifact, MedicalReviewRequest } from '../types';
import './BookingMedicalUpload.css';

type BookingDocumentType = string;

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
  requestType?: MedicalReviewRequest['requestType'];
}> = [
  { type: 'contract', title: 'Contract', description: 'Signed client contract for this booking.' },
  { type: 'food_intake', title: 'Food Form', description: 'Food intake, allergies, and kitchen notes.', requestType: 'food_review' },
  { type: 'medications_form', title: 'Medications Form', description: 'Initial or follow-up medication information.', requestType: 'medications_review' },
  { type: 'questionnaire', title: 'Questionnaire Form', description: 'Client questionnaire submitted for this booking.', requestType: 'questionnaire_review' },
];

const SENT_MATCH = /\bsent|send|request(ed)?\b/i;
const RECEIVED_MATCH = /\breceived|signed|submitted|uploaded|complete(d)?\b/i;

const humanizeArtifactType = (value: string) => value
  .split(/[_-]+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const getItemExpectedArtifact = (item: BookingFlowItem) => String(item.metadata?.expectedArtifact || '').trim();

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
  const navigate = useNavigate();
  const [artifacts, setArtifacts] = useState<MedicalArtifact[]>([]);
  const [flowItems, setFlowItems] = useState<BookingFlowItem[]>([]);
  const [actionLogsByItem, setActionLogsByItem] = useState<Record<string, BookingFlowActionLog[]>>({});
  const [reviewsByArtifact, setReviewsByArtifact] = useState<Record<string, MedicalReviewRequest[]>>({});
  const [loading, setLoading] = useState(false);
  const [uploadingType, setUploadingType] = useState<BookingDocumentType | null>(null);
  const [sendingItemId, setSendingItemId] = useState<string | null>(null);
  const [markOnUpload, setMarkOnUpload] = useState<Record<string, boolean>>({});
  const [creatingReviewFor, setCreatingReviewFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const configuredDocumentSections = useMemo(() => {
    const configured = flowItems
      .map((item) => getItemExpectedArtifact(item))
      .filter(Boolean)
      .filter((type, index, all) => all.indexOf(type) === index)
      .map((type) => {
        const matchingItems = flowItems.filter((item) => getItemExpectedArtifact(item) === type);
        const fallback = documentSections.find((section) => section.type === type);
        const receivedItem = matchingItems.find((item) => RECEIVED_MATCH.test(`${item.key} ${item.title}`));
        const sentItem = matchingItems.find((item) => SENT_MATCH.test(`${item.key} ${item.title}`));
        return {
          type,
          title: fallback?.title || humanizeArtifactType(type),
          description: fallback?.description || receivedItem?.description || sentItem?.description || `Document configured from booking step ${receivedItem?.title || sentItem?.title || type}.`,
          requestType: fallback?.requestType,
          sentItem,
          receivedItem,
          items: matchingItems,
        };
      });

    const configuredTypes = new Set(configured.map((section) => section.type));
    const fallback = documentSections
      .filter((section) => !configuredTypes.has(section.type))
      .map((section) => ({ ...section, sentItem: undefined, receivedItem: undefined, items: [] as BookingFlowItem[] }));

    return [...configured, ...fallback];
  }, [flowItems]);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [response, contextualResponse, flowResponse] = await Promise.all([
        medicalArtifactsApi.getAll({ bookingId }),
        clientId
          ? medicalArtifactsApi.getAll({
              clientId,
              retreatId,
              contextType: 'booking',
              purpose: 'booking_requirement',
            })
          : Promise.resolve({ data: [] as MedicalArtifact[] }),
        bookingFlowApi.getItems({ bookingId }),
      ]);
      const items: BookingFlowItem[] = flowResponse.data || [];
      setFlowItems(items);
      const directArtifacts: MedicalArtifact[] = response.data || [];
      const contextualArtifacts: MedicalArtifact[] = contextualResponse.data || [];
      const bookingArtifacts = [...directArtifacts, ...contextualArtifacts.filter((artifact) => {
        const artifactBookingId = typeof artifact.bookingId === 'string' ? artifact.bookingId : '';
        return !artifactBookingId || artifactBookingId === bookingId || artifact.data?.bookingId === bookingId;
      })].filter((artifact, index, all) => {
        const key = artifact._id || `${artifact.artifactType}-${artifact.title}-${artifact.receivedAt || artifact.createdAt || index}`;
        return all.findIndex((candidate) => (candidate._id || `${candidate.artifactType}-${candidate.title}-${candidate.receivedAt || candidate.createdAt || index}`) === key) === index;
      });
      const sectionTypes = new Set([
        ...documentSections.map((section) => section.type),
        ...items.map((item) => String(item.metadata?.expectedArtifact || '').trim()).filter(Boolean),
      ]);
      const documentArtifacts = bookingArtifacts.filter((artifact) => sectionTypes.has(String(artifact.artifactType || '')));
      setArtifacts(documentArtifacts);
      const reviewEntries = await Promise.all(
        documentArtifacts
          .filter((artifact) => artifact._id)
          .map(async (artifact) => {
            try {
              const reviewsResponse = await medicalReviewRequestsApi.getByArtifact(artifact._id!);
              return [artifact._id!, reviewsResponse.data || []] as const;
            } catch {
              return [artifact._id!, []] as const;
            }
          })
      );
      setReviewsByArtifact(Object.fromEntries(reviewEntries));
      const logEntries = await Promise.all(
        items
          .filter((item) => item._id && item.metadata?.expectedArtifact)
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
          const artifactType = String(item.metadata?.expectedArtifact || '').trim();
          if (artifactType && RECEIVED_MATCH.test(`${item.key} ${item.title}`) && next[artifactType] === undefined) {
            next[artifactType] = true;
          }
        });
        return next;
      });
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Unable to load booking documents.');
    } finally {
      setLoading(false);
    }
  }, [bookingId, clientId, retreatId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const artifactsByType = useMemo(() => {
    return configuredDocumentSections.reduce<Record<BookingDocumentType, MedicalArtifact[]>>((acc, section) => {
      acc[section.type] = artifacts
        .filter((artifact) => artifact.artifactType === section.type)
        .sort((a, b) => new Date(b.receivedAt || b.createdAt || 0).getTime() - new Date(a.receivedAt || a.createdAt || 0).getTime());
      return acc;
    }, {});
  }, [artifacts, configuredDocumentSections]);

  const handleUpload = async (section: (typeof configuredDocumentSections)[number], files: FileList | null) => {
    if (!files?.length) return;

    setUploadingType(section.type);
    setError(null);
    try {
      const fileArray = Array.from(files);
      const created = await medicalArtifactsApi.create({
        clientId,
        retreatId,
        bookingId,
        artifactType: section.type as any,
        title: fileArray[0]?.name || `${section?.title || 'Booking document'}${bookingNumber ? ` - ${bookingNumber}` : ''}`,
        description: section?.description,
        source: 'admin_upload',
        status: 'stored',
        purpose: 'booking_requirement',
        data: {
          bookingId,
          bookingFlowItemId: section.receivedItem?._id,
          markBookingStepOnUpload: !!markOnUpload[section.type],
        },
      });

      if (created.data._id) {
        try {
          if (section?.requestType) {
            const review = await createReviewRequest(created.data, section.requestType);
            if (!review?.display_id) {
              throw new Error('Medical review request could not be created before upload.');
            }
            await medicalArtifactsApi.uploadFiles(created.data._id, fileArray, {
              reviewRequestNumber: review.display_id,
            });
          } else {
            await medicalArtifactsApi.uploadFiles(created.data._id, fileArray);
          }
        } catch (uploadError) {
          await medicalArtifactsApi.delete(created.data._id).catch((rollbackError) => {
            console.error('Error rolling back empty medical artifact:', rollbackError);
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
            artifactType: section.type,
            medicalArtifactId: created.data._id,
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

  const createReviewRequest = async (artifact: MedicalArtifact, requestType: MedicalReviewRequest['requestType']) => {
    if (!artifact._id) return undefined;
    setCreatingReviewFor(artifact._id);
    setError(null);
    try {
      const response = await medicalReviewRequestsApi.createFromArtifact(artifact._id, requestType, {
        medicalStaffNotes: `${artifact.title} linked to booking ${bookingNumber || bookingId}.`,
      });
      await loadDocuments();
      return response.data;
    } catch (reviewError: any) {
      setError(reviewError?.response?.data?.message || reviewError?.message || 'Unable to create medical review request.');
      return undefined;
    } finally {
      setCreatingReviewFor(null);
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
          <p>Upload forms tied directly to this booking. Each upload is stored as a medical artifact with the booking ID.</p>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={loadDocuments} disabled={loading}>
          <RefreshCw size={16} /> {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="booking-documents-grid">
        {configuredDocumentSections.map((section) => {
          const sectionArtifacts = artifactsByType[section.type] || [];
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
                      <div className="booking-medical-actions">
                        {artifact._id && (
                          <button className="btn btn-sm btn-secondary" type="button" onClick={() => navigate(`/medical-artifacts/${artifact._id}`)}>
                            <Eye size={16} /> Artifact
                          </button>
                        )}
                        {section.requestType && (
                          (reviewsByArtifact[artifact._id || ''] || [])[0]?._id ? (
                            <button className="btn btn-sm btn-secondary" type="button" onClick={() => navigate(`/medical-review-requests/${(reviewsByArtifact[artifact._id || ''] || [])[0]._id}`)}>
                              <Eye size={16} /> Review #{(reviewsByArtifact[artifact._id || ''] || [])[0].display_id || (reviewsByArtifact[artifact._id || ''] || [])[0]._id}
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm btn-primary"
                              type="button"
                              disabled={!artifact._id || creatingReviewFor === artifact._id}
                              onClick={() => createReviewRequest(artifact, section.requestType!)}
                            >
                              <Send size={16} /> {creatingReviewFor === artifact._id ? 'Creating...' : 'Create Review'}
                            </button>
                          )
                        )}
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
