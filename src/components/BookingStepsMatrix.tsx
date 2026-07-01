import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, Lock, Mail, RefreshCw, RotateCcw, Save, Unlock, X } from 'lucide-react';
import { bookingFlowApi, clientsApi, communicationsApi } from '../services/api';
import { BookingFlowAction, BookingFlowActionLog, BookingFlowItem, BookingFlowTemplate, Client } from '../types';
import LoadingSpinner from './LoadingSpinner';
import EmailComposeModal, { EmailComposeInitialValues } from './EmailComposeModal';
import {
  getBookingStepColorStyles,
  getBookingStepToneWithColor,
  titleizeBookingStepGroup,
} from '../utils/bookingStepColors';

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

const ClientAvatar: React.FC<{ client: Client | null; name: string }> = ({ client, name }) => {
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

  if (!hasProfilePicture) return null;

  return (
    <span className="mr-2 inline-flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100 text-sm font-semibold text-gray-600">
      {profilePictureUrl ? (
        <img src={profilePictureUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{name.charAt(0).toUpperCase()}</span>
      )}
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

const formatDateInput = (value?: Date | string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

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
      className: 'bg-red-50 text-red-700',
      icon: <X className="h-5 w-5" />,
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
      icon: <CheckCircle2 className="h-5 w-5" />,
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
  const [bookings, setBookings] = useState<any[]>([]);
  const [templates, setTemplates] = useState<BookingFlowTemplate[]>([]);
  const [items, setItems] = useState<BookingFlowItem[]>([]);
  const [actionLogs, setActionLogs] = useState<BookingFlowActionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [viewMode, setViewMode] = useState<'detail' | 'simple'>('detail');
  const [isEditing, setIsEditing] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [dirtyNoteIds, setDirtyNoteIds] = useState<Record<string, true>>({});
  const [composeState, setComposeState] = useState<{
    item: BookingFlowItem;
    action?: BookingFlowAction;
    initialValues: EmailComposeInitialValues;
  } | null>(null);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await bookingFlowApi.getMatrix(retreatId);
      setBookings(response.data?.bookings || []);
      setTemplates(response.data?.templates || []);
      setItems(response.data?.items || []);
      setActionLogs(response.data?.actionLogs || []);
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
  }, [isEditing, items]);

  const generateSteps = async () => {
    setSaving('generate');
    try {
      await communicationsApi.seedDefaultTemplates();
      await bookingFlowApi.seedLibraryTemplates();
      await bookingFlowApi.seedTemplates(retreatId);
      await bookingFlowApi.generateForRetreat(retreatId);
      await loadData(false);
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

  const actionLogMap = useMemo(() => {
    const map = new Map<string, BookingFlowActionLog[]>();
    actionLogs.forEach((log) => {
      const itemId = getObjectId(log.bookingFlowItemId);
      if (!itemId) return;
      const current = map.get(itemId) || [];
      current.push(log);
      map.set(itemId, current);
    });
    return map;
  }, [actionLogs]);

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

  const saveAllAndLock = async () => {
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
      setIsEditing(false);
    } finally {
      setSaving('');
    }
  };

  const cancelEditing = async () => {
    setIsEditing(false);
    setDirtyNoteIds({});
    await loadData(false);
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
      await loadData(false);
    } finally {
      setSaving('');
    }
  };

  const getConfiguredActions = (item?: BookingFlowItem): BookingFlowAction[] => {
    if (!item) return [];
    const template = typeof item.templateId === 'object'
      ? item.templateId
      : templateMap.get(getObjectId(item.templateId)) || templateMap.get(item.key) || null;
    const configured = Array.isArray(item.actions) && item.actions.length > 0
      ? item.actions
      : Array.isArray(item.metadata?.actions) && (item.metadata?.actions?.length || 0) > 0
        ? (item.metadata?.actions as BookingFlowAction[])
        : Array.isArray(template?.actions)
          ? template?.actions || []
          : [];
    const actions = configured.filter((action) => action.active !== false);
    const fallbackEmailTemplateId = item.emailTemplateId || template?.emailTemplateId;
    const hasLegacyEmail = Boolean((item.emailEnabled || template?.emailEnabled) && fallbackEmailTemplateId);
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

  const runItemAction = async (item: BookingFlowItem | undefined, action: BookingFlowAction) => {
    if (!item?._id) return;
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

  const handleComposedEmailSent = async (sentEmail: any) => {
    if (!composeState?.item?._id || !sentEmail?._id) return;
    await bookingFlowApi.recordItemEmailSent(composeState.item._id, sentEmail._id, composeState.action?.key);
    await loadData(false);
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
                ? 'Editing is unlocked. Save and lock when you are done changing readiness.'
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
          {viewMode === 'detail' && (
            isEditing ? (
              <>
                <button
                  type="button"
                  onClick={saveAllAndLock}
                  disabled={saving === 'save-all'}
                  className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving === 'save-all' ? 'Saving...' : 'Save & Lock'}
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={saving === 'save-all'}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                <Unlock className="h-4 w-4" />
                Unlock Editing
              </button>
            )
          )}
          {!isEditing && viewMode === 'detail' && (
            <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-2 text-xs font-medium text-gray-600">
              <Lock className="h-3.5 w-3.5" />
              Locked
            </span>
          )}
          <button onClick={() => loadData()} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button onClick={generateSteps} disabled={saving === 'generate'} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving === 'generate' ? 'Generating...' : 'Generate Missing Steps'}
          </button>
        </div>
      </div>

      <div className="max-h-[calc(100vh-220px)] overflow-auto rounded-lg border border-gray-300 bg-white">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className={`sticky left-0 top-0 z-30 border-b border-r border-gray-300 bg-gray-100 px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600 ${viewMode === 'simple' ? 'min-w-[240px]' : 'min-w-[220px]'}`}>Action</th>
              {bookings.map((booking) => (
                <th key={getObjectId(booking)} className={`sticky top-0 z-20 border-b border-r border-gray-300 bg-gray-100 px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600 ${viewMode === 'simple' ? 'min-w-[150px]' : 'min-w-[260px]'}`}>
                  <div className="flex items-start gap-2">
                    {viewMode === 'detail' && <ClientAvatar client={getBookingClient(booking)} name={getClientName(booking)} />}
                    <div className="min-w-0 space-y-1 normal-case">
                      <div className={`${viewMode === 'simple' ? 'max-w-[130px] text-xs' : 'max-w-[210px] text-sm'} truncate font-bold uppercase text-gray-900`}>{getClientName(booking)}</div>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-semibold text-blue-700">
                        <span>Booking #{getBookingNumber(booking)}</span>
                        {viewMode === 'detail' && getClientDisplayId(booking) && <span>Client #{getClientDisplayId(booking)}</span>}
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
            {groupedRows.map((group) => (
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
                  <td className={`sticky left-0 z-10 border-b border-r border-gray-300 px-3 py-2 text-xs font-bold uppercase tracking-wide ${tone.groupCell} ${tone.groupText}`} style={groupStyle}>
                    <span className="inline-flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} style={dotStyle} />
                      {group.label}
                    </span>
                  </td>
                  {bookings.map((booking) => (
                    <td key={`${group.key}:${getObjectId(booking)}`} className={`border-b border-r border-gray-300 px-2 py-2 text-xs font-semibold uppercase tracking-wide ${tone.groupCell} ${tone.groupText}`} style={groupStyle}>
                      {group.rows.length} steps
                    </td>
                  ))}
                </tr>
                {group.rows.map((row, rowIndex) => (
                  <tr key={row.key}>
                    <td className={`sticky left-0 z-10 border-b border-l-4 border-r border-gray-300 px-3 py-2 font-medium text-gray-900 ${tone.stepCell} ${tone.stepStripe}`} style={stepStyle}>
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[11px] font-semibold ${tone.badge}`} style={badgeStyle}>
                          {rowIndex + 1}
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
                      const itemActionLogs = item?._id ? actionLogMap.get(item._id) || [] : [];
                      const configuredActions = getConfiguredActions(item);
                      const simpleStatus = getSimpleStatus(item);
                      return (
                        <td key={`${getObjectId(booking)}:${row.key}`} className={`${viewMode === 'simple' ? 'min-w-[150px] px-2 py-2 text-center' : 'min-w-[230px] px-2 py-1 align-top'} border-b border-r border-gray-300 ${item ? getStatusCellClass(item.status) : 'bg-red-50 text-red-900'}`}>
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
                            <input
                              type="date"
                              value={formatDateInput(dateValue)}
                              disabled={!isEditing || saving === `date:${item._id}`}
                              onChange={(event) => updateItemDate(item, event.target.value)}
                              className="w-full rounded border border-black/10 bg-white/80 px-1.5 py-1 text-xs text-gray-800 disabled:cursor-not-allowed disabled:bg-white/40"
                            />
                              </div>
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
                            {configuredActions.map((action) => {
                              const actionLogs = itemActionLogs.filter((log) => (log.actionKey || 'default_email') === action.key);
                              const actionCount = actionLogs.length;
                              const savingKey = `action:${item._id}:${action.key}`;
                              return (
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
                              </div>
                              {itemActionLogs.length > 0 && (
                                <div className="space-y-0.5 text-[11px] text-blue-800">
                              {configuredActions
                                .map((action) => ({ action, logs: itemActionLogs.filter((log) => (log.actionKey || 'default_email') === action.key) }))
                                .filter(({ logs }) => logs.length > 0)
                                .map(({ action, logs }) => (
                                  <div key={action.key}>
                                    {action.label}: {logs.length}x{logs[0]?.performedAt ? `, last ${formatDateTime(logs[0].performedAt)}` : ''}
                                  </div>
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
      {composeState && (
        <EmailComposeModal
          title={`Send ${composeState.item.title}`}
          initialValues={composeState.initialValues}
          onClose={() => setComposeState(null)}
          onSent={handleComposedEmailSent}
        />
      )}
    </div>
  );
};

export default BookingStepsMatrix;
