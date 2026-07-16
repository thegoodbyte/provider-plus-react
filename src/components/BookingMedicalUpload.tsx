import React, { useEffect, useMemo, useState } from 'react';
import { Eye, FileText, RefreshCw, Save, Send, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { bookingFlowApi, clientMedicalApi, medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';
import { usersApi, User } from '../services/usersApi';
import { BookingFlowItem, ClientMedical, MedicalArtifact, MedicalReviewRequest } from '../types';
import { buildBookingFlowArtifactFilters } from './bookingFlowLookup';
import './BookingMedicalUpload.css';

interface BookingMedicalUploadProps {
  bookingId: string;
  bookingNumber?: string | number;
  clientId: string;
  retreatId: string;
  onUploadComplete?: () => void;
}

type BookingMedicalTestType = 'ekg' | 'liver_panel';
type BookingDocumentType = Extract<MedicalArtifact['documentType'], 'EKG' | 'Liver'>;

const medicalTestSections: Array<{
  type: BookingMedicalTestType;
  documentType: BookingDocumentType;
  title: string;
  requestType: MedicalReviewRequest['requestType'];
  description: string;
}> = [
  {
    type: 'ekg',
    documentType: 'EKG',
    title: 'EKG',
    requestType: 'ekg_review',
    description: 'Required EKG result for this booking.',
  },
  {
    type: 'liver_panel',
    documentType: 'Liver',
    title: 'Liver Panel',
    requestType: 'liver_panel_review',
    description: 'Required liver panel test result for this booking.',
  },
];

const getApiErrorMessage = (error: any) => {
  const status = error?.response?.status;
  const message = error?.response?.data?.message || error?.message;
  if (status === 503 || /s3|storage|configured|configuration/i.test(message || '')) {
    return 'Upload error: storage is misconfigured. Check S3 settings before uploading files.';
  }
  return message || 'Upload error. Please try again.';
};

const formatDate = (value?: Date | string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

const formatBytes = (size?: number) => {
  if (!size) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const artifactDate = (artifact: MedicalArtifact) =>
  new Date(artifact.receivedAt || artifact.createdAt || 0).getTime();

const hasArtifactFiles = (artifact: MedicalArtifact) => (artifact.files || []).length > 0;

const compareArtifactsForDisplay = (a: MedicalArtifact, b: MedicalArtifact) => {
  const fileScore = Number(hasArtifactFiles(b)) - Number(hasArtifactFiles(a));
  if (fileScore !== 0) return fileScore;
  return artifactDate(b) - artifactDate(a);
};

const reviewDate = (review: MedicalReviewRequest) =>
  new Date(review.reviewedAt || review.requestedAt || review.createdAt || 0).getTime();

const mergeArtifacts = (artifactGroups: MedicalArtifact[][]) => {
  const seen = new Set<string>();
  return artifactGroups.flat().filter((artifact) => {
    const key = artifact._id || `${artifact.artifactType}:${artifact.title}:${artifact.createdAt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getLatestReview = (reviews: MedicalReviewRequest[] = []) =>
  [...reviews].sort((a, b) => reviewDate(b) - reviewDate(a))[0];

const getObjectId = (value: any) => typeof value === 'object' ? value?._id || value?.id : value;

const normalizeText = (value: any) => String(value || '').trim().toLowerCase();

const artifactMatchesBookingNumber = (artifact: MedicalArtifact, bookingNumber?: string | number) => {
  const normalizedBookingNumber = normalizeText(bookingNumber);
  if (!normalizedBookingNumber) return false;

  const searchableValues = [
    artifact.title,
    artifact.description,
    artifact.notes,
    artifact.textContent,
    artifact.data?.bookingNumber,
    artifact.data?.booking_number,
    artifact.data?.bookingNo,
    ...(artifact.tags || []),
  ];

  return searchableValues.some((value) => normalizeText(value).includes(normalizedBookingNumber));
};

const artifactBelongsToBooking = (artifact: MedicalArtifact, bookingId: string, bookingNumber?: string | number) => {
  const artifactBookingId = getObjectId(artifact.bookingId);
  return artifactBookingId === bookingId || artifactMatchesBookingNumber(artifact, bookingNumber);
};

const getReviewDecisionInfo = (review?: MedicalReviewRequest) => {
  const rawDecision = review?.reviewDecision || review?.decision;
  if (!review) return { label: 'No medical review', className: 'badge-pending' };
  if (!rawDecision) return { label: 'No decision', className: 'badge-pending' };
  if (rawDecision === 'OK' || rawDecision === 'approved') return { label: 'OK', className: 'badge-approved' };
  if (rawDecision === 'NOT OK' || rawDecision === 'declined') return { label: 'Declined', className: 'badge-rejected' };
  if (rawDecision === 'caution') return { label: 'Caution', className: 'badge-caution' };
  return { label: String(rawDecision).replace(/_/g, ' '), className: 'badge-default' };
};

const getFlowReceiptKey = (sectionType: BookingMedicalTestType) =>
  sectionType === 'ekg' ? 'ekg_received' : 'liver_received';

const getFlowReadinessGroup = (sectionType: BookingMedicalTestType) =>
  sectionType === 'ekg' ? 'ekg' : 'liver';

const artifactMatchesSection = (artifact: MedicalArtifact, section: (typeof medicalTestSections)[number]) =>
  artifact.artifactType === section.type ||
  (artifact.documentStage === 'entry' && artifact.documentType === section.documentType);

const getArtifactResultText = (artifact?: MedicalArtifact) => {
  const dataResult = artifact?.data?.resultText;
  if (typeof dataResult === 'string' && dataResult.trim()) return dataResult;
  return artifact?.textContent || artifact?.notes || '';
};

const getReviewBadgeClass = (review?: MedicalReviewRequest) => {
  if (!review) return 'badge-pending';
  if (review.status === 'approved' || review.status === 'completed') return 'badge-approved';
  if (review.status === 'rejected' || review.status === 'needs_resubmission') return 'badge-rejected';
  if (review.status === 'caution') return 'badge-caution';
  if (review.status === 'in_review') return 'badge-received';
  return 'badge-pending';
};

const getReviewLabel = (review?: MedicalReviewRequest) => {
  if (!review) return 'Review required';
  if (review.status === 'completed') return review.reviewDecision || 'completed';
  return review.status.replace(/_/g, ' ');
};

const BookingMedicalUpload: React.FC<BookingMedicalUploadProps> = ({
  bookingId,
  bookingNumber,
  clientId,
  retreatId,
  onUploadComplete,
}) => {
  const navigate = useNavigate();
  const [artifacts, setArtifacts] = useState<MedicalArtifact[]>([]);
  const [reviewsByArtifact, setReviewsByArtifact] = useState<Record<string, MedicalReviewRequest[]>>({});
  const [loading, setLoading] = useState(false);
  const [uploadingType, setUploadingType] = useState<BookingMedicalTestType | null>(null);
  const [creatingReviewFor, setCreatingReviewFor] = useState<string | null>(null);
  const [savingResultType, setSavingResultType] = useState<BookingMedicalTestType | null>(null);
  const [medicalAdvisors, setMedicalAdvisors] = useState<User[]>([]);
  const [advisorSelections, setAdvisorSelections] = useState<Record<BookingMedicalTestType, string>>({
    ekg: '',
    liver_panel: '',
  });
  const [resultDrafts, setResultDrafts] = useState<Record<BookingMedicalTestType, string>>({
    ekg: '',
    liver_panel: '',
  });
  const [markedArtifactIds, setMarkedArtifactIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const loadMedicalArtifacts = async () => {
    setLoading(true);
    setError(null);
    try {
      const itemsResponse = await bookingFlowApi.getItems({ bookingId });
      const bookingFlowFilters = buildBookingFlowArtifactFilters(itemsResponse.data || []);
      const responses = await Promise.all([
        medicalArtifactsApi.getAll({ bookingId, ...bookingFlowFilters }),
        medicalArtifactsApi.getAll({ bookingId }),
        clientId && retreatId ? medicalArtifactsApi.getAll({ clientId, retreatId, ...bookingFlowFilters }) : Promise.resolve({ data: [] }),
      ]);
      const directBookingArtifacts: MedicalArtifact[] = responses[0].data || [];
      const bookingArtifacts: MedicalArtifact[] = responses[1].data || [];
      const clientRetreatArtifacts: MedicalArtifact[] = responses[2].data || [];
      const bookingNumberFallbackArtifacts = [...bookingArtifacts, ...clientRetreatArtifacts].filter((artifact) =>
        artifactBelongsToBooking(artifact, bookingId, bookingNumber)
      );
      const medicalArtifacts: MedicalArtifact[] = mergeArtifacts([directBookingArtifacts, bookingNumberFallbackArtifacts]).filter((artifact) =>
        medicalTestSections.some((section) => artifactMatchesSection(artifact, section) && artifactBelongsToBooking(artifact, bookingId, bookingNumber))
      );
      setArtifacts(medicalArtifacts);

      const reviewEntries = await Promise.all(
        medicalArtifacts
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
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Unable to load booking medical tests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedicalArtifacts();
    usersApi.getAll()
      .then((response) => {
        const advisors = (response.data || []).filter((user) => user.role === 'medical_advisor' && user.isActive !== false);
        setMedicalAdvisors(advisors);
        if (advisors.length === 1) {
          setAdvisorSelections({ ekg: advisors[0]._id, liver_panel: advisors[0]._id });
        }
      })
      .catch((advisorError) => {
        console.error('Error loading medical advisors:', advisorError);
        setMedicalAdvisors([]);
      });
  }, [bookingId, bookingNumber, clientId, retreatId]);

  const artifactsByType = useMemo(() => {
    return medicalTestSections.reduce<Record<BookingMedicalTestType, MedicalArtifact[]>>((acc, section) => {
      acc[section.type] = artifacts
        .filter((artifact) => artifactMatchesSection(artifact, section))
        .sort(compareArtifactsForDisplay);
      return acc;
    }, {
      ekg: [],
      liver_panel: [],
    });
  }, [artifacts]);

  useEffect(() => {
    setResultDrafts({
      ekg: getArtifactResultText(artifactsByType.ekg[0]),
      liver_panel: getArtifactResultText(artifactsByType.liver_panel[0]),
    });
  }, [artifactsByType]);

  const upsertClientMedicalResult = async (sectionType: BookingMedicalTestType, resultText: string) => {
    const now = new Date().toISOString();
    const update: Partial<ClientMedical> = sectionType === 'ekg'
      ? {
          ekgResults: resultText,
          ekgReceivedDate: now,
          ekgStatus: 'received',
        }
      : {
          liverPanelResults: resultText,
          liverPanelReceivedDate: now,
          liverPanelStatus: 'received',
        };

    try {
      const existing = await clientMedicalApi.getByClientAndRetreat(clientId, retreatId);
      if (existing.data?._id) {
        await clientMedicalApi.update(existing.data._id, update);
        return;
      }
    } catch (medicalLoadError: any) {
      if (medicalLoadError?.response?.status && medicalLoadError.response.status !== 404) {
        throw medicalLoadError;
      }
    }

    await clientMedicalApi.create({
      clientId,
      retreatId,
      liverPanelStatus: sectionType === 'liver_panel' ? 'received' : 'pending',
      ekgStatus: sectionType === 'ekg' ? 'received' : 'pending',
      finalMedicalClearance: false,
      ...update,
    } as any);
  };

  const markBookingFlowReceived = async (sectionType: BookingMedicalTestType, artifact?: MedicalArtifact) => {
    const key = getFlowReceiptKey(sectionType);
    const readinessGroup = getFlowReadinessGroup(sectionType);
    const expectedArtifact = sectionType;

    let items: BookingFlowItem[] = [];
    try {
      const response = await bookingFlowApi.getItems({ bookingId });
      items = response.data || [];
      if (!items.length) {
        await bookingFlowApi.generateForBooking(bookingId);
        const generatedResponse = await bookingFlowApi.getItems({ bookingId });
        items = generatedResponse.data || [];
      }
    } catch (error) {
      console.error('Unable to load booking flow items after medical upload:', error);
      return;
    }

    const item = items.find((candidate) => {
      const template = typeof candidate.templateId === 'object' ? candidate.templateId : undefined;
      const itemReadinessGroup = candidate.metadata?.readinessGroup || template?.readinessGroup;
      const itemExpectedArtifact = candidate.metadata?.expectedArtifact || template?.expectedArtifact;
      return candidate.key === key ||
        itemReadinessGroup === readinessGroup ||
        itemExpectedArtifact === expectedArtifact;
    });

    if (!item?._id) return;

    await bookingFlowApi.updateItem(item._id, {
      status: 'received',
      receivedAt: new Date().toISOString(),
      notes: `${sectionType === 'ekg' ? 'EKG' : 'Liver panel'} received from booking upload${artifact?.display_id ? ` (artifact #${artifact.display_id})` : ''}.`,
      metadata: {
        ...(item.metadata || {}),
        receivedArtifactId: artifact?._id,
        receivedArtifactDisplayId: artifact?.display_id,
        receivedFrom: 'booking-medical-upload',
      },
    } as Partial<BookingFlowItem>);
  };

  useEffect(() => {
    const candidates = medicalTestSections
      .map((section) => {
        const artifact = artifactsByType[section.type][0];
        return { section, artifact };
      })
      .filter(({ artifact }) => artifact?._id && ((artifact.files || []).length > 0 || getArtifactResultText(artifact)));

    const unmarked = candidates.filter(({ artifact }) => artifact?._id && !markedArtifactIds.has(artifact._id));
    if (!unmarked.length) return;

    setMarkedArtifactIds((current) => {
      const next = new Set(current);
      unmarked.forEach(({ artifact }) => {
        if (artifact?._id) next.add(artifact._id);
      });
      return next;
    });

    unmarked.forEach(({ section, artifact }) => {
      if (!artifact) return;
      markBookingFlowReceived(section.type, artifact)
        .then(() => onUploadComplete?.())
        .catch((error) => console.error(`Unable to mark ${section.title} as received:`, error));
    });
  }, [artifactsByType, markedArtifactIds, onUploadComplete]);

  const saveResult = async (section: (typeof medicalTestSections)[number], latestArtifact?: MedicalArtifact) => {
    const resultText = resultDrafts[section.type].trim();
    if (!resultText) {
      setError(`Enter ${section.title} results before saving.`);
      return;
    }

    setSavingResultType(section.type);
    setError(null);
    try {
      const now = new Date().toISOString();
      const artifactPayload = {
        textContent: resultText,
        notes: resultText,
        data: {
          ...(latestArtifact?.data || {}),
          resultText,
          resultRecordedAt: now,
          resultSource: 'booking',
          bookingId,
          bookingNumber,
        },
        contextType: 'booking' as const,
        documentStage: 'entry' as const,
        documentType: section.documentType,
        purpose: 'booking_requirement' as const,
        tags: Array.from(new Set([...(latestArtifact?.tags || []), 'booking-requirement'])),
        receivedAt: latestArtifact?.receivedAt || now,
        status: 'stored' as const,
      };

      if (latestArtifact?._id) {
        await medicalArtifactsApi.update(latestArtifact._id, artifactPayload);
      } else {
        await medicalArtifactsApi.create({
          clientId,
          retreatId,
          bookingId,
          artifactType: section.type,
          title: `${section.title} Results${bookingNumber ? ` - Booking ${bookingNumber}` : ''}`,
          description: section.description,
          source: 'manual',
          ...artifactPayload,
        });
      }

      await upsertClientMedicalResult(section.type, resultText);
      await markBookingFlowReceived(section.type, latestArtifact);
      await loadMedicalArtifacts();
      onUploadComplete?.();
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || saveError?.message || `Unable to save ${section.title} results.`);
    } finally {
      setSavingResultType(null);
    }
  };

  const createReviewRequest = async (artifact: MedicalArtifact, section: (typeof medicalTestSections)[number]) => {
    if (!artifact._id) return undefined;
    const advisorId = advisorSelections[section.type];
    if (!advisorId) {
      setError('Select a medical advisor before creating the medical review request.');
      return undefined;
    }
    const advisor = medicalAdvisors.find((item) => item._id === advisorId);
    setCreatingReviewFor(artifact._id);
    setError(null);
    try {
      const response = await medicalReviewRequestsApi.createFromArtifact(artifact._id, section.requestType, {
        assignedToUserId: advisorId,
        medicalStaffNotes: `${artifact.title} linked to booking ${bookingNumber || bookingId}${advisor?.email ? ` and assigned to ${advisor.email}` : ''}.`,
      });
      await loadMedicalArtifacts();
      return response.data;
    } catch (reviewError: any) {
      setError(reviewError?.response?.data?.message || reviewError?.message || 'Unable to create medical review request.');
      return undefined;
    } finally {
      setCreatingReviewFor(null);
    }
  };

  const handleUpload = async (section: (typeof medicalTestSections)[number], files: FileList | null) => {
    if (!files?.length) return;

    setUploadingType(section.type);
    setError(null);
    try {
      const fileArray = Array.from(files);
      const created = await medicalArtifactsApi.create({
        clientId,
        retreatId,
        bookingId,
        artifactType: section.type,
        contextType: 'booking',
        documentStage: 'entry',
        documentType: section.documentType,
        purpose: 'booking_requirement',
        title: `${section.title}${bookingNumber ? ` - Booking ${bookingNumber}` : ''}`,
        description: section.description,
        source: 'admin_upload',
        status: 'stored',
        data: {
          bookingId,
          bookingNumber,
        },
        tags: ['booking-requirement', bookingNumber ? `booking-${bookingNumber}` : ''].filter(Boolean),
      });

      if (created.data._id) {
        let uploadResponse;
        try {
          uploadResponse = await medicalArtifactsApi.uploadFiles(created.data._id, fileArray);
        } catch (uploadError) {
          await medicalArtifactsApi.delete(created.data._id).catch((rollbackError) => {
            console.error('Error rolling back empty medical artifact:', rollbackError);
          });
          throw uploadError;
        }
        const uploadedArtifact = uploadResponse.data?.artifact || created.data;
        await createReviewRequest(uploadedArtifact, section);
        await markBookingFlowReceived(section.type, uploadedArtifact);
      }

      await loadMedicalArtifacts();
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
          <h3>Booking Medical Tests</h3>
          <p>Each booking requires an EKG and liver panel artifact, plus a linked medical review request.</p>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={loadMedicalArtifacts} disabled={loading}>
          <RefreshCw size={16} /> {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="booking-documents-grid">
        {medicalTestSections.map((section) => {
          const sectionArtifacts = artifactsByType[section.type];
          const latestArtifact = sectionArtifacts[0];
          const latestReview = latestArtifact?._id ? getLatestReview(reviewsByArtifact[latestArtifact._id]) : undefined;
          const latestResult = getArtifactResultText(latestArtifact);
          const latestDecision = getReviewDecisionInfo(latestReview);
          const inputId = `booking-medical-${section.type}`;
          const isUploading = uploadingType === section.type;
          const isSavingResult = savingResultType === section.type;
          const isCreatingReview = latestArtifact?._id && creatingReviewFor === latestArtifact._id;
          const selectedAdvisorId = advisorSelections[section.type] || '';

          return (
            <div key={section.type} className="booking-document-card">
              <div className="booking-document-card-header">
                <FileText size={20} />
                <div>
                  <h4>{section.title}</h4>
                  <p>{section.description}</p>
                </div>
              </div>

              <div className="booking-medical-status-row">
                <span className={`status-badge ${latestArtifact ? 'badge-received' : 'badge-pending'}`}>
                  {latestArtifact ? 'artifact stored' : 'missing artifact'}
                </span>
                <span className={`status-badge ${getReviewBadgeClass(latestReview)}`}>
                  {getReviewLabel(latestReview)}
                </span>
                <span className={`status-badge ${latestResult ? 'badge-approved' : 'badge-pending'}`}>
                  {latestResult ? 'results saved' : 'results missing'}
                </span>
              </div>

              <div className="booking-medical-required-item">
                <div>
                  <span className="booking-medical-required-label">Required entry document</span>
                  <strong>{section.title}</strong>
                </div>
                <div>
                  <span className="booking-medical-required-label">Medical review</span>
                  {latestReview?._id ? (
                    <button
                      type="button"
                      className="booking-medical-inline-link"
                      onClick={() => navigate(`/medical-review-requests/${latestReview._id}`)}
                    >
                      Review #{latestReview.display_id || latestReview._id}
                    </button>
                  ) : (
                    <span>No review</span>
                  )}
                </div>
                <div>
                  <span className="booking-medical-required-label">Medical advisor</span>
                  {latestReview?._id ? (
                    <span>{typeof latestReview.assignedToUserId === 'object'
                      ? [latestReview.assignedToUserId.firstName, latestReview.assignedToUserId.lastName].filter(Boolean).join(' ') || latestReview.assignedToUserId.email || 'Assigned'
                      : 'Assigned'}</span>
                  ) : (
                    <select
                      value={selectedAdvisorId}
                      onChange={(event) => setAdvisorSelections((current) => ({ ...current, [section.type]: event.target.value }))}
                      className="booking-medical-advisor-select"
                    >
                      <option value="">Select advisor</option>
                      {medicalAdvisors.map((advisor) => (
                        <option key={advisor._id} value={advisor._id}>
                          {[advisor.firstName, advisor.lastName].filter(Boolean).join(' ') || advisor.email}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <span className="booking-medical-required-label">Decision</span>
                  <span className={`status-badge ${latestDecision.className}`}>{latestDecision.label}</span>
                </div>
              </div>

              <div className="booking-medical-result-editor">
                <label htmlFor={`booking-medical-result-${section.type}`}>{section.title} results</label>
                <textarea
                  id={`booking-medical-result-${section.type}`}
                  rows={4}
                  value={resultDrafts[section.type]}
                  onChange={(event) => setResultDrafts((current) => ({ ...current, [section.type]: event.target.value }))}
                  placeholder={`Enter ${section.title} results, values, interpretation, or notes`}
                  disabled={isSavingResult}
                />
                <button
                  className="btn btn-sm btn-secondary"
                  type="button"
                  disabled={isSavingResult}
                  onClick={() => saveResult(section, latestArtifact)}
                >
                  <Save size={16} /> {isSavingResult ? 'Saving...' : 'Save Results'}
                </button>
              </div>

              <div className="booking-document-files">
                {!latestArtifact ? (
                  <div className="booking-document-empty">No {section.title} file uploaded yet.</div>
                ) : (
                  sectionArtifacts.map((artifact) => {
                    const review = artifact._id ? getLatestReview(reviewsByArtifact[artifact._id]) : undefined;
                    const decision = getReviewDecisionInfo(review);
                    return (
                      <div key={artifact._id} className="booking-document-file-row">
                        <div className="booking-medical-file-heading">
                          <button
                            type="button"
                            className="booking-medical-inline-link"
                            onClick={() => artifact._id && navigate(`/medical-artifacts/${artifact._id}`)}
                          >
                            Artifact #{artifact.display_id || artifact._id}
                          </button>
                          <span>Received: {formatDate(artifact.receivedAt || artifact.createdAt)}</span>
                        </div>
                        <div className="booking-medical-file-title">{artifact.title}</div>
                        <div className="booking-medical-review-line">
                          <span>
                            Medical review:{' '}
                            {review?._id ? (
                              <button
                                type="button"
                                className="booking-medical-inline-link"
                                onClick={() => navigate(`/medical-review-requests/${review._id}`)}
                              >
                                Review #{review.display_id || review._id}
                              </button>
                            ) : (
                              'No review'
                            )}
                          </span>
                          <span className={`status-badge ${decision.className}`}>{decision.label}</span>
                        </div>
                        <div className="booking-document-file-list">
                          {(artifact.files || []).length === 0 ? (
                            <span>No files attached.</span>
                          ) : (
                            (artifact.files || []).map((file, index) => (
                              <span key={`${file.s3Key || file.filePath || file.fileName}-${index}`}>
                                {file.fileName || 'Uploaded file'} ({formatBytes(file.size)})
                              </span>
                            ))
                          )}
                        </div>
                        <div className="booking-medical-actions">
                          {artifact._id && (
                            <button
                              className="btn btn-sm btn-secondary"
                              type="button"
                              onClick={() => navigate(`/medical-artifacts/${artifact._id}`)}
                            >
                              <Eye size={16} /> Artifact
                            </button>
                          )}
                          {review?._id ? (
                            <button
                              className="btn btn-sm btn-secondary"
                              type="button"
                              onClick={() => navigate(`/medical-review-requests/${review._id}`)}
                            >
                              <Eye size={16} /> Review #{review.display_id || review._id}
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm btn-primary"
                              type="button"
                              disabled={!artifact._id || !selectedAdvisorId || creatingReviewFor === artifact._id}
                              onClick={() => createReviewRequest(artifact, section)}
                            >
                              <Send size={16} /> {creatingReviewFor === artifact._id ? 'Creating...' : 'Create Review'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="upload-section">
                <input
                  type="file"
                  id={inputId}
                  accept=".pdf,.jpg,.jpeg,.png,.heic,.heif"
                  multiple
                  onChange={(event) => {
                    handleUpload(section, event.target.files);
                    event.target.value = '';
                  }}
                  disabled={Boolean(uploadingType)}
                />
                <label htmlFor={inputId} className="btn btn-sm btn-primary">
                  <Upload size={16} /> {isUploading || isCreatingReview ? 'Working...' : `Upload ${section.title}`}
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BookingMedicalUpload;
