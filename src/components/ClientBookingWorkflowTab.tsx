import React, { useEffect, useMemo, useState } from 'react';
import { FiCheckCircle, FiEdit2, FiExternalLink, FiMail, FiRefreshCw, FiSave, FiUpload } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { bookingDocumentsApi, bookingFlowApi, medicalArtifactsApi } from '../services/api';
import { BookingFlowAction, BookingFlowActionLog, BookingFlowItem, BookingFlowTemplate, MedicalArtifact } from '../types';
import AppleButton from './AppleButton';
import EmailComposeModal, { EmailComposeInitialValues } from './EmailComposeModal';
import LoadingSpinner from './LoadingSpinner';
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

const fulfilledStatuses = new Set<BookingFlowItem['status']>(['received', 'reviewed', 'approved', 'caution', 'completed']);

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
  ekg_received: { documentType: 'ekg', title: 'Entry EKG' },
  liver_received: { documentType: 'liver_panel', title: 'Entry Liver Panel' },
  medications_form_initial_received: { documentType: 'medications_form', title: 'Medications Form' },
  medications_form_30_day_received: { documentType: 'medications_form', title: '30-Day Medications Form' },
  questionnaire_received: { documentType: 'questionnaire', title: 'Questionnaire' },
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
  notes: string;
};

type StepFilter = 'all' | 'past_due' | 'due_soon' | 'open' | 'completed';

const ClientBookingWorkflowTab: React.FC<ClientBookingWorkflowTabProps> = ({ bookings, hideBookingSelector = false }) => {
  const navigate = useNavigate();
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [items, setItems] = useState<BookingFlowItem[]>([]);
  const [templates, setTemplates] = useState<BookingFlowTemplate[]>([]);
  const [libraryTemplates, setLibraryTemplates] = useState<BookingFlowTemplate[]>([]);
  const [actionLogsByItem, setActionLogsByItem] = useState<Record<string, BookingFlowActionLog[]>>({});
  const [drafts, setDrafts] = useState<Record<string, StepDraft>>({});
  const [stepFilter, setStepFilter] = useState<StepFilter>('all');
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
  const dueSoonCount = items.filter(isDueSoon).length;
  const filteredItems = items.filter((item) => {
    if (stepFilter === 'past_due') return isPastDue(item);
    if (stepFilter === 'due_soon') return isDueSoon(item);
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
      notes: item.notes || '',
    };
  };

  const hydrateDrafts = (nextItems: BookingFlowItem[]) => {
    setDrafts(Object.fromEntries(nextItems.map((item) => [getItemId(item), makeDraft(item)])));
  };

  const loadItems = async (bookingId = selectedBookingId) => {
    if (!bookingId) return;
    try {
      setLoading(true);
      setError(null);
      const generated = await bookingFlowApi.generateForBooking(bookingId);
      let nextItems = generated.data || [];
      if (nextItems.length === 0) {
        const response = await bookingFlowApi.getItems({ bookingId });
        nextItems = response.data || [];
      }
      const retreatId = getRetreatId(selectedBooking) || getObjectId(nextItems[0]?.retreatId);
      if (retreatId) {
        const [templateResponse, libraryTemplateResponse] = await Promise.all([
          bookingFlowApi.getTemplates(retreatId),
          bookingFlowApi.getLibraryTemplates().catch(() => ({ data: [] as BookingFlowTemplate[] })),
        ]);
        setTemplates(templateResponse.data || []);
        setLibraryTemplates(libraryTemplateResponse.data || []);
      } else {
        setTemplates([]);
        setLibraryTemplates([]);
      }

      setItems(nextItems);
      const logEntries = await Promise.all(
        nextItems
          .filter((item: BookingFlowItem) => item._id)
          .map(async (item: BookingFlowItem) => {
            try {
              const logsResponse = await bookingFlowApi.getItemActionLogs(item._id!);
              const logs = [...(logsResponse.data || [])].sort((a, b) => new Date(getActionLogDate(b) || 0).getTime() - new Date(getActionLogDate(a) || 0).getTime());
              return [item._id!, logs] as const;
            } catch {
              return [item._id!, []] as const;
            }
          })
      );
      setActionLogsByItem(Object.fromEntries(logEntries));
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
    setIsEditing(false);
  };

  const uploadStepArtifact = async (item: BookingFlowItem, files: FileList | null) => {
    if (!files?.length || !selectedBooking) return;
    const config = artifactUploadsByStep[item.key];
    const documentConfig = bookingDocumentUploadsByStep[item.key];
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
    <div className="space-y-5">
      <div className="sticky top-0 z-30 -mx-1 rounded-b-xl border-b border-gray-200 bg-white/95 px-1 pb-3 pt-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Booking Requirements</h2>
            <p className="mt-1 text-sm text-gray-500">Track each booking action with a checkbox, timestamp, and notes.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
            {isEditing ? (
              <>
                <AppleButton onClick={cancelEditing} variant="ghost" className="px-3 py-2" disabled={savingId === 'all'}>
                  Cancel
                </AppleButton>
                <AppleButton onClick={saveDrafts} variant="primary" className="px-3 py-2" disabled={savingId === 'all'}>
                  <Icon icon={FiSave} className="mr-2 h-4 w-4" />
                  {savingId === 'all' ? 'Saving...' : 'Save'}
                </AppleButton>
              </>
            ) : (
              <AppleButton onClick={() => setIsEditing(true)} variant="secondary" className="px-3 py-2">
                <Icon icon={FiEdit2} className="mr-2 h-4 w-4" />
                Edit
              </AppleButton>
            )}
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">{completedCount} of {items.length} complete</span>
            <span className="text-gray-500">{progressPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100">
            <div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
          {selectedBooking && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span>{getRetreatName(selectedBooking)} {selectedBooking?.status ? `- ${selectedBooking.status}` : ''}</span>
              {pastDueCount > 0 && <span className="rounded-full bg-red-100 px-2 py-1 font-semibold text-red-700">{pastDueCount} past due</span>}
              {dueSoonCount > 0 && <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-700">{dueSoonCount} due soon</span>}
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {([
            ['all', `All (${items.length})`],
            ['past_due', `Past due (${pastDueCount})`],
            ['due_soon', `Due soon (${dueSoonCount})`],
            ['open', `Open (${items.length - completedCount})`],
            ['completed', `Completed (${completedCount})`],
          ] as Array<[StepFilter, string]>).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStepFilter(key)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                stepFilter === key
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
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
                const uploadConfig = artifactUploadsByStep[item.key] || bookingDocumentUploadsByStep[item.key];
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
                const configuredActions = getConfiguredActions(item);
                const uploadAction = configuredActions.find((action) => action.type === 'upload');
                const visibleActions = configuredActions.filter((action) => action.type !== 'upload');
                const itemActionLogs = item._id ? (actionLogsByItem[item._id] || []) : [];

                return (
                  <div key={id} className={`grid gap-2 border-l-4 p-3 ${tone.stepStripe} ${isChecked ? 'bg-green-50/60' : overdue ? 'bg-red-50/70' : dueSoon ? 'bg-amber-50/70' : tone.stepCell}`} style={!isChecked && !overdue && !dueSoon ? stepStyle : undefined}>
                    <div className="grid gap-2 lg:grid-cols-[minmax(240px,1fr)_minmax(210px,260px)] lg:items-center">
                      <label className="flex min-w-0 items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!isEditing || savingId === 'all'}
                          onChange={(event) => setActionChecked(item, event.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="min-w-0">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className={`h-2.5 w-2.5 flex-none rounded-full ${tone.dot}`} style={dotStyle} />
                            <span className={`block truncate text-sm font-semibold ${isChecked ? 'text-green-900' : 'text-gray-950'}`}>
                              {item.title}
                            </span>
                          </span>
                          <span className="block truncate text-xs text-gray-500">
                            {titleizeBookingStepGroup(groupKey)} • {item.dueDate ? `Due ${formatDisplayDate(item.dueDate)}` : item.category}
                            {overdue ? ' • Past due' : dueSoon ? ' • Due soon' : ''}
                            {item.metadata?.latestFileName ? ` • ${item.metadata.latestFileName}` : ''}
                          </span>
                        </span>
                      </label>
                      <input
                        type="datetime-local"
                        value={draft.dateTime}
                        disabled={!isEditing || !isChecked || savingId === 'all'}
                        onChange={(event) => setDraft(item, { dateTime: event.target.value })}
                        className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        title={isChecked ? 'Action date and time' : 'Check this action before setting the completion date'}
                      />
                    </div>

                    <div className="grid gap-2 lg:grid-cols-[1fr_auto] lg:items-center">
                      <textarea
                        value={draft.notes}
                        disabled={!isEditing || savingId === 'all'}
                        onChange={(event) => setDraft(item, { notes: event.target.value })}
                        rows={1}
                        className="min-h-[36px] w-full resize-y rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Internal note"
                      />
                      <div className="flex items-center gap-2 lg:justify-end">
                        {visibleActions.map((action) => {
                          const savingKey = `${item._id}:${action.key}`;
                          const actionLogs = itemActionLogs.filter((log) => (log.actionKey || 'default_email') === action.key);
                          return (
                            <span key={action.key} className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                disabled={!isEditing || actionSavingKey === savingKey || savingId === 'all'}
                                onClick={() => runItemAction(item, action)}
                                className="inline-flex items-center rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-white"
                                title={isEditing ? action.type : 'Unlock editing to run actions'}
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
                        {linkedBookingDocumentId && (
                          <span className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700">
                            <Icon icon={FiExternalLink} className="mr-2 h-4 w-4" />
                            Document {linkedBookingDocumentDisplayId ? `#${linkedBookingDocumentDisplayId}` : ''}
                          </span>
                        )}
                        {(uploadConfig || uploadAction) && (
                          <label className={`inline-flex items-center rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-sm font-medium ${isEditing ? 'cursor-pointer text-blue-700 hover:bg-blue-50' : 'cursor-not-allowed text-gray-400'}`}>
                            <Icon icon={FiUpload} className="mr-2 h-4 w-4" />
                            {uploadingId === item._id ? 'Uploading...' : uploadAction?.label || 'Upload'}
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic,.heif"
                              multiple
                              disabled={!isEditing || Boolean(uploadingId)}
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
