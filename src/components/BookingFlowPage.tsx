import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import { bookingsApi, bookingFlowApi, retreatsApi } from '../services/api';
import { BookingFlowItem, Retreat } from '../types';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => <IconComponent className={className} />;

type FlowDraft = {
  title: string;
  order: string;
  offsetDays: string;
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

const makeDraft = (item: BookingFlowItem): FlowDraft => ({
  title: item.title || '',
  order: String(item.order || 0),
  offsetDays: String(item.offsetDays || 0),
  notes: item.notes || '',
});

const BookingFlowPage: React.FC = () => {
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const [booking, setBooking] = useState<any>(null);
  const [retreat, setRetreat] = useState<Retreat | null>(null);
  const [items, setItems] = useState<BookingFlowItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, FlowDraft>>({});
  const [newStep, setNewStep] = useState<FlowDraft>({ title: '', order: '0', offsetDays: '0', notes: '' });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.title).localeCompare(String(b.title))),
    [items],
  );

  useEffect(() => {
    if (bookingId) {
      loadData();
    } else {
      setLoading(false);
      setError('Open Client Flow from a booking or workflow record.');
    }
  }, [bookingId]);

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
        await bookingFlowApi.seedLibraryTemplates();
        await bookingFlowApi.seedTemplates(retreatId);
        flowItems = (await bookingFlowApi.generateForBooking(bookingId)).data || [];
      }

      setItems(flowItems);
      hydrateDrafts(flowItems);
    } catch (err) {
      console.error('Error loading client flow:', err);
      setError('Unable to load Client Flow.');
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
        ...(current[itemId] || { title: '', order: '0', offsetDays: '0', notes: '' }),
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
        dueDate: calculateDueDate(offsetDays),
        notes: draft.notes,
      });
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
        dueDate: calculateDueDate(offsetDays),
        notes: newStep.notes,
        category: 'other',
      });
      setNewStep({ title: '', order: String((sortedItems.at(-1)?.order || 0) + 10), offsetDays: '0', notes: '' });
      await loadData();
    } finally {
      setSavingId('');
    }
  };

  const deleteItem = async (item: BookingFlowItem) => {
    if (!item._id) return;
    const confirmed = window.confirm(`Delete "${item.title}" from this client flow?`);
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
    return <LoadingSpinner message="Loading client flow..." />;
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
          <h1 className="text-2xl font-semibold text-gray-900">Client Flow</h1>
          <p className="text-sm text-gray-600">
            {(booking?.clientId as any)?.firstName ? `${(booking.clientId as any).firstName} ${(booking.clientId as any).lastName}` : 'Client'}
            {' '}• {retreat?.name || 'Retreat'} • top step happens first
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={normalizeOrder} disabled={savingId === 'normalize'} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Re-number
          </button>
          <button onClick={loadData} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Icon icon={RefreshCw} className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 text-sm font-semibold text-gray-900">Add Step</div>
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_100px_130px_minmax(220px,1fr)_auto]">
          <input
            value={newStep.title}
            onChange={(event) => setNewStep((current) => ({ ...current, title: event.target.value }))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="Name"
          />
          <input
            type="number"
            value={newStep.order}
            onChange={(event) => setNewStep((current) => ({ ...current, order: event.target.value }))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="Order"
          />
          <input
            type="number"
            value={newStep.offsetDays}
            onChange={(event) => setNewStep((current) => ({ ...current, offsetDays: event.target.value }))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="Days prior"
          />
          <input
            value={newStep.notes}
            onChange={(event) => setNewStep((current) => ({ ...current, notes: event.target.value }))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="Note"
          />
          <button
            onClick={addItem}
            disabled={!newStep.title.trim() || savingId === 'new'}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Icon icon={Plus} className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <div className="grid min-w-[1100px] grid-cols-[72px_minmax(220px,1fr)_100px_130px_minmax(220px,1fr)_140px_150px] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase text-gray-500">
          <div>Move</div>
          <div>Name</div>
          <div>Order</div>
          <div>Days prior</div>
          <div>Note</div>
          <div>Last update</div>
          <div>Actions</div>
        </div>

        {sortedItems.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">No client flow steps yet.</div>
        ) : (
          sortedItems.map((item, index) => {
            const id = item._id || item.key;
            const draft = drafts[id] || makeDraft(item);
            return (
              <div key={id} className="grid min-w-[1100px] grid-cols-[72px_minmax(220px,1fr)_100px_130px_minmax(220px,1fr)_140px_150px] gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0">
                <div className="flex items-center gap-1">
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
                </div>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft(id, { title: event.target.value })}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  value={draft.order}
                  onChange={(event) => setDraft(id, { order: event.target.value })}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  value={draft.offsetDays}
                  onChange={(event) => setDraft(id, { offsetDays: event.target.value })}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <textarea
                  value={draft.notes}
                  onChange={(event) => setDraft(id, { notes: event.target.value })}
                  rows={2}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <div className="flex items-center text-sm text-gray-600">
                  {formatDate(item.updatedAt)}
                </div>
                <div className="flex items-center gap-2">
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
