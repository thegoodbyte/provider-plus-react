import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Circle, FileText, Filter, Link2, ListPlus, Lock, Mail, OctagonX, RefreshCw, Save, ThumbsDown, ThumbsUp, Unlock, Upload, X } from 'lucide-react';
import { bookingDocumentsApi, bookingFlowApi, clientsApi, communicationsApi, medicalArtifactsApi, medicalReviewRequestsApi, paymentsApi } from '../services/api';
import { usersApi, User } from '../services/usersApi';
import { BookingDocument, BookingFlowAction, BookingFlowActionLog, BookingFlowItem, BookingFlowTemplate, Client, MedicalArtifact, MedicalReviewRequest, Payment } from '../types';
import LoadingSpinner from './LoadingSpinner';
import EmailComposeModal, { EmailComposeInitialValues } from './EmailComposeModal';
import { resolveBookingStepUploadTarget, shouldShowArtifactUploadFallback } from './BookingStepsMatrix.helpers';
import {
  getBookingStepColorStyles,
  getBookingStepToneWithColor,
  titleizeBookingStepGroup,
} from '../utils/bookingStepColors';
import { buildBookingFlowArtifactFilters } from './bookingFlowLookup';
import { hasBookingActionLog, reviewRequestStatusToBookingStepStatus } from './BookingStepsMatrix.helpers';
import { normalizeBookingStepKey, resolveConfiguredBookingStepActions } from './bookingStepActions';

const getObjectId = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

const getClientName = (booking: any): string => {
  const client = booking.clientId || booking.client || {};
  if (typeof client === 'object') {
    const name = [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ');
    return name || client.email || `Client ${getObjectId(booking).slice(-6)}`;
  }
  return `Client ${String(client || getObjectId(booking)).slice(-6)}`;
};

const getBookingClient = (booking: any): Client | null => {
  const client = booking.clientId || booking.client || null;
  return client && typeof client === 'object' ? client : null;
};

const getBookingNumber = (booking: any): string => {
  return booking.bookingNumber || booking.displayNumber || getObjectId(booking).slice(-6);
};

const getBookingClientId = (booking: any): string => {
  return getObjectId(booking.clientId || booking.client);
};

const getPaymentClientId = (payment: Payment): string => getObjectId(payment.clientId);

const normalizeDocumentKey = normalizeBookingStepKey;

const humanizeDocumentKey = (value: string) => value
  .split(/[_-]+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const bookingDocumentTypeByStep: Record<string, string> = {
  contract_signed: 'contract',
  ekg_received: 'ekg',
  liver_received: 'liver_panel',
  questionnaire_received: 'questionnaire',
};

type ReviewStepConfig = {
  receivedStepKey: string;
  requestType: NonNullable<MedicalReviewRequest['requestType']>;
  documentStage: MedicalArtifact['documentStage'];
  documentType: MedicalArtifact['documentType'];
  artifactType: NonNullable<MedicalArtifact['artifactType']>;
  label: string;
};

const reviewStepConfigByKey: Record<string, ReviewStepConfig> = {
  ekg_sent_for_review: { receivedStepKey: 'ekg_received', requestType: 'ekg_review', documentStage: 'entry', documentType: 'EKG', artifactType: 'ekg', label: 'Entry EKG review' },
  liver_panel_sent_for_review: { receivedStepKey: 'liver_received', requestType: 'liver_panel_review', documentStage: 'entry', documentType: 'Liver', artifactType: 'liver_panel', label: 'Liver panel review' },
  medications_form_mrr_sent: { receivedStepKey: 'medications_form_initial_received', requestType: 'medications_review', documentStage: 'entry', documentType: 'Medications', artifactType: 'medications_form', label: 'Medication form review' },
  medications_form_review_result: { receivedStepKey: 'medications_form_initial_received', requestType: 'medications_review', documentStage: 'entry', documentType: 'Medications', artifactType: 'medications_form', label: 'Medication form review' },
};

const artifactStepConfigByKey: Record<string, Pick<ReviewStepConfig, 'documentStage' | 'documentType' | 'artifactType' | 'label'>> = {
  ekg_received: { documentStage: 'entry', documentType: 'EKG', artifactType: 'ekg', label: 'Entry EKG' },
  liver_received: { documentStage: 'entry', documentType: 'Liver', artifactType: 'liver_panel', label: 'Entry liver panel' },
  medications_form_initial_received: { documentStage: 'entry', documentType: 'Medications', artifactType: 'medications_form', label: 'Medication form' },
  medications_form_30_day_received: { documentStage: 'additional', documentType: 'Medications', artifactType: 'medications_form', label: '30-day medications form' },
};

const getArtifactStepConfig = (item: Pick<BookingFlowItem, 'key' | 'title' | 'metadata'>) => {
  const exact = artifactStepConfigByKey[item.key];
  if (exact) return exact;

  const metadata = item.metadata || {};
  const normalized = normalizeDocumentKey([
    item.key,
    item.title,
    metadata.expectedArtifact,
    metadata.expectedDocument,
    metadata.expectedBookingDocument,
  ].filter(Boolean).join(' '));
  if (normalized.includes('review') || normalized.includes('sent_for_review')) return undefined;
  if (normalized.includes('medication') || normalized.includes('medical_form') || normalized.includes('meds_form') || normalized.includes('med_form')) {
    return artifactStepConfigByKey.medications_form_initial_received;
  }
  if (normalized.includes('entry_ekg') || normalized === 'ekg_received') return artifactStepConfigByKey.ekg_received;
  if (normalized.includes('liver') && normalized.includes('received')) return artifactStepConfigByKey.liver_received;
  return undefined;
};

type ArtifactLinkConfig = {
  documentStage: MedicalArtifact['documentStage'];
  documentType: MedicalArtifact['documentType'];
  artifactType: NonNullable<MedicalArtifact['artifactType']>;
  label: string;
};

const getReviewStepConfig = (row: Pick<MatrixRow, 'key' | 'title'>) => {
  const exact = reviewStepConfigByKey[row.key];
  if (exact) return exact;

  const normalized = normalizeDocumentKey(`${row.key} ${row.title}`);
  const isReviewStep = normalized.includes('review') && (
    normalized.includes('sent') ||
    normalized.includes('send') ||
    normalized.includes('medical')
  );
  if (!isReviewStep) return undefined;
  if (normalized.includes('ekg')) {
    return { receivedStepKey: 'ekg_received', requestType: 'ekg_review' as const, documentStage: 'entry' as const, documentType: 'EKG' as const, artifactType: 'ekg' as const, label: 'Entry EKG review' };
  }
  if (normalized.includes('liver')) {
    return { receivedStepKey: 'liver_received', requestType: 'liver_panel_review' as const, documentStage: 'entry' as const, documentType: 'Liver' as const, artifactType: 'liver_panel' as const, label: 'Liver panel review' };
  }
  if (normalized.includes('medication') || normalized.includes('meds')) {
    return { receivedStepKey: 'medications_form_initial_received', requestType: 'medications_review' as const, documentStage: 'entry' as const, documentType: 'Medications' as const, artifactType: 'medications_form' as const, label: 'Medication form review' };
  }
  return undefined;
};

const getArtifactLinkCandidates = (booking: any, artifacts: MedicalArtifact[], config?: ArtifactLinkConfig) => {
  if (!config) return [];
  const bookingId = getObjectId(booking);
  const clientId = getBookingClientId(booking);
  const retreatId = getObjectId(booking.retreatId || booking.retreat);
  const bookingNumber = String(getBookingNumber(booking)).trim().toLowerCase();

  return artifacts
    .filter((artifact) => {
      if (!artifact._id) return false;
      const matchesType = artifact.artifactType === config.artifactType
        || (artifact.documentStage === 'entry' && artifact.documentType === config.documentType);
      if (!matchesType) return false;

      const artifactBookingId = getObjectId(artifact.bookingId);
      const artifactClientId = getObjectId(artifact.clientId);
      const artifactRetreatId = getObjectId(artifact.retreatId);
      const bookingNumberMatches = [
        artifact.title,
        artifact.description,
        artifact.notes,
        artifact.textContent,
        artifact.data?.bookingNumber,
        artifact.data?.booking_number,
        artifact.data?.bookingNo,
      ].some((value) => String(value || '').toLowerCase().includes(bookingNumber));

      return artifactBookingId === bookingId
        || artifactClientId === clientId
        || (retreatId && artifactRetreatId === retreatId)
        || bookingNumberMatches
        || (!artifactBookingId && !artifactClientId && !artifactRetreatId);
    })
    .sort((a, b) => new Date(b.receivedAt || b.createdAt || 0).getTime() - new Date(a.receivedAt || a.createdAt || 0).getTime());
};

const reviewStatusToDecision = (status?: MedicalReviewRequest['status']) => {
  if (status === 'approved') return 'OK';
  if (status === 'rejected') return 'NOT OK';
  if (status === 'caution') return 'caution';
  if (status === 'needs_resubmission') return 'more_info_needed';
  return '';
};

const reviewDecisionToLabel = (decision?: string) => {
  if (decision === 'OK') return 'OK';
  if (decision === 'NOT OK') return 'Declined';
  if (decision === 'caution') return 'Caution';
  if (decision === 'more_info_needed') return 'More info needed';
  return '';
};

const reviewDecisionToClassName = (decision?: string) => {
  if (decision === 'OK') return 'border-green-300 bg-green-200 text-green-950';
  if (decision === 'NOT OK') return 'border-red-300 bg-red-200 text-red-950';
  if (decision === 'caution') return 'border-yellow-300 bg-yellow-200 text-yellow-950';
  if (decision === 'more_info_needed') return 'border-amber-300 bg-amber-200 text-amber-950';
  return '';
};

const getReviewRequestLinkCandidates = (
  booking: any,
  requests: MedicalReviewRequest[],
  config?: ReviewStepConfig,
  itemId?: string,
) => {
  const bookingClientId = getBookingClientId(booking);
  const bookingRetreatId = getObjectId(booking.retreatId || booking.retreat);
  const bookingId = getObjectId(booking);
  return requests
    .filter((request) => {
      const linkedItemId = getObjectId(request.bookingFlowItemId);
      if (linkedItemId && itemId && linkedItemId !== itemId) return false;
      const requestClientId = getObjectId(request.clientId);
      const requestRetreatId = getObjectId(request.retreatId);
      const matchesBooking = [
        requestClientId && requestClientId === bookingClientId,
        requestRetreatId && requestRetreatId === bookingRetreatId,
        getObjectId(request.bookingFlowItemId) === itemId,
      ].some(Boolean);
      if (!matchesBooking) return false;
      if (!config) return true;
      if (request.requestType !== config.requestType) return false;
      if (request.documentStage && request.documentStage !== config.documentStage) return false;
      if (request.documentType && request.documentType !== config.documentType) return false;
      const artifact = (request.artifactIds || []).find((candidate): candidate is MedicalArtifact => typeof candidate !== 'string');
      if (artifact) {
        if (artifact.bookingId && getObjectId(artifact.bookingId) && getObjectId(artifact.bookingId) !== bookingId) return false;
        if (artifact.documentStage && artifact.documentStage !== config.documentStage) return false;
        if (artifact.documentType && artifact.documentType !== config.documentType) return false;
        if (artifact.artifactType && artifact.artifactType !== config.artifactType) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.requestedAt || b.createdAt || 0).getTime() - new Date(a.requestedAt || a.createdAt || 0).getTime());
};

const getClientDisplayId = (booking: any): string => {
  const client = getBookingClient(booking);
  return String(client?.display_id || booking.clientDisplayId || booking.clientDisplayNumber || '');
};

const getClientEmail = (booking: any): string => {
  return getBookingClient(booking)?.email || booking.clientEmail || '';
};

const getClientPhone = (booking: any): string => {
  const client = getBookingClient(booking) as any;
  const phoneParts = [client?.phoneCountryCode, client?.phone || booking.clientPhone].filter(Boolean);
  return phoneParts.join(' ');
};

const RetreatMatrixClientAvatar: React.FC<{ client: Client | null; name: string }> = ({ client, name }) => {
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(client?.profilePictureUrl || null);
  const hasProfilePicture = Boolean(client?.profilePictureUrl || client?.profilePictureS3Key || client?.profilePictureFileUploadId);

  useEffect(() => {
    if (!client?._id || client.profilePictureUrl || !hasProfilePicture) {
      setProfilePictureUrl(client?.profilePictureUrl || null);
      return;
    }

    let objectUrl: string | null = null;
    let active = true;

    clientsApi.getProfilePictureBlob(client._id)
      .then((response) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(response.data);
        setProfilePictureUrl(objectUrl);
      })
      .catch(() => {
        if (active) setProfilePictureUrl(null);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [client?._id, client?.profilePictureFileUploadId, client?.profilePictureS3Key, client?.profilePictureUrl, hasProfilePicture]);

  return (
    <span className="mr-2 inline-flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100 text-xs font-semibold text-gray-600">
      {profilePictureUrl ? <img src={profilePictureUrl} alt="" className="h-full w-full object-cover" /> : <span>{name.charAt(0).toUpperCase()}</span>}
    </span>
  );
};

const formatDate = (value?: Date | string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
};

const formatDateTime = (value?: Date | string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getActionLogDate = (log: BookingFlowActionLog) => log.performedAt || log.createdAt;

const describeActionLog = (log: BookingFlowActionLog) => {
  const parts = [
    getActionLogDate(log) ? formatDateTime(getActionLogDate(log)) : '',
    log.metadata?.sentEmailDisplayId ? `Email #${log.metadata.sentEmailDisplayId}` : '',
    log.performedByEmail || '',
    log.statusAfter ? `Status: ${String(log.statusAfter).replace(/_/g, ' ')}` : '',
  ].filter(Boolean);
  return parts.join(' • ') || 'Recorded action';
};

const ActionHistoryHover: React.FC<{ label: string; logs: BookingFlowActionLog[] }> = ({ label, logs }) => {
  if (logs.length === 0) return null;
  const sortedLogs = [...logs].sort((a, b) => new Date(getActionLogDate(b) || 0).getTime() - new Date(getActionLogDate(a) || 0).getTime());
  const latest = sortedLogs[0];

  return (
    <span className="group relative inline-flex max-w-full items-center">
      <button
        type="button"
        className="truncate rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-800 hover:bg-blue-100"
        title="Hover to see all actions"
      >
        {label}: {logs.length}x{latest?.performedAt ? `, last ${formatDateTime(latest.performedAt)}` : ''}
      </button>
      <span className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-80 max-w-[80vw] rounded-lg border border-gray-200 bg-white p-3 text-left text-xs text-gray-700 shadow-xl group-hover:block">
        <span className="mb-2 block font-semibold text-gray-900">{label} history</span>
        <span className="block max-h-72 space-y-2 overflow-y-auto">
          {sortedLogs.map((log, index) => (
            <span key={log._id || `${label}-${index}`} className="block rounded-md bg-gray-50 p-2">
              <span className="block font-medium text-gray-900">{describeActionLog(log)}</span>
              {log.notes && <span className="mt-1 block whitespace-pre-wrap text-gray-600">{log.notes}</span>}
              {log.actionLabel && <span className="mt-1 block text-gray-500">{log.actionLabel}</span>}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
};

const formatDateInput = (value?: Date | string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const formatMoney = (amount?: number, currency?: string) => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return '';
  return `${numericAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || ''}`.trim();
};

const formatPaymentOption = (payment: Payment) => {
  const displayId = payment.display_id ? `#${payment.display_id}` : payment._id?.slice(-6) || 'Payment';
  const amount = formatMoney(payment.amount, payment.currency);
  const date = formatDate(payment.paymentDate);
  const method = String(payment.paymentMethod || '').replace(/_/g, ' ');
  const status = payment.status && payment.status !== 'completed' ? ` (${payment.status})` : '';
  return [displayId, amount, date, method].filter(Boolean).join(' • ') + status;
};

const getLinkedArtifactIdFromItem = (item?: BookingFlowItem): string => {
  const metadata = item?.metadata || {};
  const direct = metadata.latestArtifactId || metadata.linkedMedicalArtifactId || metadata.receivedArtifactId;
  if (direct) return String(direct);
  const ids = metadata.linkedMedicalArtifactIds;
  if (Array.isArray(ids) && ids.length > 0) return String(ids[ids.length - 1]);
  return '';
};

const getReviewRequestArtifactIds = (request: MedicalReviewRequest): string[] => {
  return (request.artifactIds || []).map((artifact) => getObjectId(artifact)).filter(Boolean);
};

const makeReviewContextKey = (bookingId: string, config: ReviewStepConfig) => [
  bookingId,
  config.documentStage,
  config.documentType,
  config.artifactType,
  config.requestType,
].join(':');

const makeArtifactContextKey = (bookingId: string, config: Pick<ReviewStepConfig, 'documentStage' | 'documentType' | 'artifactType'>) => [
  bookingId,
  config.documentStage,
  config.documentType,
  config.artifactType,
].join(':');

const sortReviewRequests = (requests: MedicalReviewRequest[]) => {
  return [...requests].sort((a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime());
};

const sortMedicalArtifacts = (artifacts: MedicalArtifact[]) => {
  return [...artifacts].sort((a, b) => new Date(b.receivedAt || b.createdAt || 0).getTime() - new Date(a.receivedAt || a.createdAt || 0).getTime());
};

const solidifyAlphaHex = (value?: string): string | undefined => {
  if (!value || !/^#[0-9a-fA-F]{8}$/.test(value)) return value;
  const red = parseInt(value.slice(1, 3), 16);
  const green = parseInt(value.slice(3, 5), 16);
  const blue = parseInt(value.slice(5, 7), 16);
  const alpha = parseInt(value.slice(7, 9), 16) / 255;
  const blend = (channel: number) => Math.round(channel * alpha + 255 * (1 - alpha));
  return `rgb(${blend(red)}, ${blend(green)}, ${blend(blue)})`;
};

const getStickyActionCellStyle = (style: React.CSSProperties | undefined, fallbackBackground: string): React.CSSProperties => ({
  ...(style || {}),
  backgroundColor: solidifyAlphaHex(String(style?.backgroundColor || '')) || style?.backgroundColor || fallbackBackground,
  backgroundClip: 'padding-box',
  boxShadow: '4px 0 10px rgba(15, 23, 42, 0.08)',
});

interface MatrixRow {
  key: string;
  title: string;
  order: number;
  category?: BookingFlowTemplate['category'] | BookingFlowItem['category'];
  groupKey: string;
  groupLabel: string;
  groupColor?: string;
  templateId?: string;
  emailEnabled?: boolean;
  emailTemplateId?: BookingFlowTemplate['emailTemplateId'];
}

interface MatrixRowGroup {
  key: string;
  label: string;
  color?: string;
  rows: MatrixRow[];
}

const statusOptions: BookingFlowItem['status'][] = [
  'pending',
  'sent',
  'received',
  'sent_for_review',
  'in_review',
  'reviewed',
  'approved',
  'caution',
  'rejected',
  'needs_resubmission',
  'completed',
  'blocked',
  'waived',
  'scheduled',
];

const fulfilledStatuses = new Set<BookingFlowItem['status']>(['received', 'reviewed', 'approved', 'caution', 'completed']);
const failedStatuses = new Set<BookingFlowItem['status']>(['rejected', 'needs_resubmission', 'blocked']);
const attentionStatuses = new Set<BookingFlowItem['status']>(['caution', 'sent_for_review', 'in_review']);

const getStatusCellClass = (status?: BookingFlowItem['status']) => {
  if (status === 'caution') return 'bg-orange-200 text-orange-950';
  if (status === 'rejected' || status === 'needs_resubmission' || status === 'blocked') return 'bg-red-200 text-red-950';
  if (status && fulfilledStatuses.has(status)) return 'bg-green-100 text-green-950';
  if (status === 'sent' || status === 'sent_for_review' || status === 'in_review' || status === 'scheduled') return 'bg-red-50 text-red-900';
  return 'bg-red-50 text-red-900';
};

const getSimpleStatus = (item?: BookingFlowItem) => {
  if (!item) {
    return {
      label: 'Missing',
      className: 'bg-red-50 text-red-600',
      icon: <X className="h-5 w-5" />,
    };
  }
  if (failedStatuses.has(item.status)) {
    return {
      label: item.status.replace(/_/g, ' '),
      className: 'bg-red-100 text-red-800',
      icon: <ThumbsDown className="h-5 w-5" />,
    };
  }
  if (attentionStatuses.has(item.status)) {
    return {
      label: item.status.replace(/_/g, ' '),
      className: 'bg-amber-50 text-amber-700',
      icon: <AlertTriangle className="h-5 w-5" />,
    };
  }
  if (fulfilledStatuses.has(item.status)) {
    return {
      label: item.status.replace(/_/g, ' '),
      className: 'bg-green-50 text-green-700',
      icon: <ThumbsUp className="h-5 w-5" />,
    };
  }
  return {
    label: item.status?.replace(/_/g, ' ') || 'pending',
    className: 'bg-red-50 text-red-600',
    icon: <X className="h-5 w-5" />,
  };
};

const getStatusDateField = (status?: BookingFlowItem['status']): keyof BookingFlowItem | 'dueDate' => {
  if (status === 'sent' || status === 'sent_for_review') return 'sentAt';
  if (status === 'received') return 'receivedAt';
  if (status === 'reviewed' || status === 'approved' || status === 'caution' || status === 'rejected' || status === 'needs_resubmission') return 'reviewedAt';
  if (status === 'completed') return 'completedAt';
  return 'dueDate';
};

const getItemDisplayValue = (item: BookingFlowItem) => {
  if (item.status === 'pending' && !item.notes) return '';
  const dateField = getStatusDateField(item.status);
  const dateValue = item[dateField as keyof BookingFlowItem] as Date | string | null | undefined;
  return formatDateTime(dateValue) || (item.status === 'pending' ? '' : item.status.replace(/_/g, ' '));
};

const titleizeGroup = (value?: string) => {
  return titleizeBookingStepGroup(value);
};

const getTemplateGroup = (template?: Partial<BookingFlowTemplate> | null, fallbackCategory?: string) => {
  const groupKey = String(template?.readinessGroup || fallbackCategory || template?.category || 'other').trim() || 'other';
  return {
    groupKey,
    groupLabel: titleizeGroup(groupKey),
    groupColor: (template as any)?.readinessGroupColor,
  };
};

const getItemGroup = (item?: Partial<BookingFlowItem> | null, template?: Partial<BookingFlowTemplate> | null) => {
  const metadata = item?.metadata || {};
  const groupKey = String(metadata.readinessGroup || template?.readinessGroup || item?.category || template?.category || 'other').trim() || 'other';
  return {
    groupKey,
    groupLabel: titleizeGroup(groupKey),
    groupColor: (template as any)?.readinessGroupColor || metadata.readinessGroupColor,
  };
};

const BookingStepsMatrix: React.FC<{ retreatId: string }> = ({ retreatId }) => {
  const location = useLocation();
  const [bookings, setBookings] = useState<any[]>([]);
  const [templates, setTemplates] = useState<BookingFlowTemplate[]>([]);
  const [libraryTemplates, setLibraryTemplates] = useState<BookingFlowTemplate[]>([]);
  const [items, setItems] = useState<BookingFlowItem[]>([]);
  const [actionLogs, setActionLogs] = useState<BookingFlowActionLog[]>([]);
  const [bookingDocuments, setBookingDocuments] = useState<BookingDocument[]>([]);
  const [medicalArtifacts, setMedicalArtifacts] = useState<MedicalArtifact[]>([]);
  const [reviewRequests, setReviewRequests] = useState<MedicalReviewRequest[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [medicalAdvisors, setMedicalAdvisors] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [viewMode, setViewMode] = useState<'detail' | 'simple'>('detail');
  const [isEditing, setIsEditing] = useState(false);
  const [toolbarMessage, setToolbarMessage] = useState('');
  const [selectedBookingAction, setSelectedBookingAction] = useState('');
  const [selectedActionKeys, setSelectedActionKeys] = useState<string[] | null>(null);
  const [actionFilterOpen, setActionFilterOpen] = useState(false);
  const [actionFilterDraft, setActionFilterDraft] = useState<string[]>([]);
  const [actionFilterSearch, setActionFilterSearch] = useState('');
  const [actionFilterPosition, setActionFilterPosition] = useState({ top: 0, left: 0 });
  const actionFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [dirtyNoteIds, setDirtyNoteIds] = useState<Record<string, true>>({});
  const [datePickerDrafts, setDatePickerDrafts] = useState<Record<string, string>>({});
  const [reviewRequestModal, setReviewRequestModal] = useState<{
    item: BookingFlowItem;
    booking: any;
    artifactId: string;
    requestType: NonNullable<MedicalReviewRequest['requestType']>;
    label: string;
    advisorId: string;
  } | null>(null);
  const [artifactLinkModal, setArtifactLinkModal] = useState<{
    item: BookingFlowItem;
    booking: any;
    row: MatrixRow;
    config: ArtifactLinkConfig;
    candidates: MedicalArtifact[];
    selectedArtifactId: string;
  } | null>(null);
  const [reviewRequestLinkModal, setReviewRequestLinkModal] = useState<{
    item: BookingFlowItem;
    booking: any;
    row: MatrixRow;
    config?: ReviewStepConfig;
    action?: BookingFlowAction;
    candidates: MedicalReviewRequest[];
    selectedRequestId: string;
  } | null>(null);
  const [composeState, setComposeState] = useState<{
    item: BookingFlowItem;
    action?: BookingFlowAction;
    initialValues: EmailComposeInitialValues;
  } | null>(null);
  const [reminderState, setReminderState] = useState<{
    item: BookingFlowItem;
    to: string;
    subject: string;
    bodyText: string;
    dueDate?: string;
    uploadUrl: string;
    reminderCount: number;
    lastReminderAt?: string;
    duplicateBlocked: boolean;
    duplicateWarning: boolean;
    suggestedFollowUpDate: string;
    history: BookingFlowActionLog[];
  } | null>(null);
  const [automationState, setAutomationState] = useState<{
    item: BookingFlowItem;
    paused: boolean;
    pauseReason?: string;
    resumeAt?: string;
    schedules: Array<{ _id: string; ruleKey: string; actionType: 'send_email' | 'create_staff_task'; scheduledFor: string; status: string; executedAt?: string; lastError?: string }>;
  } | null>(null);
  const routePrefix = useMemo(() => {
    const firstSegment = location.pathname.split('/').filter(Boolean)[0];
    return ['admin', 'medical', 'staff', 'user', 'helper'].includes(firstSegment) ? firstSegment : 'admin';
  }, [location.pathname]);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await bookingFlowApi.getMatrix(retreatId);
      const bookingFlowFilters = buildBookingFlowArtifactFilters(response.data?.items || []);
      const [libraryTemplateResponse, paymentsResponse, usersResponse, documentsResponse, artifactsResponse, reviewRequestsResponse] = await Promise.all([
        bookingFlowApi.getLibraryTemplates().catch(() => ({ data: [] as BookingFlowTemplate[] })),
        paymentsApi.getByRetreat(retreatId).catch(() => ({ data: [] as Payment[] })),
        usersApi.getAll().catch(() => ({ data: [] as User[] })),
        bookingDocumentsApi.getAll({ retreatId }).catch(() => ({ data: [] as BookingDocument[] })),
        medicalArtifactsApi.getAll({ retreatId, ...bookingFlowFilters }).catch(() => ({ data: [] as MedicalArtifact[] })),
        medicalReviewRequestsApi.getAll({ retreatId }).catch(() => ({ data: [] as MedicalReviewRequest[] })),
      ]);
      setBookings(response.data?.bookings || []);
      setTemplates(response.data?.templates || []);
      setLibraryTemplates(libraryTemplateResponse.data || []);
      setItems(response.data?.items || []);
      setActionLogs(response.data?.actionLogs || []);
      setBookingDocuments(documentsResponse.data || []);
      setMedicalArtifacts(artifactsResponse.data || []);
      setReviewRequests(reviewRequestsResponse.data || []);
      setPayments(Array.isArray(paymentsResponse.data) ? paymentsResponse.data : []);
      setMedicalAdvisors((usersResponse.data || []).filter((user) => user.role === 'medical_advisor' && user.isActive !== false));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [retreatId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (isEditing) {
      setNoteDrafts((current) => {
        const nextDrafts = { ...current };
        items.forEach((item) => {
          if (item._id && nextDrafts[item._id] === undefined) nextDrafts[item._id] = item.notes || '';
        });
        return nextDrafts;
      });
      return;
    }

    const nextDrafts: Record<string, string> = {};
    items.forEach((item) => {
      if (item._id) nextDrafts[item._id] = item.notes || '';
    });
    setNoteDrafts(nextDrafts);
    setDirtyNoteIds({});
    setDatePickerDrafts({});
  }, [isEditing, items]);

  const generateSteps = async () => {
    setSaving('generate');
    setToolbarMessage('');
    try {
      await communicationsApi.seedDefaultTemplates();
      await bookingFlowApi.seedLibraryTemplates();
      await bookingFlowApi.seedTemplates(retreatId);
      await bookingFlowApi.generateForRetreat(retreatId);
      await loadData(false);
      setToolbarMessage('Booking steps are up to date.');
    } catch (error: any) {
      setToolbarMessage(error?.response?.data?.message || error?.message || 'Unable to generate missing booking steps.');
    } finally {
      setSaving('');
    }
  };

  const rows = useMemo<MatrixRow[]>(() => {
    const rowMap = new Map<string, MatrixRow>();
    templates.forEach((template) => {
      const group = getTemplateGroup(template);
      rowMap.set(template.key, {
        key: template.key,
        title: template.title,
        order: template.order || 0,
        category: template.category,
        ...group,
        templateId: template._id,
        emailEnabled: template.emailEnabled,
        emailTemplateId: template.emailTemplateId,
      });
    });
    items.forEach((item) => {
      const template = typeof item.templateId === 'object' ? item.templateId : null;
      const existing = rowMap.get(item.key);
      const group = getItemGroup(item, template || existing);
      rowMap.set(item.key, {
        ...existing,
        key: item.key,
        title: item.title,
        order: item.order || 0,
        category: item.category || existing?.category || template?.category,
        ...group,
        templateId: existing?.templateId || template?._id || (typeof item.templateId === 'string' ? item.templateId : undefined),
        emailEnabled: existing?.emailEnabled || item.emailEnabled || template?.emailEnabled,
        emailTemplateId: existing?.emailTemplateId || item.emailTemplateId || template?.emailTemplateId,
      });
    });
    return Array.from(rowMap.values()).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  }, [items, templates]);

  const groupedRows = useMemo<MatrixRowGroup[]>(() => {
    const groups = new Map<string, MatrixRowGroup>();
    rows.forEach((row) => {
      const groupKey = row.groupKey || row.category || 'other';
      const current = groups.get(groupKey) || { key: groupKey, label: row.groupLabel || titleizeGroup(groupKey), rows: [] };
      if (!current.color && row.groupColor) current.color = row.groupColor;
      current.rows.push(row);
      groups.set(groupKey, current);
    });
    return Array.from(groups.values());
  }, [rows]);

  const filteredGroupedRows = useMemo<MatrixRowGroup[]>(() => {
    if (selectedActionKeys === null) return groupedRows;
    const selected = new Set(selectedActionKeys);
    return groupedRows
      .map((group) => ({ ...group, rows: group.rows.filter((row) => selected.has(row.key)) }))
      .filter((group) => group.rows.length > 0);
  }, [groupedRows, selectedActionKeys]);

  const openActionFilter = () => {
    if (actionFilterOpen) {
      setActionFilterOpen(false);
      return;
    }
    const rect = actionFilterButtonRef.current?.getBoundingClientRect();
    setActionFilterPosition({
      top: (rect?.bottom || 0) + 6,
      left: Math.max(12, Math.min(rect?.left || 12, window.innerWidth - 352)),
    });
    setActionFilterDraft(selectedActionKeys === null ? rows.map((row) => row.key) : selectedActionKeys);
    setActionFilterSearch('');
    setActionFilterOpen(true);
  };

  const visibleActionFilterRows = rows.filter((row) => row.title.toLowerCase().includes(actionFilterSearch.trim().toLowerCase()));

  const actionNumberByKey = useMemo(
    () => new Map(rows.map((row, index) => [row.key, index + 1])),
    [rows]
  );

  const itemMap = useMemo(() => {
    const map = new Map<string, BookingFlowItem>();
    items.forEach((item) => {
      map.set(`${getObjectId(item.bookingId)}:${item.key}`, item);
    });
    return map;
  }, [items]);

  const templateMap = useMemo(() => {
    const map = new Map<string, BookingFlowTemplate>();
    templates.forEach((template) => {
      if (template._id) map.set(template._id, template);
      if (template.key) map.set(template.key, template);
    });
    return map;
  }, [templates]);

  const libraryTemplateMap = useMemo(() => {
    const map = new Map<string, BookingFlowTemplate>();
    libraryTemplates.forEach((template) => {
      if (template._id) map.set(template._id, template);
      if (template.key) map.set(template.key, template);
    });
    return map;
  }, [libraryTemplates]);

  const actionLogMap = useMemo(() => {
    const map = new Map<string, BookingFlowActionLog[]>();
    actionLogs.forEach((log) => {
      const itemId = getObjectId(log.bookingFlowItemId);
      if (!itemId) return;
      const current = map.get(itemId) || [];
      current.push(log);
      map.set(itemId, current);
    });
    map.forEach((logs) => {
      logs.sort((a, b) => new Date(getActionLogDate(b) || 0).getTime() - new Date(getActionLogDate(a) || 0).getTime());
    });
    return map;
  }, [actionLogs]);

  const bookingDocumentMap = useMemo(() => {
    const map = new Map<string, BookingDocument[]>();
    bookingDocuments.forEach((document) => {
      const bookingId = getObjectId(document.bookingId);
      const documentType = normalizeDocumentKey(document.documentType);
      if (!bookingId || !documentType || (document.files || []).length === 0) return;
      const key = `${bookingId}:${documentType}`;
      const current = map.get(key) || [];
      current.push(document);
      map.set(key, current);
    });
    map.forEach((documents) => {
      documents.sort((a, b) => new Date(b.receivedAt || b.createdAt || 0).getTime() - new Date(a.receivedAt || a.createdAt || 0).getTime());
    });
    return map;
  }, [bookingDocuments]);

  const medicalArtifactById = useMemo(() => {
    const map = new Map<string, MedicalArtifact>();
    medicalArtifacts.forEach((artifact) => {
      if (artifact._id) map.set(artifact._id, artifact);
    });
    return map;
  }, [medicalArtifacts]);

  const medicalArtifactsByBookingContext = useMemo(() => {
    const map = new Map<string, MedicalArtifact[]>();
    medicalArtifacts.forEach((artifact) => {
      const bookingId = getObjectId(artifact.bookingId) || getObjectId(artifact.data?.bookingId || artifact.data?.booking_id);
      if (!bookingId || !artifact.documentStage || !artifact.documentType || !artifact.artifactType) return;
      const key = makeArtifactContextKey(bookingId, {
        documentStage: artifact.documentStage,
        documentType: artifact.documentType,
        artifactType: artifact.artifactType,
      });
      const current = map.get(key) || [];
      current.push(artifact);
      map.set(key, current);
    });
    map.forEach((artifacts, key) => {
      map.set(key, sortMedicalArtifacts(artifacts));
    });
    return map;
  }, [medicalArtifacts]);

  const reviewRequestsByArtifactId = useMemo(() => {
    const map = new Map<string, MedicalReviewRequest[]>();
    reviewRequests.forEach((request) => {
      getReviewRequestArtifactIds(request).forEach((artifactId) => {
        const current = map.get(artifactId) || [];
        current.push(request);
        map.set(artifactId, current);
      });
    });
    map.forEach((requests, artifactId) => {
      map.set(artifactId, sortReviewRequests(requests));
    });
    return map;
  }, [reviewRequests]);

  const reviewRequestsByBookingContext = useMemo(() => {
    const map = new Map<string, MedicalReviewRequest[]>();
    reviewRequests.forEach((request) => {
      (request.artifactIds || []).forEach((artifact) => {
        if (!artifact || typeof artifact === 'string') return;
        const bookingId = getObjectId(artifact.bookingId);
        if (!bookingId) return;
        Object.values(reviewStepConfigByKey).forEach((config) => {
          if (request.requestType !== config.requestType) return;
          if (request.documentStage && request.documentStage !== config.documentStage) return;
          if (request.documentType && request.documentType !== config.documentType) return;
          if (artifact.documentStage && artifact.documentStage !== config.documentStage) return;
          if (artifact.documentType && artifact.documentType !== config.documentType) return;
          if (artifact.artifactType && artifact.artifactType !== config.artifactType) return;
          const key = makeReviewContextKey(bookingId, config);
          const current = map.get(key) || [];
          current.push(request);
          map.set(key, current);
        });
      });
    });
    map.forEach((requests, key) => {
      map.set(key, sortReviewRequests(requests));
    });
    return map;
  }, [reviewRequests]);

  const paymentsByClientId = useMemo(() => {
    const map = new Map<string, Payment[]>();
    payments.forEach((payment) => {
      const clientId = getPaymentClientId(payment);
      if (!clientId) return;
      const current = map.get(clientId) || [];
      current.push(payment);
      map.set(clientId, current);
    });
    map.forEach((clientPayments) => {
      clientPayments.sort((a, b) => new Date(b.paymentDate || 0).getTime() - new Date(a.paymentDate || 0).getTime());
    });
    return map;
  }, [payments]);

  const toggleItem = async (item: BookingFlowItem | undefined, checked: boolean) => {
    if (!item?._id) return;
    setSaving(item._id);
    try {
      await bookingFlowApi.updateItem(item._id, {
        status: checked ? 'completed' : 'pending',
        completedAt: checked ? new Date().toISOString() : null,
      } as Partial<BookingFlowItem>);
      await loadData(false);
    } finally {
      setSaving('');
    }
  };

  const updateItemStatus = async (item: BookingFlowItem | undefined, status: BookingFlowItem['status']) => {
    if (!item?._id || item.status === status) return;
    setSaving(item._id);
    try {
      await bookingFlowApi.updateItem(item._id, { status } as Partial<BookingFlowItem>);
      await loadData(false);
    } finally {
      setSaving('');
    }
  };

  const saveAllChanges = async (lockAfterSave = false) => {
    const dirtyIds = Object.keys(dirtyNoteIds);
    setSaving('save-all');
    try {
      await Promise.all(dirtyIds.map((itemId) => {
        const item = items.find((currentItem) => currentItem._id === itemId);
        if (!item || (item.notes || '') === (noteDrafts[itemId] || '')) return Promise.resolve();
        return bookingFlowApi.updateItem(itemId, { notes: noteDrafts[itemId] || '' } as Partial<BookingFlowItem>);
      }));
      setDirtyNoteIds({});
      await loadData(false);
      if (lockAfterSave) setIsEditing(false);
    } finally {
      setSaving('');
    }
  };

  const updateItemDate = async (item: BookingFlowItem | undefined, value: string) => {
    if (!item?._id) return;
    const field = getStatusDateField(item.status);
    setSaving(`date:${item._id}`);
    try {
      setItems((current) => current.map((currentItem) => (
        currentItem._id === item._id
          ? { ...currentItem, [field]: value || null }
          : currentItem
      )));
      await bookingFlowApi.updateItem(item._id, { [field]: value || null } as Partial<BookingFlowItem>);
      setDatePickerDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[item._id!];
        return nextDrafts;
      });
      await loadData(false);
    } finally {
      setSaving('');
    }
  };

  const selectPaymentForItem = async (item: BookingFlowItem | undefined, paymentId: string) => {
    if (!item?._id || !paymentId) return;
    const payment = payments.find((candidate) => candidate._id === paymentId);
    if (!payment) return;
    const paymentDate = payment.paymentDate ? new Date(payment.paymentDate) : new Date();
    const receivedAt = Number.isNaN(paymentDate.getTime()) ? new Date().toISOString() : paymentDate.toISOString();
    const metadata = {
      ...(item.metadata || {}),
      paymentId: payment._id,
      paymentDisplayId: payment.display_id,
      paymentAmount: payment.amount,
      paymentCurrency: payment.currency,
      paymentDate: receivedAt,
      paymentMethod: payment.paymentMethod,
      paymentStatus: payment.status,
    };

    setSaving(`payment:${item._id}`);
    try {
      await bookingFlowApi.updateItem(item._id, {
        status: 'received',
        receivedAt,
        metadata,
      } as Partial<BookingFlowItem>);
      await bookingFlowApi.recordItemAction(item._id, {
        actionType: 'manual_mark',
        actionKey: 'payment_selected',
        actionLabel: 'Payment selected',
        statusAfter: 'received',
        notes: `Payment ${payment.display_id ? `#${payment.display_id}` : payment._id} selected for Payment received.`,
        metadata,
      }).catch(() => null);
      await loadData(false);
    } finally {
      setSaving('');
    }
  };

  const openReviewRequestModal = (booking: any, item: BookingFlowItem | undefined, row: MatrixRow) => {
    if (!item?._id) return;
    const config = getReviewStepConfig(row);
    if (!config) return;
    const bookingId = getObjectId(booking);
    const receivedItem = itemMap.get(`${bookingId}:${config.receivedStepKey}`);
    const artifactId = getLinkedArtifactIdFromItem(item) || getLinkedArtifactIdFromItem(receivedItem);
    if (!artifactId) {
      alert(`Upload or link the ${config.label} artifact before creating a medical review request.`);
      return;
    }

    setReviewRequestModal({
      item,
      booking,
      artifactId,
      requestType: config.requestType,
      label: config.label,
      advisorId: medicalAdvisors.length === 1 ? medicalAdvisors[0]._id : '',
    });
  };

  const createMedicalReviewRequestFromStep = async () => {
    if (!reviewRequestModal?.item._id || !reviewRequestModal.artifactId || !reviewRequestModal.advisorId) return;
    const advisor = medicalAdvisors.find((item) => item._id === reviewRequestModal.advisorId);
    const item = reviewRequestModal.item;
    const itemId = item._id;
    if (!itemId) return;
    const booking = reviewRequestModal.booking;
    const savingKey = `mrr:${itemId}`;
    setSaving(savingKey);
    try {
      const response = await medicalReviewRequestsApi.createFromArtifact(reviewRequestModal.artifactId, reviewRequestModal.requestType, {
        assignedToUserId: reviewRequestModal.advisorId,
        medicalStaffNotes: `${reviewRequestModal.label} created from booking step "${item.title}" for booking #${getBookingNumber(booking)}.`,
      });
      const reviewRequest = response.data;
      await bookingFlowApi.updateItem(itemId, {
        status: 'sent_for_review',
        sentAt: new Date().toISOString(),
        metadata: {
          ...(item.metadata || {}),
          medicalReviewRequestId: reviewRequest._id,
          medicalReviewRequestDisplayId: reviewRequest.display_id,
          medicalReviewRequestType: reviewRequest.requestType,
          medicalReviewArtifactId: reviewRequestModal.artifactId,
          medicalReviewAssignedToUserId: reviewRequestModal.advisorId,
          medicalReviewAssignedToEmail: advisor?.email,
        },
      } as Partial<BookingFlowItem>);
      await bookingFlowApi.recordItemAction(itemId, {
        actionType: 'manual_mark',
        actionKey: 'medical_review_request_created',
        actionLabel: 'Medical review request created',
        statusAfter: 'sent_for_review',
        notes: `Created medical review request #${reviewRequest.display_id || reviewRequest._id} for ${advisor?.email || 'selected medical advisor'}.`,
        metadata: {
          medicalReviewRequestId: reviewRequest._id,
          medicalReviewRequestDisplayId: reviewRequest.display_id,
          medicalReviewRequestType: reviewRequest.requestType,
          artifactId: reviewRequestModal.artifactId,
          assignedToUserId: reviewRequestModal.advisorId,
          assignedToEmail: advisor?.email,
        },
      }).catch(() => null);
      setReviewRequestModal(null);
      await loadData(false);
    } catch (error: any) {
      alert(error?.response?.data?.message || error?.message || 'Unable to create medical review request.');
    } finally {
      setSaving('');
    }
  };

  const openExistingReviewRequestLinkModal = (booking: any, item: BookingFlowItem, row: MatrixRow, action?: BookingFlowAction) => {
    if (!item?._id) return;
    const config = getReviewStepConfig(row);
    const candidates = getReviewRequestLinkCandidates(booking, reviewRequests, config, item._id);
    if (!candidates.length) {
      alert(`No existing medical review requests were found for ${row.title}.`);
      return;
    }

    setReviewRequestLinkModal({
      item,
      booking,
      row,
      config,
      action,
      candidates,
      selectedRequestId: candidates[0]?._id || '',
    });
  };

  const linkExistingReviewRequestToStep = async () => {
    if (!reviewRequestLinkModal?.item._id || !reviewRequestLinkModal.selectedRequestId) return;
    const selectedRequest = reviewRequestLinkModal.candidates.find((candidate) => candidate._id === reviewRequestLinkModal.selectedRequestId);
    if (!selectedRequest?._id) return;

    const booking = reviewRequestLinkModal.booking;
    const item = reviewRequestLinkModal.item;
    const itemId = item._id!;
    const savingKey = `link-mrr:${itemId}`;

    setSaving(savingKey);
    try {
      const updatedRequest = await medicalReviewRequestsApi.update(selectedRequest._id, {
        bookingFlowItemId: itemId,
        retreatId: getObjectId(booking.retreatId || booking.retreat) || undefined,
        clientId: getBookingClientId(booking) || undefined,
      });

      const nextStatus = reviewRequestStatusToBookingStepStatus(updatedRequest.data.status) as BookingFlowItem['status'];
      const nextMetadata = {
        ...(item.metadata || {}),
        medicalReviewRequestId: updatedRequest.data._id,
        medicalReviewRequestDisplayId: updatedRequest.data.display_id,
        medicalReviewRequestType: updatedRequest.data.requestType,
        medicalReviewBookingFlowItemId: itemId,
        medicalReviewAssignedToUserId: updatedRequest.data.assignedToUserId || item.metadata?.medicalReviewAssignedToUserId,
        medicalReviewAssignedToEmail: updatedRequest.data.assignedToEmail || item.metadata?.medicalReviewAssignedToEmail,
      };

      await bookingFlowApi.updateItem(itemId, {
        status: nextStatus,
        sentAt: nextStatus === 'sent_for_review' || nextStatus === 'in_review' ? new Date().toISOString() : item.sentAt,
        reviewedAt: nextStatus === 'completed' || nextStatus === 'needs_resubmission' || nextStatus === 'in_review'
          ? new Date().toISOString()
          : item.reviewedAt,
        completedAt: nextStatus === 'completed' ? new Date().toISOString() : item.completedAt,
        approvedAt: nextStatus === 'approved' ? new Date().toISOString() : item.approvedAt,
        metadata: nextMetadata,
      } as Partial<BookingFlowItem>);

      await bookingFlowApi.recordItemAction(itemId, {
        actionType: 'manual_mark',
        actionKey: reviewRequestLinkModal.action?.key || 'link_existing_mrr',
        actionLabel: reviewRequestLinkModal.action?.label || 'Link existing MRR',
        statusAfter: nextStatus,
        notes: `Linked existing medical review request #${updatedRequest.data.display_id || updatedRequest.data._id} to booking #${getBookingNumber(booking)}.`,
        metadata: {
          medicalReviewRequestId: updatedRequest.data._id,
          medicalReviewRequestDisplayId: updatedRequest.data.display_id,
          medicalReviewRequestType: updatedRequest.data.requestType,
          medicalReviewBookingFlowItemId: itemId,
        },
      }).catch(() => null);

      setReviewRequestLinkModal(null);
      await loadData(false);
    } catch (error: any) {
      console.error('Error linking existing medical review request:', error);
      alert(error?.response?.data?.message || error?.message || 'Unable to link existing medical review request.');
    } finally {
      setSaving('');
    }
  };

  const openArtifactLinkModal = (booking: any, item: BookingFlowItem, row: MatrixRow, config: ArtifactLinkConfig) => {
    const candidates = getArtifactLinkCandidates(booking, medicalArtifacts, config);
    if (candidates.length === 0) {
      alert(`No existing ${config.label} artifact was found for this booking.`);
      return;
    }
    setArtifactLinkModal({
      item,
      booking,
      row,
      config,
      candidates,
      selectedArtifactId: candidates[0]._id || '',
    });
  };

  const linkExistingArtifactToStep = async () => {
    if (!artifactLinkModal?.item._id || !artifactLinkModal.selectedArtifactId) return;
    const selectedArtifact = artifactLinkModal.candidates.find((candidate) => candidate._id === artifactLinkModal.selectedArtifactId);
    if (!selectedArtifact?._id) return;

    const booking = artifactLinkModal.booking;
    const bookingId = getObjectId(booking);
    const clientId = getBookingClientId(booking);
    const retreatId = getObjectId(booking.retreatId || booking.retreat);
    const item = artifactLinkModal.item;
    const itemId = item._id!;
    const savingKey = `link:${itemId}`;

    setSaving(savingKey);
    try {
      const linkedArtifactResponse = await medicalArtifactsApi.update(selectedArtifact._id, {
        bookingId,
        clientId,
        retreatId: retreatId || undefined,
      } as Partial<MedicalArtifact>);
      const linkedArtifact = linkedArtifactResponse.data;
      const linkedArtifactId = linkedArtifact._id || selectedArtifact._id;

      await bookingFlowApi.updateItem(itemId, {
        status: 'received',
        receivedAt: selectedArtifact.receivedAt || new Date().toISOString(),
        notes: item.notes?.trim()
          ? `${item.notes.trim()}\nLinked existing ${artifactLinkModal.config.label} artifact #${linkedArtifact.display_id || selectedArtifact.display_id || linkedArtifactId}.`
          : `Linked existing ${artifactLinkModal.config.label} artifact #${linkedArtifact.display_id || selectedArtifact.display_id || linkedArtifactId}.`,
        metadata: {
          ...(item.metadata || {}),
          linkedMedicalArtifactId: linkedArtifactId,
          linkedMedicalArtifactIds: Array.from(new Set([
            ...((((item as any).metadata || {}).linkedMedicalArtifactIds || []) as string[]),
            linkedArtifactId,
          ])),
          latestArtifactId: linkedArtifactId,
          linkedMedicalArtifactDisplayId: linkedArtifact.display_id || selectedArtifact.display_id,
          linkedMedicalArtifactType: linkedArtifact.artifactType || selectedArtifact.artifactType,
          linkedMedicalArtifactStage: linkedArtifact.documentStage || selectedArtifact.documentStage,
          linkedMedicalArtifactDocumentType: linkedArtifact.documentType || selectedArtifact.documentType,
          linkedMedicalArtifactAt: new Date().toISOString(),
        },
      } as Partial<BookingFlowItem>);

      await bookingFlowApi.recordItemAction(itemId, {
        actionType: 'manual_mark',
        actionKey: 'existing_artifact_linked',
        actionLabel: 'Existing artifact linked',
        statusAfter: 'received',
        notes: `Linked existing artifact #${linkedArtifact.display_id || selectedArtifact.display_id || linkedArtifactId} to ${item.title} for booking #${getBookingNumber(booking)}.`,
        metadata: {
          artifactId: linkedArtifactId,
          artifactDisplayId: linkedArtifact.display_id || selectedArtifact.display_id,
          artifactType: linkedArtifact.artifactType || selectedArtifact.artifactType,
          documentStage: linkedArtifact.documentStage || selectedArtifact.documentStage,
          documentType: linkedArtifact.documentType || selectedArtifact.documentType,
          bookingId,
          clientId,
          retreatId,
        },
      }).catch(() => null);

      setArtifactLinkModal(null);
      await loadData(false);
    } catch (error: any) {
      console.error('Error linking existing artifact to booking step:', error);
      alert(error?.response?.data?.message || error?.message || 'Unable to link existing artifact.');
    } finally {
      setSaving('');
    }
  };

  const cancelItemDateDraft = (item: BookingFlowItem | undefined) => {
    if (!item?._id) return;
    setDatePickerDrafts((current) => {
      const nextDrafts = { ...current };
      delete nextDrafts[item._id!];
      return nextDrafts;
    });
  };

  const getConfiguredActions = useCallback((item?: BookingFlowItem) => resolveConfiguredBookingStepActions(item, templateMap, libraryTemplateMap), [templateMap, libraryTemplateMap]);

  const interpolateActionUrl = (template: string, variables: Record<string, any> = {}) => {
    return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, path) => {
      const value = String(path).split('.').reduce((current: any, key: string) => current?.[key], variables);
      return encodeURIComponent(value ?? '');
    });
  };

  const runItemAction = async (item: BookingFlowItem | undefined, action: BookingFlowAction) => {
    if (!item?._id) return;
    if (action.type === 'upload') return;
    if (action.type === 'link_mrr') return;
    setSaving(`action:${item._id}:${action.key}`);
    try {
      if (action.type === 'email') {
        const response = await bookingFlowApi.getItemEmailComposeData(item._id, action.key);
        setComposeState({
          item,
          action,
          initialValues: response.data,
        });
        return;
      }

      let metadata: Record<string, any> = {};
      if ((action.type === 'whatsapp' || action.type === 'link') && action.urlTemplate) {
        const response = await bookingFlowApi.getItemEmailComposeData(item._id, action.key).catch(() => null);
        metadata = { urlTemplate: action.urlTemplate };
        const url = interpolateActionUrl(action.urlTemplate, response?.data?.variables || {});
        window.open(url, '_blank', 'noopener,noreferrer');
      }

      await bookingFlowApi.recordItemAction(item._id, {
        actionKey: action.key,
        actionType: action.type,
        statusAfter: action.statusAfterSuccess,
        metadata,
      });
      await loadData(false);
    } catch (error: any) {
      console.error('Error running booking step action:', error);
      alert(error?.response?.data?.message || error?.message || 'Unable to run booking step action.');
    } finally {
      setSaving('');
    }
  };

  const resolveBookingDocumentType = (item: BookingFlowItem): string => {
    const metadata = item.metadata || {};
    return normalizeDocumentKey(
      bookingDocumentTypeByStep[item.key]
      || metadata.expectedBookingDocument
      || metadata.expectedDocument
      || metadata.expectedArtifact
      || item.key,
    );
  };

  const uploadItemDocument = async (booking: any, item: BookingFlowItem | undefined, action: BookingFlowAction, files: FileList | null) => {
    if (!item?._id || !files?.length) return;
    const bookingId = getObjectId(booking);
    const clientId = getObjectId(booking.clientId || booking.client || item.clientId);
    const currentRetreatId = getObjectId(booking.retreatId || booking.retreat || item.retreatId) || retreatId;
    const documentType = resolveBookingDocumentType(item);
    const artifactConfig = getArtifactStepConfig(item);
    const configuredDocumentType = normalizeDocumentKey(bookingDocumentTypeByStep[item.key] || item.metadata?.expectedBookingDocument || item.metadata?.expectedDocument || (!artifactConfig ? item.metadata?.expectedArtifact : '') || '');
    const documentConfig = configuredDocumentType ? { documentType: configuredDocumentType, title: humanizeDocumentKey(configuredDocumentType) } : undefined;
    const uploadTarget = resolveBookingStepUploadTarget(artifactConfig, documentConfig);
    if (!bookingId || !clientId || !currentRetreatId) {
      alert('This file cannot be uploaded because the booking, client, or retreat link is missing.');
      return;
    }

    const savingKey = `upload:${item._id}:${action.key}`;
    setSaving(savingKey);
    try {
      const fileArray = Array.from(files);
      if (uploadTarget === 'medical_artifact' && artifactConfig) {
        const created = await medicalArtifactsApi.create({
          clientId,
          retreatId: currentRetreatId,
          bookingId,
          artifactType: artifactConfig.artifactType,
          documentStage: artifactConfig.documentStage,
          documentType: artifactConfig.documentType,
          title: fileArray[0]?.name || artifactConfig.label,
          description: `${artifactConfig.label} linked to booking ${getBookingNumber(booking)}.`,
          contextType: 'booking',
          purpose: 'booking_requirement',
          source: 'admin_upload',
          status: 'stored',
          data: {
            bookingId,
            bookingNumber: getBookingNumber(booking),
            bookingFlowItemId: item._id,
            bookingFlowItemKey: item.key,
            actionKey: action.key,
          },
          tags: [
            'booking-requirement',
            item.key,
            getBookingNumber(booking) ? `booking-${getBookingNumber(booking)}` : '',
          ].filter(Boolean),
        });

        if (created.data._id) {
          try {
            await medicalArtifactsApi.uploadFiles(created.data._id, fileArray);
          } catch (uploadError) {
            await medicalArtifactsApi.delete(created.data._id).catch((rollbackError) => {
              console.error('Error rolling back empty medical artifact:', rollbackError);
            });
            throw uploadError;
          }
        }

        await bookingFlowApi.updateItem(item._id, {
          status: 'received',
          receivedAt: new Date().toISOString(),
          metadata: {
            ...(item.metadata || {}),
            latestArtifactId: created.data._id,
            latestArtifactDisplayId: created.data.display_id,
            latestFileName: fileArray[0]?.name,
            linkedMedicalArtifactId: created.data._id,
            linkedMedicalArtifactDisplayId: created.data.display_id,
            linkedMedicalArtifactType: artifactConfig.artifactType,
            linkedMedicalArtifactStage: artifactConfig.documentStage,
            linkedMedicalArtifactDocumentType: artifactConfig.documentType,
            linkedMedicalArtifactAt: new Date().toISOString(),
          },
        } as Partial<BookingFlowItem>);
      } else {
        const created = await bookingDocumentsApi.create({
          bookingId,
          clientId,
          retreatId: currentRetreatId,
          documentType,
          title: humanizeDocumentKey(documentType),
          description: `${humanizeDocumentKey(documentType)} linked to booking ${getBookingNumber(booking)}.`,
          bookingFlowItemId: item._id,
          metadata: {
            bookingNumber: getBookingNumber(booking),
            bookingFlowItemKey: item.key,
            actionKey: action.key,
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

        await loadData(false);
      }
    } catch (error: any) {
      console.error('Error uploading booking step document:', error);
      alert(error?.response?.data?.message || error?.message || 'Unable to upload booking step document.');
    } finally {
      setSaving('');
    }
  };

  const handleComposedEmailSent = async (sentEmail: any) => {
    if (!composeState?.item?._id || !sentEmail?._id) return;
    await bookingFlowApi.recordItemEmailSent(composeState.item._id, sentEmail._id, composeState.action?.key);
    await loadData(false);
  };

  const canSendReminder = (item?: BookingFlowItem) => Boolean(
    item?._id
    && !['received', 'reviewed', 'approved', 'completed', 'waived'].includes(item.status)
    && getClientEmail(bookings.find((booking) => getObjectId(booking) === getObjectId(item.bookingId)))
  );

  const openReminderPreview = async (item?: BookingFlowItem) => {
    if (!item?._id) return;
    setSaving(`reminder-preview:${item._id}`);
    try {
      const response = await bookingFlowApi.getItemReminderPreview(item._id);
      setReminderState({ item, ...response.data });
    } catch (error: any) {
      alert(error?.response?.data?.message || error?.message || 'Unable to prepare reminder.');
    } finally {
      setSaving('');
    }
  };

  const sendReminder = async (overrideDuplicate = false) => {
    if (!reminderState?.item?._id) return;
    if (reminderState.duplicateBlocked && !overrideDuplicate) {
      const lastSent = reminderState.lastReminderAt ? formatDateTime(reminderState.lastReminderAt) : 'recently';
      if (!window.confirm(`A reminder was sent ${lastSent}. Send another reminder anyway?`)) return;
      overrideDuplicate = true;
    }
    setSaving(`reminder-send:${reminderState.item._id}`);
    try {
      const response = await bookingFlowApi.sendItemReminder(reminderState.item._id, {
        subject: reminderState.subject,
        bodyText: reminderState.bodyText,
        followUpDate: reminderState.suggestedFollowUpDate,
        overrideDuplicate,
      });
      if (response.data?.sentEmail?.status === 'failed') {
        alert(response.data.sentEmail.errorMessage || 'The reminder could not be sent.');
        return;
      }
      setReminderState(null);
      await loadData(false);
      alert('Reminder sent and recorded.');
    } catch (error: any) {
      alert(error?.response?.data?.message || error?.message || 'Unable to send reminder.');
    } finally {
      setSaving('');
    }
  };

  const openReminderAutomation = async (item?: BookingFlowItem) => {
    if (!item?._id) return;
    setSaving(`automation:${item._id}`);
    try {
      const response = await bookingFlowApi.getItemReminderAutomation(item._id);
      setAutomationState({ item, ...response.data });
    } catch (error: any) {
      alert(error?.response?.data?.message || error?.message || 'Unable to load reminder automation.');
    } finally {
      setSaving('');
    }
  };

  const toggleReminderAutomation = async () => {
    if (!automationState?.item?._id) return;
    const paused = !automationState.paused;
    const reason = paused ? window.prompt('Why are reminders being paused for this client?', automationState.pauseReason || '') || '' : undefined;
    setSaving(`automation-toggle:${automationState.item._id}`);
    try {
      const response = await bookingFlowApi.setItemReminderAutomationPaused(automationState.item._id, { paused, reason });
      setAutomationState((current) => current ? { ...current, ...response.data } : current);
      await loadData(false);
    } finally {
      setSaving('');
    }
  };

  const sendRowEmail = async (row: MatrixRow) => {
    if (!row.templateId) return;
    const label = row.key === 'address_sent' ? 'address email' : `"${row.title}" email`;
    if (!window.confirm(`Send ${label} to all participants in this retreat?`)) return;

    setSaving(`row-email:${row.key}`);
    try {
      const response = await bookingFlowApi.sendTemplateEmailToRetreat(retreatId, row.templateId);
      const { sent = 0, failed = 0, skipped = 0 } = response.data || {};
      alert(`Sent: ${sent}\nFailed: ${failed}\nSkipped: ${skipped}`);
      await loadData(false);
    } catch (error: any) {
      console.error('Error sending retreat step email:', error);
      alert(error?.response?.data?.message || error?.message || 'Unable to send retreat step email.');
    } finally {
      setSaving('');
    }
  };

  const rowCanSendEmail = (row: MatrixRow) => Boolean(row.templateId && row.emailEnabled && row.emailTemplateId);

  const bookingActionOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ value: string; label: string; rowKey: string; actionKey: string }> = [];

    items.forEach((item) => {
      const actions = getConfiguredActions(item);
      actions.forEach((action) => {
        const value = `${item.key}::${action.key}`;
        if (seen.has(value)) return;
        seen.add(value);
        options.push({
          value,
          rowKey: item.key,
          actionKey: action.key,
          label: `${item.title} · ${action.label}`,
        });
      });
    });

    return options;
  }, [items, getConfiguredActions]);

  const selectedBookingActionOption = useMemo(
    () => bookingActionOptions.find((option) => option.value === selectedBookingAction) || null,
    [bookingActionOptions, selectedBookingAction]
  );

  useEffect(() => {
    setSelectedBookingAction((current) => {
      if (current && bookingActionOptions.some((option) => option.value === current)) {
        return current;
      }
      return bookingActionOptions[0]?.value || '';
    });
  }, [bookingActionOptions]);

  if (loading) {
    return <LoadingSpinner message="Loading retreat readiness..." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Retreat Readiness</h2>
          <p className="text-sm text-gray-500">
            {viewMode === 'detail'
              ? isEditing
                ? 'Editing is unlocked. Changes stay unlocked until you explicitly lock readiness.'
                : 'Read-only mode prevents accidental changes. Unlock editing to update status, date, notes, or actions.'
              : 'Simple view shows only complete, pending, and problem status by color.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-md border border-gray-300 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('detail')}
              className={`rounded px-3 py-1.5 text-sm font-medium ${viewMode === 'detail' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              Detail
            </button>
            <button
              type="button"
              onClick={() => setViewMode('simple')}
              className={`rounded px-3 py-1.5 text-sm font-medium ${viewMode === 'simple' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              Simple
            </button>
          </div>
          {viewMode === 'detail' && (isEditing ? (
            <button type="button" onClick={() => saveAllChanges(true)} disabled={saving === 'save-all'} className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">
              <Lock className="h-4 w-4" /> {saving === 'save-all' ? 'Saving...' : 'Save & Lock'}
            </button>
          ) : (
            <button type="button" onClick={() => setIsEditing(true)} className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800">
              <Unlock className="h-4 w-4" /> Unlock Editing
            </button>
          ))}
          <button onClick={() => loadData()} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={generateSteps}
            disabled={saving === 'generate'}
            title="Create booking steps that are configured for this retreat but do not exist yet"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <ListPlus className={`h-4 w-4 ${saving === 'generate' ? 'animate-pulse' : ''}`} />
            {saving === 'generate' ? 'Generating...' : 'Generate Missing Steps'}
          </button>
        </div>
      </div>

      {toolbarMessage && (
        <div className={`rounded-md border px-4 py-2 text-sm ${toolbarMessage.startsWith('Unable') ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>
          {toolbarMessage}
        </div>
      )}

      <div className="max-h-[calc(100vh-220px)] overflow-auto rounded-lg border border-gray-300 bg-white">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className={`sticky left-0 top-0 z-40 border-b border-r border-gray-300 bg-gray-100 bg-clip-padding px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600 shadow-[4px_0_10px_rgba(15,23,42,0.08)] ${viewMode === 'simple' ? 'min-w-[240px]' : 'min-w-[220px]'}`}>
                <div>
                  <button ref={actionFilterButtonRef} type="button" onClick={openActionFilter} className={`inline-flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left shadow-sm ${selectedActionKeys === null ? 'border-gray-300 bg-white hover:bg-gray-50' : 'border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100'}`} aria-expanded={actionFilterOpen}>
                    <span>Action{selectedActionKeys === null ? '' : ` (${selectedActionKeys.length}/${rows.length})`}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold">
                      <Filter className={`h-3.5 w-3.5 ${selectedActionKeys === null ? 'text-gray-500' : 'text-blue-600'}`} />
                      FILTER
                    </span>
                  </button>
                </div>
              </th>
              {bookings.map((booking) => (
                <th key={getObjectId(booking)} className={`sticky top-0 z-20 border-b border-r border-gray-300 bg-gray-100 px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600 ${viewMode === 'simple' ? 'min-w-[150px]' : 'min-w-[260px]'}`}>
                  <div className="flex items-start gap-2">
                    {viewMode === 'detail' && <RetreatMatrixClientAvatar client={getBookingClient(booking)} name={getClientName(booking)} />}
                    <div className="min-w-0 space-y-1 normal-case">
                      {getBookingClientId(booking) ? (
                        <Link
                          to={`/${routePrefix}/clients/${getBookingClientId(booking)}`}
                          className={`${viewMode === 'simple' ? 'max-w-[130px] text-xs' : 'max-w-[210px] text-sm'} block truncate font-bold uppercase text-gray-900 hover:text-blue-700 hover:underline`}
                          title="View client profile"
                        >
                          {getClientName(booking)}
                        </Link>
                      ) : (
                        <div className={`${viewMode === 'simple' ? 'max-w-[130px] text-xs' : 'max-w-[210px] text-sm'} truncate font-bold uppercase text-gray-900`}>
                          {getClientName(booking)}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-semibold text-blue-700">
                        {getObjectId(booking) ? (
                          <Link to={`/admin/bookings/${getObjectId(booking)}`} className="hover:text-blue-900 hover:underline">
                            Booking #{getBookingNumber(booking)}
                          </Link>
                        ) : (
                          <span>Booking #{getBookingNumber(booking)}</span>
                        )}
                        {viewMode === 'detail' && getClientDisplayId(booking) && (
                          getBookingClientId(booking) ? (
                            <Link to={`/${routePrefix}/clients/${getBookingClientId(booking)}`} className="hover:text-blue-900 hover:underline">
                              Client #{getClientDisplayId(booking)}
                            </Link>
                          ) : (
                            <span>Client #{getClientDisplayId(booking)}</span>
                          )
                        )}
                      </div>
                      {viewMode === 'detail' && getClientEmail(booking) && (
                        <div className="max-w-[220px] truncate text-[11px] font-medium text-gray-600" title={getClientEmail(booking)}>
                          {getClientEmail(booking)}
                        </div>
                      )}
                      {viewMode === 'detail' && getClientPhone(booking) && (
                        <div className="max-w-[220px] truncate text-[11px] font-medium text-gray-600" title={getClientPhone(booking)}>
                          {getClientPhone(booking)}
                        </div>
                      )}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {viewMode === 'detail' && (
              <tr>
                <td className="sticky left-0 z-30 border-b border-r border-gray-300 bg-blue-50 px-3 py-2 font-medium text-blue-900 shadow-[4px_0_10px_rgba(15,23,42,0.06)]" style={getStickyActionCellStyle(undefined, '#eff6ff')}>
                  <div className="space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wide text-blue-900">Booking action check</div>
                    <select
                      value={selectedBookingAction}
                      onChange={(event) => setSelectedBookingAction(event.target.value)}
                      className="w-full rounded border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-gray-700"
                    >
                      {bookingActionOptions.length === 0 ? (
                        <option value="">No booking actions available</option>
                      ) : (
                        bookingActionOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))
                      )}
                    </select>
                    <div className="text-[11px] text-blue-700">Check bookings for the selected action.</div>
                  </div>
                </td>
                {bookings.map((booking) => {
                  const selectedItem = selectedBookingActionOption
                    ? itemMap.get(`${getObjectId(booking)}:${selectedBookingActionOption.rowKey}`)
                    : undefined;
                  const selectedItemLogs = selectedItem?._id ? actionLogMap.get(selectedItem._id) || [] : [];
                  const completed = Boolean(selectedBookingActionOption && selectedItem && hasBookingActionLog(selectedItemLogs, selectedBookingActionOption.actionKey));
                  return (
                    <td
                      key={`selected-action:${getObjectId(booking)}`}
                      className={`border-b border-r border-gray-300 px-2 py-2 text-center ${completed ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-700'}`}
                    >
                      <div className="flex items-center justify-center gap-1 text-xs font-semibold">
                        {completed ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
                        <span>{completed ? 'Yes' : 'No'}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            )}
            {filteredGroupedRows.map((group) => (
              <React.Fragment key={group.key}>
                {(() => {
                  const tone = getBookingStepToneWithColor(group.key, group.color);
                  const groupStyle = getBookingStepColorStyles(tone, 'group');
                  const stepStyle = getBookingStepColorStyles(tone, 'step');
                  const dotStyle = getBookingStepColorStyles(tone, 'dot');
                  const badgeStyle = getBookingStepColorStyles(tone, 'badge');
                  return (
                <>
                <tr>
                  <td className={`sticky left-0 z-30 border-b border-r border-gray-300 bg-clip-padding px-3 py-2 text-xs font-bold uppercase tracking-wide ${tone.groupCell} ${tone.groupText}`} style={getStickyActionCellStyle(groupStyle, '#f1f5f9')}>
                    <span className="inline-flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} style={dotStyle} />
                      {group.label}
                    </span>
                  </td>
                  {bookings.map((booking) => (
                    <td key={`${group.key}:${getObjectId(booking)}`} className={`border-b border-r border-gray-300 px-2 py-2 text-xs font-semibold uppercase tracking-wide ${tone.groupCell} ${tone.groupText}`} style={groupStyle}>
                      <span className="sr-only">{group.label}</span>
                    </td>
                  ))}
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.key}>
                    <td className={`sticky left-0 z-30 border-b border-l-4 border-r border-gray-300 bg-clip-padding px-3 py-2 font-medium text-gray-900 ${tone.stepCell} ${tone.stepStripe}`} style={getStickyActionCellStyle(stepStyle, '#f8fafc')}>
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[11px] font-semibold ${tone.badge}`} style={badgeStyle}>
                          {actionNumberByKey.get(row.key)}
                        </span>
                        <span>{row.title}</span>
                      </div>
                      {rowCanSendEmail(row) && (
                        <button
                          type="button"
                          disabled={!isEditing || saving === `row-email:${row.key}`}
                          onClick={() => sendRowEmail(row)}
                          className="mt-2 inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                          title={isEditing ? 'Send this email to all participants' : 'Unlock editing to send row email'}
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {saving === `row-email:${row.key}` ? 'Sending...' : row.key === 'address_sent' ? 'Send address' : 'Send row'}
                        </button>
                      )}
                    </td>
                    {bookings.map((booking) => {
                      const item = itemMap.get(`${getObjectId(booking)}:${row.key}`);
                      const done = item?.status ? fulfilledStatuses.has(item.status) : false;
                      const dateField = item ? getStatusDateField(item.status) : 'dueDate';
                      const dateValue = item ? item[dateField as keyof BookingFlowItem] as Date | string | null | undefined : undefined;
                      const confirmedDateInputValue = formatDateInput(dateValue);
                      const pendingDateInputValue = item?._id ? datePickerDrafts[item._id] : undefined;
                      const hasPendingDateInput = item?._id && pendingDateInputValue !== undefined && pendingDateInputValue !== confirmedDateInputValue;
                      const itemActionLogs = item?._id ? actionLogMap.get(item._id) || [] : [];
                      const configuredActions = getConfiguredActions(item);
                      const simpleStatus = getSimpleStatus(item);
                      const isPaymentReceivedStep = row.key === 'payment_received';
                      const bookingPayments = paymentsByClientId.get(getBookingClientId(booking)) || [];
                      const selectedPaymentId = String(item?.metadata?.paymentId || '');
                      const reviewStepConfig = getReviewStepConfig(row);
                      const receivedItem = reviewStepConfig ? itemMap.get(`${getObjectId(booking)}:${reviewStepConfig.receivedStepKey}`) : undefined;
                      const linkedArtifactId = getLinkedArtifactIdFromItem(item) || getLinkedArtifactIdFromItem(receivedItem);
                      const metadataReviewRequestId = item?.metadata?.medicalReviewRequestId ? String(item.metadata.medicalReviewRequestId) : '';
                      const requestsLinkedToThisStep = item?._id
                        ? reviewRequests.filter((request) => getObjectId(request.bookingFlowItemId) === item._id)
                        : [];
                      const relatedReviewRequests = reviewStepConfig
                        ? [
                            ...requestsLinkedToThisStep,
                            ...(linkedArtifactId ? (reviewRequestsByArtifactId.get(linkedArtifactId) || []).filter((request) => request.requestType === reviewStepConfig.requestType) : []),
                            ...(reviewRequestsByBookingContext.get(makeReviewContextKey(getObjectId(booking), reviewStepConfig)) || []),
                          ].filter((request, index, requests) => request._id && requests.findIndex((candidate) => candidate._id === request._id) === index)
                        : requestsLinkedToThisStep;
                      const finalReviewRequest = relatedReviewRequests.find((request) => Boolean(request.reviewDecision || reviewStatusToDecision(request.status as MedicalReviewRequest['status'])));
                      const resolvedReviewDecision = item?.reviewDecision
                        || finalReviewRequest?.reviewDecision
                        || reviewStatusToDecision(finalReviewRequest?.status as MedicalReviewRequest['status']);
                      const resolvedReviewNotes = item?.reviewNotes
                        || finalReviewRequest?.reviewNotes
                        || (finalReviewRequest as any)?.overallNotes
                        || '';
                      const resolvedReviewReviewedAt = item?.reviewedAt || finalReviewRequest?.reviewedAt;
                      const existingReviewRequest = relatedReviewRequests.find((request) => request._id === metadataReviewRequestId) || relatedReviewRequests[0];
                      const existingReviewRequestId = metadataReviewRequestId || existingReviewRequest?._id || '';
                      const existingReviewRequestDisplay = item?.metadata?.medicalReviewRequestDisplayId || existingReviewRequest?.display_id || '';
                      const documentTypeForStep = item ? resolveBookingDocumentType(item) : normalizeDocumentKey(row.key);
                      const relatedBookingDocument = bookingDocumentMap.get(`${getObjectId(booking)}:${documentTypeForStep}`)?.[0];
                      const artifactStepConfig = getArtifactStepConfig(row) || (reviewStepConfig ? artifactStepConfigByKey[reviewStepConfig.receivedStepKey] : undefined);
                      const configuredBookingDocumentType = row.key === 'questionnaire_sent'
                        ? ''
                        : normalizeDocumentKey(bookingDocumentTypeByStep[row.key] || item?.metadata?.expectedBookingDocument || item?.metadata?.expectedDocument || (!artifactStepConfig ? item?.metadata?.expectedArtifact : '') || '');
                      const linkableArtifacts = artifactStepConfig ? getArtifactLinkCandidates(booking, medicalArtifacts, artifactStepConfig) : [];
                      const relatedMedicalArtifact = linkedArtifactId
                        ? medicalArtifactById.get(linkedArtifactId)
                          : artifactStepConfig
                            ? medicalArtifactsByBookingContext.get(makeArtifactContextKey(getObjectId(booking), artifactStepConfig))?.[0]
                            : undefined;
                      const relatedMedicalArtifactId = relatedMedicalArtifact?._id || linkedArtifactId;
                      return (
                        <td key={`${getObjectId(booking)}:${row.key}`} className={`${viewMode === 'simple' ? 'min-w-[150px] px-2 py-2 text-center' : 'min-w-[230px] px-2 py-1 align-top'} border-b border-r border-gray-300 ${item ? (reviewStepConfig && resolvedReviewDecision ? reviewDecisionToClassName(resolvedReviewDecision) : getStatusCellClass(item.status)) : 'bg-red-50 text-red-900'}`}>
                          {viewMode === 'simple' ? (
                            <div
                              className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full ${simpleStatus.className}`}
                              title={`${row.title}: ${simpleStatus.label}`}
                            >
                              {simpleStatus.icon}
                            </div>
                          ) : item ? (
                            <div className="space-y-1">
                              <div className="grid grid-cols-[18px_minmax(88px,1fr)_92px] items-center gap-1">
                            <button
                              type="button"
                              disabled={!isEditing || saving === item._id}
                              onClick={() => toggleItem(item, !done)}
                              className="inline-flex justify-center disabled:opacity-50"
                              title={isEditing ? (done ? 'Mark pending' : 'Mark complete') : 'Unlock editing to change status'}
                            >
                              {done ? <CheckCircle2 className="h-4 w-4 flex-none" /> : <Circle className="h-4 w-4 flex-none" />}
                            </button>
                            <select
                              value={item.status || 'pending'}
                              disabled={!isEditing || saving === item._id}
                              onChange={(event) => updateItemStatus(item, event.target.value as BookingFlowItem['status'])}
                              className="w-full rounded border border-black/10 bg-white/80 px-1.5 py-1 text-xs font-medium text-gray-800 disabled:cursor-not-allowed disabled:bg-white/40"
                              title={getItemDisplayValue(item) || item.status || 'pending'}
                            >
                              {statusOptions.map((status) => (
                                <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                              ))}
                            </select>
                            <div className="grid gap-1">
                              <input
                                type="date"
                                value={pendingDateInputValue ?? confirmedDateInputValue}
                                disabled={!isEditing || saving === `date:${item._id}`}
                                onChange={(event) => {
                                  if (!item._id) return;
                                  setDatePickerDrafts((current) => ({ ...current, [item._id!]: event.target.value }));
                                }}
                                className="w-full rounded border border-black/10 bg-white/80 px-1.5 py-1 text-xs text-gray-800 disabled:cursor-not-allowed disabled:bg-white/40"
                              />
                              {hasPendingDateInput && (
                                <div className="flex justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => cancelItemDateDraft(item)}
                                    className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateItemDate(item, pendingDateInputValue || '')}
                                    className="rounded bg-blue-600 px-1.5 py-0.5 text-[11px] font-medium text-white hover:bg-blue-700"
                                  >
                                    OK
                                  </button>
                                </div>
                              )}
                            </div>
                              </div>
                              {isPaymentReceivedStep && (
                                <select
                                  value={selectedPaymentId}
                                  disabled={!isEditing || saving === `payment:${item._id}` || bookingPayments.length === 0}
                                  onChange={(event) => selectPaymentForItem(item, event.target.value)}
                                  className="w-full rounded border border-emerald-200 bg-white/90 px-1.5 py-1 text-xs font-medium text-emerald-900 disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-gray-500"
                                  title={bookingPayments.length > 0 ? 'Choose client payment to mark this step received' : 'No payments found for this client in this retreat'}
                                >
                                  <option value="">{bookingPayments.length > 0 ? 'Choose payment...' : 'No payments found'}</option>
                                  {bookingPayments.map((payment) => (
                                    <option key={payment._id || `${payment.display_id}:${payment.paymentDate}`} value={payment._id || ''}>
                                      {formatPaymentOption(payment)}
                                    </option>
                                  ))}
                                </select>
                              )}
                              <div className="grid grid-cols-[1fr_auto] gap-1">
                            <textarea
                              value={noteDrafts[item._id || ''] || ''}
                              disabled={!isEditing}
                              onChange={(event) => {
                                if (!item._id) return;
                                setNoteDrafts((current) => ({ ...current, [item._id!]: event.target.value }));
                                setDirtyNoteIds((current) => ({ ...current, [item._id!]: true }));
                              }}
                              rows={1}
                              placeholder={item.emailSentAt ? `Email ${formatDate(item.emailSentAt)}` : 'Notes'}
                              className="min-h-[28px] w-full resize-y rounded border border-black/10 bg-white/80 px-1.5 py-1 text-xs text-gray-800 placeholder:text-gray-400 disabled:cursor-not-allowed disabled:bg-white/40"
                            />
                            {reviewStepConfig && (
                              existingReviewRequestId ? (
                                <Link
                                  to={`/admin/medical-review-requests/${existingReviewRequestId}`}
                                  className="inline-flex items-center justify-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                                  title={`Open medical review request #${existingReviewRequestDisplay || existingReviewRequestId}`}
                                >
                                  MRR #{existingReviewRequestDisplay || 'linked'}
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!isEditing || saving === `mrr:${item._id}`}
                                  onClick={() => openReviewRequestModal(booking, item, row)}
                                  className="inline-flex items-center justify-center gap-1 rounded-md border border-indigo-200 bg-white px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                                  title={isEditing ? `Create ${reviewStepConfig.label}` : 'Unlock editing to create medical review request'}
                                >
                                  {saving === `mrr:${item._id}` ? '...' : 'Create MRR'}
                                </button>
                              )
                            )}
                            {reviewStepConfig && isEditing && !configuredActions.some((action) => action.type === 'link_mrr') && (
                              <button
                                type="button"
                                disabled={saving === `link-mrr:${item._id}`}
                                onClick={() => openExistingReviewRequestLinkModal(booking, item, row)}
                                className="inline-flex items-center justify-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                                title="Link an existing medical review request to this step"
                              >
                                <Link2 className="h-3.5 w-3.5" />
                                Link existing MRR
                              </button>
                            )}
                            {reviewStepConfig && resolvedReviewDecision && (
                              <div className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${reviewDecisionToClassName(resolvedReviewDecision)}`}>
                                <div className="flex items-center justify-between gap-2">
                                  <span>{reviewDecisionToLabel(resolvedReviewDecision) || 'Reviewed'}</span>
                                  {resolvedReviewReviewedAt && (
                                    <span className="font-normal opacity-80">{formatDateTime(resolvedReviewReviewedAt)}</span>
                                  )}
                                </div>
                                {resolvedReviewNotes && (
                                  <div className="mt-1 font-normal leading-snug">
                                    {resolvedReviewNotes}
                                  </div>
                                )}
                              </div>
                            )}
                            {configuredActions.map((action) => {
                              const actionLogs = itemActionLogs.filter((log) => (log.actionKey || 'default_email') === action.key);
                              const actionCount = actionLogs.length;
                              const savingKey = action.type === 'upload' ? `upload:${item._id}:${action.key}` : `action:${item._id}:${action.key}`;
                              return action.type === 'upload' ? (
                                <label
                                  key={action.key}
                                  className={`inline-flex items-center justify-center gap-1 rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 ${!isEditing || saving === savingKey ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                  title={isEditing ? 'Upload document for this booking step' : 'Unlock editing to upload documents'}
                                >
                                  <Upload className="h-3.5 w-3.5" />
                                  {saving === savingKey ? '...' : actionCount > 0 && action.allowRepeat !== false ? `${action.label} again` : action.label}
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic,.heif"
                                    multiple
                                    disabled={!isEditing || Boolean(saving)}
                                    onChange={(event) => {
                                      uploadItemDocument(booking, item, action, event.target.files);
                                      event.target.value = '';
                                    }}
                                  />
                                  </label>
                              ) : action.type === 'link_mrr' ? (
                                <button
                                  key={action.key}
                                  type="button"
                                  disabled={!isEditing || saving === savingKey}
                                  onClick={() => openExistingReviewRequestLinkModal(booking, item, row, action)}
                                  className="inline-flex items-center justify-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                                  title={isEditing ? 'Link an existing medical review request' : 'Unlock editing to link a medical review request'}
                                >
                                  <Link2 className="h-3.5 w-3.5" />
                                  {saving === savingKey ? '...' : actionCount > 0 && action.allowRepeat !== false ? `${action.label} again` : action.label}
                                </button>
                              ) : (
                                <button
                                  key={action.key}
                                  type="button"
                                  disabled={!isEditing || saving === savingKey}
                                  onClick={() => runItemAction(item, action)}
                                  className="inline-flex items-center justify-center gap-1 rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                                  title={isEditing ? action.type : 'Unlock editing to run actions'}
                                >
                                  {action.type === 'email' && <Mail className="h-3.5 w-3.5" />}
                                  {saving === savingKey ? '...' : actionCount > 0 && action.allowRepeat !== false ? `${action.label} again` : action.label}
                                </button>
                              );
                            })}
                            {canSendReminder(item) && (
                              <>
                                <button
                                  type="button"
                                  disabled={saving === `reminder-preview:${item._id}`}
                                  onClick={() => openReminderPreview(item)}
                                  className="inline-flex items-center justify-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                                  title={`Preview a reminder for ${item.title}`}
                                >
                                  <Mail className="h-3.5 w-3.5" />
                                  {saving === `reminder-preview:${item._id}` ? 'Preparing...' : `Remind: ${item.title}`}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openReminderAutomation(item)}
                                  className={`inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${item.automationPaused ? 'border-gray-300 bg-gray-100 text-gray-600' : 'border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100'}`}
                                  title="View automated reminder sequence"
                                >
                                  <ListPlus className="h-3.5 w-3.5" />
                                  {item.automationPaused ? 'Automation paused' : 'Automation'}
                                </button>
                              </>
                            )}
                            {shouldShowArtifactUploadFallback(artifactStepConfig, isEditing, configuredActions.some((action) => action.type === 'upload')) && (
                              <label
                                className={`inline-flex items-center justify-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 ${!isEditing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                title={isEditing ? `Upload a new ${artifactStepConfig?.label || 'artifact'} document` : 'Unlock editing to upload documents'}
                              >
                                <Upload className="h-3.5 w-3.5" />
                                Upload {artifactStepConfig?.artifactType === 'medications_form' ? 'form' : 'new'}
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic,.heif"
                                  multiple
                                  disabled={!isEditing || Boolean(saving)}
                                  onChange={(event) => {
                                    uploadItemDocument(booking, item, {
                                      key: `artifact-upload:${item._id || row.key}`,
                                      label: `Upload ${artifactStepConfig?.label || 'artifact'}`,
                                      type: 'upload',
                                    }, event.target.files);
                                    event.target.value = '';
                                  }}
                                />
                              </label>
                            )}
                            {configuredBookingDocumentType && isEditing && !configuredActions.some((action) => action.type === 'upload') && (
                              <label className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100" title={`Upload ${humanizeDocumentKey(configuredBookingDocumentType)} for this booking step`}>
                                <Upload className="h-3.5 w-3.5" /> Upload {humanizeDocumentKey(configuredBookingDocumentType)}
                                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic,.heif" multiple disabled={Boolean(saving)} onChange={(event) => {
                                  uploadItemDocument(booking, item, { key: `document-upload:${item?._id || row.key}`, label: `Upload ${humanizeDocumentKey(configuredBookingDocumentType)}`, type: 'upload' }, event.target.files);
                                  event.target.value = '';
                                }} />
                              </label>
                            )}
                            {relatedBookingDocument?._id && (
                              <button
                                type="button"
                                onClick={() => window.location.assign('/admin/booking-documents')}
                                className="inline-flex items-center justify-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                                title="Open Document Library"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                Document #{relatedBookingDocument.display_id || 'linked'}
                              </button>
                            )}
                            {relatedMedicalArtifactId && (
                              <Link
                                to={`/admin/medical-artifacts/${relatedMedicalArtifactId}`}
                                className="inline-flex items-center justify-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-medium text-purple-800 hover:bg-purple-100"
                                title={`Open uploaded ${artifactStepConfig?.label || 'medical artifact'}`}
                              >
                                <FileText className="h-3.5 w-3.5" />
                                Artifact #{relatedMedicalArtifact?.display_id || relatedMedicalArtifactId.slice(-6)}
                              </Link>
                            )}
                            {!relatedMedicalArtifactId && artifactStepConfig && linkableArtifacts.length > 0 && (
                              <button
                                type="button"
                                disabled={!isEditing}
                                onClick={() => openArtifactLinkModal(booking, item, row, artifactStepConfig)}
                                className="inline-flex items-center justify-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                                title={isEditing ? `Link an existing ${artifactStepConfig.label} artifact to this step` : 'Unlock editing to link an existing artifact'}
                              >
                                <FileText className="h-3.5 w-3.5" />
                                Link existing
                              </button>
                            )}
                              </div>
                              {itemActionLogs.length > 0 && (
                                <div className="space-y-0.5 text-[11px] text-blue-800">
                              {configuredActions
                                .map((action) => ({ action, logs: itemActionLogs.filter((log) => (log.actionKey || 'default_email') === action.key) }))
                                .filter(({ logs }) => logs.length > 0)
                                .map(({ action, logs }) => (
                                  <ActionHistoryHover key={action.key} label={action.label} logs={logs} />
                                ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                </>
                  );
                })()}
              </React.Fragment>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={bookings.length + 1} className="px-4 py-8 text-center text-gray-500">No booking steps yet. Generate missing steps to build the matrix.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {actionFilterOpen && createPortal(
        <>
          <button type="button" className="fixed inset-0 z-[1090] cursor-default bg-transparent" onClick={() => setActionFilterOpen(false)} aria-label="Close action filter" />
          <div className="fixed z-[1100] w-[340px] rounded-lg border border-gray-300 bg-white normal-case shadow-2xl" style={{ top: actionFilterPosition.top, left: actionFilterPosition.left }} role="dialog" aria-label="Filter booking actions">
            <div className="border-b border-gray-200 p-3">
              <div className="text-sm font-semibold text-gray-900">Filter booking actions</div>
              <input autoFocus value={actionFilterSearch} onChange={(event) => setActionFilterSearch(event.target.value)} placeholder="Search actions" className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
            <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 text-xs font-semibold">
              <label className="flex cursor-pointer items-center gap-2 text-gray-700">
                <input type="checkbox" checked={actionFilterDraft.length === rows.length && rows.length > 0} onChange={(event) => setActionFilterDraft(event.target.checked ? rows.map((row) => row.key) : [])} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                Select all
              </label>
              <span className="text-gray-500">{actionFilterDraft.length} of {rows.length}</span>
            </div>
            <div className="max-h-80 space-y-0.5 overflow-y-auto p-2">
              {visibleActionFilterRows.map((row) => {
                const originalIndex = rows.findIndex((candidate) => candidate.key === row.key);
                return (
                  <label key={row.key} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                    <input type="checkbox" checked={actionFilterDraft.includes(row.key)} onChange={() => setActionFilterDraft((current) => current.includes(row.key) ? current.filter((key) => key !== row.key) : [...current, row.key])} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600" />
                    <span><span className="mr-1 text-gray-400">{originalIndex + 1}.</span>{row.title}</span>
                  </label>
                );
              })}
              {visibleActionFilterRows.length === 0 && <div className="px-2 py-6 text-center text-sm text-gray-500">No actions match your search.</div>}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 p-3">
              <button type="button" onClick={() => setActionFilterOpen(false)} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={() => { setSelectedActionKeys(actionFilterDraft.length === rows.length ? null : actionFilterDraft); setActionFilterOpen(false); }} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Apply filter</button>
            </div>
          </div>
        </>,
        document.body
      )}
      {composeState && (
        <EmailComposeModal
          title={`Send ${composeState.item.title}`}
          initialValues={composeState.initialValues}
          onClose={() => setComposeState(null)}
          onSent={handleComposedEmailSent}
        />
      )}
      {reminderState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Reminder: {reminderState.item.title}</h2>
                <p className="mt-1 text-sm text-gray-500">Preview and edit before sending to {reminderState.to}.</p>
              </div>
              <button type="button" onClick={() => setReminderState(null)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100" aria-label="Close reminder preview">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {(reminderState.duplicateWarning || reminderState.reminderCount > 0) && (
                <div className={`rounded-lg border p-3 text-sm ${reminderState.duplicateBlocked ? 'border-red-300 bg-red-50 text-red-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
                  <strong>{reminderState.reminderCount} previous reminder{reminderState.reminderCount === 1 ? '' : 's'}.</strong>
                  {reminderState.lastReminderAt && ` Last sent ${formatDateTime(reminderState.lastReminderAt)}.`}
                  {reminderState.duplicateBlocked && ' Another reminder requires confirmation because the last one was sent less than 24 hours ago.'}
                </div>
              )}
              <div className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm sm:grid-cols-3">
                <div><span className="block text-xs uppercase text-gray-500">Deadline</span><strong>{reminderState.dueDate || 'Not set'}</strong></div>
                <div><span className="block text-xs uppercase text-gray-500">Follow up</span><input type="date" value={reminderState.suggestedFollowUpDate} onChange={(event) => setReminderState((current) => current ? { ...current, suggestedFollowUpDate: event.target.value } : current)} className="mt-1 rounded border border-gray-300 px-2 py-1" /></div>
                <div><span className="block text-xs uppercase text-gray-500">Upload link</span><a href={reminderState.uploadUrl} target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline">Open client step</a></div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Subject</label>
                <input value={reminderState.subject} onChange={(event) => setReminderState((current) => current ? { ...current, subject: event.target.value } : current)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Message</label>
                <textarea value={reminderState.bodyText} onChange={(event) => setReminderState((current) => current ? { ...current, bodyText: event.target.value } : current)} rows={13} className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm" />
              </div>
              {reminderState.history.length > 0 && (
                <details className="rounded-lg border border-gray-200 p-3 text-sm">
                  <summary className="cursor-pointer font-medium">Previous reminders</summary>
                  <ul className="mt-2 space-y-2 text-gray-600">
                    {reminderState.history.map((log, index) => <li key={log._id || index}>{formatDateTime(log.performedAt)}{log.performedByEmail ? ` · ${log.performedByEmail}` : ''}</li>)}
                  </ul>
                </details>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
              <button type="button" onClick={() => setReminderState(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Cancel</button>
              <button type="button" disabled={!reminderState.subject.trim() || !reminderState.bodyText.trim() || saving === `reminder-send:${reminderState.item._id}`} onClick={() => sendReminder()} className="rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50">
                {saving === `reminder-send:${reminderState.item._id}` ? 'Sending...' : 'Send reminder'}
              </button>
            </div>
          </div>
        </div>
      )}
      {automationState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Automated reminders: {automationState.item.title}</h2>
                <p className="mt-1 text-sm text-gray-500">Generated from the step deadline. Completed steps cancel future actions automatically.</p>
              </div>
              <button type="button" onClick={() => setAutomationState(null)} className="rounded-md p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-5">
              {automationState.paused && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <strong>Automation paused.</strong>{automationState.pauseReason ? ` ${automationState.pauseReason}` : ''}
                </div>
              )}
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Status</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {automationState.schedules.map((schedule) => (
                      <tr key={schedule._id}><td className="px-3 py-2">{formatDateTime(schedule.scheduledFor)}</td><td className="px-3 py-2">{schedule.ruleKey.replace(/_/g, ' ')}</td><td className="px-3 py-2 font-medium">{schedule.status.replace(/_/g, ' ')}</td></tr>
                    ))}
                    {automationState.schedules.length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-gray-500">No automation is scheduled for this step.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-between border-t border-gray-200 px-5 py-4">
              <button type="button" onClick={toggleReminderAutomation} disabled={saving === `automation-toggle:${automationState.item._id}`} className={`rounded-md px-4 py-2 text-sm font-semibold ${automationState.paused ? 'bg-green-700 text-white' : 'border border-gray-300 text-gray-700'}`}>
                {automationState.paused ? 'Resume automation' : 'Pause for this client'}
              </button>
              <button type="button" onClick={() => setAutomationState(null)} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white">Close</button>
            </div>
          </div>
        </div>
      )}
      {reviewRequestLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-3xl rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Link existing medical review request</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {reviewRequestLinkModal.row.title} for {getClientName(reviewRequestLinkModal.booking)} · Booking #{getBookingNumber(reviewRequestLinkModal.booking)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Select an existing request, then link it to this booking step.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewRequestLinkModal(null)}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-auto rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Select</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Request</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Details</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {reviewRequestLinkModal.candidates.map((request) => (
                    <tr key={request._id} className={reviewRequestLinkModal.selectedRequestId === request._id ? 'bg-indigo-50' : ''}>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="radio"
                          name="review-request-link-selection"
                          checked={reviewRequestLinkModal.selectedRequestId === request._id}
                          onChange={() => setReviewRequestLinkModal((current) => (current ? { ...current, selectedRequestId: request._id || '' } : current))}
                        />
                      </td>
                      <td className="px-3 py-2 align-top font-medium text-gray-900">
                        MRR #{request.display_id || request._id?.slice(-6)} {request.requestType ? `· ${request.requestType}` : ''}
                      </td>
                      <td className="px-3 py-2 align-top text-gray-600">
                        <div>{request.status?.replace(/_/g, ' ') || 'pending'}{request.reviewDecision ? ` · ${request.reviewDecision}` : ''}</div>
                        <div>{request.assignedToEmail || request.assignedTo || 'Unassigned'}</div>
                        <div>{formatDateTime(request.requestedAt || request.createdAt)}</div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <button
                          type="button"
                          disabled={saving === `link-mrr:${reviewRequestLinkModal.item._id}` || reviewRequestLinkModal.selectedRequestId !== request._id}
                          onClick={linkExistingReviewRequestToStep}
                          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {saving === `link-mrr:${reviewRequestLinkModal.item._id}` ? 'Linking...' : 'Link to step'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {artifactLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Link existing artifact</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Select an existing {artifactLinkModal.config.label.toLowerCase()} artifact for {artifactLinkModal.row.title} on booking #{getBookingNumber(artifactLinkModal.booking)}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setArtifactLinkModal(null)}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-auto rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Select</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Artifact</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Details</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {artifactLinkModal.candidates.map((artifact) => (
                    <tr key={artifact._id} className={artifactLinkModal.selectedArtifactId === artifact._id ? 'bg-amber-50' : ''}>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="radio"
                          name="artifact-link-selection"
                          checked={artifactLinkModal.selectedArtifactId === artifact._id}
                          onChange={() => setArtifactLinkModal((current) => (current ? { ...current, selectedArtifactId: artifact._id || '' } : current))}
                        />
                      </td>
                      <td className="px-3 py-2 align-top font-medium text-gray-900">
                        #{artifact.display_id || artifact._id?.slice(-6)} {artifact.title || artifact.documentType || artifact.artifactType}
                      </td>
                      <td className="px-3 py-2 align-top text-gray-600">
                        <div>{artifact.documentStage || 'entry'} · {artifact.documentType || artifact.artifactType}</div>
                        <div>{formatDateTime(artifact.receivedAt || artifact.createdAt)}</div>
                        <div>{(artifact.files || []).length} file(s)</div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <button
                          type="button"
                          disabled={saving === `link:${artifactLinkModal.item._id}` || artifactLinkModal.selectedArtifactId !== artifact._id}
                          onClick={linkExistingArtifactToStep}
                          className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                          {saving === `link:${artifactLinkModal.item._id}` ? 'Linking...' : 'Link to step'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
        {createPortal(<div className="fixed bottom-6 right-6 z-[1000] flex items-center gap-2 rounded-xl border border-gray-300 bg-white p-2 shadow-2xl">
          {isEditing ? (
            <>
              <button type="button" onClick={() => saveAllChanges(false)} disabled={saving === 'save-all'} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                <Save className="h-4 w-4" /> {saving === 'save-all' ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={() => saveAllChanges(true)} disabled={saving === 'save-all'} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">
                <Lock className="h-4 w-4" /> {saving === 'save-all' ? 'Saving...' : 'Lock'}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => { setViewMode('detail'); setIsEditing(true); }} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-gray-800">
              <Unlock className="h-4 w-4" /> Unlock Editing
            </button>
          )}
        </div>, document.body)}
      {reviewRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Create Medical Review Request</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {reviewRequestModal.label} for {getClientName(reviewRequestModal.booking)} · Booking #{getBookingNumber(reviewRequestModal.booking)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewRequestModal(null)}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                <div><span className="font-medium text-gray-900">Artifact:</span> {reviewRequestModal.artifactId}</div>
                <div><span className="font-medium text-gray-900">Request type:</span> {reviewRequestModal.requestType.replace(/_/g, ' ')}</div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Medical Advisor <span className="text-red-600">*</span>
                </label>
                <select
                  value={reviewRequestModal.advisorId}
                  onChange={(event) => setReviewRequestModal((current) => current ? { ...current, advisorId: event.target.value } : current)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select medical advisor</option>
                  {medicalAdvisors.map((advisor) => (
                    <option key={advisor._id} value={advisor._id}>
                      {[advisor.firstName, advisor.lastName].filter(Boolean).join(' ') || advisor.email} ({advisor.email})
                    </option>
                  ))}
                </select>
                {medicalAdvisors.length === 0 && (
                  <p className="mt-1 text-xs text-red-600">No active medical advisors are available.</p>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewRequestModal(null)}
                disabled={saving === `mrr:${reviewRequestModal.item._id}`}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createMedicalReviewRequestFromStep}
                disabled={!reviewRequestModal.advisorId || saving === `mrr:${reviewRequestModal.item._id}`}
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving === `mrr:${reviewRequestModal.item._id}` ? 'Creating...' : 'Create MRR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingStepsMatrix;
