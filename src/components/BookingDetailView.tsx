import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiChevronDown, FiDownload, FiEdit3, FiEye, FiMail, FiSend } from 'react-icons/fi';
import { message } from 'antd';
import { bookingsApi, bookingDocumentsApi, bookingFlowApi, ceremoniesApi, communicationsApi, medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';
import BookingPaymentManagement from './BookingPaymentManagement';
import BookingMedicalUpload from './BookingMedicalUpload';
import BookingDocumentsUpload from './BookingDocumentsUpload';
import ClientBookingWorkflowTab from './ClientBookingWorkflowTab';
import EmailComposeModal, { EmailComposeInitialValues } from './EmailComposeModal';
import EmailHistoryPanel from './EmailHistoryPanel';
import { TaskList } from './Tasks/TaskList';
import { TaskForm } from './Tasks/TaskForm';
import { buildBookingFlowArtifactFilters } from './bookingFlowLookup';
import { createBookingConfirmationPdf, generateBookingPDF } from './BookingConfirmationPDF';
import { Task, CreateTaskDto, taskService } from '../services/taskService';
import { BookingDocument, BookingFlowItem, CeremonyParticipant, MedicalArtifact, MedicalReviewRequest } from '../types';
import './BookingDetailView.css';

type RequirementArtifactType = NonNullable<MedicalArtifact['artifactType']>;
type BookingConfirmationLanguage = 'pl' | 'cz' | 'en';
const bookingConfirmationLanguageLabels: Record<BookingConfirmationLanguage, string> = {
  pl: 'Polish',
  cz: 'Czech',
  en: 'English',
};
type RequirementDefinition = {
  key: string;
  label: string;
  artifactTypes: RequirementArtifactType[];
  documentTypes?: MedicalArtifact['documentType'][];
  bookingDocumentTypes?: string[];
  readinessGroups: string[];
};

interface BookingDetailViewProps {
  bookingId: string;
  onBack: () => void;
}

const HeaderIcon: React.FC<{ icon: any }> = ({ icon: IconComponent }) => <IconComponent />;

const requirementDefinitions: RequirementDefinition[] = [
  { key: 'contract', label: 'Contract', artifactTypes: ['contract'], bookingDocumentTypes: ['contract'], readinessGroups: ['contract'] },
  { key: 'ekg', label: 'Entry EKG', artifactTypes: ['ekg'], documentTypes: ['EKG'], readinessGroups: ['ekg'] },
  { key: 'liver', label: 'Entry Liver Panel', artifactTypes: ['liver_panel'], documentTypes: ['Liver'], bookingDocumentTypes: ['liver_panel'], readinessGroups: ['liver'] },
  { key: 'medications', label: 'Medications Form', artifactTypes: ['medications_form', 'medication_list'], documentTypes: ['Medications'], bookingDocumentTypes: ['medications_form'], readinessGroups: ['medications'] },
  { key: 'questionnaire', label: 'Questionnaire', artifactTypes: ['questionnaire'], bookingDocumentTypes: ['questionnaire'], readinessGroups: ['questionnaire'] },
  { key: 'food', label: 'Food Form', artifactTypes: ['food_intake'], bookingDocumentTypes: ['food_intake'], readinessGroups: ['food'] },
];

const completedStatuses = new Set(['received', 'reviewed', 'approved', 'completed', 'caution']);
const reviewedStatuses = new Set(['reviewed', 'approved', 'completed', 'caution', 'rejected', 'needs_resubmission']);
const medicalStageLabels: Record<MedicalArtifact['documentStage'], string> = {
  entry: 'Entry',
  pre_ceremony: 'Pre-ceremony',
  in_ceremony: 'In-ceremony',
  post_ceremony: 'Post-ceremony',
  other: 'Other',
  additional: 'Additional',
};

const medicalStageOrder: MedicalArtifact['documentStage'][] = ['entry', 'pre_ceremony', 'in_ceremony', 'post_ceremony', 'other', 'additional'];
const requiredEntryDocumentTypes: MedicalArtifact['documentType'][] = ['EKG', 'Liver'];

const escapeHtml = (value: any) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] || char));

const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(String(reader.result || '').split(',')[1] || '');
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatHistoryDateTime = (date?: string | Date) => {
  if (!date) return 'N/A';
  const dateObj = new Date(date);
  if (Number.isNaN(dateObj.getTime())) return 'N/A';
  return dateObj.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getClientName = (client: any) => {
  const explicitName = String(client?.fullName || client?.name || '').trim();
  if (explicitName) return explicitName;
  return [client?.firstName || client?.fname, client?.lastName || client?.lname].filter(Boolean).join(' ').trim();
};

const getClientDisplayId = (client: any, booking?: any) =>
  client?.display_id || client?.displayId || client?.clientNumber || booking?.clientDisplayId || booking?.clientDetails?.display_id || '';

const normalizeBookingDocumentKey = (value?: string) =>
  String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const getRetreatCode = (retreat: any) => {
  const explicitCode = String(retreat?.code || retreat?.retreatCode || '').trim();
  if (explicitCode) return explicitCode;
  const rawName = String(retreat?.name || retreat?.location || 'Retreat').trim();
  const initials = rawName
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'RET';
  const dateValue = retreat?.startDate || retreat?.dates?.startDate;
  const date = dateValue ? new Date(dateValue) : null;
  if (!date || Number.isNaN(date.getTime())) return initials;
  const two = (value: number) => String(value).padStart(2, '0');
  return `${initials}-${two(date.getUTCMonth() + 1)}-${two(date.getUTCDate())}-${two(date.getUTCFullYear() % 100)}`;
};

const getRetreatLocationTown = (retreat: any) =>
  String(
    retreat?.location_town ||
    retreat?.locationTown ||
    retreat?.generalTown ||
    retreat?.general_town ||
    retreat?.house?.generalTown ||
    retreat?.house?.general_town ||
    retreat?.house?.city ||
    retreat?.houseId?.generalTown ||
    retreat?.houseId?.general_town ||
    retreat?.houseId?.city ||
    retreat?.location ||
    ''
  ).trim();

const getRetreatAddress = (retreat: any) =>
  String(
    retreat?.address ||
    retreat?.house?.address ||
    retreat?.houseId?.address ||
    getRetreatLocationTown(retreat) ||
    ''
  ).trim();

const getRetreatMapLink = (retreat: any) =>
  String(
    retreat?.googleMapLink ||
    retreat?.google_map_link ||
    retreat?.house?.googleMapLink ||
    retreat?.house?.google_map_link ||
    retreat?.houseId?.googleMapLink ||
    retreat?.houseId?.google_map_link ||
    ''
  ).trim();

const getRetreatStartTime = (retreat: any) =>
  String(
    retreat?.startTime ||
    retreat?.start_time ||
    retreat?.dates?.startTime ||
    retreat?.dates?.start_time ||
    ''
  ).trim();

const getRetreatEndTime = (retreat: any) =>
  String(
    retreat?.endTime ||
    retreat?.end_time ||
    retreat?.dates?.endTime ||
    retreat?.dates?.end_time ||
    ''
  ).trim();

const interpolateTemplate = (template: string, variables: Record<string, any>) =>
  String(template || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path) => {
    const value = String(path).split('.').reduce((current, key) => current?.[key], variables);
    return value === undefined || value === null ? '' : String(value);
  });

const textToHtml = (text: string) =>
  `<pre style="white-space: pre-wrap; font-family: Arial, Helvetica, sans-serif; line-height: 1.55; color: #111827;">${escapeHtml(text)}</pre>`;

const formatSentEmailReceipt = (sentEmail: any) => {
  const lines = [
    `Email ${sentEmail?.status || 'queued'}.`,
    sentEmail?.display_id ? `Log #${sentEmail.display_id}` : '',
    sentEmail?.gmailMessageId ? `Gmail message ID: ${sentEmail.gmailMessageId}` : '',
    (sentEmail?.cc || []).length ? `CC: ${(sentEmail.cc || []).join(', ')}` : 'CC: none',
    (sentEmail?.attachments || []).length ? `Attachments: ${sentEmail.attachments.length}` : '',
    sentEmail?.errorMessage ? `Error: ${sentEmail.errorMessage}` : '',
  ].filter(Boolean);
  return lines.join('\n');
};

const getArtifactTime = (artifact: MedicalArtifact) =>
  new Date(artifact.receivedAt || artifact.createdAt || 0).getTime();

const hasArtifactFiles = (artifact: MedicalArtifact) => (artifact.files || []).length > 0;

const compareArtifactsForDisplay = (a: MedicalArtifact, b: MedicalArtifact) => {
  const fileScore = Number(hasArtifactFiles(b)) - Number(hasArtifactFiles(a));
  if (fileScore !== 0) return fileScore;
  return getArtifactTime(b) - getArtifactTime(a);
};

const getReviewTime = (review: MedicalReviewRequest) =>
  new Date(review.reviewedAt || review.requestedAt || review.createdAt || 0).getTime();

const getObjectId = (value: any) => typeof value === 'object' ? value?._id || value?.id : value;

const getClientEmail = (client: any) => String(client?.email || '').trim();

const getBookingConfirmationLanguage = (client: any): BookingConfirmationLanguage => {
  const language = String(client?.language || client?.preferredLanguage || '').trim().toUpperCase();
  if (['CZ', 'CS', 'CZECH', 'CESKY', 'ČESKY'].includes(language)) return 'cz';
  if (['PL', 'POLISH', 'POLSKI', 'POLSKA'].includes(language)) return 'pl';
  if (['EN', 'ENG', 'ENGLISH'].includes(language)) return 'en';
  return 'en';
};

const bookingConfirmationEmailCopy: Record<BookingConfirmationLanguage, {
  subject: (bookingNumber?: string) => string;
  greeting: (firstName: string) => string;
  intro: (location: string, dates: string) => string;
  attached: string;
  moreInfo: string;
  questions: (email: string) => string;
  closing: string;
  none: string;
  rows: Record<string, string>;
}> = {
  en: {
    subject: (bookingNumber) => `Booking confirmation ${bookingNumber || ''}`.trim(),
    greeting: (firstName) => `Hello ${firstName},`,
    intro: (location, dates) => `We are excited to welcome you to our retreat in ${location} on ${dates}.`,
    attached: 'Below is your booking information. A PDF copy of your booking confirmation is attached to this email.',
    moreInfo: 'We will email more information as we get closer to the retreat.',
    questions: (email) => `If you have any questions, please do not hesitate to reach out to ${email}.`,
    closing: 'Warmly,',
    none: 'None',
    rows: {
      bookingNumber: 'Booking number',
      bookingType: 'Booking type',
      status: 'Status',
      client: 'Client',
      retreat: 'Retreat',
      locationTown: 'Location town',
      dates: 'Dates',
      checkIn: 'Check-in',
      checkOut: 'Check-out',
      address: 'Address',
      googleMapLink: 'Google map',
      specialRequests: 'Special requests',
    },
  },
  cz: {
    subject: (bookingNumber) => `Potvrzení rezervace ${bookingNumber || ''}`.trim(),
    greeting: (firstName) => `Dobrý den ${firstName},`,
    intro: (location, dates) => `Těšíme se, že vás přivítáme na našem pobytu v ${location} v termínu ${dates}.`,
    attached: 'Níže najdete informace k vaší rezervaci. PDF potvrzení rezervace je přiloženo k tomuto e-mailu.',
    moreInfo: 'Další informace vám pošleme e-mailem, až se bude termín pobytu blížit.',
    questions: (email) => `Pokud máte jakékoli otázky, napište nám prosím na ${email}.`,
    closing: 'S pozdravem,',
    none: 'Žádné',
    rows: {
      bookingNumber: 'Číslo rezervace',
      bookingType: 'Typ rezervace',
      status: 'Stav',
      client: 'Klient',
      retreat: 'Pobyt',
      locationTown: 'Místo',
      dates: 'Termín',
      checkIn: 'Příjezd',
      checkOut: 'Odjezd',
      address: 'Adresa',
      googleMapLink: 'Google mapa',
      specialRequests: 'Speciální požadavky',
    },
  },
  pl: {
    subject: (bookingNumber) => `Potwierdzenie rezerwacji ${bookingNumber || ''}`.trim(),
    greeting: (firstName) => `Dzień dobry ${firstName},`,
    intro: (location, dates) => `Cieszymy się, że będziemy mogli powitać Cię na naszym pobycie w ${location} w terminie ${dates}.`,
    attached: 'Poniżej znajdziesz informacje dotyczące rezerwacji. Potwierdzenie rezerwacji w PDF jest załączone do tej wiadomości.',
    moreInfo: 'Prześlemy więcej informacji e-mailem bliżej terminu pobytu.',
    questions: (email) => `Jeśli masz pytania, napisz do nas na ${email}.`,
    closing: 'Serdecznie,',
    none: 'Brak',
    rows: {
      bookingNumber: 'Numer rezerwacji',
      bookingType: 'Typ rezerwacji',
      status: 'Status',
      client: 'Klient',
      retreat: 'Pobyt',
      locationTown: 'Miejscowość',
      dates: 'Termin',
      checkIn: 'Przyjazd',
      checkOut: 'Wyjazd',
      address: 'Adres',
      googleMapLink: 'Mapa Google',
      specialRequests: 'Specjalne prośby',
    },
  },
};

const formatShortDateTime = (value?: Date | string) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getReviewDecisionText = (review?: MedicalReviewRequest) =>
  review?.reviewDecision || review?.decision || (review?.status && reviewedStatuses.has(review.status) ? review.status : 'No decision');

const getReviewDecisionClass = (review?: MedicalReviewRequest) => {
  const decision = String(getReviewDecisionText(review)).toLowerCase();
  if (decision.includes('ok') || decision.includes('approved') || decision.includes('completed')) return 'medical-decision-ok';
  if (decision.includes('caution') || decision.includes('need')) return 'medical-decision-caution';
  if (decision.includes('not') || decision.includes('declined') || decision.includes('reject')) return 'medical-decision-declined';
  return 'medical-decision-pending';
};

const getArtifactDisplayTitle = (artifact: MedicalArtifact) => {
  const title = artifact.title || artifact.documentType || artifact.artifactType || 'Medical record';
  const ceremony = artifact.ceremonyNumber ? `Ceremony #${artifact.ceremonyNumber}` : '';
  return [title, ceremony].filter(Boolean).join(' - ');
};

const getLatestReviewForArtifact = (artifact: MedicalArtifact, reviewsByArtifact: Record<string, MedicalReviewRequest[]>) => {
  if (!artifact._id) return undefined;
  return [...(reviewsByArtifact[artifact._id] || [])].sort((a, b) => getReviewTime(b) - getReviewTime(a))[0];
};

const indexReviewsByArtifact = (reviews: MedicalReviewRequest[]) => {
  const result: Record<string, MedicalReviewRequest[]> = {};
  for (const review of reviews || []) {
    const artifactIds = Array.from(new Set([
      ...(review.artifactIds || []),
      (review as any).artifactId,
      ...((review.fileReviews || []).map((fileReview) => fileReview.artifactId)),
    ]
      .map((value) => getObjectId(value))
      .filter(Boolean)));
    artifactIds.forEach((artifactId) => {
      result[artifactId] = [...(result[artifactId] || []), review];
    });
  }
  Object.keys(result).forEach((artifactId) => {
    result[artifactId] = [...result[artifactId]].sort((a, b) => getReviewTime(b) - getReviewTime(a));
  });
  return result;
};

const logLoadTimings = (label: string, timings: Record<string, number>) => {
  const total = Math.round(timings.total || 0);
  const breakdown = Object.fromEntries(
    Object.entries(timings)
      .filter(([key]) => key !== 'total')
      .map(([key, value]) => [key, Math.round(value)])
  );
  console.info(`[${label}] load timings`, { total, ...breakdown });
};

const loadReviewsByArtifactIds = async (artifactIds: string[]) => {
  const start = performance.now();
  try {
    const response = await medicalReviewRequestsApi.getByArtifacts(artifactIds);
    const reviews = response.data || [];
    return {
      reviewsByArtifact: indexReviewsByArtifact(reviews),
      duration: performance.now() - start,
      count: reviews.length,
    };
  } catch {
    return {
      reviewsByArtifact: {},
      duration: performance.now() - start,
      count: 0,
    };
  }
};

const mergeArtifacts = (artifactGroups: MedicalArtifact[][]) => {
  const seen = new Set<string>();
  return artifactGroups.flat().filter((artifact) => {
    const key = artifact._id || `${artifact.artifactType}:${artifact.title}:${artifact.createdAt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const isArtifactRelevantToBooking = (artifact: MedicalArtifact, bookingId: string, retreatId?: string) => {
  const artifactBookingId = getObjectId(artifact.bookingId);
  if (artifactBookingId) return artifactBookingId === bookingId;

  const artifactRetreatId = getObjectId(artifact.retreatId);
  if (artifactRetreatId) return Boolean(retreatId) && artifactRetreatId === retreatId;

  return true;
};

const BookingRequirementsPanel: React.FC<{
  bookingId: string;
  clientId?: string;
  retreatId?: string;
  refreshKey: number;
}> = ({ bookingId, clientId, retreatId, refreshKey }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = useMemo(() => {
    const firstSegment = location.pathname.split('/').filter(Boolean)[0];
    return ['admin', 'medical', 'staff', 'user'].includes(firstSegment) ? `/${firstSegment}` : '';
  }, [location.pathname]);
  const [items, setItems] = useState<BookingFlowItem[]>([]);
  const [artifacts, setArtifacts] = useState<MedicalArtifact[]>([]);
  const [documents, setDocuments] = useState<BookingDocument[]>([]);
  const [reviewsByArtifact, setReviewsByArtifact] = useState<Record<string, MedicalReviewRequest[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadRequirements = async () => {
    const loadStart = performance.now();
    const timings: Record<string, number> = {};
    setLoading(true);
    setError('');
    try {
      const itemsStart = performance.now();
      const itemsResponse = await bookingFlowApi.getItems({ bookingId });
      timings.items = performance.now() - itemsStart;
      const bookingFlowFilters = buildBookingFlowArtifactFilters(itemsResponse.data || []);
      const artifactsStart = performance.now();
      const [artifactsResponse, documentsResponse] = await Promise.all([
        Promise.all([
          medicalArtifactsApi.getAll({ bookingId, ...bookingFlowFilters }),
          medicalArtifactsApi.getAll({ bookingId }),
          clientId && retreatId ? medicalArtifactsApi.getAll({ clientId, retreatId, ...bookingFlowFilters }) : Promise.resolve({ data: [] }),
          clientId ? medicalArtifactsApi.getAll({ clientId, ...bookingFlowFilters }) : Promise.resolve({ data: [] }),
        ]),
        bookingDocumentsApi.getAll({ bookingId }),
      ]);
      timings.artifacts = performance.now() - artifactsStart;
      const loadedArtifacts: MedicalArtifact[] = mergeArtifacts(artifactsResponse.map((response) => response.data || []))
        .filter((artifact) => isArtifactRelevantToBooking(artifact, bookingId, retreatId));
      const artifactIds = loadedArtifacts.map((artifact) => artifact._id).filter(Boolean) as string[];
      const reviewLoad = await loadReviewsByArtifactIds(artifactIds);
      timings.reviews = reviewLoad.duration;
      setItems(itemsResponse.data || []);
      setArtifacts(loadedArtifacts);
      setDocuments(documentsResponse.data || []);
      setReviewsByArtifact(reviewLoad.reviewsByArtifact);
      timings.total = performance.now() - loadStart;
      timings.reviewCount = reviewLoad.count;
      timings.artifactCount = loadedArtifacts.length;
      logLoadTimings('booking requirements', timings);
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Unable to load booking requirements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequirements();
  }, [bookingId, clientId, retreatId, refreshKey]);

  const rows = requirementDefinitions.map((definition) => {
    const relatedItems = items.filter((item) => {
      const template = typeof item.templateId === 'object' ? item.templateId : undefined;
      const readinessGroup = item.metadata?.readinessGroup || template?.readinessGroup;
      const expectedArtifact = item.metadata?.expectedArtifact || template?.expectedArtifact;
      return definition.readinessGroups.includes(readinessGroup) || definition.artifactTypes.includes(expectedArtifact);
    });
    const relatedArtifacts = artifacts
      .filter((artifact) => {
        const matchesLegacyType = artifact.artifactType && definition.artifactTypes.includes(artifact.artifactType);
        const matchesDocumentType = artifact.documentStage === 'entry' && definition.documentTypes?.includes(artifact.documentType);
        return matchesLegacyType || matchesDocumentType;
      })
      .sort(compareArtifactsForDisplay);
    const relatedDocuments = documents
      .filter((document) => definition.bookingDocumentTypes?.includes(normalizeBookingDocumentKey(document.documentType)) && (document.files || []).length > 0)
      .sort((a, b) => new Date(b.receivedAt || b.createdAt || 0).getTime() - new Date(a.receivedAt || a.createdAt || 0).getTime());
    const latestArtifact = relatedArtifacts[0];
    const latestDocument = relatedDocuments[0];
    const reviews = latestArtifact?._id ? (reviewsByArtifact[latestArtifact._id] || []) : [];
    const latestReview = [...reviews].sort((a, b) => getReviewTime(b) - getReviewTime(a))[0];
    const uploaded = relatedArtifacts.some((artifact) => (artifact.files || []).length > 0);
    const documentUploaded = relatedDocuments.length > 0;
    const flowReceived = relatedItems.some((item) => completedStatuses.has(item.status));
    const reviewed = Boolean(latestReview && reviewedStatuses.has(latestReview.status)) ||
      relatedItems.some((item) => item.status === 'reviewed' || item.status === 'approved' || item.status === 'caution');
    const required = relatedItems.length === 0 || relatedItems.some((item) => item.isBlocking);

    return {
      ...definition,
      required,
      uploaded: uploaded || documentUploaded || flowReceived,
      reviewed,
      latestArtifact,
      latestDocument,
      latestReview,
      relatedItems,
    };
  });

  return (
    <div className="detail-section">
      <div className="section-header">
        <h3 className="pdf-section-title">Mandatory Booking Requirements</h3>
        <button className="edit-btn" type="button" onClick={loadRequirements} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-3">
        Driven by booking-flow requirements and linked booking artifacts/review requests.
      </p>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Requirement</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Required</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Uploaded</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Reviewed</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Latest File / Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="px-3 py-2 font-medium text-gray-900">{row.label}</td>
                <td className="px-3 py-2">{row.required ? 'Yes' : 'No'}</td>
                <td className="px-3 py-2">
                  <span className={`status-badge ${row.uploaded ? 'badge-received' : 'badge-pending'}`}>
                    {row.uploaded ? 'uploaded' : 'missing'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className={`status-badge ${row.reviewed ? 'badge-approved' : 'badge-pending'}`}>
                    {row.reviewed ? (row.latestReview?.reviewDecision || row.latestReview?.status || 'reviewed') : 'pending'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    {row.latestArtifact?._id && (
                      <button type="button" className="text-blue-700 hover:underline" onClick={() => navigate(`${routePrefix}/medical-artifacts/${row.latestArtifact!._id}`)}>
                        Artifact #{row.latestArtifact.display_id || row.latestArtifact._id}
                      </button>
                    )}
                    {row.latestDocument?._id && (
                      <button type="button" className="text-blue-700 hover:underline" onClick={() => navigate(`${routePrefix}/booking-documents`)}>
                        Document #{row.latestDocument.display_id || row.latestDocument._id}
                      </button>
                    )}
                    {row.latestReview?._id && (
                      <button type="button" className="text-blue-700 hover:underline" onClick={() => navigate(`${routePrefix}/medical-review-requests/${row.latestReview!._id}`)}>
                        Review #{row.latestReview.display_id || row.latestReview._id}
                      </button>
                    )}
                    {!row.latestArtifact && !row.latestDocument && !row.latestReview && <span className="text-gray-500">No linked record</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const MedicalReviewLine: React.FC<{
  review?: MedicalReviewRequest;
  routePrefix: string;
  navigate: ReturnType<typeof useNavigate>;
}> = ({ review, routePrefix, navigate }) => (
  <div className="booking-medical-review-line">
    <span className={`booking-medical-decision ${getReviewDecisionClass(review)}`}>
      {getReviewDecisionText(review)}
    </span>
    {review?._id ? (
      <button
        type="button"
        className="booking-medical-link"
        onClick={() => navigate(`${routePrefix}/medical-review-requests/${review._id}`)}
      >
        Review #{review.display_id || review._id}
      </button>
    ) : (
      <span className="booking-medical-muted">No medical review linked yet</span>
    )}
    {review?.reviewedAt && <span className="booking-medical-muted">{formatShortDateTime(review.reviewedAt)}</span>}
    {(review?.reviewNotes || review?.overallNotes || review?.medicalStaffNotes) && (
      <span className="booking-medical-notes">{review.reviewNotes || review.overallNotes || review.medicalStaffNotes}</span>
    )}
  </div>
);

const BookingMedicalOverviewPanel: React.FC<{
  bookingId: string;
  clientId?: string;
  retreatId?: string;
  refreshKey: number;
  onUploadComplete: () => void;
  bookingNumber?: number | string;
}> = ({ bookingId, clientId, retreatId, refreshKey, onUploadComplete, bookingNumber }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = useMemo(() => {
    const firstSegment = location.pathname.split('/').filter(Boolean)[0];
    return ['admin', 'medical', 'staff', 'user'].includes(firstSegment) ? `/${firstSegment}` : '';
  }, [location.pathname]);
  const [artifacts, setArtifacts] = useState<MedicalArtifact[]>([]);
  const [reviewsByArtifact, setReviewsByArtifact] = useState<Record<string, MedicalReviewRequest[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadMedicalOverview = async () => {
    const loadStart = performance.now();
    const timings: Record<string, number> = {};
    setLoading(true);
    setError('');
    try {
      const itemsStart = performance.now();
      const itemsResponse = await bookingFlowApi.getItems({ bookingId });
      timings.items = performance.now() - itemsStart;
      const bookingFlowFilters = buildBookingFlowArtifactFilters(itemsResponse.data || []);
      const artifactsStart = performance.now();
      const artifactResponses = await Promise.all([
        medicalArtifactsApi.getForBooking(bookingId),
        medicalArtifactsApi.getAll({ bookingId, ...bookingFlowFilters }),
        medicalArtifactsApi.getAll({ bookingId }),
        clientId && retreatId ? medicalArtifactsApi.getAll({ clientId, retreatId, ...bookingFlowFilters }) : Promise.resolve({ data: [] }),
        clientId ? medicalArtifactsApi.getAll({ clientId, ...bookingFlowFilters }) : Promise.resolve({ data: [] }),
        clientId ? medicalArtifactsApi.getAll({ clientId }) : Promise.resolve({ data: [] }),
      ]);
      timings.artifacts = performance.now() - artifactsStart;
      const loadedArtifacts = mergeArtifacts(artifactResponses.map((response) => response.data || []))
        .filter((artifact) => isArtifactRelevantToBooking(artifact, bookingId, retreatId))
        .sort(compareArtifactsForDisplay);
      const reviewLoad = await loadReviewsByArtifactIds(loadedArtifacts.map((artifact) => artifact._id).filter(Boolean) as string[]);
      timings.reviews = reviewLoad.duration;
      setArtifacts(loadedArtifacts);
      setReviewsByArtifact(reviewLoad.reviewsByArtifact);
      timings.total = performance.now() - loadStart;
      timings.reviewCount = reviewLoad.count;
      timings.artifactCount = loadedArtifacts.length;
      logLoadTimings('booking medical overview', timings);
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Unable to load booking medical records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedicalOverview();
  }, [bookingId, clientId, retreatId, refreshKey]);

  const artifactsByStage = medicalStageOrder.reduce((acc, stage) => {
    acc[stage] = artifacts.filter((artifact) => (artifact.documentStage || 'entry') === stage);
    return acc;
  }, {} as Record<MedicalArtifact['documentStage'], MedicalArtifact[]>);

  const entryArtifacts = artifactsByStage.entry || [];
  const requiredRows = requiredEntryDocumentTypes.map((documentType) => {
    const expectedArtifactType = documentType === 'EKG' ? 'ekg' : 'liver_panel';
    const match = entryArtifacts.find((artifact) =>
      artifact.artifactType === expectedArtifactType
      || String(artifact.documentType || '').toLowerCase() === documentType.toLowerCase()
    );
    return { documentType, artifact: match, review: match ? getLatestReviewForArtifact(match, reviewsByArtifact) : undefined };
  });

  return (
    <div className="booking-medical-panel">
      <div className="detail-section">
        <div className="section-header">
          <h3 className="pdf-section-title">Required Entry Medical Items</h3>
          <button className="edit-btn" type="button" onClick={loadMedicalOverview} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="booking-medical-required-grid">
          {requiredRows.map(({ documentType, artifact, review }) => (
            <div key={documentType} className={`booking-medical-required-card ${artifact ? 'is-present' : 'is-missing'}`}>
              <div>
                <div className="booking-medical-required-title">Entry {documentType}</div>
                <div className="booking-medical-muted">
                  Lookup: entry document + booking #{bookingNumber || bookingId}
                </div>
              </div>
              {artifact ? (
                <>
                  <button
                    type="button"
                    className="booking-medical-link"
                    onClick={() => navigate(`${routePrefix}/medical-artifacts/${artifact._id}`)}
                  >
                    Artifact #{artifact.display_id || artifact._id}
                  </button>
                  <MedicalReviewLine review={review} routePrefix={routePrefix} navigate={navigate} />
                </>
              ) : (
                <span className="booking-medical-decision medical-decision-declined">Missing</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="detail-section">
        <h3 className="pdf-section-title">Medical Records by Stage</h3>
        <div className="booking-medical-stage-list">
          {medicalStageOrder.map((stage) => {
            const stageArtifacts = artifactsByStage[stage] || [];
            return (
              <details key={stage} className="booking-medical-stage" open={stage === 'entry'}>
                <summary>
                  <span>{medicalStageLabels[stage]}</span>
                  <span>{stageArtifacts.length}</span>
                </summary>
                {stageArtifacts.length === 0 ? (
                  <div className="booking-medical-empty">No {medicalStageLabels[stage].toLowerCase()} records found.</div>
                ) : (
                  <div className="booking-medical-record-list">
                    {stageArtifacts.map((artifact) => {
                      const review = getLatestReviewForArtifact(artifact, reviewsByArtifact);
                      return (
                        <div key={artifact._id || `${artifact.documentType}-${artifact.receivedAt}`} className="booking-medical-record">
                          <div className="booking-medical-record-main">
                            <button
                              type="button"
                              className="booking-medical-link booking-medical-title-link"
                              onClick={() => artifact._id && navigate(`${routePrefix}/medical-artifacts/${artifact._id}`)}
                              disabled={!artifact._id}
                            >
                              #{artifact.display_id || artifact._id || 'New'} {getArtifactDisplayTitle(artifact)}
                            </button>
                            <div className="booking-medical-meta">
                              <span>{artifact.documentType}</span>
                              <span>{artifact.artifactType || 'artifact'}</span>
                              <span>{formatShortDateTime(artifact.receivedAt || artifact.createdAt)}</span>
                              <span>{(artifact.files || []).length} file(s)</span>
                            </div>
                          </div>
                          <MedicalReviewLine review={review} routePrefix={routePrefix} navigate={navigate} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </details>
            );
          })}
        </div>
      </div>

      {clientId && retreatId ? (
        <BookingMedicalUpload
          bookingId={bookingId}
          bookingNumber={bookingNumber}
          clientId={clientId}
          retreatId={retreatId}
          onUploadComplete={() => {
            onUploadComplete();
            loadMedicalOverview();
          }}
        />
      ) : (
        <div className="detail-section">
          <p className="text-sm text-gray-500">Medical upload needs a linked client and retreat on this booking.</p>
        </div>
      )}
    </div>
  );
};

const BookingCeremoniesPanel: React.FC<{
  bookingId: string;
  clientId?: string;
  retreatId?: string;
  refreshKey: number;
}> = ({ bookingId, clientId, retreatId, refreshKey }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = useMemo(() => {
    const firstSegment = location.pathname.split('/').filter(Boolean)[0];
    return ['admin', 'medical', 'staff', 'user'].includes(firstSegment) ? `/${firstSegment}` : '';
  }, [location.pathname]);
  const [participations, setParticipations] = useState<CeremonyParticipant[]>([]);
  const [artifacts, setArtifacts] = useState<MedicalArtifact[]>([]);
  const [reviewsByArtifact, setReviewsByArtifact] = useState<Record<string, MedicalReviewRequest[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadCeremonies = async () => {
    if (!clientId) return;
    const loadStart = performance.now();
    const timings: Record<string, number> = {};
    setLoading(true);
    setError('');
    try {
      const participationStart = performance.now();
      const [participationResponse, itemsResponse] = await Promise.all([
        ceremoniesApi.getClientParticipations(clientId),
        bookingFlowApi.getItems({ bookingId }),
      ]);
      timings.participation = performance.now() - participationStart;
      const bookingFlowFilters = buildBookingFlowArtifactFilters(itemsResponse.data || []);
      const artifactsStart = performance.now();
      const artifactResponses = await Promise.all([
        medicalArtifactsApi.getAll({ bookingId, ...bookingFlowFilters }),
        medicalArtifactsApi.getAll({ bookingId }),
        retreatId ? medicalArtifactsApi.getAll({ clientId, retreatId, ...bookingFlowFilters }) : Promise.resolve({ data: [] }),
        medicalArtifactsApi.getAll({ clientId, ...bookingFlowFilters }),
      ]);
      timings.artifacts = performance.now() - artifactsStart;
      const allParticipations = participationResponse.data || [];
      const loadedArtifacts = mergeArtifacts(artifactResponses.map((response) => response.data || []))
        .filter((artifact) => isArtifactRelevantToBooking(artifact, bookingId, retreatId))
        .sort(compareArtifactsForDisplay);
      const reviewLoad = await loadReviewsByArtifactIds(loadedArtifacts.map((artifact) => artifact._id).filter(Boolean) as string[]);
      timings.reviews = reviewLoad.duration;
      setParticipations(retreatId
        ? allParticipations.filter((participation: any) => getObjectId(participation.retreatId) === retreatId)
        : allParticipations);
      setArtifacts(loadedArtifacts);
      setReviewsByArtifact(reviewLoad.reviewsByArtifact);
      timings.total = performance.now() - loadStart;
      timings.reviewCount = reviewLoad.count;
      timings.artifactCount = loadedArtifacts.length;
      logLoadTimings('booking ceremonies', timings);
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Unable to load ceremony information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCeremonies();
  }, [bookingId, clientId, retreatId, refreshKey]);

  const getStageArtifactsForCeremony = (ceremonyNumber: number | undefined, stage: MedicalArtifact['documentStage']) =>
    artifacts.filter((artifact) => artifact.documentStage === stage && (!ceremonyNumber || artifact.ceremonyNumber === ceremonyNumber));

  const renderArtifactChips = (ceremonyNumber: number | undefined, stage: MedicalArtifact['documentStage']) => {
    const matches = getStageArtifactsForCeremony(ceremonyNumber, stage);
    if (matches.length === 0) return <span className="booking-medical-muted">None</span>;
    return (
      <div className="booking-ceremony-artifact-list">
        {matches.map((artifact) => {
          const review = getLatestReviewForArtifact(artifact, reviewsByArtifact);
          return (
            <button
              key={artifact._id || `${stage}-${artifact.documentType}-${artifact.receivedAt}`}
              type="button"
              className={`booking-ceremony-artifact-chip ${getReviewDecisionClass(review)}`}
              onClick={() => artifact._id && navigate(`${routePrefix}/medical-artifacts/${artifact._id}`)}
            >
              {artifact.documentType} #{artifact.display_id || artifact._id}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="detail-section">
      <div className="section-header">
        <h3 className="pdf-section-title">Ceremonies</h3>
        <button className="edit-btn" type="button" onClick={loadCeremonies} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {participations.length === 0 ? (
        <p className="text-sm text-gray-500">No ceremony participation records found for this booking retreat.</p>
      ) : (
        <div className="booking-ceremony-list">
          {participations.map((participation: any) => {
            const ceremony = participation.ceremonyId || {};
            return (
              <div key={participation._id || getObjectId(ceremony)} className="booking-ceremony-card">
                <div className="booking-ceremony-card-header">
                  <div>
                    <div className="booking-medical-required-title">Ceremony #{ceremony.ceremonyNumber || participation.ceremonyNumber || 'N/A'}</div>
                    <div className="booking-medical-muted">
                      {formatShortDateTime(ceremony.date)} {ceremony.startTime ? ` - ${ceremony.startTime}` : ''}
                    </div>
                  </div>
                  <span className={`booking-medical-decision ${participation.medicalClearance === 'approved' ? 'medical-decision-ok' : participation.medicalClearance === 'not_approved' ? 'medical-decision-declined' : participation.medicalClearance === 'conditional' ? 'medical-decision-caution' : 'medical-decision-pending'}`}>
                    {participation.medicalClearance || 'pending'}
                  </span>
                </div>
                <div className="booking-ceremony-grid">
                  <div>
                    <label>Spoons</label>
                    <strong>{participation.spoonsTaken || 0}</strong>
                    <span>{participation.firstSpoonTime || 'No time recorded'}</span>
                  </div>
                  <div>
                    <label>Pre-ceremony labs</label>
                    {renderArtifactChips(ceremony.ceremonyNumber, 'pre_ceremony')}
                  </div>
                  <div>
                    <label>In-ceremony labs</label>
                    {renderArtifactChips(ceremony.ceremonyNumber, 'in_ceremony')}
                  </div>
                  <div>
                    <label>Post-ceremony labs</label>
                    {renderArtifactChips(ceremony.ceremonyNumber, 'post_ceremony')}
                  </div>
                </div>
                {(participation.medicalClearanceNotes || participation.individualNotes || participation.postCeremonyNotes) && (
                  <p className="booking-medical-notes">
                    {participation.medicalClearanceNotes || participation.individualNotes || participation.postCeremonyNotes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const BookingDetailView: React.FC<BookingDetailViewProps> = ({ bookingId, onBack }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfLanguage, setPdfLanguage] = useState<BookingConfirmationLanguage>('en');
  const [requirementsRefreshKey, setRequirementsRefreshKey] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewFileName, setPreviewFileName] = useState('');
  const [isPreviewingPDF, setIsPreviewingPDF] = useState(false);
  const [isSendingConfirmation, setIsSendingConfirmation] = useState(false);
  const [isPreparingConfirmationEmail, setIsPreparingConfirmationEmail] = useState(false);
  const [confirmationEmailDraft, setConfirmationEmailDraft] = useState<EmailComposeInitialValues | null>(null);
  const [showQuickSendConfirm, setShowQuickSendConfirm] = useState(false);
  const [confirmationHistoryReason, setConfirmationHistoryReason] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'requirements' | 'medical' | 'ceremonies' | 'documents' | 'emails' | 'tasks' | 'workflow' | 'notes'>('overview');
  const [bookingTasks, setBookingTasks] = useState<Task[]>([]);
  const [loadingBookingTasks, setLoadingBookingTasks] = useState(false);
  const [bookingTasksError, setBookingTasksError] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showBookingDates, setShowBookingDates] = useState(false);
  const [showClientDetails, setShowClientDetails] = useState(false);
  const [showRetreatInfo, setShowRetreatInfo] = useState(false);
  const [showPayments, setShowPayments] = useState(true);
  const [showBookingSteps, setShowBookingSteps] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);
  const routePrefix = useMemo(() => {
    const firstSegment = location.pathname.split('/').filter(Boolean)[0];
    return ['admin', 'medical', 'staff', 'user'].includes(firstSegment) ? `/${firstSegment}` : '';
  }, [location.pathname]);

  useEffect(() => {
    fetchBookingDetails();
  }, [bookingId]);

  useEffect(() => {
    if (activeTab === 'tasks') {
      loadBookingTasks();
    }
  }, [activeTab, bookingId]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const fetchBookingDetails = async () => {
    try {
      setIsLoading(true);
      // Fetch booking details
      const bookingResponse = await bookingsApi.getOne(bookingId);
      setBooking(bookingResponse.data);
      setPdfLanguage(getBookingConfirmationLanguage(bookingResponse.data?.clientId || bookingResponse.data?.clientDetails));
    } catch (error) {
      console.error('Error fetching booking details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBookingTasks = async () => {
    try {
      setLoadingBookingTasks(true);
      setBookingTasksError(null);
      const tasks = await taskService.getTasks({ bookingId, sortBy: 'dueDate', sortOrder: 'asc' });
      setBookingTasks(tasks);
    } catch (error: any) {
      setBookingTasksError(error?.message || 'Unable to load booking tasks.');
    } finally {
      setLoadingBookingTasks(false);
    }
  };

  const handleCreateTask = () => {
    setEditingTask(null);
    setBookingTasksError(null);
    setShowTaskForm(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setBookingTasksError(null);
    setShowTaskForm(true);
  };

  const handleSubmitTask = async (taskData: CreateTaskDto) => {
    try {
      setBookingTasksError(null);
      if (editingTask) {
        await taskService.updateTask(editingTask.id, taskData);
      } else {
        await taskService.createTask({ ...taskData, bookingId });
      }
      setShowTaskForm(false);
      setEditingTask(null);
      await loadBookingTasks();
    } catch (error: any) {
      setBookingTasksError(error?.message || 'Unable to save task.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      setBookingTasksError(null);
      await taskService.deleteTask(taskId);
      await loadBookingTasks();
    } catch (error: any) {
      setBookingTasksError(error?.message || 'Unable to delete task.');
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      setBookingTasksError(null);
      await taskService.completeTask(taskId);
      await loadBookingTasks();
    } catch (error: any) {
      setBookingTasksError(error?.message || 'Unable to complete task.');
    }
  };

  const formatDate = (date: string | Date) => {
    if (!date) return 'N/A';

    // Create date and use UTC methods to avoid timezone conversion
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC' // Force UTC to prevent timezone shift
    });
  };

  const buildBookingConfirmationEmail = async (language: BookingConfirmationLanguage) => {
    const clientData = booking?.clientId || booking?.clientDetails;
    const retreatData = booking?.retreatId || booking?.retreatDetails;
    const copy = bookingConfirmationEmailCopy[language];
    const firstName = clientData?.firstName || clientData?.fname || 'there';
    const locationText = getRetreatLocationTown(retreatData) || 'our retreat center';
    const addressText = getRetreatAddress(retreatData) || 'N/A';
    const mapLinkText = getRetreatMapLink(retreatData) || 'N/A';
    const dateLocale = language === 'cz' ? 'cs-CZ' : language === 'pl' ? 'pl-PL' : 'en-US';
    const formatLocalizedDate = (date?: string | Date) => {
      if (!date) return 'N/A';
      const dateObj = new Date(date);
      if (Number.isNaN(dateObj.getTime())) return 'N/A';
      return dateObj.toLocaleDateString(dateLocale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      });
    };
    const formatLocalizedDateTime = (date?: string | Date, time?: string) => {
      const dateText = formatLocalizedDate(date);
      if (dateText === 'N/A') return dateText;
      const trimmedTime = String(time || '').trim();
      return trimmedTime ? `${dateText} ${trimmedTime}` : dateText;
    };
    const getLocalizedRetreatDateRange = (retreat: any) => {
      const startDate = retreat?.startDate || retreat?.dates?.startDate;
      const endDate = retreat?.endDate || retreat?.dates?.endDate;
      if (startDate && endDate) return `${formatLocalizedDate(startDate)} - ${formatLocalizedDate(endDate)}`;
      return formatLocalizedDate(startDate || endDate);
    };
    const dateText = getLocalizedRetreatDateRange(retreatData);
    const contactEmail = 'info@ibogaspirit.cz';
    const bookingNumber = String(booking?.bookingNumber || booking?.booking_number || booking?.display_id || booking?.displayId || 'N/A');
    const bookingType = `${booking?.bookingType === 'booster' ? 'B' : 'F'} / ${getRetreatCode(retreatData)}`;
    const retreatStartTime = getRetreatStartTime(retreatData);
    const retreatEndTime = getRetreatEndTime(retreatData);
    const checkInText = formatLocalizedDateTime(retreatData?.startDate || retreatData?.dates?.startDate, retreatStartTime);
    const checkOutText = formatLocalizedDateTime(retreatData?.endDate || retreatData?.dates?.endDate, retreatEndTime);
    const specialRequestsText = booking?.specialRequests || copy.none;
    const rows = [
      [copy.rows.bookingNumber, bookingNumber],
      [copy.rows.bookingType, bookingType],
      [copy.rows.status, booking?.status || 'pending'],
      [copy.rows.client, getClientName(clientData) || 'N/A'],
      [copy.rows.retreat, retreatData?.name || 'N/A'],
      [copy.rows.locationTown, getRetreatLocationTown(retreatData) || 'N/A'],
      [copy.rows.dates, dateText],
      [copy.rows.checkIn, checkInText],
      [copy.rows.checkOut, checkOutText],
      [copy.rows.address, addressText],
      [copy.rows.googleMapLink, mapLinkText],
      [copy.rows.specialRequests, specialRequestsText],
    ];
    const variables = {
      client: {
        firstName,
        fullName: getClientName(clientData) || 'N/A',
      },
      booking: {
        number: bookingNumber,
        type: bookingType,
        status: booking?.status || 'pending',
        specialRequests: specialRequestsText,
      },
      retreat: {
        name: retreatData?.name || 'N/A',
        locationTown: getRetreatLocationTown(retreatData) || 'N/A',
        dateRange: dateText,
        checkIn: checkInText,
        checkOut: checkOutText,
        startTime: retreatStartTime,
        endTime: retreatEndTime,
        address: addressText,
        googleMapLink: mapLinkText,
      },
      bookingNumber,
      bookingType,
      bookingStatus: booking?.status || 'pending',
      clientFirstName: firstName,
      clientFullName: getClientName(clientData) || 'N/A',
      clientName: getClientName(clientData) || 'N/A',
      retreatName: retreatData?.name || 'N/A',
      retreatCode: getRetreatCode(retreatData),
      retreatLocationTown: getRetreatLocationTown(retreatData) || 'N/A',
      locationTown: getRetreatLocationTown(retreatData) || 'N/A',
      retreatDateRange: dateText,
      retreatCheckIn: checkInText,
      retreatCheckOut: checkOutText,
      retreatAddress: addressText,
      retreatGoogleMapLink: mapLinkText,
      specialRequests: specialRequestsText,
    };

    try {
      const templateResponse = await communicationsApi.getTemplateByCategoryAndLanguage('booking_confirmation', language);
      const template = templateResponse.data;
      if (template?.bodyText && template?.subject) {
        const bodyText = interpolateTemplate(template.bodyText, variables);
        return {
          templateId: template._id,
          bookingFlowStepKey: template.bookingFlowStepKey || 'booking_confirmation_sent',
          bookingFlowStatusOnSend: template.bookingFlowStatusOnSend || 'sent',
          subject: interpolateTemplate(template.subject, variables),
          bodyText,
          bodyHtml: template.bodyHtml ? interpolateTemplate(template.bodyHtml, variables) : textToHtml(bodyText),
          variables,
        };
      }
    } catch (error) {
      console.warn('Booking confirmation template missing; using fallback copy.', error);
    }

    const bodyText = [
      copy.greeting(firstName),
      '',
      copy.intro(locationText, dateText),
      '',
      copy.attached,
      '',
      ...rows.map(([label, value]) => `${label}: ${value}`),
      '',
      copy.moreInfo,
      copy.questions(contactEmail),
      '',
      copy.closing,
      'IbogaSpirit.cz',
    ].join('\n');
    const rowHtml = rows.map(([label, value]) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-weight:600;width:34%;">${escapeHtml(label)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#111827;">${escapeHtml(value)}</td>
      </tr>
    `).join('');
    const bodyHtml = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.55;max-width:720px;margin:0 auto;">
        <p>${escapeHtml(copy.greeting(firstName))}</p>
        <p>${escapeHtml(copy.intro(locationText, dateText))}</p>
        <p>${escapeHtml(copy.attached)}</p>
        <table style="border-collapse:collapse;width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:22px 0;">
          <tbody>${rowHtml}</tbody>
        </table>
        <p>${escapeHtml(copy.moreInfo)}</p>
        <p>${escapeHtml(copy.questions(contactEmail))}</p>
        <p>${escapeHtml(copy.closing)}<br/>IbogaSpirit.cz</p>
      </div>
    `;
    return {
      bookingFlowStepKey: 'booking_confirmation_sent',
      bookingFlowStatusOnSend: 'sent',
      subject: copy.subject(bookingNumber),
      bodyText,
      bodyHtml,
      variables,
    };
  };

  const getDefaultConfirmationReason = () => {
    const history = booking?.bookingConfirmationHistory || [];
    return history.length === 0 ? 'Original booking confirmation' : 'Updated booking confirmation';
  };

  const recordBookingConfirmationHistory = async (sentEmail: any, language: BookingConfirmationLanguage, reason?: string) => {
    const resolvedReason = String(reason || confirmationHistoryReason || getDefaultConfirmationReason()).trim() || getDefaultConfirmationReason();
    const response = await bookingsApi.recordConfirmationHistory(bookingId, {
      action: (booking?.bookingConfirmationHistory || []).length === 0 ? 'created' : 'updated',
      reason: resolvedReason,
      language,
      sentEmailId: sentEmail?._id,
      sentEmailDisplayId: sentEmail?.display_id,
      sentAt: sentEmail?.sentAt || new Date().toISOString(),
    });
    setBooking(response.data);
  };

  const handleBookingRelatedUpdate = () => {
    fetchBookingDetails();
    setRequirementsRefreshKey((current) => current + 1);
  };

  const navigateToClientEdit = () => {
    const clientId = getObjectId(booking?.clientId || booking?.clientDetails);
    if (!clientId) return;

    navigate(`${routePrefix}/clients/${clientId}/edit`, {
      state: { returnTo: location.pathname },
    });
  };

  const generatePDF = async () => {
    if (!booking) return;

    try {
      setIsGeneratingPDF(true);
      await generateBookingPDF({
        booking,
        language: pdfLanguage,
        onComplete: () => {
          setIsGeneratingPDF(false);
        }
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
      setIsGeneratingPDF(false);
    }
  };

  const previewPDF = async () => {
    if (!booking) return;
    setIsPreviewingPDF(true);
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const { blob, fileName } = await createBookingConfirmationPdf({ booking, language: pdfLanguage });
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewFileName(fileName);
    } catch (error) {
      console.error('Error previewing PDF:', error);
    } finally {
      setIsPreviewingPDF(false);
    }
  };

  const showMissingClientEmailError = () => {
    message.error('This client does not have an email address.');
  };

  const emailBookingConfirmation = async () => {
    const client = booking?.clientId || booking?.clientDetails;
    const retreat = booking?.retreatId || booking?.retreatDetails;
    const recipientEmail = getClientEmail(client);
    if (!recipientEmail) {
      showMissingClientEmailError();
      return;
    }
    setIsPreparingConfirmationEmail(true);
    const reason = confirmationHistoryReason || getDefaultConfirmationReason();
    setConfirmationHistoryReason(reason);
    try {
      const language = pdfLanguage;
      const { blob, fileName } = await createBookingConfirmationPdf({ booking, language });
      const contentBase64 = await blobToBase64(blob);
      const email = await buildBookingConfirmationEmail(language);
      setConfirmationEmailDraft({
        to: recipientEmail,
        subject: email.subject,
        bodyText: email.bodyText,
        templateId: email.templateId,
        bookingFlowStepKey: email.bookingFlowStepKey || 'booking_confirmation_sent',
        bookingFlowStatusOnSend: email.bookingFlowStatusOnSend || 'sent',
        variables: email.variables,
        clientId: client?._id,
        retreatId: retreat?._id,
        relatedEntityType: 'booking',
        relatedEntityId: bookingId,
        attachments: [{
          fileName,
          mimeType: 'application/pdf',
          contentBase64,
        }],
      });
    } catch (error) {
      console.error('Error preparing booking confirmation email:', error);
      alert('Unable to prepare booking confirmation email.');
    } finally {
      setIsPreparingConfirmationEmail(false);
    }
  };

  const requestQuickSendBookingConfirmation = () => {
    const clientData = booking?.clientId || booking?.clientDetails;
    const recipientEmail = getClientEmail(clientData);
    if (!recipientEmail) {
      showMissingClientEmailError();
      return;
    }
    setConfirmationHistoryReason(getDefaultConfirmationReason());
    setShowQuickSendConfirm(true);
  };

  const sendBookingConfirmationEmail = async () => {
    const clientData = booking?.clientId || booking?.clientDetails;
    const retreatData = booking?.retreatId || booking?.retreatDetails;
    const recipientEmail = getClientEmail(clientData);
    let pdfSize = 0;
    let payloadSize = 0;
    if (!recipientEmail) {
      showMissingClientEmailError();
      return;
    }

    setIsSendingConfirmation(true);
    setShowQuickSendConfirm(false);
    try {
      const language = pdfLanguage;
      const { blob, fileName } = await createBookingConfirmationPdf({ booking, language });
      pdfSize = blob.size;
      const contentBase64 = await blobToBase64(blob);
      const email = await buildBookingConfirmationEmail(language);
      const payload = {
        to: recipientEmail,
        subject: email.subject,
        bodyText: email.bodyText,
        bodyHtml: email.bodyHtml,
        templateId: email.templateId,
        bookingId,
        clientId: clientData?._id,
        retreatId: retreatData?._id,
        relatedEntityType: 'booking',
        relatedEntityId: bookingId,
        bookingFlowStepKey: email.bookingFlowStepKey || 'booking_confirmation_sent',
        bookingFlowStatusOnSend: email.bookingFlowStatusOnSend || 'sent',
        variables: email.variables,
        attachments: [{
          fileName,
          mimeType: 'application/pdf',
          contentBase64,
        }],
      };
      payloadSize = new Blob([JSON.stringify(payload)]).size;
      const response = await communicationsApi.sendEmail(payload);
      if (response.data.status === 'failed') {
        alert(`Email was logged but Gmail failed to send it: ${response.data.errorMessage || 'Unknown error'}`);
        return;
      }
      await recordBookingConfirmationHistory(response.data, language, confirmationHistoryReason);
      setRequirementsRefreshKey((current) => current + 1);
      alert(formatSentEmailReceipt(response.data));
    } catch (error: any) {
      console.error('Error sending booking confirmation email:', error);
      const status = error?.response?.status;
      const data = error?.response?.data || {};
      const details = [
        data?.message || error?.message || 'Unable to send booking confirmation email.',
        status ? `Status: ${status}` : '',
        pdfSize ? `PDF attachment size: ${formatFileSize(pdfSize)}` : '',
        payloadSize ? `Request payload size: ${formatFileSize(payloadSize)}` : '',
        data?.limitBytes ? `API limit: ${formatFileSize(Number(data.limitBytes))}` : '',
        data?.receivedBytes ? `Received by API: ${formatFileSize(Number(data.receivedBytes))}` : '',
      ].filter(Boolean).join('\n');
      alert(details);
    } finally {
      setIsSendingConfirmation(false);
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">⏳</div>
        <p>Loading booking details...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="error-container">
        <p>Booking not found</p>
        <button onClick={onBack}>Back to Bookings</button>
      </div>
    );
  }


  // Extract client and retreat info
  const client = booking.clientId || booking.clientDetails;
  const retreat = booking.retreatId || booking.retreatDetails;
  const clientName = getClientName(client) || 'N/A';
  const clientDisplayId = getClientDisplayId(client, booking);
  const bookingTypeCode = booking.bookingType === 'booster' ? 'B' : 'F';
  const retreatCode = getRetreatCode(retreat);
  const retreatId = getObjectId(retreat);
  const retreatAddress = getRetreatAddress(retreat);
  const confirmationHistory = [...(booking.bookingConfirmationHistory || [])].sort((a: any, b: any) => (a.iteration || 0) - (b.iteration || 0));
  const firstConfirmation = confirmationHistory[0];
  const latestConfirmation = confirmationHistory[confirmationHistory.length - 1];
  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'payments', label: 'Payments' },
    { key: 'requirements', label: 'Requirements' },
    { key: 'medical', label: 'Medical' },
    { key: 'ceremonies', label: 'Ceremonies' },
    { key: 'documents', label: 'Documents' },
    { key: 'emails', label: 'Emails' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'workflow', label: 'Booking Requirements' },
    { key: 'notes', label: 'Notes' },
  ] as const;

  return (
    <div className="booking-detail-container">
      <div className="detail-header">
        <button onClick={onBack} className="back-btn" title="Back to bookings" aria-label="Back to bookings">
          <HeaderIcon icon={FiArrowLeft} />
        </button>
        <div className="booking-title-block">
          <span className="booking-title-kicker">Booking Details</span>
          <h1>Booking #{booking.bookingNumber || 'N/A'}</h1>
        </div>
        <div className="header-actions">
          <select
            value={pdfLanguage}
            onChange={(e) => setPdfLanguage(e.target.value as BookingConfirmationLanguage)}
            className="language-selector"
            disabled={isGeneratingPDF}
          >
            <option value="pl">PL</option>
            <option value="cz">CZ</option>
            <option value="en">EN</option>
          </select>
          <button
            onClick={() => navigate(`${routePrefix}/bookings/${bookingId}/edit`)}
            className="pdf-btn"
            title="Edit booking"
            aria-label="Edit booking"
            data-tooltip="Edit booking"
          >
            <HeaderIcon icon={FiEdit3} />
            <span>Edit</span>
          </button>
          <button
            onClick={previewPDF}
            disabled={isPreviewingPDF}
            className="pdf-btn"
            title="Preview PDF"
            aria-label="Preview PDF"
            data-tooltip="Preview PDF"
          >
            <HeaderIcon icon={FiEye} />
            <span>{isPreviewingPDF ? 'Previewing' : 'Preview'}</span>
          </button>
          <button
            onClick={requestQuickSendBookingConfirmation}
            disabled={isSendingConfirmation}
            className="pdf-btn primary-action"
            title="Send email with PDF attachment"
            aria-label="Send email with PDF attachment"
            data-tooltip="Quick send PDF"
          >
            <HeaderIcon icon={FiSend} />
            <span>{isSendingConfirmation ? 'Sending' : 'Send'}</span>
          </button>
          <button
            onClick={emailBookingConfirmation}
            disabled={isPreparingConfirmationEmail}
            className="pdf-btn"
            title="Review email with PDF attachment"
            aria-label="Review email with PDF attachment"
            data-tooltip="Review email"
          >
            <HeaderIcon icon={FiMail} />
            <span>{isPreparingConfirmationEmail ? 'Preparing' : 'Review'}</span>
          </button>
          <button
            onClick={generatePDF}
            disabled={isGeneratingPDF}
            className="pdf-btn"
            title="Download PDF"
            aria-label="Download PDF"
            data-tooltip="Download PDF"
          >
            <HeaderIcon icon={FiDownload} />
            <span>{isGeneratingPDF ? 'Generating' : 'Download'}</span>
          </button>
        </div>
      </div>

      <div className="detail-content" ref={pdfRef}>
        {previewUrl && (
          <div className="detail-section pdf-section">
            <div className="section-header">
              <h3 className="pdf-section-title">Booking Confirmation Preview</h3>
              <a href={previewUrl} download={previewFileName} className="edit-btn">
                Download Preview
              </a>
            </div>
            <iframe
              src={previewUrl}
              title={previewFileName || 'Booking confirmation preview'}
              className="w-full border-0"
              style={{ height: '70vh', background: '#fff' }}
            />
          </div>
        )}

        <div className="booking-info-strip" aria-label="Booking summary">
          <div className="booking-info-item booking-info-client">
            <span>Client</span>
            <strong>{clientName}</strong>
          </div>
          {clientDisplayId && (
            <div className="booking-info-item">
              <span>Client ID</span>
              <strong>#{clientDisplayId}</strong>
            </div>
          )}
          <div className="booking-info-item">
            <span>Retreat</span>
            {retreatId ? (
              <button
                type="button"
                className="booking-info-link"
                onClick={() => navigate(`${routePrefix}/retreats/${retreatId}`)}
                title={`Open retreat ${retreatCode}`}
              >
                {retreatCode}
              </button>
            ) : (
              <strong>{retreatCode}</strong>
            )}
          </div>
          <div className="booking-info-item booking-info-type">
            <span>Type</span>
            <strong>{bookingTypeCode}</strong>
          </div>
        </div>

        <div className="booking-detail-tabs" role="tablist" aria-label="Booking sections">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`booking-detail-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              aria-selected={activeTab === tab.key}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <>
            <div className="booking-overview-summary">
              <div className="booking-overview-retreat">
                <span className="booking-type-dot">{bookingTypeCode}</span>
                <span className="retreat-code-pill">{retreatCode}</span>
              </div>
              <div className="booking-overview-address">
                {retreatAddress || 'No retreat address recorded'}
              </div>
            </div>

            <div className="detail-section pdf-section">
              <div className="section-header">
                <h3 className="pdf-section-title">Booking Confirmation History</h3>
                <span className="booking-confirm-history-count">{confirmationHistory.length} iteration{confirmationHistory.length === 1 ? '' : 's'}</span>
              </div>
              {confirmationHistory.length === 0 ? (
                <p className="text-sm text-gray-500">No booking confirmation has been sent yet.</p>
              ) : (
                <details className="booking-confirm-history-accordion">
                  <summary className="booking-confirm-history-trigger">
                    <div className="booking-confirm-history-compact">
                      <div>
                        <span>Original</span>
                        <strong>{formatHistoryDateTime(firstConfirmation?.sentAt || firstConfirmation?.createdAt)}</strong>
                      </div>
                      <div>
                        <span>Last update</span>
                        <strong>{formatHistoryDateTime(latestConfirmation?.sentAt || latestConfirmation?.createdAt)}</strong>
                      </div>
                      <div>
                        <span>Latest reason</span>
                        <strong>{latestConfirmation?.reason || 'N/A'}</strong>
                      </div>
                    </div>
                    <span className="booking-confirm-history-toggle">Show iterations</span>
                  </summary>
                  <div className="booking-confirm-history">
                    <div className="booking-confirm-history-list">
                      {confirmationHistory.map((entry: any) => (
                        <div key={entry._id || `${entry.iteration}-${entry.sentAt}`} className="booking-confirm-history-entry">
                          <div className="booking-confirm-history-entry-main">
                            <strong>Iteration {entry.iteration}</strong>
                            <span>{formatHistoryDateTime(entry.sentAt || entry.createdAt)}</span>
                          </div>
                          <div className="booking-confirm-history-entry-meta">
                            <span>{entry.reason || 'No reason recorded'}</span>
                            {entry.language && <span>{bookingConfirmationLanguageLabels[entry.language as BookingConfirmationLanguage] || entry.language}</span>}
                            {entry.sentEmailDisplayId && <span>Email #{entry.sentEmailDisplayId}</span>}
                            {entry.snapshot?.retreatCode && <span>{entry.snapshot.retreatCode}</span>}
                            {entry.snapshot?.paymentRequestDisplayId && <span>Payment request #{entry.snapshot.paymentRequestDisplayId}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              )}
            </div>

            <div className="detail-section pdf-section">
              <div className="section-header client-section-header">
                <h3 className="pdf-section-title">Client Information</h3>
                <div className="client-mobile-heading">
                  <div>
                    <span className="mobile-section-label">Client</span>
                    <h2>{clientName}</h2>
                  </div>
                  <button
                    className="edit-btn edit-client-btn"
                    onClick={navigateToClientEdit}
                    title="Edit client information"
                    aria-label="Edit client information"
                  >
                    <HeaderIcon icon={FiEdit3} />
                    <span>Edit Client</span>
                  </button>
                </div>
                <button
                  className="edit-btn edit-client-btn desktop-client-edit"
                  onClick={navigateToClientEdit}
                  title="Edit client information"
                >
                  <HeaderIcon icon={FiEdit3} />
                  <span>Edit Client</span>
                </button>
              </div>
              <button
                type="button"
                className="mobile-client-details-toggle"
                onClick={() => setShowClientDetails((current) => !current)}
                aria-expanded={showClientDetails}
              >
                <span>Client details</span>
                <HeaderIcon icon={FiChevronDown} />
              </button>
              <div className={`info-grid client-info-grid ${showClientDetails ? 'mobile-expanded' : 'mobile-collapsed'}`}>
                <div className="info-item">
                  <label>Name:</label>
                  <span>{clientName}</span>
                </div>
                <div className="info-item mobile-hidden-client-field">
                  <label>Email:</label>
                  <span>{client?.email || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <label>Phone:</label>
                  <span>{client?.phone || 'N/A'}</span>
                </div>
                <div className="info-item mobile-hidden-client-field">
                  <label>City:</label>
                  <span>{client?.city || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <label>Country:</label>
                  <span>{client?.country || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="booking-detail-accordion booking-payment-accordion">
              <button
                type="button"
                className="booking-detail-accordion-trigger"
                onClick={() => setShowPayments((current) => !current)}
                aria-expanded={showPayments}
              >
                <span>Payment Information</span>
                <span>{showPayments ? 'Hide' : 'Show'}</span>
              </button>
              {showPayments && (
                <div className="booking-detail-accordion-body">
                  <BookingPaymentManagement
                    bookingId={bookingId}
                    bookingNumber={booking.bookingNumber}
                    bookingHash={booking.bookingHash}
                    clientId={typeof client === 'object' ? client._id : client}
                    retreatId={typeof retreat === 'object' ? retreat._id : retreat}
                    totalAmount={booking.totalAmount || 0}
                    currency={booking.currency || 'EUR'}
                    onPaymentUpdate={fetchBookingDetails}
                  />
                </div>
              )}
            </div>

            <div className="booking-detail-accordion booking-steps-accordion">
              <button
                type="button"
                className="booking-detail-accordion-trigger"
                onClick={() => setShowBookingSteps((current) => !current)}
                aria-expanded={showBookingSteps}
              >
                <span>Booking Requirements</span>
                <span>{showBookingSteps ? 'Hide' : 'Show'}</span>
              </button>
              {showBookingSteps && (
                <div className="booking-detail-accordion-body">
                  <ClientBookingWorkflowTab bookings={[booking]} hideBookingSelector />
                </div>
              )}
            </div>

            <div className="booking-detail-accordion retreat-info-accordion">
              <button
                type="button"
                className="booking-detail-accordion-trigger"
                onClick={() => setShowRetreatInfo((current) => !current)}
                aria-expanded={showRetreatInfo}
              >
                <span>Retreat Information</span>
                <span>{showRetreatInfo ? 'Hide' : 'Show'}</span>
              </button>
              {showRetreatInfo && (
                <div className="booking-detail-accordion-body">
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Retreat Name:</label>
                      <span>{retreat?.name || 'N/A'}</span>
                    </div>
                    <div className="info-item">
                      <label>Location town:</label>
                      <span>{getRetreatLocationTown(retreat) || 'N/A'}</span>
                    </div>
                    <div className="info-item">
                      <label>Type:</label>
                      <span>{retreat?.type ? retreat.type.charAt(0).toUpperCase() + retreat.type.slice(1) : 'N/A'}</span>
                    </div>
                    <div className="info-item">
                      <label>Start Date:</label>
                      <span>{formatDate(retreat?.startDate || retreat?.dates?.startDate)}</span>
                    </div>
                    <div className="info-item">
                      <label>End Date:</label>
                      <span>{formatDate(retreat?.endDate || retreat?.dates?.endDate)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="booking-detail-accordion">
              <button
                type="button"
                className="booking-detail-accordion-trigger"
                onClick={() => setShowBookingDates((current) => !current)}
                aria-expanded={showBookingDates}
              >
                <span>Booking Dates</span>
                <span>{showBookingDates ? 'Hide' : 'Show'}</span>
              </button>
              {showBookingDates && (
                <div className="booking-detail-accordion-body">
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Registration Date:</label>
                      <span>{formatDate(booking.registrationDate)}</span>
                    </div>
                    <div className="info-item">
                      <label>Check-in Date:</label>
                      <span>{formatDate(booking.checkInDate)}</span>
                    </div>
                    <div className="info-item">
                      <label>Check-out Date:</label>
                      <span>{formatDate(booking.checkOutDate)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </>
        )}

        {activeTab === 'payments' && (
          <BookingPaymentManagement
            bookingId={bookingId}
            bookingNumber={booking.bookingNumber}
            bookingHash={booking.bookingHash}
            clientId={typeof client === 'object' ? client._id : client}
            retreatId={typeof retreat === 'object' ? retreat._id : retreat}
            totalAmount={booking.totalAmount || 0}
            currency={booking.currency || 'EUR'}
            onPaymentUpdate={fetchBookingDetails}
          />
        )}

        {activeTab === 'requirements' && (
          <BookingRequirementsPanel
            bookingId={bookingId}
            clientId={getObjectId(client)}
            retreatId={getObjectId(retreat)}
            refreshKey={requirementsRefreshKey}
          />
        )}

        {activeTab === 'medical' && (
          <BookingMedicalOverviewPanel
            bookingId={bookingId}
            bookingNumber={booking.bookingNumber}
            clientId={typeof client === 'object' ? client._id : client}
            retreatId={typeof retreat === 'object' ? retreat._id : retreat}
            refreshKey={requirementsRefreshKey}
            onUploadComplete={handleBookingRelatedUpdate}
          />
        )}

        {activeTab === 'ceremonies' && (
          <BookingCeremoniesPanel
            bookingId={bookingId}
            clientId={getObjectId(client)}
            retreatId={getObjectId(retreat)}
            refreshKey={requirementsRefreshKey}
          />
        )}

        {activeTab === 'documents' && (
          <BookingDocumentsUpload
            bookingId={bookingId}
            bookingNumber={booking.bookingNumber}
            clientId={typeof client === 'object' ? client._id : client}
            retreatId={typeof retreat === 'object' ? retreat._id : retreat}
            onUploadComplete={handleBookingRelatedUpdate}
          />
        )}

        {activeTab === 'emails' && (
          <EmailHistoryPanel
            bookingId={bookingId}
            clientId={getObjectId(booking?.clientId || booking?.clientDetails)}
            retreatId={getObjectId(booking?.retreatId || booking?.retreat)}
            recipientEmail={(typeof booking?.clientId === 'object' ? booking.clientId?.email : booking?.clientDetails?.email) || booking?.clientEmail}
            recipientName={typeof booking?.clientId === 'object' ? [booking.clientId?.firstName, booking.clientId?.lastName].filter(Boolean).join(' ') : [booking?.clientDetails?.firstName, booking?.clientDetails?.lastName].filter(Boolean).join(' ')}
            title="Booking emails"
            subtitle="Only emails related to this booking and client."
          />
        )}

        {activeTab === 'tasks' && (
          <div className="detail-section">
            <div className="section-header">
              <h3 className="pdf-section-title">Booking Tasks</h3>
              <button type="button" className="edit-btn" onClick={handleCreateTask}>
                Add Task
              </button>
            </div>
            {bookingTasksError && <div className="alert alert-danger">{bookingTasksError}</div>}
            {loadingBookingTasks ? (
              <p className="text-sm text-gray-500">Loading tasks...</p>
            ) : (
              <TaskList
                tasks={bookingTasks}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onCompleteTask={handleCompleteTask}
              />
            )}
          </div>
        )}

        {activeTab === 'workflow' && (
          <div className="detail-section">
            <ClientBookingWorkflowTab bookings={[booking]} hideBookingSelector />
          </div>
        )}

        {activeTab === 'notes' && (
          <>
            {booking.specialRequests && (
              <div className="detail-section pdf-section">
                <h3 className="pdf-section-title">Special Requests</h3>
                <p className="special-requests">{booking.specialRequests}</p>
              </div>
            )}

            {booking.notes && (
              <div className="detail-section pdf-section">
                <h3 className="pdf-section-title">Notes</h3>
                <p className="notes">{booking.notes}</p>
              </div>
            )}

            {!booking.specialRequests && !booking.notes && (
              <div className="detail-section">
                <p className="text-sm text-gray-500">No notes or special requests recorded.</p>
              </div>
            )}
          </>
        )}
      </div>

      {confirmationEmailDraft && (
        <EmailComposeModal
          title="Booking Confirmation Email"
          initialValues={confirmationEmailDraft}
          extraContent={
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Confirmation history reason</label>
              <input
                value={confirmationHistoryReason}
                onChange={(event) => setConfirmationHistoryReason(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Original booking confirmation, date change, new payment..."
              />
            </div>
          }
          onClose={() => setConfirmationEmailDraft(null)}
          onSent={async (sentEmail) => {
            await recordBookingConfirmationHistory(sentEmail, pdfLanguage, confirmationHistoryReason);
            setConfirmationEmailDraft(null);
            fetchBookingDetails();
            setRequirementsRefreshKey((current) => current + 1);
          }}
        />
      )}

      {showQuickSendConfirm && (() => {
        const confirmClient = booking?.clientId || booking?.clientDetails;
        const confirmName = getClientName(confirmClient) || 'this client';
        const confirmEmail = getClientEmail(confirmClient);
        return (
          <div className="booking-confirm-dialog-overlay" role="presentation">
            <div className="booking-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="quick-send-confirm-title">
              <h2 id="quick-send-confirm-title">Send booking confirmation?</h2>
              <p>Do you want to send the booking confirmation to this client?</p>
              <div className="booking-confirm-dialog-details">
                <div>
                  <span>Name</span>
                  <strong>{confirmName}</strong>
                </div>
                <div>
                  <span>Email</span>
                  <strong>{confirmEmail}</strong>
                </div>
                <div>
                  <span>Language</span>
                  <strong>{bookingConfirmationLanguageLabels[pdfLanguage]}</strong>
                </div>
                <div className="booking-confirm-dialog-reason">
                  <label htmlFor="booking-confirm-history-reason">Reason</label>
                  <input
                    id="booking-confirm-history-reason"
                    value={confirmationHistoryReason}
                    onChange={(event) => setConfirmationHistoryReason(event.target.value)}
                    placeholder="Original booking confirmation, date change, new payment..."
                  />
                </div>
              </div>
              <div className="booking-confirm-dialog-actions">
                <button
                  type="button"
                  className="booking-confirm-secondary"
                  onClick={() => setShowQuickSendConfirm(false)}
                  disabled={isSendingConfirmation}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="booking-confirm-primary"
                  onClick={sendBookingConfirmationEmail}
                  disabled={isSendingConfirmation}
                >
                  {isSendingConfirmation ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showTaskForm && (
        <TaskForm
          task={editingTask}
          clientId={getObjectId(booking?.clientId || booking?.clientDetails)}
          retreatId={getObjectId(booking?.retreatId || booking?.retreatDetails)}
          bookingId={bookingId}
          bookingLabel={`#${booking.bookingNumber || bookingId.slice(-6)}`}
          onSubmit={handleSubmitTask}
          onCancel={() => {
            setShowTaskForm(false);
            setEditingTask(null);
          }}
          error={bookingTasksError}
        />
      )}
    </div>
  );
};

export default BookingDetailView;
