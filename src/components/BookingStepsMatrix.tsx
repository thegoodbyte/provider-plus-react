import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Circle, FileText, Filter, Link2, ListPlus, Lock, Mail, RefreshCw, Save, ThumbsDown, ThumbsUp, Unlock, Upload, X } from 'lucide-react';
import { bookingDocumentsApi, bookingFlowApi, communicationsApi, medicalArtifactsApi, medicalReviewRequestsApi, paymentsApi } from '../services/api';
import { usersApi, User } from '../services/usersApi';
import { BookingDocument, BookingFlowAction, BookingFlowActionLog, BookingFlowItem, BookingFlowTemplate, MedicalArtifact, MedicalReviewRequest, Payment } from '../types';
import LoadingSpinner from './LoadingSpinner';
import EmailComposeModal, { EmailComposeInitialValues } from './EmailComposeModal';
import { resolveBookingStepUploadTarget, shouldShowArtifactUploadFallback } from './BookingStepsMatrix.helpers';
import { getBookingStepColorStyles, getBookingStepToneWithColor } from '../utils/bookingStepColors';
import { buildBookingFlowArtifactFilters } from './bookingFlowLookup';
import { hasBookingActionLog } from './BookingStepsMatrix.helpers';
import { resolveConfiguredBookingStepActions } from './bookingStepActions';
import { ArtifactLinkConfig, getArtifactLinkCandidates, getArtifactStepConfig, getReviewRequestLinkCandidates, getReviewStepConfig, reviewDecisionToClassName, reviewDecisionToLabel } from './bookingStepMedicalLinks';
import { formatStepDate as formatDate, formatStepDateTime as formatDateTime, formatStepPaymentOption as formatPaymentOption, getSimpleStepStatus, getStepItemDisplayValue as getItemDisplayValue, getStepStatusCellClass as getStatusCellClass, getStepStickyCellStyle as getStickyActionCellStyle } from './bookingStepPresentation';
import { getBookingStepClientId as getBookingClientId, getBookingStepNumber as getBookingNumber, getBookingStepObjectId as getObjectId } from './bookingStepIdentity';
import { BookingStepMatrixRow as MatrixRow, buildBookingStepRows, filterBookingStepRowGroups, groupBookingStepRows, numberBookingStepRows, searchBookingStepRows } from './bookingStepRows';
import { indexBookingStepActionLogs, indexBookingStepDocuments, indexBookingStepItems, indexBookingStepPayments, indexBookingStepTemplates } from './bookingStepIndexes';
import { indexBookingStepArtifactsByContext, indexBookingStepArtifactsById, indexBookingStepReviewsByArtifact, indexBookingStepReviewsByContext } from './bookingStepMedicalIndexes';
import { buildBookingStepActionOptions, canSendBookingStepReminder as canSendReminder, canSendBookingStepRowEmail as rowCanSendEmail, getLinkedBookingStepArtifactId as getLinkedArtifactIdFromItem, humanizeBookingStepDocumentKey as humanizeDocumentKey, interpolateBookingStepActionUrl as interpolateActionUrl, resolveBookingStepDocumentType, resolveConfiguredBookingStepDocumentType } from './bookingStepControlRules';
import BookingStepActionHistory from './BookingStepActionHistory';
import { applyBookingStepDateUpdate, buildBookingStepDateUpdate, buildBookingStepNoteUpdates, buildBookingStepToggleUpdate, removeBookingStepDateDraft, shouldUpdateBookingStepStatus } from './bookingStepMutations';
import { buildBookingStepPaymentSelection } from './bookingStepPaymentSelection';
import { buildBookingStepReviewCreation, buildBookingStepReviewLink } from './bookingStepReviewMutations';
import { buildBookingStepArtifactLink, buildBookingStepArtifactUploadUpdate } from './bookingStepArtifactMutations';
import { buildBookingStepAutomationToggle, buildBookingStepReminderPayload, formatBookingStepRowEmailSummary, getBookingStepDuplicateReminderPrompt, getBookingStepReminderFailure, getBookingStepRowEmailConfirmation } from './bookingStepCommunicationRules';
import BookingStepClientHeader, { getBookingStepRoutePrefix } from './BookingStepClientHeader';
import { BookingStepAutomationModal, BookingStepAutomationModalState, BookingStepReminderModal, BookingStepReminderModalState } from './BookingStepCommunicationModals';
import { BookingStepArtifactLinkModal, BookingStepArtifactLinkModalState, BookingStepReviewLinkModal, BookingStepReviewLinkModalState, BookingStepReviewRequestModal, BookingStepReviewRequestModalState } from './BookingStepMedicalModals';
import { buildBookingStepCellModel } from './bookingStepCellModel';

const getSimpleStatus = (item?: BookingFlowItem) => {
  const status = getSimpleStepStatus(item);
  const icon = status.icon === 'failed' ? <ThumbsDown className="h-5 w-5" /> : status.icon === 'attention' ? <AlertTriangle className="h-5 w-5" /> : status.icon === 'fulfilled' ? <ThumbsUp className="h-5 w-5" /> : <X className="h-5 w-5" />;
  return { ...status, icon };
};

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
  const [reviewRequestModal, setReviewRequestModal] = useState<BookingStepReviewRequestModalState | null>(null);
  const [artifactLinkModal, setArtifactLinkModal] = useState<BookingStepArtifactLinkModalState | null>(null);
  const [reviewRequestLinkModal, setReviewRequestLinkModal] = useState<BookingStepReviewLinkModalState | null>(null);
  const [composeState, setComposeState] = useState<{
    item: BookingFlowItem;
    action?: BookingFlowAction;
    initialValues: EmailComposeInitialValues;
  } | null>(null);
  const [reminderState, setReminderState] = useState<BookingStepReminderModalState | null>(null);
  const [automationState, setAutomationState] = useState<BookingStepAutomationModalState | null>(null);
  const routePrefix = useMemo(() => getBookingStepRoutePrefix(location.pathname), [location.pathname]);

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

  const rows = useMemo(() => buildBookingStepRows(templates, items), [items, templates]);
  const groupedRows = useMemo(() => groupBookingStepRows(rows), [rows]);
  const filteredGroupedRows = useMemo(() => filterBookingStepRowGroups(groupedRows, selectedActionKeys), [groupedRows, selectedActionKeys]);

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

  const visibleActionFilterRows = searchBookingStepRows(rows, actionFilterSearch);

  const actionNumberByKey = useMemo(
    () => numberBookingStepRows(rows),
    [rows]
  );

  const itemMap = useMemo(() => indexBookingStepItems(items), [items]);
  const templateMap = useMemo(() => indexBookingStepTemplates(templates), [templates]);
  const libraryTemplateMap = useMemo(() => indexBookingStepTemplates(libraryTemplates), [libraryTemplates]);
  const actionLogMap = useMemo(() => indexBookingStepActionLogs(actionLogs), [actionLogs]);
  const bookingDocumentMap = useMemo(() => indexBookingStepDocuments(bookingDocuments), [bookingDocuments]);

  const medicalArtifactById = useMemo(() => indexBookingStepArtifactsById(medicalArtifacts), [medicalArtifacts]);
  const medicalArtifactsByBookingContext = useMemo(() => indexBookingStepArtifactsByContext(medicalArtifacts), [medicalArtifacts]);
  const reviewRequestsByArtifactId = useMemo(() => indexBookingStepReviewsByArtifact(reviewRequests), [reviewRequests]);
  const reviewRequestsByBookingContext = useMemo(() => indexBookingStepReviewsByContext(reviewRequests), [reviewRequests]);

  const paymentsByClientId = useMemo(() => indexBookingStepPayments(payments), [payments]);

  const toggleItem = async (item: BookingFlowItem | undefined, checked: boolean) => {
    if (!item?._id) return;
    setSaving(item._id);
    try {
      await bookingFlowApi.updateItem(item._id, {
        ...buildBookingStepToggleUpdate(checked),
      });
      await loadData(false);
    } finally {
      setSaving('');
    }
  };

  const updateItemStatus = async (item: BookingFlowItem | undefined, status: BookingFlowItem['status']) => {
    if (!shouldUpdateBookingStepStatus(item, status)) return;
    setSaving(item._id);
    try {
      await bookingFlowApi.updateItem(item._id, { status } as Partial<BookingFlowItem>);
      await loadData(false);
    } finally {
      setSaving('');
    }
  };

  const saveAllChanges = async (lockAfterSave = false) => {
    const noteUpdates = buildBookingStepNoteUpdates(items, dirtyNoteIds, noteDrafts);
    setSaving('save-all');
    try {
      await Promise.all(noteUpdates.map(({ itemId, notes }) => bookingFlowApi.updateItem(itemId, { notes })));
      setDirtyNoteIds({});
      await loadData(false);
      if (lockAfterSave) setIsEditing(false);
    } finally {
      setSaving('');
    }
  };

  const updateItemDate = async (item: BookingFlowItem | undefined, value: string) => {
    if (!item?._id) return;
    const { field, payload } = buildBookingStepDateUpdate(item, value);
    setSaving(`date:${item._id}`);
    try {
      setItems((current) => applyBookingStepDateUpdate(current, item._id!, field, value));
      await bookingFlowApi.updateItem(item._id, payload);
      setDatePickerDrafts((current) => removeBookingStepDateDraft(current, item._id!));
      await loadData(false);
    } finally {
      setSaving('');
    }
  };

  const selectPaymentForItem = async (item: BookingFlowItem | undefined, paymentId: string) => {
    const selection = buildBookingStepPaymentSelection(item, paymentId, payments);
    if (!selection || !item?._id) return;

    setSaving(`payment:${item._id}`);
    try {
      await bookingFlowApi.updateItem(item._id, selection.update);
      await bookingFlowApi.recordItemAction(item._id, selection.action).catch(() => null);
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
      const mutation = buildBookingStepReviewCreation(item, reviewRequest, reviewRequestModal.artifactId, reviewRequestModal.advisorId, advisor);
      await bookingFlowApi.updateItem(itemId, mutation.update);
      await bookingFlowApi.recordItemAction(itemId, mutation.action).catch(() => null);
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

      const mutation = buildBookingStepReviewLink(item, updatedRequest.data, getBookingNumber(booking), reviewRequestLinkModal.action);
      await bookingFlowApi.updateItem(itemId, mutation.update);
      await bookingFlowApi.recordItemAction(itemId, mutation.action).catch(() => null);

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
      const mutation = buildBookingStepArtifactLink(item, selectedArtifact, linkedArtifact, { bookingId, clientId, retreatId, bookingNumber: getBookingNumber(booking), label: artifactLinkModal.config.label });
      await bookingFlowApi.updateItem(itemId, mutation.update);
      await bookingFlowApi.recordItemAction(itemId, mutation.action).catch(() => null);

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
    setDatePickerDrafts((current) => removeBookingStepDateDraft(current, item._id!));
  };

  const getConfiguredActions = useCallback((item?: BookingFlowItem) => resolveConfiguredBookingStepActions(item, templateMap, libraryTemplateMap), [templateMap, libraryTemplateMap]);

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

  const uploadItemDocument = async (booking: any, item: BookingFlowItem | undefined, action: BookingFlowAction, files: FileList | null) => {
    if (!item?._id || !files?.length) return;
    const bookingId = getObjectId(booking);
    const clientId = getObjectId(booking.clientId || booking.client || item.clientId);
    const currentRetreatId = getObjectId(booking.retreatId || booking.retreat || item.retreatId) || retreatId;
    const documentType = resolveBookingStepDocumentType(item);
    const artifactConfig = getArtifactStepConfig(item);
    const configuredDocumentType = resolveConfiguredBookingStepDocumentType(item, Boolean(artifactConfig));
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

        await bookingFlowApi.updateItem(item._id, buildBookingStepArtifactUploadUpdate(item, created.data, fileArray[0]?.name, artifactConfig as any));
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
    const duplicatePrompt = getBookingStepDuplicateReminderPrompt(reminderState, overrideDuplicate);
    if (duplicatePrompt) {
      if (!window.confirm(duplicatePrompt)) return;
      overrideDuplicate = true;
    }
    setSaving(`reminder-send:${reminderState.item._id}`);
    try {
      const response = await bookingFlowApi.sendItemReminder(reminderState.item._id, buildBookingStepReminderPayload(reminderState, overrideDuplicate));
      const failure = getBookingStepReminderFailure(response);
      if (failure) {
        alert(failure);
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
    const toggle = buildBookingStepAutomationToggle(automationState.paused, automationState.pauseReason || '', () => window.prompt('Why are reminders being paused for this client?', automationState.pauseReason || ''));
    setSaving(`automation-toggle:${automationState.item._id}`);
    try {
      const response = await bookingFlowApi.setItemReminderAutomationPaused(automationState.item._id, toggle);
      setAutomationState((current) => current ? { ...current, ...response.data } : current);
      await loadData(false);
    } finally {
      setSaving('');
    }
  };

  const sendRowEmail = async (row: MatrixRow) => {
    if (!row.templateId) return;
    if (!window.confirm(getBookingStepRowEmailConfirmation(row))) return;

    setSaving(`row-email:${row.key}`);
    try {
      const response = await bookingFlowApi.sendTemplateEmailToRetreat(retreatId, row.templateId);
      alert(formatBookingStepRowEmailSummary(response.data));
      await loadData(false);
    } catch (error: any) {
      console.error('Error sending retreat step email:', error);
      alert(error?.response?.data?.message || error?.message || 'Unable to send retreat step email.');
    } finally {
      setSaving('');
    }
  };

  const bookingActionOptions = useMemo(() => {
    return buildBookingStepActionOptions(items, getConfiguredActions);
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
              {bookings.map((booking) => <BookingStepClientHeader key={getObjectId(booking)} booking={booking} viewMode={viewMode} routePrefix={routePrefix} />)}
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
                      const simpleStatus = getSimpleStatus(item);
                      const done = getSimpleStepStatus(item).icon === 'fulfilled';
                      const itemActionLogs = item?._id ? actionLogMap.get(item._id) || [] : [];
                      const configuredActions = getConfiguredActions(item);
                      const { confirmedDateInputValue, pendingDateInputValue, hasPendingDateInput, isPaymentReceivedStep, bookingPayments, selectedPaymentId, reviewStepConfig, resolvedReviewDecision, resolvedReviewNotes, resolvedReviewReviewedAt, existingReviewRequestId, existingReviewRequestDisplay, relatedBookingDocument, artifactStepConfig, configuredBookingDocumentType, linkableArtifacts, relatedMedicalArtifact, relatedMedicalArtifactId } = buildBookingStepCellModel({ booking, item, row, itemMap, datePickerDrafts, paymentsByClientId, reviewRequests, reviewRequestsByArtifactId, reviewRequestsByBookingContext, bookingDocumentMap, medicalArtifacts, medicalArtifactById, medicalArtifactsByBookingContext });
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
                            {canSendReminder(item, bookings) && (
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
                                  <BookingStepActionHistory key={action.key} label={action.label} logs={logs} />
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
      {reminderState && <BookingStepReminderModal state={reminderState} saving={saving} onChange={setReminderState} onClose={() => setReminderState(null)} onSend={() => sendReminder()} />}
      {automationState && <BookingStepAutomationModal state={automationState} saving={saving} onClose={() => setAutomationState(null)} onToggle={toggleReminderAutomation} />}
      {reviewRequestLinkModal && <BookingStepReviewLinkModal state={reviewRequestLinkModal} saving={saving} onChange={setReviewRequestLinkModal} onClose={() => setReviewRequestLinkModal(null)} onLink={linkExistingReviewRequestToStep} />}
      {artifactLinkModal && <BookingStepArtifactLinkModal state={artifactLinkModal} saving={saving} onChange={setArtifactLinkModal} onClose={() => setArtifactLinkModal(null)} onLink={linkExistingArtifactToStep} />}
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
      {reviewRequestModal && <BookingStepReviewRequestModal state={reviewRequestModal} advisors={medicalAdvisors} saving={saving} onChange={setReviewRequestModal} onClose={() => setReviewRequestModal(null)} onCreate={createMedicalReviewRequestFromStep} />}
    </div>
  );
};

export default BookingStepsMatrix;
