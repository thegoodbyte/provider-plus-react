import React, { useEffect, useMemo, useState } from 'react';
import { FiCheckCircle, FiRefreshCw } from 'react-icons/fi';
import { bookingFlowApi } from '../services/api';
import { BookingFlowItem } from '../types';
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

const formatDateInput = (date?: Date | string | null): string => {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const formatDisplayDate = (date?: Date | string | null): string => {
  if (!date) return 'No date';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'No date';
  return parsed.toLocaleDateString();
};

interface ClientBookingWorkflowTabProps {
  bookings: any[];
}

const ClientBookingWorkflowTab: React.FC<ClientBookingWorkflowTabProps> = ({ bookings }) => {
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [items, setItems] = useState<BookingFlowItem[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [reviewNoteDrafts, setReviewNoteDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
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

  const completedCount = items.filter((item) => item.status === 'completed' || item.status === 'approved').length;
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  const hydrateDrafts = (nextItems: BookingFlowItem[]) => {
    setNoteDrafts(Object.fromEntries(nextItems.map((item) => [item._id || item.key, item.notes || ''])));
    setReviewNoteDrafts(Object.fromEntries(nextItems.map((item) => [item._id || item.key, item.reviewNotes || ''])));
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

  const toggleCompleted = async (item: BookingFlowItem, checked: boolean) => {
    await updateItem(item, {
      status: checked ? 'completed' : 'pending',
      completedAt: checked ? new Date().toISOString() : null,
      notes: noteDrafts[item._id || item.key] || item.notes || '',
    } as Partial<BookingFlowItem>);
  };

  const saveNotes = async (item: BookingFlowItem) => {
    await updateItem(item, {
      notes: noteDrafts[item._id || item.key] || '',
      reviewNotes: reviewNoteDrafts[item._id || item.key] || '',
    });
  };

  if (bookings.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <Icon icon={FiCheckCircle} className="mx-auto h-10 w-10 text-gray-400" />
        <h3 className="mt-3 text-sm font-medium text-gray-900">No booking workflow yet</h3>
        <p className="mt-1 text-sm text-gray-500">Create or link a booking for this client before tracking booking progress.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Booking Progress</h2>
          <p className="mt-1 text-sm text-gray-500">Track each client readiness step with completion dates, notes, and review outcomes.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
              No booking progress items were generated for this booking.
            </div>
          ) : (
            <div className="divide-y divide-gray-200 bg-white">
              {items.map((item) => {
                const id = item._id || item.key;
                const isDone = item.status === 'completed' || item.status === 'approved';
                const showReview = item.category === 'approval' || item.metadata?.reviewRequired || item.key.includes('result') || item.key.includes('screening_completed');

                return (
                  <div key={id} className="p-4">
                    <div className="space-y-4">
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isDone}
                          disabled={savingId === item._id}
                          onChange={(event) => toggleCompleted(item, event.target.checked)}
                          className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>
                          <span className="block font-medium text-gray-900">{item.title}</span>
                          {item.description && <span className="mt-1 block text-sm text-gray-500">{item.description}</span>}
                          <span className="mt-2 inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                            {item.category}
                          </span>
                        </span>
                      </label>

                      {isDone && (
                        <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 xl:grid-cols-[170px_220px_minmax(260px,1fr)]">
                          <div>
                            <label className="block text-xs font-medium uppercase text-gray-500">Checked date</label>
                            <input
                              type="date"
                              value={formatDateInput(item.completedAt)}
                              disabled={savingId === item._id}
                              onChange={(event) => updateItem(item, { completedAt: event.target.value || null } as Partial<BookingFlowItem>)}
                              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="mt-1 text-xs text-gray-500">Due {formatDisplayDate(item.dueDate)}</p>
                          </div>

                          {showReview ? (
                            <div>
                              <label className="block text-xs font-medium uppercase text-gray-500">Result</label>
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
                              {item.reviewDecision && (
                                <p className="mt-1 text-xs text-gray-500">{REVIEW_LABELS[item.reviewDecision]}</p>
                              )}
                            </div>
                          ) : (
                            <div>
                              <label className="block text-xs font-medium uppercase text-gray-500">Status</label>
                              <p className="mt-2 text-sm capitalize text-gray-700">{item.status.replace(/_/g, ' ')}</p>
                            </div>
                          )}

                          <div className="space-y-2">
                            <label className="block text-xs font-medium uppercase text-gray-500">Notes</label>
                            <textarea
                              value={noteDrafts[id] || ''}
                              onChange={(event) => setNoteDrafts((current) => ({ ...current, [id]: event.target.value }))}
                              onBlur={() => saveNotes(item)}
                              rows={showReview ? 2 : 3}
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Date, MRR number, quote, or internal note"
                            />
                            {showReview && (
                              <textarea
                                value={reviewNoteDrafts[id] || ''}
                                onChange={(event) => setReviewNoteDrafts((current) => ({ ...current, [id]: event.target.value }))}
                                onBlur={() => saveNotes(item)}
                                rows={2}
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Review notes"
                              />
                            )}
                          </div>
                        </div>
                      )}
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
