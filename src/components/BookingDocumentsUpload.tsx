import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, FileHeart, FileText, HeartPulse, Pill, RefreshCw, Scale, Stethoscope, Upload, Utensils } from 'lucide-react';
import { bookingDocumentsApi, bookingFlowApi, medicalArtifactsApi } from '../services/api';
import { BookingDocument, BookingDocumentType, BookingFlowItem, MedicalArtifact } from '../types';
import './BookingMedicalUpload.css';
import { entryMedicalType, isEntryMedicalArtifact, mergeMedicalArtifacts } from './bookingEntryMedicalArtifacts';

interface BookingDocumentsUploadProps {
  bookingId: string;
  bookingNumber?: string;
  clientName?: string;
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

type DocumentFileViewer = {
  document: BookingDocument;
  file: NonNullable<BookingDocument['files']>[number];
  viewUrl: string;
};

const DEFAULT_DOCUMENT_TYPES: BookingDocumentType[] = [
  { key: 'contract', label: 'Contract', description: 'Signed client contract for this booking.', order: 10, bookingFlowReceivedStepKey: 'contract_signed' },
  { key: 'food_intake', label: 'Food Form', description: 'Food intake, allergies, and kitchen notes.', order: 40 },
  { key: 'medications_form', label: 'Medications Form', description: 'Initial or follow-up medication information.', order: 50 },
  { key: 'questionnaire', label: 'Questionnaire Form', description: 'Client questionnaire submitted for this booking.', order: 60 },
  { key: 'health_assessment', label: 'Health Assessment', description: 'General health assessment for this booking.', order: 70 },
];

const MEDICAL_ARTIFACT_TYPES = new Set(['ekg', 'liver_panel']);

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

const formatBytes = (size?: number) => {
  if (!size) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const BookingDocumentsUpload: React.FC<BookingDocumentsUploadProps> = ({
  bookingId,
  bookingNumber,
  clientName,
  clientId,
  retreatId,
  onUploadComplete,
}) => {
  const [documents, setDocuments] = useState<BookingDocument[]>([]);
  const [entryMedicalArtifacts, setEntryMedicalArtifacts] = useState<MedicalArtifact[]>([]);
  const [documentTypes, setDocumentTypes] = useState<BookingDocumentType[]>([]);
  const [flowItems, setFlowItems] = useState<BookingFlowItem[]>([]);
  // Avoid flashing empty/stale counts while the tab's first request starts.
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [markOnUpload, setMarkOnUpload] = useState<Record<string, boolean>>({});
  const [viewer, setViewer] = useState<DocumentFileViewer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sections = useMemo<DocumentSection[]>(() => {
    const typeMap = new Map<string, BookingDocumentType>();
    [...DEFAULT_DOCUMENT_TYPES, ...documentTypes]
      .filter((type) => type.active !== false)
      .filter((type) => !MEDICAL_ARTIFACT_TYPES.has(normalizeKey(type.key)))
      .forEach((type) => typeMap.set(normalizeKey(type.key), { ...type, key: normalizeKey(type.key) }));

    flowItems.forEach((item) => {
      const expected = getItemExpectedDocument(item);
      if (expected && !MEDICAL_ARTIFACT_TYPES.has(expected) && !typeMap.has(expected)) {
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
      const [typesResponse, documentsResponse, flowResponse, bookingArtifactsResponse] = await Promise.all([
        bookingDocumentsApi.getTypes(),
        // File previews/downloads use the secure file endpoint on demand, so the
        // tab does not need bulk signed URLs or read-time reconciliation.
        bookingDocumentsApi.getAll({ bookingId, compact: true }),
        bookingFlowApi.getItems({ bookingId }),
        medicalArtifactsApi.getForBooking(bookingId),
      ]);

      const items: BookingFlowItem[] = flowResponse.data || [];
      setDocumentTypes(typesResponse.data || []);
      setDocuments(documentsResponse.data || []);
      setFlowItems(items);
      setEntryMedicalArtifacts(mergeMedicalArtifacts(bookingArtifactsResponse.data || [])
        .filter((artifact: MedicalArtifact) => (artifact.files || []).length > 0 && isEntryMedicalArtifact(artifact)));

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

  const orderedSections = useMemo(() => {
    const order: Record<string, number> = {
      contract: 10,
      questionnaire: 20,
      questionnaire_form: 20,
      medications_form: 30,
      food_intake: 40,
      food_form: 40,
      health_assessment: 50,
    };
    return [...sections].sort((a, b) => (order[a.type] ?? 100) - (order[b.type] ?? 100));
  }, [sections]);

  const handleMedicalUpload = async (artifactType: 'ekg' | 'liver_panel', files: FileList | null) => {
    if (!files?.length) return;
    setUploadingType(artifactType);
    setError(null);
    try {
      const created = await medicalArtifactsApi.create({
        clientId,
        bookingId,
        retreatId,
        artifactType,
        documentStage: 'entry',
        documentType: artifactType === 'ekg' ? 'EKG' : 'Liver',
        title: artifactType === 'ekg' ? 'Entry EKG' : 'Entry liver panel',
        source: 'admin_upload',
        status: 'stored',
      });
      if (created.data._id) await medicalArtifactsApi.uploadFiles(created.data._id, Array.from(files));
      await loadDocuments();
      onUploadComplete?.();
    } catch (uploadError: any) {
      setError(getApiErrorMessage(uploadError));
    } finally {
      setUploadingType(null);
    }
  };

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
        title: section.title,
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

  const iconFor = (type: string) => {
    const props = { size: 22, strokeWidth: 1.6 };
    if (type === 'contract') return <Scale {...props} />;
    if (type.includes('questionnaire')) return <ClipboardList {...props} />;
    if (type.includes('medication')) return <Pill {...props} />;
    if (type.includes('food')) return <Utensils {...props} />;
    if (type.includes('health')) return <Stethoscope {...props} />;
    return <FileText {...props} />;
  };

  const bookingReceivedCount = orderedSections.filter((section) =>
    (documentsByType[section.type] || []).some((document) => (document.files || []).length > 0)
  ).length;
  const medicalRows = [
    { type: 'ekg' as const, title: 'Entry EKG', description: "Uploaded through this booking's retreat requirements.", icon: <HeartPulse size={22} strokeWidth={1.6} /> },
    { type: 'liver_panel' as const, title: 'Entry liver panel', description: "Uploaded through this booking's retreat requirements.", icon: <FileHeart size={22} strokeWidth={1.6} /> },
  ];
  const medicalReceivedCount = medicalRows.filter((row) => entryMedicalArtifacts.some((artifact) => entryMedicalType(artifact) === row.type)).length;
  const totalCount = orderedSections.length + medicalRows.length;
  const receivedCount = bookingReceivedCount + medicalReceivedCount;

  return (
    <div className="booking-documents-redesign" aria-busy={loading}>
      {loading && <div className="booking-documents-loading" role="status" aria-live="polite">
        <RefreshCw size={30} className="booking-medical-loading-spinner" aria-hidden="true" />
        <strong>Loading documents…</strong>
        <span>Refreshing booking documents and medical files.</span>
      </div>}
      <header className="booking-documents-redesign-header">
        <div>
          <div className="booking-documents-eyebrow">Booking #{bookingNumber || '—'}{clientName ? ` · ${clientName}` : ''}</div>
          <h2>Documents</h2>
          <p>{receivedCount} of {totalCount} on file. Medical files also arrive through the retreat requirements.</p>
        </div>
        <div className="booking-documents-header-actions">
          <span className="booking-documents-outstanding">{totalCount - receivedCount} outstanding</span>
          <button type="button" className="booking-documents-refresh" onClick={loadDocuments} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'booking-medical-loading-spinner' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {error && <div className="alert alert-danger booking-documents-error">{error}</div>}

      <section className="booking-documents-section">
        <div className="booking-documents-section-title">
          <h3>Booking documents</h3>
          <span>{bookingReceivedCount} of {orderedSections.length} on file</span>
        </div>
        <div className="booking-documents-rows">
          {orderedSections.map((section, index) => {
            const sectionDocuments = documentsByType[section.type] || [];
            const latestDocument = sectionDocuments[0];
            const latestFile = latestDocument?.files?.[0];
            const storedPath = latestFile?.s3Key || latestFile?.filePath;
            const received = Boolean(latestFile);
            const required = Boolean(section.receivedItem?.isBlocking);
            const inputId = `booking-document-${section.type}`;
            const openViewer = () => {
              if (latestDocument?._id && latestFile && storedPath) {
                setViewer({ document: latestDocument, file: latestFile, viewUrl: latestFile.url || bookingDocumentsApi.getFileViewUrl(latestDocument._id, storedPath) });
              }
            };
            return (
              <article className={`booking-documents-row ${received ? 'is-received' : 'is-missing'}`} key={section.type}>
                <div className="booking-documents-number">{String(index + 1).padStart(2, '0')}</div>
                <div className="booking-documents-icon">{iconFor(section.type)}</div>
                <div className="booking-documents-copy">
                  <div className="booking-documents-name-line"><strong>{section.title}</strong>{required && !received && <span className="booking-documents-required">Required</span>}</div>
                  <p>{section.description}</p>
                </div>
                <div className="booking-documents-file">
                  {received ? <>
                    <button type="button" onClick={openViewer} className="booking-documents-file-name">{latestFile?.fileName || latestDocument.title}</button>
                    <span>Received {new Date(latestDocument.receivedAt || latestDocument.createdAt || 0).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {formatBytes(latestFile?.size)}</span>
                  </> : <span>Nothing on file yet</span>}
                </div>
                <div className="booking-documents-actions">
                  {received && <>
                    <button type="button" onClick={openViewer}>View</button>
                    <a href={latestFile?.url || (latestDocument?._id && storedPath ? bookingDocumentsApi.getFileViewUrl(latestDocument._id, storedPath) : undefined)} target="_blank" rel="noreferrer">Download</a>
                  </>}
                  <input id={inputId} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic,.heif" onChange={(event) => { handleUpload(section, event.target.files); event.target.value = ''; }} disabled={Boolean(uploadingType)} />
                  <label htmlFor={inputId} className={received ? 'booking-documents-add' : 'booking-documents-upload'}><Upload size={14} />{uploadingType === section.type ? 'Uploading…' : received ? 'Add another' : 'Upload'}</label>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="booking-documents-section booking-documents-medical-section">
        <div className="booking-documents-section-title">
          <h3>Entry medical documents</h3>
          <span>{medicalReceivedCount} of {medicalRows.length} on file</span>
        </div>
        <div className="booking-documents-rows">
          {medicalRows.map((row, index) => {
            const artifact = entryMedicalArtifacts.find((candidate) => entryMedicalType(candidate) === row.type);
            const file = artifact?.files?.[0];
            const received = Boolean(file);
            const inputId = `booking-medical-document-${row.type}`;
            return (
              <article className={`booking-documents-row ${received ? 'is-received' : 'is-missing'}`} key={row.type}>
                <div className="booking-documents-number">{String(orderedSections.length + index + 1).padStart(2, '0')}</div>
                <div className="booking-documents-icon">{row.icon}</div>
                <div className="booking-documents-copy">
                  <div className="booking-documents-name-line"><strong>{row.title}</strong>{!received && <span className="booking-documents-required">Required</span>}</div>
                  <p>{row.description}</p>
                </div>
                <div className="booking-documents-file">{received ? <><strong>{file?.fileName || row.title}</strong><span>Received {new Date(artifact?.receivedAt || artifact?.createdAt || 0).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {formatBytes(file?.size)}</span></> : <span>Nothing on file yet</span>}</div>
                <div className="booking-documents-actions">
                  <input id={inputId} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.heic,.heif" onChange={(event) => { handleMedicalUpload(row.type, event.target.files); event.target.value = ''; }} disabled={Boolean(uploadingType)} />
                  <label htmlFor={inputId} className={received ? 'booking-documents-add' : 'booking-documents-upload'}><Upload size={14} />{uploadingType === row.type ? 'Uploading…' : received ? 'Add another' : 'Upload'}</label>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      {viewer && (
        <div className="booking-document-viewer-backdrop" role="dialog" aria-modal="true" aria-label="Booking document viewer">
          <div className="booking-document-viewer">
            <div className="booking-document-viewer-header">
              <div>
                <strong>{viewer.file.fileName || viewer.document.title}</strong>
                <div>{viewer.document.title} #{viewer.document.display_id || viewer.document._id}</div>
              </div>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setViewer(null)}>Close</button>
            </div>
            <div className="booking-document-viewer-body">
              {viewer.file.mimeType?.startsWith('image/') ? (
                <img src={viewer.viewUrl} alt={viewer.file.fileName || viewer.document.title} />
              ) : (
                <iframe src={viewer.viewUrl} title={viewer.file.fileName || viewer.document.title} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingDocumentsUpload;
