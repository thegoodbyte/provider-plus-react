import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Copy, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import SearchableRetreatSelect from './SearchableRetreatSelect';
import { bookingFlowApi, retreatsApi } from '../services/api';
import { BookingFlowTemplate, Retreat } from '../types';

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

const RetreatFlowLibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = location.pathname.startsWith('/medical/') ? '/medical' : '/admin';
  const [templates, setTemplates] = useState<BookingFlowTemplate[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedRetreatId, setSelectedRetreatId] = useState<string>('');
  const [form, setForm] = useState<TemplateForm>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [templatesResponse, retreatsResponse] = await Promise.all([
        bookingFlowApi.getLibraryTemplates(),
        retreatsApi.getAll(),
      ]);

      const list = templatesResponse.data || [];
      setTemplates(list);
      setRetreats(retreatsResponse.data || []);

      const first = list[0];
      if (first) {
        selectTemplate(first);
      } else {
        setSelectedTemplateId('');
        setForm(emptyForm());
      }
    } catch (error) {
      console.error('Error loading retreat flow library:', error);
      setTemplates([]);
      setRetreats([]);
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = (template: BookingFlowTemplate) => {
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
    try {
      setSaving(true);
      const payload = {
        templateScope: 'global' as const,
        workflowStage: form.workflowStage,
        key: form.key,
        title: form.title,
        description: form.description,
        category: form.category,
        offsetDays: form.offsetDays,
        active: form.active,
        isBlocking: form.isBlocking,
        order: form.order,
        createsTask: form.createsTask,
        taskTitle: form.taskTitle,
        taskPriority: form.taskPriority,
        triggerType: form.triggerType,
      };

      if (selectedTemplateId) {
        await bookingFlowApi.updateLibraryTemplate(selectedTemplateId, payload);
      } else {
        await bookingFlowApi.createLibraryTemplate(payload as any);
      }

      await loadData();
    } catch (error) {
      console.error('Error saving library template:', error);
      alert('Error saving template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplateId) return;
    if (!window.confirm('Delete this library step?')) return;
    await bookingFlowApi.deleteLibraryTemplate(selectedTemplateId);
    await loadData();
  };

  const handleSeed = async () => {
    await bookingFlowApi.seedLibraryTemplates();
    await loadData();
  };

  const handleApplySelected = async () => {
    if (!selectedTemplateId || !selectedRetreatId) return;
    try {
      setApplying(true);
      await bookingFlowApi.applyLibraryTemplateToRetreat(selectedTemplateId, selectedRetreatId);
      navigate(`${routePrefix}/retreat-flow/${selectedRetreatId}`);
    } finally {
      setApplying(false);
    }
  };

  const handleApplyAll = async () => {
    if (!selectedRetreatId) return;
    try {
      setApplying(true);
      await bookingFlowApi.applyLibraryToRetreat(selectedRetreatId);
      navigate(`${routePrefix}/retreat-flow/${selectedRetreatId}`);
    } finally {
      setApplying(false);
    }
  };

  const sortedTemplates = useMemo(() => templates.slice().sort((a, b) => (a.order || 0) - (b.order || 0)), [templates]);

  if (loading && templates.length === 0) {
    return <LoadingSpinner message="Loading retreat flow library..." />;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Retreat Flow Library</h1>
          <p className="text-sm text-gray-600">Define the generic flow once, then apply it to any retreat.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSeed} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Icon icon={Plus} className="h-4 w-4" />
            Seed Defaults
          </button>
          <button onClick={() => navigate(`${routePrefix}/retreat-flow`)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Icon icon={RefreshCw} className="h-4 w-4" />
            Open Retreat Flow
          </button>
        </div>
      </div>

      <div className="mb-4 max-w-lg">
        <SearchableRetreatSelect
          retreats={retreats}
          selectedRetreatId={selectedRetreatId}
          onRetreatSelect={setSelectedRetreatId}
          placeholder="Select retreat to apply library to"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Library Steps</h2>
            <span className="text-xs text-gray-500">{sortedTemplates.length} templates</span>
          </div>
          <div className="space-y-2">
            {sortedTemplates.map((template) => (
              <button
                key={template._id}
                onClick={() => selectTemplate(template)}
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
            {sortedTemplates.length === 0 && <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">No library steps yet. Seed defaults to create the generic retreat flow.</div>}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Key" />
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Title" />
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
            <input value={form.offsetDays} type="number" onChange={(e) => setForm({ ...form, offsetDays: Number(e.target.value) })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Offset days" />
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

          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Description" />

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input value={form.taskTitle} onChange={(e) => setForm({ ...form, taskTitle: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Task title" />
            <select value={form.taskPriority} onChange={(e) => setForm({ ...form, taskPriority: e.target.value as TemplateForm['taskPriority'] })} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <input value={form.order} type="number" onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Order" />
            <input value={form.triggerType} onChange={(e) => setForm({ ...form, triggerType: e.target.value })} className="rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Trigger type" />
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

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Apply to Retreat</h2>
          </div>
          <p className="text-sm text-gray-600">
            Apply the selected step or the full library to a retreat. This copies the generic flow into the retreat-specific flow.
          </p>

          <div className="mt-4 space-y-3">
            <button
              disabled={!selectedRetreatId || applying}
              onClick={handleApplySelected}
              className="inline-flex w-full items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <Icon icon={Copy} className="h-4 w-4" />
                Apply selected step
              </span>
              <span className="text-xs text-blue-600">{selectedRetreatId ? 'to retreat' : 'select retreat'}</span>
            </button>

            <button
              disabled={!selectedRetreatId || applying}
              onClick={handleApplyAll}
              className="inline-flex w-full items-center justify-between rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <Icon icon={CheckCircle2} className="h-4 w-4" />
                Apply full library
              </span>
              <span className="text-xs text-white/80">{selectedRetreatId ? 'sync retreat' : 'select retreat'}</span>
            </button>
          </div>

          <div className="mt-6 rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-600">
            Use this page to build the generic retreat flow once. Then apply it from here into one retreat or keep it as your master template.
          </div>
        </div>
      </div>
    </div>
  );
};

export default RetreatFlowLibraryPage;
