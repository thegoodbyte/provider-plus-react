import React, { useEffect, useMemo, useState } from 'react';
import { FiCheckCircle, FiChevronDown, FiRefreshCw, FiUpload } from 'react-icons/fi';
import { bookingFlowApi, medicalArtifactsApi } from '../services/api';
import { BookingFlowItem, MedicalArtifact } from '../types';
import AppleButton from './AppleButton';
import LoadingSpinner from './LoadingSpinner';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => (
  <IconComponent className={className} />
);

const REVIEW_LABELS: Record<string, string> = {
  OK: 'Good to go',
  caution: 'Fixes needed',
  'NOT OK': 'No good',
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

const fulfilledStatuses = new Set<BookingFlowItem['status']>(['received', 'reviewed', 'approved', 'caution', 'completed']);
const problemStatuses = new Set<BookingFlowItem['status']>(['rejected', 'needs_resubmission', 'blocked']);

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

const getStatusClass = (status: BookingFlowItem['status']) => {
  if (fulfilledStatuses.has(status)) return 'border-green-200 bg-green-50 text-green-800';
  if (problemStatuses.has(status)) return 'border-red-200 bg-red-50 text-red-800';
  if (status === 'sent' || status === 'sent_for_review' || status === 'in_review') return 'border-blue-200 bg-blue-50 text-blue-800';
  return 'border-gray-200 bg-white text-gray-800';
};

const getStatusPillClass = (status: BookingFlowItem['status']) => {
  if (fulfilledStatuses.has(status)) return 'bg-green-100 text-green-800';
  if (problemStatuses.has(status)) return 'bg-red-100 text-red-800';
  if (status === 'sent' || status === 'sent_for_review' || status === 'in_review') return 'bg-blue-100 text-blue-800';
  return 'bg-gray-100 text-gray-700';
};

interface ClientBookingWorkflowTabProps {
  bookings: any[];
  hideBookingSelector?: boolean;
}

const ClientBookingWorkflowTab: React.FC<ClientBookingWorkflowTabProps> = ({ bookings, hideBookingSelector = false }) => {
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [items, setItems] = useState<BookingFlowItem[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [reviewNoteDrafts, setReviewNoteDrafts] = useState<Record<string, string>>({});
  const [openItemIds, setOpenItemIds] = useState<Record<string, boolean>>({});
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

  const hydrateDrafts = (nextItems: BookingFlowItem[]) => {
    setNoteDrafts(Object.fromEntries(nextItems.map((item) => [item._id || item.key, item.notes || ''])));
    setReviewNoteDrafts(Object.fromEntries(nextItems.map((item) => [item._id || item.key, item.reviewNotes || ''])));
    setOpenItemIds((current) => {
      if (Object.keys(current).length > 0) return current;
      return Object.fromEntries(nextItems.slice(0, 4).map((item) => [item._id || item.key, true]));
    });
  };

  const loadItems = async (bookingId = selectedBookingId) => {
    if (!bookingId) return;
    try {
      setLoading(true);
      setError(null);
      let response = await bookingFlowApi.getItems({ bookingId });
      let nextItems = response.data || [];

      if (nextItems.length === 0) {
        const booking = bookings.find((current) => getObjectId(current) === bookingId);
        const retreatId = getRetreatId(booking);
        if (retreatId) {
          await bookingFlowApi.seedLibraryTemplates();
          await bookingFlowApi.seedTemplates(retreatId);
        }
        const generated = await bookingFlowApi.generateForBooking(bookingId);
        nextItems = generated.data || [];
        if (nextItems.length === 0) {
          response = await bookingFlowApi.getItems({ bookingId });
          nextItems = response.data || [];
        }
      }

      setItems(nextItems);
      hydrateDrafts(nextItems);
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

  const updateStatus = async (item: BookingFlowItem, status: BookingFlowItem['status']) => {
    await updateItem(item, {
      status,
      notes: noteDrafts[item._id || item.key] || item.notes || '',
      reviewNotes: reviewNoteDrafts[item._id || item.key] || item.reviewNotes || '',
    } as Partial<BookingFlowItem>);
  };

  const saveNotes = async (item: BookingFlowItem) => {
    await updateItem(item, {
      notes: noteDrafts[item._id || item.key] || '',
      reviewNotes: reviewNoteDrafts[item._id || item.key] || '',
    });
  };

  const toggleOpen = (item: BookingFlowItem) => {
    const id = item._id || item.key;
    setOpenItemIds((current) => ({ ...current, [id]: !current[id] }));
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
          <p className="mt-1 text-sm text-gray-500">Track this booking with completion dates, notes, and review outcomes.</p>
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
        <div className="overflow-hidden rounded-lg border border-gray-200">
          {items.length === 0 ? (
            <div className="bg-gray-50 p-8 text-center text-sm text-gray-500">
              No booking steps were generated for this booking.
            </div>
          ) : (
            <div className="divide-y divide-gray-200 bg-white">
              {items.map((item) => {
                const id = item._id || item.key;
                const showReview = item.category === 'approval' || item.metadata?.reviewRequired || item.key.includes('result') || item.key.includes('screening_completed');
                const isOpen = openItemIds[id] ?? false;
                const uploadConfig = artifactUploadsByStep[item.key];

                return (
                  <div key={id} className={`border-l-4 ${getStatusClass(item.status)}`}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 p-4 text-left"
                      onClick={() => toggleOpen(item)}
                      aria-expanded={isOpen}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-gray-950">{item.order ? `${item.order}. ` : ''}{item.title}</span>
                        <span className="mt-1 block text-sm text-gray-600">{item.description || item.category}</span>
                        <span className="mt-2 flex flex-wrap gap-2">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusPillClass(item.status)}`}>
                            {item.status.replace(/_/g, ' ')}
                          </span>
                          {item.dueDate && (
                            <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                              Due {formatDisplayDate(item.dueDate)}
                            </span>
                          )}
                          {item.reviewDecision && (
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${item.reviewDecision === 'OK' ? 'bg-green-100 text-green-800' : item.reviewDecision === 'caution' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}`}>
                              {REVIEW_LABELS[item.reviewDecision] || item.reviewDecision}
                            </span>
                          )}
                        </span>
                      </span>
                      <Icon icon={FiChevronDown} className={`h-5 w-5 flex-none transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isOpen && (
                      <div className="space-y-4 border-t border-gray-200 bg-white p-4">
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                          <div>
                            <label className="block text-xs font-medium uppercase text-gray-500">Status</label>
                            <select
                              value={item.status}
                              disabled={savingId === item._id}
                              onChange={(event) => updateStatus(item, event.target.value as BookingFlowItem['status'])}
                              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {statusOptions.map((status) => (
                                <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium uppercase text-gray-500">Sent at</label>
                            <input
                              type="datetime-local"
                              value={formatDateTimeInput(item.sentAt)}
                              disabled={savingId === item._id}
                              onChange={(event) => updateItem(item, { sentAt: toIsoFromDateTimeInput(event.target.value) } as Partial<BookingFlowItem>)}
                              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium uppercase text-gray-500">Received at</label>
                            <input
                              type="datetime-local"
                              value={formatDateTimeInput(item.receivedAt)}
                              disabled={savingId === item._id}
                              onChange={(event) => updateItem(item, { receivedAt: toIsoFromDateTimeInput(event.target.value) } as Partial<BookingFlowItem>)}
                              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium uppercase text-gray-500">Completed at</label>
                            <input
                              type="datetime-local"
                              value={formatDateTimeInput(item.completedAt)}
                              disabled={savingId === item._id}
                              onChange={(event) => updateItem(item, { completedAt: toIsoFromDateTimeInput(event.target.value) } as Partial<BookingFlowItem>)}
                              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        {showReview && (
                          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                            <div>
                              <label className="block text-xs font-medium uppercase text-gray-500">Review result</label>
                              <select
                                value={item.reviewDecision || ''}
                                disabled={savingId === item._id}
                                onChange={(event) => updateItem(item, { reviewDecision: event.target.value as any })}
                                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">Select result</option>
                                {Object.entries(REVIEW_LABELS).map(([value, label]) => (
                                  <option key={value} value={value}>{label}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-medium uppercase text-gray-500">Reviewed at</label>
                              <input
                                type="datetime-local"
                                value={formatDateTimeInput(item.reviewedAt)}
                                disabled={savingId === item._id}
                                onChange={(event) => updateItem(item, { reviewedAt: toIsoFromDateTimeInput(event.target.value) } as Partial<BookingFlowItem>)}
                                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium uppercase text-gray-500">Approved at</label>
                              <input
                                type="datetime-local"
                                value={formatDateTimeInput(item.approvedAt)}
                                disabled={savingId === item._id}
                                onChange={(event) => updateItem(item, { approvedAt: toIsoFromDateTimeInput(event.target.value) } as Partial<BookingFlowItem>)}
                                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(260px,1fr)_minmax(260px,1fr)]">
                          <div className="space-y-2">
                            <label className="block text-xs font-medium uppercase text-gray-500">Notes</label>
                            <textarea
                              value={noteDrafts[id] || ''}
                              onChange={(event) => setNoteDrafts((current) => ({ ...current, [id]: event.target.value }))}
                              onBlur={() => saveNotes(item)}
                              rows={3}
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Date, MRR number, document link, or internal note"
                            />
                          </div>

                          {showReview ? (
                            <div className="space-y-2">
                              <label className="block text-xs font-medium uppercase text-gray-500">Review notes</label>
                              <textarea
                                value={reviewNoteDrafts[id] || ''}
                                onChange={(event) => setReviewNoteDrafts((current) => ({ ...current, [id]: event.target.value }))}
                                onBlur={() => saveNotes(item)}
                                rows={3}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Medical review notes, status reason, or follow-up needed"
                              />
                            </div>
                          ) : (
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                              <div><strong>Category:</strong> {item.category}</div>
                              <div><strong>Key:</strong> {item.key}</div>
                              {item.metadata?.latestFileName && <div><strong>Latest upload:</strong> {item.metadata.latestFileName}</div>}
                              {savingId === item._id && <div className="mt-2 text-blue-700">Saving...</div>}
                            </div>
                          )}
                        </div>

                        {uploadConfig && (
                          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3">
                            <div className="text-sm text-gray-700">
                              Upload {uploadConfig.title}. Uploading marks this step as received.
                            </div>
                            <label className="inline-flex cursor-pointer items-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                              <Icon icon={FiUpload} className="mr-2 h-4 w-4" />
                              {uploadingId === item._id ? 'Uploading...' : 'Upload file'}
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
                          </div>
                        )}
                      </div>
                      )}
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
