import React, { useEffect, useMemo, useState } from 'react';
import { FiActivity, FiCreditCard, FiFile, FiMail, FiPackage, FiRefreshCw, FiShield, FiUser } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { bookingsApi } from '../services/api';
import { BookingActivityEvent } from '../types';
import LoadingSpinner from './LoadingSpinner';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => <IconComponent className={className} />;

const iconByType: Record<BookingActivityEvent['type'], any> = {
  file_uploaded: FiFile,
  step: FiActivity,
  email: FiMail,
  payment: FiCreditCard,
  medical_decision: FiShield,
  packet: FiPackage,
  status_change: FiRefreshCw,
  booking: FiActivity,
};

const labelByType: Record<BookingActivityEvent['type'], string> = {
  file_uploaded: 'Files',
  step: 'Steps',
  email: 'Emails',
  payment: 'Payments',
  medical_decision: 'Medical',
  packet: 'Packets',
  status_change: 'Statuses',
  booking: 'Booking',
};

const BookingActivityTimeline: React.FC<{ bookingId: string }> = ({ bookingId }) => {
  const [events, setEvents] = useState<BookingActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | BookingActivityEvent['type']>('all');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await bookingsApi.getActivity(bookingId);
      setEvents(response.data || []);
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Unable to load booking activity.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [bookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const availableTypes = useMemo(() => Array.from(new Set(events.map((event) => event.type))), [events]);
  const visibleEvents = filter === 'all' ? events : events.filter((event) => event.type === filter);

  if (loading) return <LoadingSpinner message="Loading booking activity..." />;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4" aria-label="Booking activity timeline">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Activity Timeline</h3>
          <p className="mt-1 text-sm text-gray-500">Files, workflow actions, communications, payments, medical decisions, packet versions, and booking changes.</p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Icon icon={FiRefreshCw} /> Refresh
        </button>
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Activity filters">
        <button type="button" onClick={() => setFilter('all')} className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}>All ({events.length})</button>
        {availableTypes.map((type) => (
          <button key={type} type="button" onClick={() => setFilter(type)} className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === type ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}>
            {labelByType[type]} ({events.filter((event) => event.type === type).length})
          </button>
        ))}
      </div>

      {visibleEvents.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500">No booking activity recorded yet.</div>
      ) : (
        <ol className="relative mt-6 ml-3 border-l border-gray-200">
          {visibleEvents.map((event) => {
            const EventIcon = iconByType[event.type];
            const content = (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 hover:border-gray-300">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="font-semibold text-gray-900">{event.title}</div>
                  {event.automatic && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800">Automatic</span>}
                </div>
                {event.description && <div className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{event.description}</div>}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                  <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString()}</time>
                  <span className="inline-flex items-center gap-1"><Icon icon={FiUser} /> {event.actor || (event.automatic ? 'System' : 'Unknown user')}</span>
                  <span>{labelByType[event.type]}</span>
                </div>
              </div>
            );
            return (
              <li key={event.id} className="relative mb-4 ml-6">
                <span className="absolute -left-[35px] top-3 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600"><Icon icon={EventIcon} className="h-3.5 w-3.5" /></span>
                {event.href ? <Link to={event.href}>{content}</Link> : content}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};

export default BookingActivityTimeline;
