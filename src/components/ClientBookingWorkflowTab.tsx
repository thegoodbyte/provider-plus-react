import React, { useEffect, useMemo, useState } from 'react';
import { FiCheckCircle, FiEdit2, FiRefreshCw, FiSave, FiUpload } from 'react-icons/fi';
import { bookingFlowApi, medicalArtifactsApi } from '../services/api';
import { BookingFlowItem, MedicalArtifact } from '../types';
import AppleButton from './AppleButton';
import LoadingSpinner from './LoadingSpinner';

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
  contract_signed: { artifactType: 'contract', documentStage: 'additional', documentType: 'other', title: 'Signed Contract' },
  ekg_received: { artifactType: 'ekg', documentStage: 'entry', documentType: 'EKG', title: 'Entry EKG' },
  liver_received: { artifactType: 'liver_panel', documentStage: 'entry', documentType: 'Liver', title: 'Entry Liver Panel' },
  medications_form_initial_received: { artifactType: 'medications_form', documentStage: 'entry', documentType: 'Medications', title: 'Medications Form' },
  medications_form_30_day_received: { artifactType: 'medications_form', documentStage: 'additional', documentType: 'Medications', title: '30-Day Medications Form' },
  questionnaire_received: { artifactType: 'questionnaire', documentStage: 'additional', documentType: 'other', title: 'Questionnaire' },
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

const ClientBookingWorkflowTab: React.FC<ClientBookingWorkflowTabProps> = ({ bookings, hideBookingSelector = false }) => {
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [items, setItems] = useState<BookingFlowItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, StepDraft>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
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

  const completedCount = items.filter((item) => fulfilledStatuses.has(item.status)).length;
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

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
      const booking = bookings.find((current) => getObjectId(current) === bookingId);
      const retreatId = getRetreatId(booking);
      await bookingFlowApi.seedLibraryTemplates();
      if (retreatId) {
        await bookingFlowApi.seedTemplates(retreatId);
      }
      const generated = await bookingFlowApi.generateForBooking(bookingId);
      let nextItems = generated.data || [];
      if (nextItems.length === 0) {
        const response = await bookingFlowApi.getItems({ bookingId });
        nextItems = response.data || [];
      }

      setItems(nextItems);
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
    if (!config || !item._id) return;

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
      });

      if (created.data._id) {
        await medicalArtifactsApi.uploadFiles(created.data._id, fileArray);
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Booking Steps</h2>
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

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">{completedCount} of {items.length} complete</span>
          <span className="text-gray-500">{progressPercent}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100">
          <div className="h-2 rounded-full bg-blue-600 transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
        {selectedBooking && (
          <p className="mt-2 text-xs text-gray-500">
            {getRetreatName(selectedBooking)} {selectedBooking?.status ? `- ${selectedBooking.status}` : ''}
          </p>
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
          ) : (
            <div className="divide-y divide-gray-200">
              {items.map((item) => {
                const id = item._id || item.key;
                const draft = drafts[id] || makeDraft(item);
                const isChecked = draft.checked;
                const uploadConfig = artifactUploadsByStep[item.key];

                return (
                  <div key={id} className={`grid gap-3 p-4 lg:grid-cols-[minmax(220px,1.1fr)_220px_minmax(220px,1fr)_auto] lg:items-start ${isChecked ? 'bg-green-50/60' : 'bg-white'}`}>
                    <label className="flex min-w-0 items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={!isEditing || savingId === 'all'}
                        onChange={(event) => setActionChecked(item, event.target.checked)}
                        className="mt-1 h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="min-w-0">
                        <span className={`block font-medium ${isChecked ? 'text-green-900' : 'text-gray-950'}`}>
                          {item.title}
                        </span>
                        <span className="mt-1 block text-xs text-gray-500">
                          {item.dueDate ? `Due ${formatDisplayDate(item.dueDate)}` : item.category}
                        </span>
                        {item.metadata?.latestFileName && (
                          <span className="mt-1 block text-xs text-gray-500">
                            Latest upload: {item.metadata.latestFileName}
                          </span>
                        )}
                      </span>
                    </label>

                    <div>
                      <label className="block text-xs font-medium uppercase text-gray-500">Date / time</label>
                      {isChecked ? (
                        <input
                          type="datetime-local"
                          value={draft.dateTime}
                          disabled={!isEditing || savingId === 'all'}
                          onChange={(event) => setDraft(item, { dateTime: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400">
                          Not done
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium uppercase text-gray-500">Notes</label>
                      <textarea
                        value={draft.notes}
                        disabled={!isEditing || savingId === 'all'}
                        onChange={(event) => setDraft(item, { notes: event.target.value })}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Internal note"
                      />
                    </div>

                    <div className="flex items-center gap-2 lg:justify-end lg:pt-5">
                      {uploadConfig && (
                        <label className={`inline-flex items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-medium ${isEditing ? 'cursor-pointer text-blue-700 hover:bg-blue-50' : 'cursor-not-allowed text-gray-400'}`}>
                          <Icon icon={FiUpload} className="mr-2 h-4 w-4" />
                          {uploadingId === item._id ? 'Uploading...' : 'Upload'}
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
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientBookingWorkflowTab;
