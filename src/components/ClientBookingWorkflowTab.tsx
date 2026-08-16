import React, { useEffect, useMemo, useState } from 'react';
import { FiCheckCircle, FiEdit2, FiExternalLink, FiMail, FiPlus, FiRefreshCw, FiSave, FiUpload } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { bookingDocumentsApi, bookingFlowApi, medicalArtifactsApi } from '../services/api';
import { BookingDocument, BookingFlowAction, BookingFlowActionLog, BookingFlowItem, BookingFlowTemplate, MedicalArtifact } from '../types';
import AppleButton from './AppleButton';
import EmailComposeModal, { EmailComposeInitialValues } from './EmailComposeModal';
import LoadingSpinner from './LoadingSpinner';
import { evidenceReceivedStatuses } from './bookingStatusSelectors';
import {
  getBookingStepColorStyles,
  getBookingStepGroupColor,
  getBookingStepGroupKey,
  getBookingStepToneWithColor,
  titleizeBookingStepGroup,
} from '../utils/bookingStepColors';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => (
  <IconComponent className={className} />
);

const fulfilledStatuses = evidenceReceivedStatuses;

const artifactUploadsByStep: Record<string, {
  artifactType: NonNullable<MedicalArtifact['artifactType']>;
  documentStage: MedicalArtifact['documentStage'];
  documentType: MedicalArtifact['documentType'];
  title: string;
}> = {
  ekg_received: { artifactType: 'ekg', documentStage: 'entry', documentType: 'EKG', title: 'Entry EKG' },
  liver_received: { artifactType: 'liver_panel', documentStage: 'entry', documentType: 'Liver', title: 'Entry Liver Panel' },
};

const bookingDocumentUploadsByStep: Record<string, {
  documentType: string;
  title: string;
}> = {
  contract_signed: { documentType: 'contract', title: 'Signed Contract' },
  contract_received: { documentType: 'contract', title: 'Signed Contract' },
  client_agreement_received: { documentType: 'contract', title: 'Signed Contract' },
  medications_form_initial_received: { documentType: 'medications_form', title: 'Medications Form' },
  medications_form_30_day_received: { documentType: 'medications_form', title: '30-Day Medications Form' },
  questionnaire_received: { documentType: 'questionnaire', title: 'Questionnaire' },
};

const getBookingDocumentTypeForStep = (item: BookingFlowItem) => {
  if (artifactUploadsByStep[item.key]) return '';
  const explicit = bookingDocumentUploadsByStep[item.key]?.documentType;
  return String(
    explicit ||
    item.metadata?.expectedBookingDocument ||
    item.metadata?.expectedDocument ||
    item.metadata?.expectedArtifact ||
    '',
  ).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
};

const getBookingDocumentUploadConfig = (item: BookingFlowItem) => {
  const explicit = bookingDocumentUploadsByStep[item.key];
  if (explicit) return explicit;
  const documentType = getBookingDocumentTypeForStep(item);
  return documentType ? { documentType, title: item.title || documentType.replace(/_/g, ' ') } : undefined;
};

const getObjectId = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

const getRetreatName = (booking: any): string => {
  const retreat = booking?.retreat || booking?.retreatId;
  if (!retreat || typeof retreat === 'string') return 'Retreat';
  return retreat.name || retreat.title || 'Retreat';
};

const getRetreatId = (booking: any): string => getObjectId(booking?.retreat || booking?.retreatId);
const getClientName = (booking: any): string => {
  const client = booking?.client || booking?.clientId || booking?.clientDetails;
  if (!client || typeof client === 'string') return 'Client';
  return [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ') || client.fullName || client.email || 'Client';
};

const formatDateTimeInput = (date?: Date | string | null): string => {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const formatDisplayDate = (date?: Date | string | null): string => {
  if (!date) return 'No date';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'No date';
  return parsed.toLocaleString();
};

const getActionLogDate = (log: BookingFlowActionLog) => log.performedAt || log.createdAt;

const describeActionLog = (log: BookingFlowActionLog) => {
  if (log.actionType === 'deadline_changed') {
    const previousDueDate = formatDisplayDate(log.metadata?.previousDueDate);
    const nextDueDate = formatDisplayDate(log.metadata?.nextDueDate);
    return [
      getActionLogDate(log) ? formatDisplayDate(getActionLogDate(log)) : '',
      `Deadline: ${previousDueDate} -> ${nextDueDate}`,
      log.performedByEmail || '',
    ].filter(Boolean).join(' • ');
  }

  return [
    getActionLogDate(log) ? formatDisplayDate(getActionLogDate(log)) : '',
    log.metadata?.sentEmailDisplayId ? `Email #${log.metadata.sentEmailDisplayId}` : '',
    log.performedByEmail || '',
    log.statusAfter ? `Status: ${String(log.statusAfter).replace(/_/g, ' ')}` : '',
  ].filter(Boolean).join(' • ') || 'Recorded action';
};

const ActionHistoryHover: React.FC<{ logs: BookingFlowActionLog[]; label?: string }> = ({ logs, label = 'History' }) => {
  if (logs.length === 0) return null;
  const sortedLogs = [...logs].sort((a, b) => new Date(getActionLogDate(b) || 0).getTime() - new Date(getActionLogDate(a) || 0).getTime());

  return (
    <span className="group relative inline-flex items-center">
      <button
        type="button"
        className="rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
        title="Hover to see all actions"
      >
        {label} ({logs.length})
      </button>
      <span className="pointer-events-none absolute right-0 top-full z-50 mt-1 hidden w-80 max-w-[80vw] rounded-lg border border-gray-200 bg-white p-3 text-left text-xs text-gray-700 shadow-xl group-hover:block">
        <span className="mb-2 block font-semibold text-gray-900">Action history</span>
        <span className="block max-h-72 space-y-2 overflow-y-auto">
          {sortedLogs.map((log, index) => (
            <span key={log._id || `action-log-${index}`} className="block rounded-md bg-gray-50 p-2">
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

const toIsoFromDateTimeInput = (value: string) => value ? new Date(value).toISOString() : null;

const getActionDateField = (item: BookingFlowItem): keyof BookingFlowItem => {
  const text = `${item.key || ''} ${item.title || ''}`.toLowerCase();
  if (text.includes('received') || text.includes('payment_received') || text.includes('contract_signed')) return 'receivedAt';
  if (text.includes('reviewed') || text.includes('review_result')) return 'reviewedAt';
  if (text.includes('sent') || text.includes('requested')) return 'sentAt';
  return 'completedAt';
};

const getCompletedStatus = (item: BookingFlowItem): BookingFlowItem['status'] => {
  const field = getActionDateField(item);
  if (field === 'sentAt') return item.key.includes('review') ? 'sent_for_review' : 'sent';
  if (field === 'receivedAt') return 'received';
  if (field === 'reviewedAt') return 'reviewed';
  return 'completed';
};

interface ClientBookingWorkflowTabProps {
  bookings: any[];
  hideBookingSelector?: boolean;
}

type StepDraft = {
  checked: boolean;
  dateTime: string;
  dueDate: string;
  notes: string;
};

type StepFilter = 'all' | 'open' | 'completed';

const ClientBookingWorkflowTab: React.FC<ClientBookingWorkflowTabProps> = ({ bookings, hideBookingSelector = false }) => {
  const navigate = useNavigate();
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [items, setItems] = useState<BookingFlowItem[]>([]);
  const [templates, setTemplates] = useState<BookingFlowTemplate[]>([]);
  const [libraryTemplates, setLibraryTemplates] = useState<BookingFlowTemplate[]>([]);
  const [bookingDocuments, setBookingDocuments] = useState<BookingDocument[]>([]);
  const [actionLogsByItem, setActionLogsByItem] = useState<Record<string, BookingFlowActionLog[]>>({});
  const [drafts, setDrafts] = useState<Record<string, StepDraft>>({});
  const [dateTimePickerDrafts, setDateTimePickerDrafts] = useState<Record<string, string>>({});
  const [stepFilter, setStepFilter] = useState<StepFilter>('all');
  const [expandedStepId, setExpandedStepId] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [actionSavingKey, setActionSavingKey] = useState<string | null>(null);
  const [composeState, setComposeState] = useState<{
    item: BookingFlowItem;
    action: BookingFlowAction;
    initialValues: EmailComposeInitialValues;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBookingId && bookings.length > 0) {
      setSelectedBookingId(getObjectId(bookings[0]));
    }
  }, [bookings, selectedBookingId]);

  const selectedBooking = useMemo(
    () => bookings.find((booking) => getObjectId(booking) === selectedBookingId),
    [bookings, selectedBookingId],
  );
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

  const completedCount = items.filter((item) => fulfilledStatuses.has(item.status)).length;
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const soonLimit = todayStart + 7 * 24 * 60 * 60 * 1000;
  const isComplete = (item: BookingFlowItem) => fulfilledStatuses.has(item.status);
  const getDueTime = (item: BookingFlowItem) => {
    if (!item.dueDate) return null;
    const time = new Date(item.dueDate).getTime();
    return Number.isNaN(time) ? null : time;
  };
  const isPastDue = (item: BookingFlowItem) => {
    const dueTime = getDueTime(item);
    return dueTime !== null && dueTime < todayStart && !isComplete(item);
  };
  const isDueSoon = (item: BookingFlowItem) => {
    const dueTime = getDueTime(item);
    return dueTime !== null && dueTime >= todayStart && dueTime <= soonLimit && !isComplete(item);
  };
  const pastDueCount = items.filter(isPastDue).length;
  const filteredItems = items.filter((item) => {
    if (stepFilter === 'open') return !isComplete(item);
    if (stepFilter === 'completed') return isComplete(item);
    return true;
  });

  const getItemId = (item: BookingFlowItem) => item._id || item.key;

  const makeDraft = (item: BookingFlowItem): StepDraft => {
    const dateField = getActionDateField(item);
    const actionDate = item[dateField] as Date | string | null | undefined;
    const checked = Boolean(actionDate) || fulfilledStatuses.has(item.status) || ['sent', 'sent_for_review'].includes(item.status);
    return {
      checked,
      dateTime: checked ? formatDateTimeInput(actionDate || item.completedAt) : '',
      dueDate: formatDateTimeInput(item.dueDate),
      notes: item.notes || '',
    };
  };

  const hydrateDrafts = (nextItems: BookingFlowItem[]) => {
    setDrafts(Object.fromEntries(nextItems.map((item) => [getItemId(item), makeDraft(item)])));
    setDateTimePickerDrafts({});
  };

  const loadItems = async (bookingId = selectedBookingId) => {
    if (!bookingId) return;
    try {
      setLoading(true);
      setError(null);
      const [response, documentsResponse] = await Promise.all([
        bookingFlowApi.getBookingRequirements(bookingId),
        bookingDocumentsApi.getAll({ bookingId }).catch(() => ({ data: [] as BookingDocument[] })),
      ]);
      const nextItems = response.data.items || [];
      setBookingDocuments(documentsResponse.data || []);
      setTemplates(response.data.templates || []);
      setLibraryTemplates(response.data.libraryTemplates || []);
      const logsByItem: Record<string, BookingFlowActionLog[]> = (response.data.actionLogs || []).reduce((acc: Record<string, BookingFlowActionLog[]>, log: BookingFlowActionLog) => {
        const itemId = getObjectId(log.bookingFlowItemId);
        if (!itemId) return acc;
        acc[itemId] = [...(acc[itemId] || []), log];
        return acc;
      }, {});
      Object.values(logsByItem).forEach((logs) => {
        logs.sort((a, b) => new Date(getActionLogDate(b) || 0).getTime() - new Date(getActionLogDate(a) || 0).getTime());
      });
      setActionLogsByItem(logsByItem);

      setItems(nextItems);
      setExpandedStepId((current) => current || (nextItems[0] ? getItemId(nextItems[0]) : ''));
      hydrateDrafts(nextItems);
      setIsEditing(false);
    } catch (err: any) {
      console.error('Failed to load booking workflow', err);
      setError(err?.response?.data?.message || 'Failed to load booking progress');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems(selectedBookingId);
  }, [selectedBookingId]);

  const updateItem = async (item: BookingFlowItem, data: Partial<BookingFlowItem>) => {
    if (!item._id) return;
    try {
      setSavingId(item._id);
      const response = await bookingFlowApi.updateItem(item._id, data);
      setItems((current) => current.map((existing) => (existing._id === item._id ? response.data : existing)));
    } finally {
      setSavingId(null);
    }
  };

  const setDraft = (item: BookingFlowItem, patch: Partial<StepDraft>) => {
    const id = getItemId(item);
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] || makeDraft(item)),
        ...patch,
      },
    }));
  };

  const setActionChecked = (item: BookingFlowItem, checked: boolean) => {
    const current = drafts[getItemId(item)] || makeDraft(item);
    setDraft(item, {
      checked,
      dateTime: checked ? current.dateTime || formatDateTimeInput(new Date()) : '',
    });
    setDateTimePickerDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[getItemId(item)];
      return nextDrafts;
    });
  };

  const setDateTimePickerDraft = (item: BookingFlowItem, value: string) => {
    const id = getItemId(item);
    setDateTimePickerDrafts((current) => ({ ...current, [id]: value }));
  };

  const confirmDateTimePickerDraft = (item: BookingFlowItem) => {
    const id = getItemId(item);
    if (dateTimePickerDrafts[id] === undefined) return;
    setDraft(item, { dateTime: dateTimePickerDrafts[id] });
    setDateTimePickerDrafts((current) => {
      const nextDrafts = { ...current };
      delete nextDrafts[id];
      return nextDrafts;
    });
  };

  const cancelDateTimePickerDraft = (item: BookingFlowItem) => {
    const id = getItemId(item);
    setDateTimePickerDrafts((current) => {
      const nextDrafts = { ...current };
      delete nextDrafts[id];
      return nextDrafts;
    });
  };

  const saveDrafts = async () => {
    try {
      setSavingId('all');
      setError(null);
      const updatedItems: BookingFlowItem[] = [];
      for (const item of items) {
        if (!item._id) continue;
        const draft = drafts[getItemId(item)] || makeDraft(item);
        const dateField = getActionDateField(item);
        const isoValue = draft.checked ? toIsoFromDateTimeInput(draft.dateTime) || new Date().toISOString() : null;
        const originalDueDate = formatDateTimeInput(item.dueDate);
        const dueDateChanged = draft.dueDate !== originalDueDate;
        const patch = draft.checked
          ? {
              status: getCompletedStatus(item),
              [dateField]: isoValue,
              completedAt: isoValue,
              notes: draft.notes,
            }
          : {
              status: 'pending',
              [dateField]: null,
              completedAt: null,
              notes: draft.notes,
            };
        if (dueDateChanged) {
          (patch as Partial<BookingFlowItem>).dueDate = toIsoFromDateTimeInput(draft.dueDate);
          (patch as Partial<BookingFlowItem>).dueDateManuallyOverridden = true;
        }
        const response = await bookingFlowApi.updateItem(item._id, patch as Partial<BookingFlowItem>);
        updatedItems.push(response.data);
      }
      setItems((current) => current.map((item) => updatedItems.find((updated) => updated._id === item._id) || item));
      hydrateDrafts(updatedItems.length === items.length ? updatedItems : items);
      setIsEditing(false);
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || saveError?.message || 'Unable to save booking steps.');
    } finally {
      setSavingId(null);
    }
  };

  const cancelEditing = () => {
    hydrateDrafts(items);
    setDateTimePickerDrafts({});
    setIsEditing(false);
  };

  const addStep = async () => {
    const title = window.prompt('Name this booking step');
    if (!title?.trim() || !selectedBookingId) return;
    try {
      setSavingId('new');
      await bookingFlowApi.createItem({
        bookingId: selectedBookingId,
        title: title.trim(),
        category: 'other',
        order: (items.at(-1)?.order || 0) + 10,
        offsetDays: 0,
        status: 'pending',
      });
      await loadItems(selectedBookingId);
      setIsEditing(true);
    } catch (addError: any) {
      setError(addError?.response?.data?.message || addError?.message || 'Unable to add this booking step.');
    } finally {
      setSavingId(null);
    }
  };

  const uploadStepArtifact = async (item: BookingFlowItem, files: FileList | null) => {
    if (!files?.length || !selectedBooking) return;
    const config = artifactUploadsByStep[item.key];
    const documentConfig = getBookingDocumentUploadConfig(item);
    if ((!config && !documentConfig) || !item._id) return;

    const clientId = getObjectId(selectedBooking.clientId || item.clientId);
    const retreatId = getRetreatId(selectedBooking) || getObjectId(item.retreatId);
    if (!clientId) {
      setError('This booking step cannot upload a document because the booking has no client ID.');
      return;
    }

    setUploadingId(item._id);
    setError(null);
    try {
      const fileArray = Array.from(files);
      if (documentConfig) {
        const createdDocument = await bookingDocumentsApi.create({
          bookingId: selectedBookingId,
          clientId,
          retreatId,
          documentType: documentConfig.documentType,
          title: documentConfig.title,
          description: `${documentConfig.title} linked to booking ${selectedBooking.bookingNumber || selectedBookingId}.`,
          bookingFlowItemId: item._id,
          metadata: {
            bookingNumber: selectedBooking.bookingNumber,
            bookingFlowItemKey: item.key,
          },
        });

        if (createdDocument.data._id) {
          try {
            await bookingDocumentsApi.uploadFiles(createdDocument.data._id, fileArray);
          } catch (uploadError) {
            await bookingDocumentsApi.delete(createdDocument.data._id).catch((rollbackError) => {
              console.error('Error rolling back empty booking document:', rollbackError);
            });
            throw uploadError;
          }
        }

        await updateItem(item, {
          status: 'received',
          receivedAt: new Date().toISOString(),
          metadata: {
            ...(item.metadata || {}),
            latestBookingDocumentId: createdDocument.data._id,
            latestBookingDocumentDisplayId: createdDocument.data.display_id,
            latestFileName: fileArray[0]?.name,
          },
        } as Partial<BookingFlowItem>);
        return;
      }

      const created = await medicalArtifactsApi.create({
        clientId,
        retreatId,
        bookingId: selectedBookingId,
        artifactType: config.artifactType,
        documentStage: config.documentStage,
        documentType: config.documentType,
        title: fileArray[0]?.name || config.title,
        description: `${config.title} linked to booking ${selectedBooking.bookingNumber || selectedBookingId}.`,
        contextType: 'booking',
        purpose: 'booking_requirement',
        source: 'admin_upload',
        status: 'stored',
        data: {
          bookingId: selectedBookingId,
          bookingNumber: selectedBooking.bookingNumber,
          bookingFlowItemId: item._id,
          bookingFlowItemKey: item.key,
        },
        tags: [
          'booking-requirement',
          item.key,
          selectedBooking.bookingNumber ? `booking-${selectedBooking.bookingNumber}` : '',
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

      await updateItem(item, {
        status: 'received',
        receivedAt: new Date().toISOString(),
        metadata: {
          ...(item.metadata || {}),
          latestArtifactId: created.data._id,
          latestArtifactDisplayId: created.data.display_id,
          latestFileName: fileArray[0]?.name,
        },
      } as Partial<BookingFlowItem>);
    } catch (uploadError: any) {
      setError(uploadError?.response?.data?.message || uploadError?.message || 'Unable to upload booking step file.');
    } finally {
      setUploadingId(null);
    }
  };

  const getConfiguredActions = (item: BookingFlowItem): BookingFlowAction[] => {
    const template = typeof item.templateId === 'object'
      ? item.templateId
      : templateMap.get(getObjectId(item.templateId)) || templateMap.get(item.key) || null;
    const libraryTemplate = libraryTemplateMap.get(item.key) || null;
    const configured = Array.isArray(item.actions) && item.actions.length > 0
      ? item.actions
      : Array.isArray(item.metadata?.actions) && (item.metadata?.actions?.length || 0) > 0
        ? (item.metadata?.actions as BookingFlowAction[])
        : Array.isArray(template?.actions) && (template?.actions?.length || 0) > 0
          ? template?.actions || []
          : Array.isArray(libraryTemplate?.actions)
            ? libraryTemplate?.actions || []
            : [];
    const actions = configured.filter((action) => action.active !== false);
    const fallbackEmailTemplateId = item.emailTemplateId || template?.emailTemplateId || libraryTemplate?.emailTemplateId;
    const hasLegacyEmail = Boolean((item.emailEnabled || template?.emailEnabled || libraryTemplate?.emailEnabled) && fallbackEmailTemplateId);
    if (hasLegacyEmail && !actions.some((action) => action.type === 'email' && action.emailTemplateId)) {
      actions.unshift({
        key: 'default_email',
        label: 'Send email',
        type: 'email',
        emailTemplateId: fallbackEmailTemplateId,
        statusAfterSuccess: 'sent',
        allowRepeat: true,
        openComposer: true,
        order: -1,
      });
    }
    return actions.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  };

  const interpolateActionUrl = (template: string, variables: Record<string, any> = {}) => {
    return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, path) => {
      const value = String(path).split('.').reduce((current: any, key: string) => current?.[key], variables);
      return encodeURIComponent(value ?? '');
    });
  };

  const runItemAction = async (item: BookingFlowItem, action: BookingFlowAction) => {
    if (!item._id) return;
    if (action.type === 'link_mrr') return;
    const savingKey = `${item._id}:${action.key}`;
    setActionSavingKey(savingKey);
    setError(null);
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
      await loadItems(selectedBookingId);
    } catch (actionError: any) {
      console.error('Error running booking step action:', actionError);
      setError(actionError?.response?.data?.message || actionError?.message || 'Unable to run booking step action.');
    } finally {
      setActionSavingKey(null);
    }
  };

  const handleComposedEmailSent = async (sentEmail: any) => {
    if (!composeState?.item?._id || !sentEmail?._id) return;
    await bookingFlowApi.recordItemEmailSent(composeState.item._id, sentEmail._id, composeState.action.key);
    setComposeState(null);
    await loadItems(selectedBookingId);
  };

  if (bookings.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <Icon icon={FiCheckCircle} className="mx-auto h-10 w-10 text-gray-400" />
        <h3 className="mt-3 text-sm font-medium text-gray-900">No booking steps yet</h3>
        <p className="mt-1 text-sm text-gray-500">Create or link a booking before tracking booking steps.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24">
      <div className="sticky top-0 z-30 -mx-1 border-b border-gray-900 bg-white/95 px-4 pb-4 pt-4 backdrop-blur supports-[backdrop-filter]:bg-white/90 md:px-8 md:pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Booking #{selectedBooking?.bookingNumber || selectedBookingId.slice(-6)} · {getRetreatName(selectedBooking)}</div>
            <h2 className="text-2xl font-extrabold tracking-tight text-gray-950 md:text-3xl">Booking steps</h2>
            <p className="mt-1 truncate text-sm text-gray-600">{getClientName(selectedBooking)} · marked by admin as each step completes.</p>
          </div>
          <div className="flex shrink-0 gap-5 text-right">
            <div><div className="text-2xl font-black leading-none text-gray-950">{completedCount}/{items.length}</div><div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-gray-500">Complete</div></div>
            {pastDueCount > 0 && <div><div className="text-2xl font-black leading-none text-red-700">{pastDueCount}</div><div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-gray-500">Past due</div></div>}
          </div>
        </div>
        <div className="mt-5 flex h-1 gap-1" aria-label={`${progressPercent}% complete`}>
          {items.map((item) => <span key={getItemId(item)} className={`min-w-0 flex-1 ${isComplete(item) ? 'bg-green-700' : isPastDue(item) ? 'bg-red-700' : 'bg-gray-300'}`} />)}
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {([['all', 'All'], ['open', 'Outstanding'], ['completed', 'Done']] as Array<[StepFilter, string]>).map(([key, label]) => <button key={key} type="button" onClick={() => setStepFilter(key)} className={`border px-4 py-2 text-sm font-bold ${stepFilter === key ? 'border-cyan-700 bg-cyan-700 text-white' : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'}`}>{label}</button>)}
          </div>
          <div className="flex items-center gap-2">
            {!hideBookingSelector && (
            <select
              value={selectedBookingId}
              onChange={(event) => setSelectedBookingId(event.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {bookings.map((booking) => {
                const id = getObjectId(booking);
                return (
                  <option key={id} value={id}>
                    {getRetreatName(booking)} {booking?.bookingNumber ? `#${booking.bookingNumber}` : id.slice(-6)}
                  </option>
                );
              })}
            </select>
            )}
            <AppleButton onClick={() => loadItems()} variant="ghost" className="px-3 py-2">
              <Icon icon={FiRefreshCw} className="mr-2 h-4 w-4" />
              Refresh
            </AppleButton>
            <span className="text-xs text-gray-500">{filteredItems.length} of {items.length} steps shown</span>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 flex min-h-[72px] items-center justify-end gap-3 border-t border-gray-300 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur md:left-auto md:right-6 md:w-[min(1160px,calc(100%-3rem))]">
        <span className="mr-auto hidden text-sm text-gray-600 sm:block">
          {completedCount} of {items.length} steps complete · {items.length - completedCount} outstanding
        </span>
        {isEditing ? (
          <>
            <AppleButton onClick={addStep} variant="ghost" className="px-3 py-2" disabled={Boolean(savingId)}>
              <Icon icon={FiPlus} className="mr-2 h-4 w-4" />
              Add step
            </AppleButton>
            <AppleButton onClick={cancelEditing} variant="ghost" className="px-3 py-2" disabled={savingId === 'all'}>
              Cancel
            </AppleButton>
            <AppleButton onClick={saveDrafts} variant="primary" className="min-w-[138px] px-4 py-2" disabled={savingId === 'all'}>
              <Icon icon={FiSave} className="mr-2 h-4 w-4" />
              {savingId === 'all' ? 'Saving...' : 'Save changes'}
            </AppleButton>
          </>
        ) : (
          <AppleButton onClick={() => setIsEditing(true)} variant="secondary" className="rounded-full px-5 py-2">
            <Icon icon={FiEdit2} className="mr-2 h-4 w-4" />
            Edit
          </AppleButton>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {items.length === 0 ? (
            <div className="bg-gray-50 p-8 text-center text-sm text-gray-500">
              No booking steps were generated for this booking.
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-gray-50 p-8 text-center text-sm text-gray-500">
              No booking steps match this filter.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredItems.map((item) => {
                const id = item._id || item.key;
                const draft = drafts[id] || makeDraft(item);
                const isChecked = draft.checked;
                const uploadConfig = artifactUploadsByStep[item.key] || getBookingDocumentUploadConfig(item);
                const overdue = isPastDue(item);
                const dueSoon = isDueSoon(item);
                const groupKey = getBookingStepGroupKey(item);
                const tone = getBookingStepToneWithColor(groupKey, getBookingStepGroupColor(item));
                const stepStyle = getBookingStepColorStyles(tone, 'step');
                const dotStyle = getBookingStepColorStyles(tone, 'dot');
                const linkedArtifactId = item.metadata?.latestArtifactId || item.metadata?.linkedMedicalArtifactId;
                const linkedArtifactDisplayId = item.metadata?.latestArtifactDisplayId || item.metadata?.linkedMedicalArtifactDisplayId;
                const linkedBookingDocumentId = item.metadata?.latestBookingDocumentId;
                const linkedBookingDocumentDisplayId = item.metadata?.latestBookingDocumentDisplayId;
                const documentTypeForStep = getBookingDocumentTypeForStep(item);
                const relatedBookingDocument = documentTypeForStep
                  ? [...bookingDocuments]
                      .filter((document) => String(document.documentType || '').toLowerCase() === documentTypeForStep && (document.files || []).length > 0)
                      .sort((a, b) => new Date(b.receivedAt || b.createdAt || 0).getTime() - new Date(a.receivedAt || a.createdAt || 0).getTime())[0]
                  : undefined;
                const configuredActions = getConfiguredActions(item);
                const uploadAction = configuredActions.find((action) => action.type === 'upload');
                const visibleActions = configuredActions.filter((action) => action.type !== 'upload' && action.type !== 'link_mrr');
                const itemActionLogs = item._id ? (actionLogsByItem[item._id] || []) : [];
                const deadlineLogs = itemActionLogs.filter((log) => log.actionType === 'deadline_changed');
                const dateTimePickerDraft = dateTimePickerDrafts[id];
                const hasPendingDateTime = dateTimePickerDraft !== undefined && dateTimePickerDraft !== draft.dateTime;
                const isExpanded = expandedStepId === id;

                return (
                  <div
                    key={id}
                    className={`grid cursor-pointer gap-3 border-l-4 p-4 md:cursor-default md:px-8 ${tone.stepStripe} ${isChecked ? 'bg-green-50/80' : overdue ? 'bg-red-50/80' : dueSoon ? 'bg-amber-50/80' : tone.stepCell}`}
                    style={!isChecked && !overdue && !dueSoon ? stepStyle : undefined}
                    onClick={(event) => {
                      if (window.innerWidth >= 768 || isEditing || (event.target as HTMLElement).closest('button,input,a,textarea,select')) return;
                      setExpandedStepId(isExpanded ? '' : id);
                    }}
                  >
                    <div className="grid gap-4 lg:grid-cols-[minmax(300px,1fr)_minmax(330px,430px)] lg:items-center">
                      <label className="flex min-w-0 items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!isEditing || savingId === 'all'}
                          onChange={(event) => setActionChecked(item, event.target.checked)}
                          className="mt-0.5 h-6 w-6 rounded-none border-gray-400 text-green-700 focus:ring-green-600"
                        />
                        <span className="min-w-0">
                          <span className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className={`hidden h-2.5 w-2.5 flex-none rounded-full md:inline-block ${tone.dot}`} style={dotStyle} />
                            <span className={`block truncate text-sm font-semibold ${isChecked ? 'text-green-900' : 'text-gray-950'}`}>
                              {item.title}
                            </span>
                            <span className={`border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${isChecked ? 'border-green-700 text-green-800' : overdue ? 'border-red-600 text-red-700' : 'border-gray-400 text-gray-600'}`}>{isChecked ? 'Done' : 'Outstanding'}</span>
                          </span>
                          <span className="block truncate text-xs text-gray-500">
                            {titleizeBookingStepGroup(groupKey)} • {item.dueDate ? `Due ${formatDisplayDate(item.dueDate)}` : item.category}
                            {item.dueDateManuallyOverridden ? ' • Manual deadline' : ''}
                            {overdue ? ' • Past due' : dueSoon ? ' • Due soon' : ''}
                            {item.metadata?.latestFileName ? ` • ${item.metadata.latestFileName}` : ''}
                          </span>
                          {deadlineLogs.length > 0 && (
                            <span className="mt-1 block">
                              <ActionHistoryHover logs={deadlineLogs} label="Deadline changes" />
                            </span>
                          )}
                        </span>
                      </label>
                      <div className={`${isExpanded ? 'grid' : 'hidden'} grid-cols-2 gap-4 md:grid`}>
                        <label className="grid min-w-0 gap-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Due date</span>
                          {isEditing ? <input
                            type="datetime-local"
                            value={draft.dueDate}
                            disabled={!isEditing || savingId === 'all'}
                            onChange={(event) => setDraft(item, { dueDate: event.target.value })}
                            className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            title="Booking step due date"
                          /> : <span className="truncate text-sm text-gray-900">{formatDisplayDate(item.dueDate)}</span>}
                        </label>
                        <label className="grid min-w-0 gap-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Actioned</span>
                          {isEditing ? <input
                            type="datetime-local"
                            value={dateTimePickerDraft ?? draft.dateTime}
                            disabled={!isEditing || !isChecked || savingId === 'all'}
                            onChange={(event) => setDateTimePickerDraft(item, event.target.value)}
                            className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            title={isChecked ? 'Action date and time' : 'Check this action before setting the completion date'}
                          /> : <span className="truncate text-sm text-gray-900">{draft.dateTime ? formatDisplayDate(draft.dateTime) : '—'}</span>}
                        </label>
                        {hasPendingDateTime && (
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => cancelDateTimePickerDraft(item)}
                              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => confirmDateTimePickerDraft(item)}
                              className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                            >
                              OK
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={`${isExpanded ? 'grid' : 'hidden'} gap-2 md:grid lg:grid-cols-[1fr_auto] lg:items-center`}>
                      {isEditing ? <textarea
                        value={draft.notes}
                        disabled={!isEditing || savingId === 'all'}
                        onChange={(event) => setDraft(item, { notes: event.target.value })}
                        rows={1}
                        className="min-h-[36px] w-full resize-y rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Internal note"
                      /> : <div className="min-h-[24px] whitespace-pre-wrap px-2.5 text-sm text-gray-700">{draft.notes || 'Internal note'}</div>}
                      <div className="flex items-center gap-2 lg:justify-end">
                        {visibleActions.map((action) => {
                          const savingKey = `${item._id}:${action.key}`;
                          const actionLogs = itemActionLogs.filter((log) => (log.actionKey || 'default_email') === action.key);
                          return (
                            <span key={action.key} className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                disabled={actionSavingKey === savingKey || savingId === 'all'}
                                onClick={() => runItemAction(item, action)}
                                className="inline-flex items-center rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-white"
                                title={action.type}
                              >
                                {action.type === 'email' && <Icon icon={FiMail} className="mr-2 h-4 w-4" />}
                                {actionSavingKey === savingKey ? 'Loading...' : action.label}
                              </button>
                              <ActionHistoryHover logs={actionLogs} />
                            </span>
                          );
                        })}
                        {linkedArtifactId && (
                          <button
                            type="button"
                            className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            onClick={() => navigate(`/medical-artifacts/${linkedArtifactId}`)}
                          >
                            <Icon icon={FiExternalLink} className="mr-2 h-4 w-4" />
                            Artifact {linkedArtifactDisplayId ? `#${linkedArtifactDisplayId}` : ''}
                          </button>
                        )}
                        {(linkedBookingDocumentId || relatedBookingDocument?._id) && (
                          <button
                            type="button"
                            className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
                            onClick={() => navigate(`/booking-documents`)}
                          >
                            <Icon icon={FiExternalLink} className="mr-2 h-4 w-4" />
                            Document #{linkedBookingDocumentDisplayId || relatedBookingDocument?.display_id || 'linked'}
                          </button>
                        )}
                        {(uploadConfig || uploadAction) && (
                          <label className="inline-flex cursor-pointer items-center rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50">
                            <Icon icon={FiUpload} className="mr-2 h-4 w-4" />
                            {uploadingId === item._id ? 'Uploading...' : uploadAction?.label || 'Upload'}
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic,.heif"
                              multiple
                              disabled={Boolean(uploadingId)}
                              onChange={(event) => {
                                uploadStepArtifact(item, event.target.files);
                                event.target.value = '';
                              }}
                            />
                          </label>
                        )}
                        {savingId === item._id && <span className="text-xs text-blue-700">Saving...</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {composeState && (
        <EmailComposeModal
          title={composeState.action.label || 'Send booking step email'}
          initialValues={composeState.initialValues}
          extraContent={
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              <div className="font-medium">{composeState.item.title}</div>
              <div className="mt-1 text-xs">
                Requested language: {composeState.initialValues.variables?.client?.language || composeState.initialValues.variables?.clientLanguage || 'default'}
              </div>
            </div>
          }
          onClose={() => {
            setComposeState(null);
            setActionSavingKey(null);
          }}
          onSent={handleComposedEmailSent}
        />
      )}
    </div>
  );
};

export default ClientBookingWorkflowTab;
