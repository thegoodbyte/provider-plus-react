import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangle, CalendarDays, CheckCircle2, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import SearchableRetreatSelect from './SearchableRetreatSelect';
import { bookingFlowApi, retreatsApi } from '../services/api';
import { BookingFlowItem, BookingFlowTemplate, Retreat } from '../types';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => <IconComponent className={className} />;

type TemplateForm = {
  workflowStage: BookingFlowTemplate['workflowStage'];
  key: string;
  title: string;
  description: string;
  category: BookingFlowTemplate['category'];
  offsetDays: number;
  active: boolean;
  isBlocking: boolean;
  order: number;
  createsTask: boolean;
  taskTitle: string;
  taskPriority: 'low' | 'medium' | 'high' | 'urgent';
  triggerType: string;
};

const emptyForm = (): TemplateForm => ({
  workflowStage: 'potential',
  key: '',
  title: '',
  description: '',
  category: 'other',
  offsetDays: 0,
  active: true,
  isBlocking: false,
  order: 0,
  createsTask: false,
  taskTitle: '',
  taskPriority: 'medium',
  triggerType: 'before_retreat_start',
});

const formatDate = (value?: string | Date | null) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

const RetreatFlowPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { retreatId } = useParams();
  const routePrefix = location.pathname.startsWith('/medical/') ? '/medical' : '/admin';
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [selectedRetreatId, setSelectedRetreatId] = useState<string>(retreatId || '');
  const [templates, setTemplates] = useState<BookingFlowTemplate[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [items, setItems] = useState<BookingFlowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [form, setForm] = useState<TemplateForm>(emptyForm());

  useEffect(() => {
    loadRetreats();
  }, []);

  useEffect(() => {
    if (selectedRetreatId) {
      loadFlow(selectedRetreatId);
      navigate(`/admin/retreat-flow/${selectedRetreatId}`, { replace: true });
    }
  }, [selectedRetreatId]);

  const loadRetreats = async () => {
    try {
      setLoading(true);
      const response = await retreatsApi.getAll();
      const list = response.data || [];
      setRetreats(list);
      const initial = retreatId || list[0]?._id || '';
      setSelectedRetreatId(initial);
    } catch (error) {
      console.error('Error loading retreats:', error);
      setRetreats([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFlow = async (id: string) => {
    try {
      setLoading(true);
      const [templatesResponse, bookingsResponse, itemsResponse] = await Promise.all([
        bookingFlowApi.getTemplates(id),
        bookingFlowApi.getMatrix(id),
        bookingFlowApi.getItems({ retreatId: id }),
      ]);

      setTemplates(templatesResponse.data || []);
      setBookings(bookingsResponse.data?.bookings || []);
      setItems(itemsResponse.data || []);

      const firstTemplate = templatesResponse.data?.[0];
      if (firstTemplate) {
        setSelectedTemplateId(firstTemplate._id || '');
          setForm({
          workflowStage: firstTemplate.workflowStage || 'potential',
          key: firstTemplate.key,
          title: firstTemplate.title,
          description: firstTemplate.description || '',
          category: firstTemplate.category,
          offsetDays: firstTemplate.offsetDays,
          active: firstTemplate.active !== false,
          isBlocking: !!firstTemplate.isBlocking,
          order: firstTemplate.order || 0,
          createsTask: !!firstTemplate.createsTask,
          taskTitle: firstTemplate.taskTitle || '',
          taskPriority: firstTemplate.taskPriority || 'medium',
          triggerType: firstTemplate.triggerType || 'before_retreat_start',
        });
      } else {
        setSelectedTemplateId('');
        setForm(emptyForm());
      }
    } catch (error) {
      console.error('Error loading retreat flow:', error);
      setTemplates([]);
      setBookings([]);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const selectedRetreat = useMemo(() => retreats.find((retreat) => retreat._id === selectedRetreatId), [retreats, selectedRetreatId]);

  const templateItems = useMemo(() => {
    const map = new Map<string, BookingFlowItem[]>();
    items.forEach((item) => {
      const key = typeof item.templateId === 'string' ? item.templateId : item.templateId?._id || item.key;
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    });
    return map;
  }, [items]);

  const handleSelectTemplate = (template: BookingFlowTemplate) => {
    setSelectedTemplateId(template._id || '');
    setForm({
      workflowStage: template.workflowStage || 'potential',
      key: template.key,
      title: template.title,
      description: template.description || '',
      category: template.category,
      offsetDays: template.offsetDays,
      active: template.active !== false,
      isBlocking: !!template.isBlocking,
      order: template.order || 0,
      createsTask: !!template.createsTask,
      taskTitle: template.taskTitle || '',
      taskPriority: template.taskPriority || 'medium',
      triggerType: template.triggerType || 'before_retreat_start',
    });
  };

  const handleSave = async () => {
    if (!selectedRetreatId) return;
    try {
      setSaving(true);
      const payload = {
        retreatId: selectedRetreatId,
        ...form,
      };

      if (selectedTemplateId) {
        await bookingFlowApi.updateTemplate(selectedTemplateId, payload);
      } else {
        await bookingFlowApi.createTemplate(payload as any);
      }

      await loadFlow(selectedRetreatId);
    } catch (error) {
      console.error('Error saving flow template:', error);
      alert('Error saving template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplateId) return;
    if (!window.confirm('Delete this flow step?')) return;
    await bookingFlowApi.deleteTemplate(selectedTemplateId);
    await loadFlow(selectedRetreatId);
  };

  const handleSeed = async () => {
    if (!selectedRetreatId) return;
    await bookingFlowApi.seedTemplates(selectedRetreatId);
    await loadFlow(selectedRetreatId);
  };

  const handleRegenerate = async () => {
    if (!selectedRetreatId) return;
    await bookingFlowApi.generateForRetreat(selectedRetreatId);
    await loadFlow(selectedRetreatId);
  };

  const markComplete = async (itemId: string) => {
    await bookingFlowApi.completeItem(itemId);
    await loadFlow(selectedRetreatId);
  };

  const matrixRows = useMemo(() => templates.slice().sort((a, b) => (a.order || 0) - (b.order || 0)), [templates]);

  if (loading && templates.length === 0 && bookings.length === 0) {
    return <LoadingSpinner message="Loading retreat flow..." />;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Retreat Flow</h1>
          <p className="text-sm text-gray-600">Configure what happens and when, then view the retreat matrix by client.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSeed} className="inline-flex w-auto shrink-0 items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Icon icon={Plus} className="h-4 w-4" />
            Apply Library
          </button>
          <button onClick={handleRegenerate} className="inline-flex w-auto shrink-0 items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Icon icon={RefreshCw} className="h-4 w-4" />
            Regenerate
          </button>
          <button onClick={() => navigate(`${routePrefix}/retreat-flow-library`)} className="inline-flex w-auto shrink-0 items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Open Library
          </button>
        </div>
      </div>

      <div className="mb-4 max-w-lg">
        <SearchableRetreatSelect
          retreats={retreats}
          selectedRetreatId={selectedRetreatId}
          onRetreatSelect={setSelectedRetreatId}
          placeholder="Select retreat"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Flow Steps</h2>
            <span className="text-xs text-gray-500">{templates.length} templates</span>
          </div>
          <div className="space-y-2">
            {templates.map((template) => (
              <button
                key={template._id}
                onClick={() => handleSelectTemplate(template)}
                className={`block w-full rounded-md border px-3 py-2 text-left ${selectedTemplateId === template._id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-900">{template.title}</div>
                    <div className="truncate text-xs text-gray-500">{template.category} • {template.offsetDays} days before retreat</div>
                  </div>
            <div className="text-right text-xs text-gray-500">
                    <div>{template.workflowStage || 'potential'}</div>
                    <div>{template.active === false ? 'Hidden' : 'Active'}</div>
                    <div>{template.isBlocking ? 'Blocking' : 'Non-blocking'}</div>
                  </div>
                </div>
              </button>
            ))}
            {templates.length === 0 && <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">No templates for this retreat yet. Seed defaults or add a custom step.</div>}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Key"
            />
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Title"
            />
            <select value={form.workflowStage} onChange={(e) => setForm({ ...form, workflowStage: e.target.value as TemplateForm['workflowStage'] })} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="potential">Potential</option>
              <option value="screening">Screening</option>
              <option value="payment">Payment</option>
              <option value="conditional_booking">Conditional booking</option>
              <option value="contract">Contract</option>
              <option value="questionnaire">Questionnaire</option>
              <option value="medical">Medical</option>
              <option value="prep">Prep</option>
              <option value="approved">Approved</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <input
              value={form.offsetDays}
              type="number"
              onChange={(e) => setForm({ ...form, offsetDays: Number(e.target.value) })}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Offset days"
            />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as TemplateForm['category'] })} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="screening">Screening</option>
              <option value="booking">Booking</option>
              <option value="contract">Contract</option>
              <option value="questionnaire">Questionnaire</option>
              <option value="medical">Medical</option>
              <option value="payment">Payment</option>
              <option value="dietary">Dietary</option>
              <option value="message">Message</option>
              <option value="access">Access</option>
              <option value="approval">Approval</option>
              <option value="reminder">Reminder</option>
              <option value="other">Other</option>
            </select>
          </div>

          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="Description"
          />

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              value={form.taskTitle}
              onChange={(e) => setForm({ ...form, taskTitle: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Task title"
            />
            <select value={form.taskPriority} onChange={(e) => setForm({ ...form, taskPriority: e.target.value as TemplateForm['taskPriority'] })} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <input
              value={form.order}
              type="number"
              onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Order"
            />
            <input
              value={form.triggerType}
              onChange={(e) => setForm({ ...form, triggerType: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Trigger type"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isBlocking} onChange={(e) => setForm({ ...form, isBlocking: e.target.checked })} /> Blocking</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.createsTask} onChange={(e) => setForm({ ...form, createsTask: e.target.checked })} /> Creates task</label>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                <Icon icon={Save} className="h-4 w-4" />
                {saving ? 'Saving...' : selectedTemplateId ? 'Save Step' : 'Add Step'}
              </button>
              <button onClick={() => setForm(emptyForm())} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                New
              </button>
            </div>
            <button onClick={handleDelete} className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100">
              <Icon icon={Trash2} className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 overflow-auto">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Retreat Matrix</h2>
            <span className="text-xs text-gray-500">{bookings.length} bookings</span>
          </div>
          {!selectedRetreat ? (
            <div className="p-4 text-sm text-gray-500">Select a retreat to view the flow matrix.</div>
          ) : (
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white border-b border-gray-200 px-3 py-2 text-left text-xs uppercase tracking-wide text-gray-500">Flow Step</th>
                  {bookings.map((booking) => (
                    <th key={booking._id} className="border-b border-gray-200 px-3 py-2 text-left text-xs uppercase tracking-wide text-gray-500">
                        <button className="text-left" onClick={() => navigate(`${routePrefix}/booking-flow/${booking._id}`)}>
                          <div className="font-semibold text-gray-900">{booking.clientId?.firstName || ''} {booking.clientId?.lastName || ''}</div>
                          <div className="text-[11px] text-gray-500">#{booking.clientId?.display_id || '—'}</div>
                        </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixRows.map((template) => (
                  <tr key={template._id}>
                    <td className="sticky left-0 z-10 border-b border-gray-100 bg-white px-3 py-2 align-top">
                      <div className="font-medium text-gray-900">{template.title}</div>
                      <div className="text-xs text-gray-500">{template.offsetDays} days before</div>
                    </td>
                    {bookings.map((booking) => {
                      const bookingItems = templateItems.get(template._id || template.key) || [];
                      const item = bookingItems.find((entry) => {
                        const bookingItemId = typeof entry.bookingId === 'string' ? entry.bookingId : entry.bookingId?._id;
                        return bookingItemId === booking._id;
                      });
                      return (
                        <td key={`${template._id}-${booking._id}`} className="border-b border-gray-100 px-3 py-2 align-top">
                          {item ? (
                            <div className={`rounded-md border px-2 py-2 ${item.status === 'approved' ? 'border-green-200 bg-green-50' : item.status === 'rejected' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold uppercase text-gray-700">{item.status}</span>
                                {item.isBlocking && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                              </div>
                              <div className="mt-1 text-xs text-gray-600">Due {formatDate(item.dueDate)}</div>
                              <div className="mt-1 text-xs text-gray-500">{item.notes || 'No notes'}</div>
                              {item.status !== 'completed' && item.status !== 'approved' && (
                                <button
                                  onClick={() => item._id && markComplete(item._id)}
                                  className="mt-2 inline-flex items-center gap-1 rounded-md border border-green-200 bg-white px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Complete
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400">No item</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default RetreatFlowPage;
