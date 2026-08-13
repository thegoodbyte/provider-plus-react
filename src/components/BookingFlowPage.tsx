import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, Lock, Plus, RefreshCw, Save, Trash2, Unlock } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import { bookingsApi, bookingFlowApi, retreatsApi } from '../services/api';
import { BookingFlowItem, Retreat } from '../types';
import {
  getBookingStepColorStyles,
  getBookingStepGroupColor,
  getBookingStepGroupKey,
  getBookingStepToneWithColor,
  titleizeBookingStepGroup,
} from '../utils/bookingStepColors';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => <IconComponent className={className} />;

type FlowDraft = {
  title: string;
  order: string;
  offsetDays: string;
  dueDate: string;
  notes: string;
};

const getObjectId = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
};

const toDateInputValue = (value?: string | Date | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const makeDraft = (item: BookingFlowItem): FlowDraft => ({
  title: item.title || '',
  order: String(item.order || 0),
  offsetDays: String(item.offsetDays || 0),
  dueDate: toDateInputValue(item.dueDate),
  notes: item.notes || '',
});

const BookingFlowPage: React.FC = () => {
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const [bookings, setBookings] = useState<any[]>([]);
  const [allItems, setAllItems] = useState<BookingFlowItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [hideAccomplished, setHideAccomplished] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [booking, setBooking] = useState<any>(null);
  const [retreat, setRetreat] = useState<Retreat | null>(null);
  const [items, setItems] = useState<BookingFlowItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, FlowDraft>>({});
  const [newStep, setNewStep] = useState<FlowDraft>({ title: '', order: '0', offsetDays: '0', dueDate: '', notes: '' });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.title).localeCompare(String(b.title))),
    [items],
  );

  useEffect(() => {
    if (bookingId) {
      loadData();
    } else {
      loadClientFlowIndex();
    }
  }, [bookingId]);

  const loadClientFlowIndex = async () => {
    try {
      setError('');
      setLoading(true);
      const [bookingResponse, itemResponse] = await Promise.all([bookingsApi.getAll(), bookingFlowApi.getItems({})]);
      setBookings(bookingResponse.data || []);
      setAllItems(itemResponse.data || []);
    } catch (err) {
      console.error('Error loading booking requirements:', err);
      setError('Unable to load bookings.');
    } finally {
      setLoading(false);
    }
  };

  const hydrateDrafts = (nextItems: BookingFlowItem[]) => {
    setDrafts(Object.fromEntries(nextItems.map((item) => [item._id || item.key, makeDraft(item)])));
  };

  const loadData = async () => {
    if (!bookingId) return;
    try {
      setError('');
      setLoading(true);
      const bookingResponse = await bookingsApi.getOne(bookingId);
      const currentBooking = bookingResponse.data;
      setBooking(currentBooking);

      const retreatId = getObjectId(currentBooking.retreat || currentBooking.retreatId);
      let currentRetreat: Retreat | null = null;
      if (retreatId) {
        const retreatResponse = await retreatsApi.getOne(retreatId);
        currentRetreat = retreatResponse.data || null;
        setRetreat(currentRetreat);
      }

      let flowItems = (await bookingFlowApi.getItems({ bookingId })).data || [];
      if (flowItems.length === 0 && retreatId) {
        flowItems = (await bookingFlowApi.generateForBooking(bookingId)).data || [];
      }

      setItems(flowItems);
      hydrateDrafts(flowItems);
    } catch (err) {
      console.error('Error loading booking requirements:', err);
      setError('Unable to load Booking Requirements.');
    } finally {
      setLoading(false);
    }
  };

  const calculateDueDate = (offsetDays: number): string | null => {
    if (!retreat?.startDate) return null;
    const dueDate = new Date(retreat.startDate);
    dueDate.setDate(dueDate.getDate() - offsetDays);
    return dueDate.toISOString();
  };

  const setDraft = (itemId: string, patch: Partial<FlowDraft>) => {
    setDrafts((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] || { title: '', order: '0', offsetDays: '0', dueDate: '', notes: '' }),
        ...patch,
      },
    }));
  };

  const saveItem = async (item: BookingFlowItem) => {
    if (!item._id) return;
    const draft = drafts[item._id] || makeDraft(item);
    const offsetDays = Number(draft.offsetDays || 0);
    try {
      setSavingId(item._id);
      await bookingFlowApi.updateItem(item._id, {
        title: draft.title.trim(),
        order: Number(draft.order || 0),
        offsetDays,
        dueDate: draft.dueDate ? new Date(`${draft.dueDate}T12:00:00`).toISOString() : null,
        notes: draft.notes,
      });
      await loadData();
    } finally {
      setSavingId('');
    }
  };

  const resetDueDate = async (item: BookingFlowItem) => {
    if (!item._id) return;
    try {
      setSavingId(item._id);
      await bookingFlowApi.updateItem(item._id, { dueDateManuallyOverridden: false } as Partial<BookingFlowItem>);
      await loadData();
    } finally {
      setSavingId('');
    }
  };

  const addItem = async () => {
    if (!bookingId || !newStep.title.trim()) return;
    const offsetDays = Number(newStep.offsetDays || 0);
    try {
      setSavingId('new');
      await bookingFlowApi.createItem({
        bookingId,
        title: newStep.title.trim(),
        order: Number(newStep.order || 0),
        offsetDays,
        dueDate: newStep.dueDate ? new Date(`${newStep.dueDate}T12:00:00`).toISOString() : calculateDueDate(offsetDays),
        notes: newStep.notes,
        category: 'other',
      });
      setNewStep({ title: '', order: String((sortedItems.at(-1)?.order || 0) + 10), offsetDays: '0', dueDate: '', notes: '' });
      await loadData();
    } finally {
      setSavingId('');
    }
  };

  const deleteItem = async (item: BookingFlowItem) => {
    if (!item._id) return;
    const confirmed = window.confirm(`Delete "${item.title}" from this booking?`);
    if (!confirmed) return;
    try {
      setSavingId(item._id);
      await bookingFlowApi.deleteItem(item._id);
      await loadData();
    } finally {
      setSavingId('');
    }
  };

  const moveItem = async (index: number, direction: -1 | 1) => {
    const current = sortedItems[index];
    const target = sortedItems[index + direction];
    if (!current?._id || !target?._id) return;
    try {
      setSavingId(current._id);
      await Promise.all([
        bookingFlowApi.updateItem(current._id, { order: target.order || 0 }),
        bookingFlowApi.updateItem(target._id, { order: current.order || 0 }),
      ]);
      await loadData();
    } finally {
      setSavingId('');
    }
  };

  const normalizeOrder = async () => {
    try {
      setSavingId('normalize');
      await Promise.all(sortedItems.map((item, index) => (
        item._id ? bookingFlowApi.updateItem(item._id, { order: (index + 1) * 10 }) : Promise.resolve()
      )));
      await loadData();
    } finally {
      setSavingId('');
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading booking requirements..." />;
  }

  const getClientName = (currentBooking: any): string => {
    const client = currentBooking?.client || currentBooking?.clientId;
    if (client && typeof client === 'object') {
      const name = [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ');
      return name || client.email || `Client ${getObjectId(client).slice(-6)}`;
    }
    return `Client ${getObjectId(client).slice(-6) || 'unknown'}`;
  };

  const getRetreatName = (currentBooking: any): string => {
    const currentRetreat = currentBooking?.retreat || currentBooking?.retreatId;
    if (currentRetreat && typeof currentRetreat === 'object') {
      return currentRetreat.name || currentRetreat.title || `Retreat ${getObjectId(currentRetreat).slice(-6)}`;
    }
    return `Retreat ${getObjectId(currentRetreat).slice(-6) || 'unknown'}`;
  };

  const bookingById = new Map(bookings.map((entry) => [getObjectId(entry), entry]));
  const clientOptions = Array.from(new Map(allItems.map((item) => [getObjectId(item.clientId), getClientName({ clientId: item.clientId })])).entries())
    .filter(([id]) => id)
    .sort((left, right) => left[1].localeCompare(right[1]));
  const actionOptions = Array.from(new Map(allItems.map((item) => [item.category || 'other', titleizeBookingStepGroup(item.category || 'other')])).entries())
    .sort((left, right) => left[1].localeCompare(right[1]));
  const accomplishedStatuses = new Set<BookingFlowItem['status']>(['received', 'reviewed', 'approved', 'caution', 'completed', 'waived', 'sent']);
  const isAccomplished = (item: BookingFlowItem) => accomplishedStatuses.has(item.status);
  const dueTime = (item: BookingFlowItem) => item.dueDate ? new Date(item.dueDate).getTime() : Number.NaN;
  const today = new Date();
  const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const sevenDaysTime = todayTime + 7 * 24 * 60 * 60 * 1000;
  const isPastDue = (item: BookingFlowItem) => !isAccomplished(item) && Number.isFinite(dueTime(item)) && dueTime(item) < todayTime;
  const isDueSoon = (item: BookingFlowItem) => !isAccomplished(item) && Number.isFinite(dueTime(item)) && dueTime(item) >= todayTime && dueTime(item) <= sevenDaysTime;
  const filteredItems = allItems.filter((item) => {
    const query = searchTerm.trim().toLowerCase();
    const linkedBooking: any = typeof item.bookingId === 'object' ? item.bookingId : bookingById.get(getObjectId(item.bookingId));
    const due = toDateInputValue(item.dueDate);
    if (clientFilter && getObjectId(item.clientId) !== clientFilter) return false;
    if (actionFilter && (item.category || 'other') !== actionFilter) return false;
    if (hideAccomplished && isAccomplished(item)) return false;
    if (dateFrom && (!due || due < dateFrom)) return false;
    if (dateTo && (!due || due > dateTo)) return false;
    if (!query) return true;
    return [getClientName({ clientId: item.clientId }), getRetreatName({ retreatId: item.retreatId }), linkedBooking?.bookingNumber, item.title, item.category, item.status, item.notes]
      .filter(Boolean).join(' ').toLowerCase().includes(query);
  });
  const groupedItems = Array.from(filteredItems.reduce((groups, item) => {
    const id = getObjectId(item.bookingId);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(item);
    return groups;
  }, new Map<string, BookingFlowItem[]>()).entries());
  const pastDueTotal = allItems.filter(isPastDue).length;
  const dueSoonTotal = allItems.filter(isDueSoon).length;
  const accomplishedTotal = allItems.filter(isAccomplished).length;
  const upcomingTotal = allItems.length - pastDueTotal - dueSoonTotal - accomplishedTotal;

  if (!bookingId) {
    return (
      <div className="mx-auto max-w-[1500px] bg-white shadow-sm">
        <header className="flex flex-col gap-4 border-b border-gray-300 px-7 py-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">Operations · {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-950">Booking requirements</h1>
            <p className="mt-1 text-sm text-gray-600">{allItems.length - accomplishedTotal} steps still open across {new Set(allItems.map((item) => getObjectId(item.bookingId))).size} bookings. {pastDueTotal} are past their due date.</p>
          </div>
          <button onClick={loadClientFlowIndex} className="inline-flex items-center justify-center gap-2 border border-gray-900 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50">
            <Icon icon={RefreshCw} className="h-4 w-4" /> Refresh
          </button>
        </header>

        <div className="grid grid-cols-2 border-b border-gray-300 lg:grid-cols-4">
          {[
            ['Past due', pastDueTotal, 'needs action now', 'bg-red-700'],
            ['Due in 7 days', dueSoonTotal, 'approaching', 'bg-amber-600'],
            ['Upcoming', upcomingTotal, 'later than a week', 'bg-gray-500'],
            ['Accomplished', accomplishedTotal, 'no action needed', 'bg-green-700'],
          ].map(([label, count, description, dot]) => (
            <div key={String(label)} className="border-b border-r border-gray-300 px-6 py-4 last:border-r-0 lg:border-b-0">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-600"><span className={`h-2 w-2 rounded-full ${dot}`} />{label}</div>
              <div className="mt-1 text-3xl font-bold text-gray-950">{count}</div>
              <div className="text-xs text-gray-500">{description}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-2 border-b border-gray-300 bg-gray-50 px-7 py-4 md:grid-cols-[minmax(260px,1fr)_180px_180px_auto]">
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-700" placeholder="⌕  Search client, retreat, booking or step" />
          <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className="border border-gray-300 bg-white px-3 py-2.5 text-sm"><option value="">All clients</option>{clientOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} className="border border-gray-300 bg-white px-3 py-2.5 text-sm"><option value="">All categories</option>{actionOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <button type="button" onClick={() => setHideAccomplished((current) => !current)} className={`border px-4 py-2.5 text-sm font-medium ${hideAccomplished ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700'}`}>{hideAccomplished ? 'Show accomplished' : 'Hide accomplished'}</button>
          <div className="flex items-center gap-2 md:col-span-4">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Due range</span>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="border border-gray-300 bg-white px-2 py-1.5 text-xs" />
            <span className="text-xs text-gray-400">to</span>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="border border-gray-300 bg-white px-2 py-1.5 text-xs" />
            <button type="button" onClick={() => { setSearchTerm(''); setClientFilter(''); setActionFilter(''); setDateFrom(''); setDateTo(''); setHideAccomplished(false); }} className="text-xs font-medium text-blue-700 hover:underline">Clear filters</button>
          </div>
        </div>

        <div className="px-7 pb-8">
          {groupedItems.length === 0 ? <div className="p-10 text-center text-sm text-gray-500">No booking requirements match these filters.</div> : groupedItems.map(([id, bookingItems]) => {
            const currentBooking: any = bookingById.get(id) || (typeof bookingItems[0]?.bookingId === 'object' ? bookingItems[0].bookingId : null);
            const allBookingItems = allItems.filter((item) => getObjectId(item.bookingId) === id);
            const bookingDone = allBookingItems.filter(isAccomplished).length;
            const bookingPastDue = allBookingItems.filter(isPastDue).length;
            return <section key={id} className="border-b border-gray-300 py-5">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-bold text-gray-950">{getClientName({ clientId: bookingItems[0]?.clientId })}</h2>
                <span className="text-xs text-gray-500">#{currentBooking?.bookingNumber || id.slice(-6)} · {getRetreatName({ retreatId: bookingItems[0]?.retreatId })}</span>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${bookingPastDue ? 'border-red-300 bg-red-50 text-red-700' : 'border-green-300 bg-green-50 text-green-700'}`}>{bookingPastDue ? `${bookingPastDue} past due` : 'On track'}</span>
                <div className="ml-auto flex items-center gap-2"><div className="flex gap-1">{allBookingItems.map((item) => <span key={item._id || item.key} className={`h-1.5 w-4 ${isAccomplished(item) ? 'bg-green-700' : isPastDue(item) ? 'bg-red-700' : isDueSoon(item) ? 'bg-amber-600' : 'bg-gray-300'}`} />)}</div><span className="text-xs text-gray-600">{bookingDone}/{allBookingItems.length} done</span></div>
              </div>
              <div className="space-y-0.5">{[...bookingItems].sort((a, b) => dueTime(a) - dueTime(b)).map((item) => {
                const done = isAccomplished(item); const overdue = isPastDue(item); const soon = isDueSoon(item);
                const days = Number.isFinite(dueTime(item)) ? Math.ceil((dueTime(item) - todayTime) / 86400000) : null;
                return <div key={item._id || item.key} className={`grid items-center gap-3 border-l-2 px-3 py-2.5 sm:grid-cols-[minmax(230px,1fr)_110px_115px_70px] ${overdue ? 'border-red-600' : soon ? 'border-amber-600' : done ? 'border-green-700' : 'border-gray-400'}`}>
                  <div className="flex items-start gap-3"><span className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border text-xs font-bold ${done ? 'border-green-700 bg-green-700 text-white' : overdue ? 'border-red-300 bg-red-50 text-red-600' : soon ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-300 text-gray-400'}`}>{done ? '✓' : overdue ? '!' : ''}</span><div><div className="text-sm font-semibold text-gray-900">{item.title}</div><div className="text-[11px] capitalize text-gray-500">{titleizeBookingStepGroup(item.category || 'other')}</div></div></div>
                  <div className="text-right"><div className={`text-sm font-semibold ${overdue ? 'text-red-700' : 'text-gray-900'}`}>{formatDate(item.dueDate)}</div><div className="text-[10px] text-gray-500">{done ? String(item.status).replace(/_/g, ' ') : days === null ? 'No deadline' : days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'Due today' : `in ${days} days`}</div></div>
                  <div><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${done ? 'border-green-300 bg-green-50 text-green-700' : overdue ? 'border-red-300 bg-red-50 text-red-700' : soon ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-300 bg-gray-50 text-gray-600'}`}>{String(item.status || 'pending').replace(/_/g, ' ')}</span></div>
                  <button onClick={() => navigate(id)} className="text-left text-xs font-medium text-blue-700 hover:underline sm:text-right">Open →</button>
                </div>;
              })}</div>
            </section>;
          })}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>
        <button onClick={() => navigate(-1)} className="mt-4 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <button onClick={() => navigate(-1)} className="mb-3 inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Icon icon={ArrowLeft} className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">Booking Requirements</h1>
          <p className="text-sm text-gray-600">
            {(booking?.clientId as any)?.firstName ? `${(booking.clientId as any).firstName} ${(booking.clientId as any).lastName}` : 'Client'}
            {' '}• {retreat?.name || 'Retreat'} • generated from booking step setup
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editMode && <button onClick={normalizeOrder} disabled={savingId === 'normalize'} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Re-number</button>}
          <button onClick={() => { setEditMode((current) => !current); hydrateDrafts(items); }} className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${editMode ? 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>
            <Icon icon={editMode ? Lock : Unlock} className="h-4 w-4" />
            {editMode ? 'Lock editing' : 'Edit / Unlock'}
          </button>
          <button onClick={loadData} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Icon icon={RefreshCw} className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {editMode && <div className="mb-5 rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 text-sm font-semibold text-gray-900">Add Requirement</div>
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_90px_130px_150px_minmax(220px,1fr)_auto]">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Requirement name</span>
            <input
              value={newStep.title}
              onChange={(event) => setNewStep((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Example: EKG received"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Order</span>
            <input
              type="number"
              value={newStep.order}
              onChange={(event) => setNewStep((current) => ({ ...current, order: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="10"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Offset days</span>
            <input
              type="number"
              value={newStep.offsetDays}
              onChange={(event) => setNewStep((current) => ({ ...current, offsetDays: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="21"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Deadline</span>
            <input
              type="date"
              value={newStep.dueDate}
              onChange={(event) => setNewStep((current) => ({ ...current, dueDate: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Note</span>
            <input
              value={newStep.notes}
              onChange={(event) => setNewStep((current) => ({ ...current, notes: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Optional note"
            />
          </label>
          <button
            onClick={addItem}
            disabled={!newStep.title.trim() || savingId === 'new'}
            className="inline-flex items-center justify-center gap-2 self-end rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Icon icon={Plus} className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <div className="grid min-w-[1220px] grid-cols-[72px_minmax(220px,1fr)_90px_120px_150px_minmax(220px,1fr)_140px_150px] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase text-gray-500">
          <div>{editMode ? 'Move' : ''}</div>
          <div>Name</div>
          <div>Order</div>
          <div>Offset days</div>
          <div>Deadline</div>
          <div>Note</div>
          <div>Last update</div>
          <div>{editMode ? 'Actions' : 'Status'}</div>
        </div>

        {sortedItems.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">No booking requirements yet.</div>
        ) : (
          sortedItems.map((item, index) => {
            const id = item._id || item.key;
            const draft = drafts[id] || makeDraft(item);
            const groupKey = getBookingStepGroupKey(item);
            const tone = getBookingStepToneWithColor(groupKey, getBookingStepGroupColor(item));
            const stepStyle = getBookingStepColorStyles(tone, 'step');
            const dotStyle = getBookingStepColorStyles(tone, 'dot');
            return (
              <div key={id} className={`grid min-w-[1220px] grid-cols-[72px_minmax(220px,1fr)_90px_120px_150px_minmax(220px,1fr)_140px_150px] gap-3 border-b border-l-4 border-gray-100 px-4 py-3 last:border-b-0 ${tone.stepStripe} ${tone.stepCell}`} style={stepStyle}>
                <div className="flex items-center gap-1">
                  {editMode && <>
                  <button
                    onClick={() => moveItem(index, -1)}
                    disabled={index === 0 || savingId === item._id}
                    className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    title="Move up"
                  >
                    <Icon icon={ArrowUp} className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => moveItem(index, 1)}
                    disabled={index === sortedItems.length - 1 || savingId === item._id}
                    className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    title="Move down"
                  >
                    <Icon icon={ArrowDown} className="h-4 w-4" />
                  </button>
                  </>}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 flex-none rounded-full ${tone.dot}`} style={dotStyle} />
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{titleizeBookingStepGroup(groupKey)}</span>
                  </div>
                  {editMode ? <input
                    value={draft.title}
                    onChange={(event) => setDraft(id, { title: event.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  /> : <div className="py-2 text-sm font-medium text-gray-900">{item.title}</div>}
                </div>
                {editMode ? <input
                  type="number"
                  value={draft.order}
                  onChange={(event) => setDraft(id, { order: event.target.value })}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                /> : <div className="py-2 text-sm text-gray-700">{item.order || 0}</div>}
                {editMode ? <input
                  type="number"
                  value={draft.offsetDays}
                  onChange={(event) => setDraft(id, { offsetDays: event.target.value })}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                /> : <div className="py-2 text-sm text-gray-700">{item.offsetDays || 0}</div>}
                <div className="space-y-1">
                  {editMode ? <input
                    type="date"
                    value={draft.dueDate}
                    onChange={(event) => setDraft(id, { dueDate: event.target.value })}
                    className={`w-full rounded-md border px-3 py-2 text-sm ${item.dueDateManuallyOverridden ? 'border-amber-400 bg-amber-50' : 'border-gray-300 bg-white'}`}
                  /> : <div className="py-2 text-sm text-gray-700">{formatDate(item.dueDate)}</div>}
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    {item.dueDateManuallyOverridden ? (
                      <>
                        <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-800">Manual</span>
                        {editMode && <button
                          type="button"
                          onClick={() => resetDueDate(item)}
                          disabled={savingId === item._id}
                          className="rounded-md border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                        >
                          Reset
                        </button>}
                      </>
                    ) : (
                      <span>Auto</span>
                    )}
                  </div>
                </div>
                {editMode ? <textarea
                  value={draft.notes}
                  onChange={(event) => setDraft(id, { notes: event.target.value })}
                  rows={2}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                /> : <div className="py-2 text-sm text-gray-700">{item.notes || '—'}</div>}
                <div className="flex items-center text-sm text-gray-600">
                  {formatDate(item.updatedAt)}
                </div>
                <div className="flex items-center gap-2">
                  {editMode ? <>
                  <button
                    onClick={() => saveItem(item)}
                    disabled={savingId === item._id}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Icon icon={Save} className="h-4 w-4" />
                    Save
                  </button>
                  <button
                    onClick={() => deleteItem(item)}
                    disabled={savingId === item._id}
                    className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                    title="Delete step"
                  >
                    <Icon icon={Trash2} className="h-4 w-4" />
                  </button>
                  </> : <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold capitalize text-gray-700">{String(item.status || 'pending').replace(/_/g, ' ')}</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BookingFlowPage;
