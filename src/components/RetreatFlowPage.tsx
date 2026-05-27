import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { GripVertical, Plus, Save, Trash2 } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
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
  deadlineBasis: NonNullable<BookingFlowTemplate['deadlineBasis']>;
  active: boolean;
  isBlocking: boolean;
  order: number;
  createsTask: boolean;
  reviewRequired: boolean;
  taskTitle: string;
  taskPriority: 'low' | 'medium' | 'high' | 'urgent';
  readinessGroup: string;
  expectedArtifact: string;
};

const emptyForm = (): TemplateForm => ({
  workflowStage: 'potential',
  key: '',
  title: '',
  description: '',
  category: 'other',
  offsetDays: 0,
  deadlineBasis: 'before_retreat_start',
  active: true,
  isBlocking: false,
  order: 0,
  createsTask: false,
  reviewRequired: false,
  taskTitle: '',
  taskPriority: 'medium',
  readinessGroup: '',
  expectedArtifact: '',
});

const formatDate = (value?: string | Date | null) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

const formatDeadlineLabel = (template: BookingFlowTemplate) => {
  const basis = template.deadlineBasis || template.triggerType || 'before_retreat_start';
  if (basis === 'after_signup') return `${template.offsetDays} days after signup`;
  if (basis === 'after_booking') return `${template.offsetDays} days after booking`;
  if (basis === 'manual') return 'Manual due date';
  return `${template.offsetDays} days before retreat`;
};

const RetreatFlowPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { retreatId } = useParams();
  const routePrefix = location.pathname.startsWith('/medical/') ? '/medical' : '/admin';
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [selectedRetreatId, setSelectedRetreatId] = useState<string>(retreatId || '');
  const [templates, setTemplates] = useState<BookingFlowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedTemplateId, setDraggedTemplateId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [form, setForm] = useState<TemplateForm>(emptyForm());

  useEffect(() => {
    loadRetreats();
  }, []);

  useEffect(() => {
    const nextRetreatId = retreatId || '';
    setSelectedRetreatId(nextRetreatId);
    if (nextRetreatId) {
      loadFlow(nextRetreatId);
    } else {
      setTemplates([]);
      setSelectedTemplateId('');
      setForm(emptyForm());
    }
  }, [retreatId]);

  const loadRetreats = async () => {
    try {
      setLoading(true);
      const response = await retreatsApi.getAll();
      const list = response.data || [];
      setRetreats(list);
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
      const templatesResponse = await bookingFlowApi.getTemplates(id);

      setTemplates(templatesResponse.data || []);

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
          deadlineBasis: firstTemplate.deadlineBasis || (firstTemplate.triggerType as TemplateForm['deadlineBasis']) || 'before_retreat_start',
          active: firstTemplate.active !== false,
          isBlocking: !!firstTemplate.isBlocking,
          order: firstTemplate.order || 0,
          createsTask: !!firstTemplate.createsTask,
          reviewRequired: !!firstTemplate.reviewRequired,
          taskTitle: firstTemplate.taskTitle || '',
          taskPriority: firstTemplate.taskPriority || 'medium',
          readinessGroup: firstTemplate.readinessGroup || '',
          expectedArtifact: firstTemplate.expectedArtifact || '',
        });
      } else {
        setSelectedTemplateId('');
        setForm(emptyForm());
      }
    } catch (error) {
      console.error('Error loading retreat flow:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const selectedRetreat = useMemo(() => retreats.find((retreat) => retreat._id === selectedRetreatId), [retreats, selectedRetreatId]);
  const sortedTemplates = useMemo(() => templates.slice().sort((a, b) => (a.order || 0) - (b.order || 0)), [templates]);

  const handleSelectTemplate = (template: BookingFlowTemplate) => {
    setSelectedTemplateId(template._id || '');
    setForm({
      workflowStage: template.workflowStage || 'potential',
      key: template.key,
      title: template.title,
      description: template.description || '',
      category: template.category,
      offsetDays: template.offsetDays,
      deadlineBasis: template.deadlineBasis || (template.triggerType as TemplateForm['deadlineBasis']) || 'before_retreat_start',
      active: template.active !== false,
      isBlocking: !!template.isBlocking,
      order: template.order || 0,
      createsTask: !!template.createsTask,
      reviewRequired: !!template.reviewRequired,
      taskTitle: template.taskTitle || '',
      taskPriority: template.taskPriority || 'medium',
      readinessGroup: template.readinessGroup || '',
      expectedArtifact: template.expectedArtifact || '',
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

  const handleDropTemplate = async (targetTemplateId: string) => {
    if (!draggedTemplateId || draggedTemplateId === targetTemplateId) return;
    const current = [...sortedTemplates];
    const fromIndex = current.findIndex((template) => template._id === draggedTemplateId);
    const toIndex = current.findIndex((template) => template._id === targetTemplateId);
    if (fromIndex < 0 || toIndex < 0) return;

    const [dragged] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, dragged);
    const reordered = current.map((template, index) => ({ ...template, order: (index + 1) * 10 }));
    setTemplates(reordered);
    setDraggedTemplateId('');

    await Promise.all(reordered.map((template) => (
      template._id ? bookingFlowApi.updateTemplate(template._id, { order: template.order }) : Promise.resolve()
    )));
    await loadFlow(selectedRetreatId);
  };

  if (loading && retreats.length === 0 && templates.length === 0) {
    return <LoadingSpinner message="Loading retreat readiness..." />;
  }

  if (!selectedRetreatId) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Retreat Readiness</h1>
          <p className="text-sm text-gray-600">Choose a retreat to edit its readiness steps.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {retreats.map((retreat) => (
            <button
              key={retreat._id}
              onClick={() => navigate(`${routePrefix}/retreat-flow/${retreat._id}`)}
              className="rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-blue-300 hover:shadow-md"
            >
              <div className="text-sm font-semibold text-gray-900">{retreat.name}</div>
              <div className="mt-1 text-xs text-gray-500">
                {formatDate(retreat.startDate)} - {formatDate(retreat.endDate)}
              </div>
              <div className="mt-2 text-xs capitalize text-gray-500">{retreat.status || 'upcoming'}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Retreat Readiness</h1>
          <p className="text-sm text-gray-600">{selectedRetreat?.name || 'Selected retreat'} • drag steps to reorder; top happens first.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSeed} className="inline-flex w-auto shrink-0 items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Icon icon={Plus} className="h-4 w-4" />
            Apply Library
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Flow Steps</h2>
            <span className="text-xs text-gray-500">{templates.length} templates</span>
          </div>
          <div className="space-y-2">
            {sortedTemplates.map((template) => (
              <div
                key={template._id}
                draggable
                onDragStart={() => setDraggedTemplateId(template._id || '')}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => template._id && handleDropTemplate(template._id)}
                className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left ${selectedTemplateId === template._id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <Icon icon={GripVertical} className="h-4 w-4 flex-shrink-0 cursor-grab text-gray-400" />
                <button type="button" onClick={() => handleSelectTemplate(template)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-900">{template.title}</div>
                    <div className="truncate text-xs text-gray-500">{template.category} • {formatDeadlineLabel(template)}</div>
                  </div>
            <div className="text-right text-xs text-gray-500">
                    <div>{template.workflowStage || 'potential'}</div>
                    <div>{template.active === false ? 'Hidden' : 'Active'}</div>
                    <div>{template.isBlocking ? 'Blocking' : 'Non-blocking'}</div>
                  </div>
                </div>
                </button>
              </div>
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
            <select value={form.deadlineBasis} onChange={(e) => setForm({ ...form, deadlineBasis: e.target.value as TemplateForm['deadlineBasis'] })} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="before_retreat_start">Before retreat start</option>
              <option value="after_signup">After signup</option>
              <option value="after_booking">After booking</option>
              <option value="manual">Manual due date</option>
            </select>
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
              value={form.readinessGroup}
              onChange={(e) => setForm({ ...form, readinessGroup: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Readiness group (ekg, liver...)"
            />
            <input
              value={form.expectedArtifact}
              onChange={(e) => setForm({ ...form, expectedArtifact: e.target.value })}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Expected artifact"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isBlocking} onChange={(e) => setForm({ ...form, isBlocking: e.target.checked })} /> Blocking</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.createsTask} onChange={(e) => setForm({ ...form, createsTask: e.target.checked })} /> Creates task</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.reviewRequired} onChange={(e) => setForm({ ...form, reviewRequired: e.target.checked })} /> Review required</label>
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
      </div>
    </div>
  );
};

export default RetreatFlowPage;
