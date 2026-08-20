import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Filter, Lock, Save, Unlock } from 'lucide-react';
import { bookingDocumentsApi, bookingFlowApi, communicationsApi, medicalArtifactsApi, medicalReviewRequestsApi, paymentsApi } from '../services/api';
import { usersApi, User } from '../services/usersApi';
import { BookingDocument, BookingFlowAction, BookingFlowActionLog, BookingFlowItem, BookingFlowTemplate, MedicalArtifact, MedicalReviewRequest, Payment } from '../types';
import LoadingSpinner from './LoadingSpinner';
import EmailComposeModal, { EmailComposeInitialValues } from './EmailComposeModal';
import { resolveBookingStepUploadTarget } from './BookingStepsMatrix.helpers';
import { buildBookingFlowArtifactFilters } from './bookingFlowLookup';
import { resolveConfiguredBookingStepActions } from './bookingStepActions';
import { ArtifactLinkConfig, getArtifactLinkCandidates, getArtifactStepConfig, getReviewRequestLinkCandidates, getReviewStepConfig } from './bookingStepMedicalLinks';
import { getSimpleStepStatus } from './bookingStepPresentation';
import { getBookingStepClientId as getBookingClientId, getBookingStepNumber as getBookingNumber, getBookingStepObjectId as getObjectId } from './bookingStepIdentity';
import { BookingStepMatrixRow as MatrixRow, buildBookingStepRows, filterBookingStepRowGroups, groupBookingStepRows, numberBookingStepRows, searchBookingStepRows } from './bookingStepRows';
import { indexBookingStepActionLogs, indexBookingStepDocuments, indexBookingStepItems, indexBookingStepPayments, indexBookingStepTemplates } from './bookingStepIndexes';
import { indexBookingStepArtifactsByContext, indexBookingStepArtifactsById, indexBookingStepReviewsByArtifact, indexBookingStepReviewsByContext } from './bookingStepMedicalIndexes';
import { buildBookingStepActionOptions, canSendBookingStepReminder as canSendReminder, getLinkedBookingStepArtifactId as getLinkedArtifactIdFromItem, humanizeBookingStepDocumentKey as humanizeDocumentKey, interpolateBookingStepActionUrl as interpolateActionUrl, resolveBookingStepDocumentType, resolveConfiguredBookingStepDocumentType } from './bookingStepControlRules';
import { applyBookingStepDateUpdate, buildBookingStepDateUpdate, buildBookingStepNoteUpdates, buildBookingStepToggleUpdate, removeBookingStepDateDraft, shouldUpdateBookingStepStatus } from './bookingStepMutations';
import { buildBookingStepPaymentSelection } from './bookingStepPaymentSelection';
import { buildBookingStepReviewCreation, buildBookingStepReviewLink } from './bookingStepReviewMutations';
import { buildBookingStepArtifactLink, buildBookingStepArtifactUploadUpdate } from './bookingStepArtifactMutations';
import { buildBookingStepAutomationToggle, buildBookingStepReminderPayload, formatBookingStepRowEmailSummary, getBookingStepDuplicateReminderPrompt, getBookingStepReminderFailure, getBookingStepRowEmailConfirmation } from './bookingStepCommunicationRules';
import BookingStepClientHeader, { getBookingStepRoutePrefix } from './BookingStepClientHeader';
import { BookingStepAutomationModal, BookingStepAutomationModalState, BookingStepReminderModal, BookingStepReminderModalState } from './BookingStepCommunicationModals';
import { BookingStepArtifactLinkModal, BookingStepArtifactLinkModalState, BookingStepReviewLinkModal, BookingStepReviewLinkModalState, BookingStepReviewRequestModal, BookingStepReviewRequestModalState } from './BookingStepMedicalModals';
import { buildBookingStepCellModel } from './bookingStepCellModel';
import BookingStepMatrixCell from './BookingStepMatrixCell';
import BookingStepsToolbar from './BookingStepsToolbar';
import BookingStepsActionFilter from './BookingStepsActionFilter';
import BookingStepActionCheckRow from './BookingStepActionCheckRow';
import { BookingStepGroupHeader, BookingStepRowHeader } from './BookingStepRowHeaders';

const BookingStepsMatrix: React.FC<{ retreatId: string }> = ({ retreatId }) => {
  const location = useLocation();
  const navigate = useNavigate();
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
  const [showRequirementsOnly, setShowRequirementsOnly] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
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
    if (!isFullScreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && setIsFullScreen(false);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isFullScreen]);

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

  const allRows = useMemo(() => buildBookingStepRows(templates, items), [items, templates]);
  const rows = useMemo(() => showRequirementsOnly ? allRows.filter((row) => row.isRequirement) : allRows, [allRows, showRequirementsOnly]);
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
    <div className={isFullScreen ? 'fixed inset-0 z-[1000] flex flex-col gap-4 overflow-hidden bg-gray-100 p-4 sm:p-6' : 'space-y-4'}>
      <BookingStepsToolbar viewMode={viewMode} isEditing={isEditing} isFullScreen={isFullScreen} saving={saving} message={toolbarMessage} showRequirementsOnly={showRequirementsOnly} onShowRequirementsOnly={setShowRequirementsOnly} onViewMode={setViewMode} onUnlock={() => setIsEditing(true)} onSaveAndLock={() => saveAllChanges(true)} onFullScreen={() => setIsFullScreen((current) => !current)} onRefresh={() => loadData()} onGenerate={generateSteps} />

      <div className={`${isFullScreen ? 'min-h-0 flex-1' : 'max-h-[calc(100vh-220px)]'} overflow-auto rounded-lg border border-gray-300 bg-white`}>
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
            {viewMode === 'detail' && <BookingStepActionCheckRow bookings={bookings} options={bookingActionOptions} selected={selectedBookingAction} selectedOption={selectedBookingActionOption} itemMap={itemMap} actionLogMap={actionLogMap} onSelect={setSelectedBookingAction} />}
            {filteredGroupedRows.map((group) => (
              <React.Fragment key={group.key}>
                <>
                <BookingStepGroupHeader group={group} bookingIds={bookings.map(getObjectId)} />
                {group.rows.map((row) => (
                  <tr key={row.key}>
                    <BookingStepRowHeader row={row} number={actionNumberByKey.get(row.key)} group={group} isEditing={isEditing} saving={saving} onEmail={() => sendRowEmail(row)} />
                    {bookings.map((booking) => {
                      const item = itemMap.get(`${getObjectId(booking)}:${row.key}`);
                      const itemActionLogs = item?._id ? actionLogMap.get(item._id) || [] : [];
                      const configuredActions = getConfiguredActions(item);
                      const cellModel = buildBookingStepCellModel({ booking, item, row, itemMap, datePickerDrafts, paymentsByClientId, reviewRequests, reviewRequestsByArtifactId, reviewRequestsByBookingContext, bookingDocumentMap, medicalArtifacts, medicalArtifactById, medicalArtifactsByBookingContext });
                      return (
                        <BookingStepMatrixCell key={`${getObjectId(booking)}:${row.key}`} item={item} row={row} viewMode={viewMode} model={cellModel} actions={configuredActions} logs={itemActionLogs} isEditing={isEditing} saving={saving} note={item?._id ? noteDrafts[item._id] || '' : ''} canRemind={Boolean(item && canSendReminder(item, bookings))}
                          onToggle={() => item && toggleItem(item, getSimpleStepStatus(item).icon !== 'fulfilled')} onStatusChange={(status) => item && updateItemStatus(item, status)}
                          onDateDraftChange={(value) => item?._id && setDatePickerDrafts((current) => ({ ...current, [item._id!]: value }))} onDateCancel={() => item && cancelItemDateDraft(item)} onDateSave={(value) => item && updateItemDate(item, value)} onPaymentChange={(paymentId) => item && selectPaymentForItem(item, paymentId)}
                          onNoteChange={(value) => { if (!item?._id) return; setNoteDrafts((current) => ({ ...current, [item._id!]: value })); setDirtyNoteIds((current) => ({ ...current, [item._id!]: true })); }}
                          onCreateMrr={() => item && openReviewRequestModal(booking, item, row)} onLinkMrr={(action) => item && openExistingReviewRequestLinkModal(booking, item, row, action)} onRunAction={(action) => item && runItemAction(item, action)} onUpload={(action, files) => item && uploadItemDocument(booking, item, action, files)}
                          onReminder={() => item && openReminderPreview(item)} onAutomation={() => item && openReminderAutomation(item)} onLinkArtifact={() => item && cellModel.artifactStepConfig && openArtifactLinkModal(booking, item, row, cellModel.artifactStepConfig)} onOpenDocuments={() => cellModel.relatedBookingDocument?._id && navigate(`/admin/booking-documents?documentId=${encodeURIComponent(cellModel.relatedBookingDocument._id)}`)} />
                      );
                    })}
                  </tr>
                ))}
                </>
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

      {actionFilterOpen && <BookingStepsActionFilter rows={rows} visibleRows={visibleActionFilterRows} draft={actionFilterDraft} search={actionFilterSearch} position={actionFilterPosition} onDraft={setActionFilterDraft} onSearch={setActionFilterSearch} onClose={() => setActionFilterOpen(false)} onApply={(selection) => { setSelectedActionKeys(selection); setActionFilterOpen(false); }} />}
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
