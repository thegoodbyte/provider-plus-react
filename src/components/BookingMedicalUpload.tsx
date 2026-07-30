import React, { useEffect, useMemo, useState } from 'react';
import { Check, Eye, FileText, Pencil, Plus, RefreshCw, Send, Trash2, Upload, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { bloodPressureReadingsApi, bookingFlowApi, ceremoniesApi, medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';
import { usersApi, User } from '../services/usersApi';
import { BloodPressureReading, BookingFlowItem, Ceremony, MedicalArtifact, MedicalReviewRequest } from '../types';
import { buildBookingFlowArtifactFilters } from './bookingFlowLookup';
import './BookingMedicalUpload.css';

interface BookingMedicalUploadProps {
  bookingId: string;
  bookingNumber?: string | number;
  clientId: string;
  retreatId: string;
  onUploadComplete?: () => void;
  uploadRequest?: {
    stage: NonNullable<MedicalArtifact['documentStage']>;
    key: number;
  } | null;
}

type BookingMedicalTestType = 'ekg' | 'liver_panel' | 'medications_form';
type BookingDocumentType = Extract<MedicalArtifact['documentType'], 'EKG' | 'Liver' | 'Medications'>;
type UploadDocumentType = Extract<MedicalArtifact['documentType'], 'EKG' | 'Liver' | 'BP' | 'Medications' | 'additional' | 'other'>;
type MedicalView = 'documents' | 'blood_pressure';

const newBloodPressureReading = (): Partial<BloodPressureReading> => ({
  systolic: undefined,
  diastolic: undefined,
  pulse: undefined,
  recordedAt: new Date().toISOString(),
  notes: '',
  context: 'other',
});

const bloodPressureContextLabels: Record<NonNullable<BloodPressureReading['context']>, string> = {
  client_monitoring: 'Client monitoring',
  arrival: 'On arrival',
  pre_ceremony: 'Before ceremony',
  in_ceremony: 'During ceremony',
  post_ceremony: 'After ceremony',
  other: 'Other',
};

const documentStageForBloodPressure = (context?: BloodPressureReading['context']): NonNullable<MedicalArtifact['documentStage']> => {
  if (context === 'pre_ceremony') return 'pre_ceremony';
  if (context === 'in_ceremony') return 'in_ceremony';
  if (context === 'post_ceremony') return 'post_ceremony';
  return context === 'client_monitoring' || context === 'arrival' ? 'entry' : 'other';
};

const uploadDocumentOptions: Array<{ value: UploadDocumentType; label: string }> = [
  { value: 'EKG', label: 'EKG' },
  { value: 'Liver', label: 'Liver panel' },
  { value: 'BP', label: 'Blood pressure' },
  { value: 'Medications', label: 'Medications' },
  { value: 'additional', label: 'Additional medical document' },
  { value: 'other', label: 'Other' },
];

const getArtifactTypeForDocument = (
  documentType: UploadDocumentType,
  stage: NonNullable<MedicalArtifact['documentStage']>
): NonNullable<MedicalArtifact['artifactType']> => {
  if (documentType === 'EKG') return ['pre_ceremony', 'in_ceremony', 'post_ceremony'].includes(stage) ? 'ceremony_ekg' : 'ekg';
  if (documentType === 'Liver') return 'liver_panel';
  if (documentType === 'BP') return 'blood_pressure';
  if (documentType === 'Medications') return 'medications_form';
  return 'other';
};

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
  {
    type: 'medications_form',
    documentType: 'Medications',
    title: 'Medication Form Review',
    requestType: 'medications_review',
    description: 'Medication form, medical review decision, and review notes for this booking.',
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

const getFlowReceiptKey = (sectionType: BookingMedicalTestType) => {
  if (sectionType === 'ekg') return 'ekg_received';
  if (sectionType === 'liver_panel') return 'liver_received';
  return 'medications_form_initial_received';
};

const getFlowReadinessGroup = (sectionType: BookingMedicalTestType) => {
  if (sectionType === 'ekg') return 'ekg';
  if (sectionType === 'liver_panel') return 'liver';
  return 'medications';
};

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
  uploadRequest,
}) => {
  const navigate = useNavigate();
  const [artifacts, setArtifacts] = useState<MedicalArtifact[]>([]);
  const [flowItems, setFlowItems] = useState<BookingFlowItem[]>([]);
  const [reviewsByArtifact, setReviewsByArtifact] = useState<Record<string, MedicalReviewRequest[]>>({});
  const [loading, setLoading] = useState(false);
  const [uploadingType, setUploadingType] = useState<NonNullable<MedicalArtifact['artifactType']> | null>(null);
  const [creatingReviewFor, setCreatingReviewFor] = useState<string | null>(null);
  const [markingReceivedType, setMarkingReceivedType] = useState<BookingMedicalTestType | null>(null);
  const [medicalAdvisors, setMedicalAdvisors] = useState<User[]>([]);
  const [advisorSelections, setAdvisorSelections] = useState<Record<BookingMedicalTestType, string>>({
    ekg: '',
    liver_panel: '',
    medications_form: '',
  });
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadDocumentType, setUploadDocumentType] = useState<UploadDocumentType>('additional');
  const [uploadDocumentStage, setUploadDocumentStage] = useState<NonNullable<MedicalArtifact['documentStage']>>('entry');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCeremonyId, setUploadCeremonyId] = useState('');
  const [retreatCeremonies, setRetreatCeremonies] = useState<Ceremony[]>([]);
  const [loadingRetreatCeremonies, setLoadingRetreatCeremonies] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bloodPressureReadings, setBloodPressureReadings] = useState<BloodPressureReading[]>([]);
  const [editingReading, setEditingReading] = useState<BloodPressureReading | null>(null);
  const [savingReading, setSavingReading] = useState(false);
  const [medicalView, setMedicalView] = useState<MedicalView>('documents');
  const [addingReading, setAddingReading] = useState(false);
  const [newReading, setNewReading] = useState<Partial<BloodPressureReading>>(newBloodPressureReading);
  const [creatingBpReviewFor, setCreatingBpReviewFor] = useState<string | null>(null);

  const addReading = async () => {
    if (!newReading.systolic || !newReading.diastolic || !newReading.recordedAt) {
      setError('Enter SYS, DIA, and the reading date/time.');
      return;
    }
    setSavingReading(true);
    setError(null);
    try {
      await bloodPressureReadingsApi.create({
        clientId,
        bookingId,
        retreatId,
        systolic: Number(newReading.systolic),
        diastolic: Number(newReading.diastolic),
        pulse: newReading.pulse ? Number(newReading.pulse) : undefined,
        recordedAt: newReading.recordedAt,
        notes: newReading.notes,
        context: newReading.context || 'other',
        ceremonyNumber: newReading.ceremonyNumber,
      });
      const response = await bloodPressureReadingsApi.getByClient(clientId);
      setBloodPressureReadings(response.data || []);
      setNewReading(newBloodPressureReading());
      setAddingReading(false);
    } catch (readingError: any) {
      setError(readingError?.response?.data?.message || 'Unable to add blood-pressure reading.');
    } finally {
      setSavingReading(false);
    }
  };

  const createBloodPressureReview = async (reading: BloodPressureReading) => {
    if (!reading._id) return;
    setCreatingBpReviewFor(reading._id);
    setError(null);
    try {
      let artifactId = typeof reading.medicalArtifactId === 'string' ? reading.medicalArtifactId : '';
      if (!artifactId) {
        const created = await medicalArtifactsApi.create({
          clientId,
          bookingId,
          retreatId,
          artifactType: 'blood_pressure',
          documentType: 'BP',
          documentStage: documentStageForBloodPressure(reading.context),
          ceremonyNumber: reading.ceremonyNumber,
          contextType: reading.ceremonyNumber ? 'ceremony' : 'booking',
          purpose: reading.context === 'pre_ceremony' ? 'pre_ceremony' : 'general',
          title: `Blood pressure ${reading.systolic}/${reading.diastolic}`,
          textContent: `${reading.systolic}/${reading.diastolic} mmHg${reading.pulse ? ` · pulse ${reading.pulse} bpm` : ''}`,
          data: {
            bloodPressureReadingId: reading._id,
            systolic: reading.systolic,
            diastolic: reading.diastolic,
            pulse: reading.pulse,
            recordedAt: reading.recordedAt,
            context: reading.context,
            ceremonyNumber: reading.ceremonyNumber,
          },
          receivedAt: reading.recordedAt,
          source: reading.source === 'ibogaready' ? 'client_upload' : 'manual',
          notes: reading.notes,
        });
        artifactId = created.data._id || '';
        if (artifactId) await bloodPressureReadingsApi.update(reading._id, { medicalArtifactId: artifactId });
      }
      if (!artifactId) throw new Error('Unable to create a BP medical artifact.');
      const response = await medicalReviewRequestsApi.createFromArtifact(artifactId, 'blood_pressure_review', {
        medicalStaffNotes: `Review BP ${reading.systolic}/${reading.diastolic}${reading.pulse ? `, pulse ${reading.pulse}` : ''} recorded ${new Date(reading.recordedAt).toLocaleString()}.`,
      });
      await loadMedicalArtifacts();
      if (response.data?._id) navigate(`/medical-review-requests/${response.data._id}`);
    } catch (reviewError: any) {
      setError(reviewError?.response?.data?.message || reviewError?.message || 'Unable to create BP medical review request.');
    } finally {
      setCreatingBpReviewFor(null);
    }
  };

  const saveReading = async () => {
    if (!editingReading?._id) return;
    setSavingReading(true);
    try {
      await bloodPressureReadingsApi.update(editingReading._id, editingReading);
      setEditingReading(null);
      const response = await bloodPressureReadingsApi.getByClient(clientId);
      setBloodPressureReadings(response.data || []);
    } catch (readingError: any) {
      setError(readingError?.response?.data?.message || 'Unable to update blood-pressure reading.');
    } finally {
      setSavingReading(false);
    }
  };

  const deleteReading = async (reading: BloodPressureReading) => {
    if (!reading._id || !window.confirm(`Delete the ${reading.systolic}/${reading.diastolic} reading?`)) return;
    try {
      await bloodPressureReadingsApi.delete(reading._id);
      setBloodPressureReadings((items) => items.filter((item) => item._id !== reading._id));
      if (editingReading?._id === reading._id) setEditingReading(null);
    } catch (readingError: any) {
      setError(readingError?.response?.data?.message || 'Unable to delete blood-pressure reading.');
    }
  };

  const loadMedicalArtifacts = async () => {
    setLoading(true);
    setError(null);
    try {
      const itemsResponse = await bookingFlowApi.getItems({ bookingId });
      const readingsResponse = clientId ? await bloodPressureReadingsApi.getByClient(clientId) : { data: [] };
      setBloodPressureReadings(readingsResponse.data || []);
      const loadedFlowItems: BookingFlowItem[] = itemsResponse.data || [];
      setFlowItems(loadedFlowItems);
      const bookingFlowFilters = buildBookingFlowArtifactFilters(loadedFlowItems);
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
      const medicalArtifacts: MedicalArtifact[] = mergeArtifacts([directBookingArtifacts, bookingNumberFallbackArtifacts])
        .filter((artifact) => artifactBelongsToBooking(artifact, bookingId, bookingNumber));
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
          setAdvisorSelections({ ekg: advisors[0]._id, liver_panel: advisors[0]._id, medications_form: advisors[0]._id });
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
      medications_form: [],
    });
  }, [artifacts]);

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

    const exactItem = items.find((candidate) => candidate.key === key);
    const configuredReceiptItem = items.find((candidate) => {
      const template = typeof candidate.templateId === 'object' ? candidate.templateId : undefined;
      const itemReadinessGroup = candidate.metadata?.readinessGroup || template?.readinessGroup;
      const itemExpectedArtifact = candidate.metadata?.expectedArtifact || template?.expectedArtifact;
      const autoCompleteOnArtifact = candidate.metadata?.autoCompleteOnArtifact ?? template?.autoCompleteOnArtifact;
      const isRequirement = candidate.metadata?.isRequirement ?? template?.isRequirement;
      return itemReadinessGroup === readinessGroup
        && itemExpectedArtifact === expectedArtifact
        && (autoCompleteOnArtifact === true || isRequirement === true);
    });
    const item = exactItem || configuredReceiptItem;

    if (!item?._id) return;

    const receivedAt = new Date().toISOString();
    const response = await bookingFlowApi.updateItem(item._id, {
      status: 'received',
      receivedAt,
      notes: `${sectionType === 'ekg' ? 'EKG' : sectionType === 'liver_panel' ? 'Liver panel' : 'Medication form'} received from booking upload${artifact?.display_id ? ` (artifact #${artifact.display_id})` : ''}.`,
      metadata: {
        ...(item.metadata || {}),
        receivedArtifactId: artifact?._id,
        receivedArtifactDisplayId: artifact?.display_id,
        receivedFrom: 'booking-medical-upload',
      },
    } as Partial<BookingFlowItem>);
    setFlowItems((current) => current.map((candidate) => candidate._id === item._id
      ? { ...candidate, ...(response.data || {}), status: 'received', receivedAt }
      : candidate));
  };

  const handleMarkReceived = async (section: (typeof medicalTestSections)[number], artifact: MedicalArtifact) => {
    setMarkingReceivedType(section.type);
    setError(null);
    try {
      await markBookingFlowReceived(section.type, artifact);
      onUploadComplete?.();
    } catch (markError: any) {
      setError(markError?.response?.data?.message || markError?.message || `Unable to mark ${section.title} received.`);
    } finally {
      setMarkingReceivedType(null);
    }
  };

  const createReviewRequest = async (artifact: MedicalArtifact, section: (typeof medicalTestSections)[number]) => {
    if (!artifact._id) return undefined;
    const advisorId = advisorSelections[section.type];
    const advisor = medicalAdvisors.find((item) => item._id === advisorId);
    setCreatingReviewFor(artifact._id);
    setError(null);
    try {
      const response = await medicalReviewRequestsApi.createFromArtifact(artifact._id, section.requestType, {
        ...(advisorId ? { assignedToUserId: advisorId } : {}),
        medicalStaffNotes: `${artifact.title} linked to booking ${bookingNumber || bookingId}${advisor?.email ? ` and assigned to ${advisor.email}` : ' and added to the unassigned review queue'}.`,
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

  const openUploadModal = (
    documentType: UploadDocumentType = 'additional',
    stage: NonNullable<MedicalArtifact['documentStage']> = 'entry'
  ) => {
    setUploadDocumentType(documentType);
    setUploadDocumentStage(stage);
    setUploadTitle('');
    setUploadCeremonyId('');
    setSelectedFiles([]);
    setError(null);
    setUploadModalOpen(true);
  };

  const isCeremonyUpload = ['pre_ceremony', 'in_ceremony', 'post_ceremony'].includes(uploadDocumentStage);
  const selectedUploadCeremony = retreatCeremonies.find((ceremony) => ceremony._id === uploadCeremonyId);
  const hasUploadCeremony = Boolean(uploadCeremonyId && selectedUploadCeremony?.ceremonyNumber);

  useEffect(() => {
    if (!uploadModalOpen || !retreatId) {
      setRetreatCeremonies([]);
      return;
    }
    setLoadingRetreatCeremonies(true);
    ceremoniesApi.getByRetreat(retreatId)
      .then((response) => setRetreatCeremonies((response.data || []).sort((a, b) => a.ceremonyNumber - b.ceremonyNumber)))
      .catch(() => {
        setRetreatCeremonies([]);
        setError('Unable to load ceremonies for this retreat.');
      })
      .finally(() => setLoadingRetreatCeremonies(false));
  }, [retreatId, uploadModalOpen]);

  useEffect(() => {
    if (!uploadRequest) return;
    openUploadModal(uploadRequest.stage === 'entry' ? 'EKG' : 'additional', uploadRequest.stage);
  }, [uploadRequest]);

  const handleUpload = async () => {
    if (!selectedFiles.length) {
      setError('Choose at least one document to upload.');
      return;
    }
    if (isCeremonyUpload && (!uploadCeremonyId || !selectedUploadCeremony?.ceremonyNumber)) {
      setError('Select the ceremony for this pre-, in-, or post-ceremony medical artifact.');
      return;
    }

    const artifactType = getArtifactTypeForDocument(uploadDocumentType, uploadDocumentStage);
    const section = uploadDocumentStage === 'entry'
      ? medicalTestSections.find((item) => item.type === artifactType)
      : undefined;
    const documentLabel = uploadDocumentOptions.find((item) => item.value === uploadDocumentType)?.label || 'Medical document';
    setUploadingType(artifactType);
    setError(null);
    try {
      const created = await medicalArtifactsApi.create({
        clientId,
        retreatId,
        bookingId,
        artifactType,
        contextType: hasUploadCeremony ? 'ceremony' : 'booking',
        documentStage: uploadDocumentStage,
        documentType: uploadDocumentType,
        ceremonyId: hasUploadCeremony ? uploadCeremonyId : undefined,
        ceremonyNumber: hasUploadCeremony ? selectedUploadCeremony?.ceremonyNumber : undefined,
        purpose: section
          ? 'booking_requirement'
          : uploadDocumentStage === 'pre_ceremony'
            ? 'pre_ceremony'
            : ['in_ceremony', 'post_ceremony'].includes(uploadDocumentStage)
              ? 'repeat_test'
              : 'general',
        title: uploadTitle.trim() || `${documentLabel}${bookingNumber ? ` - Booking ${bookingNumber}` : ''}`,
        description: section?.description || `Additional medical document for booking ${bookingNumber || bookingId}.`,
        source: 'admin_upload',
        status: 'stored',
        data: {
          bookingId,
          bookingNumber,
          ceremonyId: hasUploadCeremony ? uploadCeremonyId : undefined,
          ceremonyNumber: hasUploadCeremony ? selectedUploadCeremony?.ceremonyNumber : undefined,
        },
        tags: [section ? 'booking-requirement' : 'additional-medical-document', bookingNumber ? `booking-${bookingNumber}` : ''].filter(Boolean),
      });

      if (created.data._id) {
        let uploadResponse;
        try {
          uploadResponse = await medicalArtifactsApi.uploadFiles(created.data._id, selectedFiles);
        } catch (uploadError) {
          await medicalArtifactsApi.delete(created.data._id).catch((rollbackError) => {
            console.error('Error rolling back empty medical artifact:', rollbackError);
          });
          throw uploadError;
        }
        const uploadedArtifact = uploadResponse.data?.artifact || created.data;
        if (section) {
          await createReviewRequest(uploadedArtifact, section);
          await markBookingFlowReceived(section.type, uploadedArtifact);
        }
      }

      await loadMedicalArtifacts();
      onUploadComplete?.();
      setUploadModalOpen(false);
      setSelectedFiles([]);
      setUploadTitle('');
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

      <div className="mb-4 flex gap-2 border-b border-slate-200">
        <button type="button" onClick={() => setMedicalView('documents')} className={`border-b-2 px-4 py-2 text-sm font-semibold ${medicalView === 'documents' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>Medical documents</button>
        <button type="button" onClick={() => setMedicalView('blood_pressure')} className={`border-b-2 px-4 py-2 text-sm font-semibold ${medicalView === 'blood_pressure' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>All BP readings ({bloodPressureReadings.length})</button>
      </div>

      {medicalView === 'blood_pressure' && (
      <section className="mb-5 rounded-xl border border-sky-200 bg-sky-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-semibold text-slate-900">All Blood Pressure Readings</h4>
            <p className="text-sm text-slate-600">Client monitoring and readings taken on arrival, before, during, or after ceremonies.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-sky-800">{bloodPressureReadings.length} reading{bloodPressureReadings.length === 1 ? '' : 's'}</span>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setAddingReading((value) => !value)}><Plus size={16} /> Add BP</button>
          </div>
        </div>
        {addingReading && (
          <div className="mt-4 grid gap-3 rounded-lg border border-sky-200 bg-white p-3 md:grid-cols-4">
            <label className="text-xs font-semibold text-slate-600">SYS<input type="number" value={newReading.systolic || ''} onChange={(event) => setNewReading({ ...newReading, systolic: Number(event.target.value) || undefined })} className="mt-1 w-full rounded border px-3 py-2 text-base" /></label>
            <label className="text-xs font-semibold text-slate-600">DIA<input type="number" value={newReading.diastolic || ''} onChange={(event) => setNewReading({ ...newReading, diastolic: Number(event.target.value) || undefined })} className="mt-1 w-full rounded border px-3 py-2 text-base" /></label>
            <label className="text-xs font-semibold text-slate-600">Pulse<input type="number" value={newReading.pulse || ''} onChange={(event) => setNewReading({ ...newReading, pulse: Number(event.target.value) || undefined })} className="mt-1 w-full rounded border px-3 py-2 text-base" /></label>
            <label className="text-xs font-semibold text-slate-600">Measured at<input type="datetime-local" value={newReading.recordedAt ? new Date(newReading.recordedAt).toISOString().slice(0, 16) : ''} onChange={(event) => setNewReading({ ...newReading, recordedAt: new Date(event.target.value).toISOString() })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
            <label className="text-xs font-semibold text-slate-600">Context<select value={newReading.context || 'other'} onChange={(event) => setNewReading({ ...newReading, context: event.target.value as BloodPressureReading['context'] })} className="mt-1 w-full rounded border px-3 py-2 text-sm">{Object.entries(bloodPressureContextLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-600">Ceremony #<input type="number" min="1" value={newReading.ceremonyNumber || ''} onChange={(event) => setNewReading({ ...newReading, ceremonyNumber: Number(event.target.value) || undefined })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
            <label className="text-xs font-semibold text-slate-600 md:col-span-2">Notes<input value={newReading.notes || ''} onChange={(event) => setNewReading({ ...newReading, notes: event.target.value })} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
            <div className="flex gap-2 md:col-span-4 md:justify-end"><button type="button" className="btn btn-sm btn-secondary" onClick={() => setAddingReading(false)}>Cancel</button><button type="button" className="btn btn-sm btn-primary" onClick={addReading} disabled={savingReading}>{savingReading ? 'Saving…' : 'Save reading'}</button></div>
          </div>
        )}
        {bloodPressureReadings.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No blood-pressure readings have been submitted yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-sky-100 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-sky-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="px-3 py-2">Date and time</th><th className="px-3 py-2">Context</th><th className="px-3 py-2">Reading</th><th className="px-3 py-2">Pulse</th><th className="px-3 py-2">Notes</th><th className="px-3 py-2 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bloodPressureReadings.map((reading) => {
                  const high = reading.systolic >= 160 || reading.diastolic >= 100;
                  const isEditing = editingReading?._id === reading._id;
                  const activeEdit = isEditing ? editingReading as BloodPressureReading : reading;
                  return (
                    <tr key={reading._id || reading.recordedAt}>
                      <td className="px-3 py-2">{isEditing ? <input type="datetime-local" className="rounded border px-2 py-1" value={new Date(activeEdit.recordedAt).toISOString().slice(0, 16)} onChange={(event) => setEditingReading({ ...activeEdit, recordedAt: new Date(event.target.value).toISOString() })} /> : new Date(reading.recordedAt).toLocaleString()}</td>
                      <td className="px-3 py-2">{isEditing ? <div className="space-y-1"><select className="rounded border px-2 py-1" value={activeEdit.context || 'client_monitoring'} onChange={(event) => setEditingReading({ ...activeEdit, context: event.target.value as BloodPressureReading['context'] })}>{Object.entries(bloodPressureContextLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input type="number" min="1" className="w-24 rounded border px-2 py-1" placeholder="Ceremony #" value={activeEdit.ceremonyNumber || ''} onChange={(event) => setEditingReading({ ...activeEdit, ceremonyNumber: Number(event.target.value) || undefined })} /></div> : <>{bloodPressureContextLabels[reading.context || 'client_monitoring']}{reading.ceremonyNumber ? ` · Ceremony #${reading.ceremonyNumber}` : ''}</>}</td>
                      <td className={`px-3 py-2 font-semibold ${high ? 'text-red-700' : 'text-slate-900'}`}>
                        {isEditing ? <span className="flex items-center gap-1"><input type="number" className="w-16 rounded border px-2 py-1" value={activeEdit.systolic} onChange={(event) => setEditingReading({ ...activeEdit, systolic: Number(event.target.value) })} /><span>/</span><input type="number" className="w-16 rounded border px-2 py-1" value={activeEdit.diastolic} onChange={(event) => setEditingReading({ ...activeEdit, diastolic: Number(event.target.value) })} /></span> : <>{reading.systolic}/{reading.diastolic} mmHg {high ? '— HIGH' : ''}</>}
                      </td>
                      <td className="px-3 py-2">{isEditing ? <input type="number" className="w-16 rounded border px-2 py-1" value={activeEdit.pulse || ''} onChange={(event) => setEditingReading({ ...activeEdit, pulse: event.target.value ? Number(event.target.value) : undefined })} /> : reading.pulse || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{isEditing ? <input className="min-w-40 rounded border px-2 py-1" value={activeEdit.notes || ''} onChange={(event) => setEditingReading({ ...activeEdit, notes: event.target.value })} /> : reading.notes || '—'}</td>
                      <td className="px-3 py-2"><div className="flex justify-end gap-1">{isEditing ? <><button type="button" className="rounded p-2 text-green-700 hover:bg-green-50" onClick={saveReading} disabled={savingReading} title="Save reading"><Check size={16} /></button><button type="button" className="rounded p-2 text-slate-600 hover:bg-slate-100" onClick={() => setEditingReading(null)} title="Cancel edit"><X size={16} /></button></> : <><button type="button" className="rounded p-2 text-blue-700 hover:bg-blue-50" onClick={() => setEditingReading({ ...reading })} title="Edit reading"><Pencil size={16} /></button><button type="button" className="rounded p-2 text-violet-700 hover:bg-violet-50" onClick={() => createBloodPressureReview(reading)} disabled={creatingBpReviewFor === reading._id} title="Create BP medical review request"><Send size={16} /></button></>}<button type="button" className="rounded p-2 text-red-700 hover:bg-red-50" onClick={() => deleteReading(reading)} title="Delete reading"><Trash2 size={16} /></button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {medicalView === 'documents' && (
      <div className="booking-documents-grid">
        {medicalTestSections.map((section) => {
          const sectionArtifacts = artifactsByType[section.type];
          const latestArtifact = sectionArtifacts[0];
          const latestReview = latestArtifact?._id ? getLatestReview(reviewsByArtifact[latestArtifact._id]) : undefined;
          const latestResult = getArtifactResultText(latestArtifact);
          const latestDecision = getReviewDecisionInfo(latestReview);
          const selectedAdvisorId = advisorSelections[section.type] || '';
          const receiptKey = getFlowReceiptKey(section.type);
          const receiptGroup = getFlowReadinessGroup(section.type);
          const receiptItem = flowItems.find((item) => {
            const template = typeof item.templateId === 'object' ? item.templateId : undefined;
            return item.key === receiptKey
              || (item.metadata?.readinessGroup || template?.readinessGroup) === receiptGroup
              || (item.metadata?.expectedArtifact || template?.expectedArtifact) === section.type;
          });
          const isMarkedReceived = !!receiptItem && ['received', 'reviewed', 'approved', 'caution', 'completed'].includes(receiptItem.status);

          return (
            <div key={section.type} className="booking-document-card">
              <div className="booking-document-card-header">
                <FileText size={20} />
                <div>
                  <h4>{section.title}</h4>
                  <p>{section.description}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-primary ml-auto shrink-0"
                  onClick={() => openUploadModal(section.documentType, 'entry')}
                >
                  <Upload size={16} /> Upload
                </button>
              </div>

              {latestArtifact && (
                <div className="booking-medical-required-item">
                  <div>
                    <span className="booking-medical-required-label">Booking step</span>
                    {isMarkedReceived ? (
                      <strong>{section.title} received — {formatDate(receiptItem?.receivedAt || receiptItem?.completedAt || receiptItem?.updatedAt)}</strong>
                    ) : (
                      <span>Artifact is linked to this booking and can fulfill the received step.</span>
                    )}
                  </div>
                  {!isMarkedReceived && (
                    <button className="btn btn-sm btn-secondary" type="button" disabled={markingReceivedType === section.type} onClick={() => handleMarkReceived(section, latestArtifact)}>
                      {markingReceivedType === section.type ? 'Marking...' : `Mark ${section.title} received`}
                    </button>
                  )}
                </div>
              )}

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
                  <span className="booking-medical-required-label">Medical advisor (optional)</span>
                  {latestReview?._id ? (
                    <span>{!latestReview.assignedToUserId ? 'Unassigned review queue' : typeof latestReview.assignedToUserId === 'object'
                      ? [latestReview.assignedToUserId.firstName, latestReview.assignedToUserId.lastName].filter(Boolean).join(' ') || latestReview.assignedToUserId.email || 'Assigned'
                      : 'Assigned'}</span>
                  ) : (
                    <select
                      value={selectedAdvisorId}
                      onChange={(event) => setAdvisorSelections((current) => ({ ...current, [section.type]: event.target.value }))}
                      className="booking-medical-advisor-select"
                    >
                      <option value="">Leave unassigned</option>
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
                        {review && (review.reviewNotes || review.overallNotes || review.medicalStaffNotes) && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <span className="booking-medical-required-label">Medical form review notes</span>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                              {review.reviewNotes || review.overallNotes || review.medicalStaffNotes}
                            </p>
                          </div>
                        )}
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
                              disabled={!artifact._id || creatingReviewFor === artifact._id}
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

            </div>
          );
        })}

        <div className="booking-document-card md:col-span-2">
          <div className="booking-document-card-header">
            <FileText size={20} />
            <div>
              <h4>Additional document</h4>
              <p>Upload another medical document and optionally link it to a ceremony.</p>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-secondary ml-auto shrink-0"
              onClick={() => openUploadModal('additional', 'additional')}
            >
              <Upload size={16} /> Upload document
            </button>
          </div>
        </div>
      </div>
      )}

      {uploadModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="booking-medical-upload-title">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-2xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 id="booking-medical-upload-title" className="text-xl font-bold text-slate-900">Upload medical artifact</h3>
                <p className="mt-1 text-sm text-slate-600">The client, retreat, and booking are already linked.</p>
              </div>
              <button type="button" onClick={() => setUploadModalOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100" aria-label="Close upload">
                <X size={22} />
              </button>
            </div>

            {error && <div className="alert alert-danger mb-4">{error}</div>}

            <div className="space-y-4">
              <div>
                <label htmlFor="booking-medical-document-stage" className="mb-1 block text-sm font-semibold text-slate-700">Stage</label>
                <select
                  id="booking-medical-document-stage"
                  value={uploadDocumentStage}
                  onChange={(event) => {
                    setUploadDocumentStage(event.target.value as NonNullable<MedicalArtifact['documentStage']>);
                    setUploadCeremonyId('');
                  }}
                  className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
                >
                  <option value="entry">Entry</option>
                  <option value="pre_ceremony">Pre-ceremony</option>
                  <option value="in_ceremony">In-ceremony</option>
                  <option value="post_ceremony">Post-ceremony</option>
                  <option value="other">Other</option>
                  <option value="additional">Additional</option>
                </select>
              </div>

              <div className="grid gap-3 rounded-lg border border-violet-200 bg-violet-50 p-3 sm:grid-cols-2">
                  <div>
                    <span className="mb-1 block text-sm font-semibold text-slate-700">Retreat</span>
                    <div className="min-h-12 rounded-lg border border-violet-200 bg-white px-3 py-3 text-sm text-slate-700">
                      Booking retreat · {retreatId}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">The retreat is fixed from this booking.</p>
                  </div>
                  <div>
                    <label htmlFor="booking-medical-ceremony" className="mb-1 block text-sm font-semibold text-slate-700">
                      Ceremony {isCeremonyUpload ? '(required)' : '(optional)'}
                    </label>
                    <select
                      id="booking-medical-ceremony"
                      value={uploadCeremonyId}
                      onChange={(event) => setUploadCeremonyId(event.target.value)}
                      disabled={loadingRetreatCeremonies}
                      required={isCeremonyUpload}
                      className="min-h-12 w-full rounded-lg border border-violet-200 bg-white px-3 text-base"
                    >
                      <option value="">{loadingRetreatCeremonies ? 'Loading ceremonies…' : 'Select ceremony'}</option>
                      {retreatCeremonies.map((ceremony) => (
                        <option key={ceremony._id} value={ceremony._id}>
                          Ceremony #{ceremony.ceremonyNumber} · {new Date(ceremony.date).toLocaleDateString()}
                        </option>
                      ))}
                    </select>
                    {!loadingRetreatCeremonies && retreatCeremonies.length === 0 && (
                      <p className="mt-1 text-xs font-medium text-amber-700">No ceremonies are configured for this retreat.</p>
                    )}
                  </div>
                </div>

              <div>
                <label htmlFor="booking-medical-document-type" className="mb-1 block text-sm font-semibold text-slate-700">Document type</label>
                <select
                  id="booking-medical-document-type"
                  value={uploadDocumentType}
                  onChange={(event) => setUploadDocumentType(event.target.value as UploadDocumentType)}
                  className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
                >
                  {uploadDocumentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="booking-medical-upload-title-input" className="mb-1 block text-sm font-semibold text-slate-700">Title (optional)</label>
                <input
                  id="booking-medical-upload-title-input"
                  value={uploadTitle}
                  onChange={(event) => setUploadTitle(event.target.value)}
                  className="min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base"
                  placeholder="Defaults to the document type"
                />
              </div>

              <div>
                <label htmlFor="booking-medical-upload-files" className="mb-1 block text-sm font-semibold text-slate-700">Files</label>
                <input
                  id="booking-medical-upload-files"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.heic,.heif"
                  multiple
                  capture="environment"
                  onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
                  className="block min-h-14 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm"
                />
                <p className="mt-1 text-xs text-slate-500">PDF or photo. On mobile you can use the camera.</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setUploadModalOpen(false)} className="min-h-12 rounded-xl border border-slate-300 bg-white font-semibold text-slate-700">Cancel</button>
              <button type="button" onClick={handleUpload} disabled={Boolean(uploadingType)} className="btn btn-primary min-h-12 justify-center">
                <Upload size={18} /> {uploadingType ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingMedicalUpload;
