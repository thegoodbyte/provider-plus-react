import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Mail, RefreshCw } from 'lucide-react';
import { bookingFlowApi, clientsApi, communicationsApi } from '../services/api';
import { BookingFlowItem, BookingFlowTemplate, Client } from '../types';
import LoadingSpinner from './LoadingSpinner';

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
  templateId?: string;
  emailEnabled?: boolean;
  emailTemplateId?: BookingFlowTemplate['emailTemplateId'];
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

const getStatusCellClass = (status?: BookingFlowItem['status']) => {
  if (status === 'caution') return 'bg-orange-200 text-orange-950';
  if (status === 'rejected' || status === 'needs_resubmission' || status === 'blocked') return 'bg-red-200 text-red-950';
  if (status && fulfilledStatuses.has(status)) return 'bg-green-100 text-green-950';
  if (status === 'sent' || status === 'sent_for_review' || status === 'in_review' || status === 'scheduled') return 'bg-blue-100 text-blue-950';
  return 'bg-white text-gray-700';
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

const BookingStepsMatrix: React.FC<{ retreatId: string }> = ({ retreatId }) => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [templates, setTemplates] = useState<BookingFlowTemplate[]>([]);
  const [items, setItems] = useState<BookingFlowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await bookingFlowApi.getMatrix(retreatId);
      setBookings(response.data?.bookings || []);
      setTemplates(response.data?.templates || []);
      setItems(response.data?.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [retreatId]);

  useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    items.forEach((item) => {
      if (item._id) nextDrafts[item._id] = item.notes || '';
    });
    setNoteDrafts(nextDrafts);
  }, [items]);

  const generateSteps = async () => {
    setSaving('generate');
    try {
      await communicationsApi.seedDefaultTemplates();
      await bookingFlowApi.seedLibraryTemplates();
      await bookingFlowApi.seedTemplates(retreatId);
      await bookingFlowApi.generateForRetreat(retreatId);
      await loadData();
    } finally {
      setSaving('');
    }
  };

  const rows = useMemo<MatrixRow[]>(() => {
    const rowMap = new Map<string, MatrixRow>();
    templates.forEach((template) => {
      rowMap.set(template.key, {
        key: template.key,
        title: template.title,
        order: template.order || 0,
        templateId: template._id,
        emailEnabled: template.emailEnabled,
        emailTemplateId: template.emailTemplateId,
      });
    });
    items.forEach((item) => {
      const template = typeof item.templateId === 'object' ? item.templateId : null;
      const existing = rowMap.get(item.key);
      rowMap.set(item.key, {
        ...existing,
        key: item.key,
        title: item.title,
        order: item.order || 0,
        templateId: existing?.templateId || template?._id || (typeof item.templateId === 'string' ? item.templateId : undefined),
        emailEnabled: existing?.emailEnabled || item.emailEnabled || template?.emailEnabled,
        emailTemplateId: existing?.emailTemplateId || item.emailTemplateId || template?.emailTemplateId,
      });
    });
    return Array.from(rowMap.values()).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  }, [items, templates]);

  const itemMap = useMemo(() => {
    const map = new Map<string, BookingFlowItem>();
    items.forEach((item) => {
      map.set(`${getObjectId(item.bookingId)}:${item.key}`, item);
    });
    return map;
  }, [items]);

  const toggleItem = async (item: BookingFlowItem | undefined, checked: boolean) => {
    if (!item?._id) return;
    setSaving(item._id);
    try {
      await bookingFlowApi.updateItem(item._id, {
        status: checked ? 'completed' : 'pending',
        completedAt: checked ? new Date().toISOString() : null,
      } as Partial<BookingFlowItem>);
      await loadData();
    } finally {
      setSaving('');
    }
  };

  const updateItemStatus = async (item: BookingFlowItem | undefined, status: BookingFlowItem['status']) => {
    if (!item?._id || item.status === status) return;
    setSaving(item._id);
    try {
      await bookingFlowApi.updateItem(item._id, { status } as Partial<BookingFlowItem>);
      await loadData();
    } finally {
      setSaving('');
    }
  };

  const saveItemNotes = async (item: BookingFlowItem | undefined) => {
    if (!item?._id) return;
    const notes = noteDrafts[item._id] || '';
    if ((item.notes || '') === notes) return;
    setSaving(`notes:${item._id}`);
    try {
      await bookingFlowApi.updateItem(item._id, { notes } as Partial<BookingFlowItem>);
      await loadData();
    } finally {
      setSaving('');
    }
  };

  const updateItemDate = async (item: BookingFlowItem | undefined, value: string) => {
    if (!item?._id) return;
    const field = getStatusDateField(item.status);
    setSaving(`date:${item._id}`);
    try {
      await bookingFlowApi.updateItem(item._id, { [field]: value || null } as Partial<BookingFlowItem>);
      await loadData();
    } finally {
      setSaving('');
    }
  };

  const sendItemEmail = async (item: BookingFlowItem | undefined) => {
    if (!item?._id) return;
    setSaving(`email:${item._id}`);
    try {
      const response = await bookingFlowApi.sendItemEmail(item._id);
      if (response.data.sentEmail?.status === 'failed') {
        alert(`Email was logged but Gmail failed to send it: ${response.data.sentEmail.errorMessage || 'Unknown error'}`);
      }
      await loadData();
    } catch (error: any) {
      console.error('Error sending booking step email:', error);
      alert(error?.response?.data?.message || error?.message || 'Unable to send booking step email.');
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
      await loadData();
    } catch (error: any) {
      console.error('Error sending retreat step email:', error);
      alert(error?.response?.data?.message || error?.message || 'Unable to send retreat step email.');
    } finally {
      setSaving('');
    }
  };

  const itemCanSendEmail = (item?: BookingFlowItem) => {
    if (!item) return false;
    const template = typeof item.templateId === 'object' ? item.templateId : null;
    return Boolean(item.emailEnabled && item.emailTemplateId) || Boolean(template?.emailEnabled && template?.emailTemplateId);
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
          <p className="text-sm text-gray-500">Actions are rows. Participants are columns. Each cell tracks status, date, and notes.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button onClick={generateSteps} disabled={saving === 'generate'} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving === 'generate' ? 'Generating...' : 'Generate Missing Steps'}
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded-lg border border-gray-300 bg-white">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 min-w-[220px] border-b border-r border-gray-300 bg-gray-100 px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">Action</th>
              {bookings.map((booking) => (
                <th key={getObjectId(booking)} className="min-w-[190px] border-b border-r border-gray-300 bg-gray-100 px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">
                  <div className="flex items-center gap-1">
                    <ClientAvatar client={getBookingClient(booking)} name={getClientName(booking)} />
                    <div>
                      <div className="max-w-[140px] truncate">{getClientName(booking)}</div>
                      <div className="mt-1 normal-case text-blue-700">P #{booking.bookingNumber || getObjectId(booking).slice(-6)}</div>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="sticky left-0 z-10 border-b border-r border-gray-300 bg-white px-3 py-2 font-medium text-gray-900">
                  <div>{row.title}</div>
                  {rowCanSendEmail(row) && (
                    <button
                      type="button"
                      disabled={saving === `row-email:${row.key}`}
                      onClick={() => sendRowEmail(row)}
                      className="mt-2 inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
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
                  return (
                    <td key={`${getObjectId(booking)}:${row.key}`} className={`min-w-[190px] border-b border-r border-gray-300 px-2 py-1 align-top ${item ? getStatusCellClass(item.status) : 'bg-white'}`}>
                      {item ? (
                        <div className="min-h-[88px]">
                          <button
                            type="button"
                            disabled={saving === item._id}
                            onClick={() => toggleItem(item, !done)}
                            className="flex w-full items-start gap-1 text-left disabled:opacity-50"
                          >
                            {done ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" /> : <Circle className="mt-0.5 h-4 w-4 flex-none" />}
                            <span className="min-w-0">
                              <span className="block truncate font-semibold">{getItemDisplayValue(item) || '-'}</span>
                              {item.emailSentAt && <span className="block text-xs opacity-75">Email {formatDate(item.emailSentAt)}</span>}
                            </span>
                          </button>
                          <select
                            value={item.status || 'pending'}
                            disabled={saving === item._id}
                            onChange={(event) => updateItemStatus(item, event.target.value as BookingFlowItem['status'])}
                            className="mt-1 w-full rounded border border-black/10 bg-white/80 px-1.5 py-1 text-xs font-medium text-gray-800"
                          >
                            {statusOptions.map((status) => (
                              <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                          <input
                            type="date"
                            value={formatDateInput(dateValue)}
                            disabled={saving === `date:${item._id}`}
                            onChange={(event) => updateItemDate(item, event.target.value)}
                            className="mt-1 w-full rounded border border-black/10 bg-white/80 px-1.5 py-1 text-xs text-gray-800"
                          />
                          <textarea
                            value={noteDrafts[item._id || ''] || ''}
                            onChange={(event) => item._id && setNoteDrafts((current) => ({ ...current, [item._id!]: event.target.value }))}
                            onBlur={() => saveItemNotes(item)}
                            rows={2}
                            placeholder="Notes"
                            className="mt-1 w-full resize-y rounded border border-black/10 bg-white/80 px-1.5 py-1 text-xs text-gray-800 placeholder:text-gray-400"
                          />
                          {itemCanSendEmail(item) && (
                            <button
                              type="button"
                              disabled={saving === `email:${item._id}`}
                              onClick={() => sendItemEmail(item)}
                              className="mt-1 inline-flex w-full items-center justify-center gap-1 rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              {saving === `email:${item._id}` ? 'Sending...' : 'Send email'}
                            </button>
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={bookings.length + 1} className="px-4 py-8 text-center text-gray-500">No booking steps yet. Generate missing steps to build the matrix.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BookingStepsMatrix;
