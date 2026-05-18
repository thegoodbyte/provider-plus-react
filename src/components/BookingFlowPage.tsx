import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, RefreshCw, Save } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import { bookingsApi, bookingFlowApi, retreatsApi } from '../services/api';
import { BookingFlowItem, BookingFlowTemplate, RetreatClient, Retreat } from '../types';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => <IconComponent className={className} />;

const statusOptions: BookingFlowItem['status'][] = ['pending', 'sent', 'received', 'reviewed', 'approved', 'rejected', 'completed', 'blocked', 'waived', 'scheduled'];

const formatDate = (value?: string | Date | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

const BookingFlowPage: React.FC = () => {
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const [booking, setBooking] = useState<any>(null);
  const [retreat, setRetreat] = useState<Retreat | null>(null);
  const [templates, setTemplates] = useState<BookingFlowTemplate[]>([]);
  const [items, setItems] = useState<BookingFlowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string>('');

  useEffect(() => {
    if (bookingId) {
      loadData();
    }
  }, [bookingId]);

  const loadData = async () => {
    if (!bookingId) return;
    try {
      setLoading(true);
      const bookingResponse = await bookingsApi.getOne(bookingId);
      const currentBooking = bookingResponse.data;
      setBooking(currentBooking);
      const retreatId = typeof currentBooking.retreatId === 'string' ? currentBooking.retreatId : currentBooking.retreatId?._id;
      if (retreatId) {
        const [retreatResponse, templatesResponse, itemsResponse] = await Promise.all([
          retreatsApi.getOne(retreatId),
          bookingFlowApi.getTemplates(retreatId),
          bookingFlowApi.getItems({ bookingId }),
        ]);
        setRetreat(retreatResponse.data || null);
        setTemplates(templatesResponse.data || []);
        let flowItems = itemsResponse.data || [];
        if (flowItems.length === 0 && templatesResponse.data?.length) {
          const generated = await bookingFlowApi.generateForBooking(bookingId);
          flowItems = generated.data || [];
        }
        setItems(flowItems);
      }
    } catch (error) {
      console.error('Error loading booking flow:', error);
      setBooking(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const itemsByTemplate = useMemo(() => {
    const map = new Map<string, BookingFlowItem>();
    items.forEach((item) => {
      const key = typeof item.templateId === 'string' ? item.templateId : item.templateId?._id || item.key;
      map.set(key, item);
    });
    return map;
  }, [items]);

  const groupedTemplates = useMemo(() => {
    return [...templates].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [templates]);

  const stats = useMemo(() => ({
    total: items.length,
    completed: items.filter((item) => item.status === 'completed' || item.status === 'approved').length,
    blocked: items.filter((item) => item.status === 'blocked' || item.isBlocking).length,
    dueSoon: items.filter((item) => {
      if (!item.dueDate) return false;
      const diffDays = Math.ceil((new Date(item.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    }).length,
  }), [items]);

  const updateItem = async (itemId: string, data: Partial<BookingFlowItem>) => {
    try {
      setSavingId(itemId);
      await bookingFlowApi.updateItem(itemId, data);
      await loadData();
    } finally {
      setSavingId('');
    }
  };

  const markComplete = async (itemId: string, notes?: string) => {
    try {
      setSavingId(itemId);
      await bookingFlowApi.completeItem(itemId, notes);
      await loadData();
    } finally {
      setSavingId('');
    }
  };

  const regenerate = async () => {
    if (!bookingId) return;
    await bookingFlowApi.generateForBooking(bookingId);
    await loadData();
  };

  if (loading) {
    return <LoadingSpinner message="Loading booking flow..." />;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <button onClick={() => navigate(-1)} className="mb-3 inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Icon icon={ArrowLeft} className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">Booking Flow</h1>
          <p className="text-sm text-gray-600">
            {booking?.clientId?.firstName ? `${booking.clientId.firstName} ${booking.clientId.lastName}` : 'Unknown client'}
            {' '}• {retreat?.name || 'Unknown retreat'}
          </p>
        </div>
        <button onClick={regenerate} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Icon icon={RefreshCw} className="h-4 w-4" />
          Regenerate
        </button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Total</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">{stats.total}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Completed</div>
          <div className="mt-1 text-2xl font-semibold text-green-700">{stats.completed}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Blocked</div>
          <div className="mt-1 text-2xl font-semibold text-red-700">{stats.blocked}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Due soon</div>
          <div className="mt-1 text-2xl font-semibold text-amber-700">{stats.dueSoon}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-3">
          {groupedTemplates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
              No templates exist for this retreat. Create them in Retreat Flow first.
            </div>
          ) : (
            groupedTemplates.map((template) => {
              const item = itemsByTemplate.get(template._id || template.key);
              return (
                <div key={template._id} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{template.title}</div>
                      <div className="text-xs text-gray-500">
                        {template.workflowStage || 'potential'} • {template.category} • {template.offsetDays} days before retreat
                      </div>
                      {template.description && <div className="mt-1 text-sm text-gray-600">{template.description}</div>}
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <div>{item?.status || 'missing'}</div>
                      <div>{item?.dueDate ? `Due ${new Date(item.dueDate).toLocaleDateString()}` : 'No due date'}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <select
                      value={item?.status || 'pending'}
                      onChange={(e) => item?._id && updateItem(item._id, { status: e.target.value as BookingFlowItem['status'] })}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                    <input
                      value={item?.assignedTo || ''}
                      onChange={(e) => item?._id && updateItem(item._id, { assignedTo: e.target.value })}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                      placeholder="Assigned to"
                    />
                    <textarea
                      value={item?.notes || ''}
                      onChange={(e) => item?._id && setItems((prev) => prev.map((entry) => entry._id === item._id ? { ...entry, notes: e.target.value } : entry))}
                      rows={3}
                      className="md:col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
                      placeholder="Notes"
                    />
                  </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        disabled={!item?._id || savingId === item._id}
                        onClick={() => item?._id && updateItem(item._id, { notes: item.notes, assignedTo: item.assignedTo })}
                        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Icon icon={Save} className="h-4 w-4" />
                        Save
                      </button>
                      <button
                        disabled={!item?._id || savingId === item._id}
                        onClick={() => item?._id && markComplete(item._id, item.notes)}
                        className="inline-flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                      >
                        <Icon icon={CheckCircle2} className="h-4 w-4" />
                        Complete
                      </button>
                      {template.isBlocking && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800"><Icon icon={AlertTriangle} className="h-3.5 w-3.5" /> Blocking</span>}
                      {item?.status === 'approved' && <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800"><Icon icon={CheckCircle2} className="h-3.5 w-3.5" /> Approved</span>}
                    </div>
                </div>
              );
            })
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 text-lg font-semibold text-gray-900">Booking Snapshot</div>
          <div className="space-y-3 text-sm text-gray-700">
            <div><span className="font-medium">Client:</span> {booking?.clientId?.firstName ? `${booking.clientId.firstName} ${booking.clientId.lastName}` : 'Unknown'}</div>
            <div><span className="font-medium">Retreat:</span> {retreat?.name || 'Unknown'}</div>
            <div><span className="font-medium">Start:</span> {formatDate(retreat?.startDate)}</div>
            <div><span className="font-medium">End:</span> {formatDate(retreat?.endDate)}</div>
            <div><span className="font-medium">Status:</span> {booking?.status || 'pending'}</div>
          </div>

          <div className="mt-5 border-t border-gray-200 pt-4">
            <div className="text-sm font-semibold text-gray-900">Open items</div>
            <div className="mt-3 space-y-2">
              {items.filter((item) => item.status !== 'completed' && item.status !== 'approved').length === 0 ? (
                <div className="text-sm text-gray-500">All steps are cleared.</div>
              ) : (
                items.filter((item) => item.status !== 'completed' && item.status !== 'approved').map((item) => (
                  <div key={item._id} className="rounded-md border border-gray-200 p-3 text-sm">
                    <div className="font-medium text-gray-900">{item.title}</div>
                    <div className="text-gray-500">{item.status}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingFlowPage;
