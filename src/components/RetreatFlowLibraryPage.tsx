import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Copy, GripVertical, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import SearchableRetreatSelect from './SearchableRetreatSelect';
import { bookingFlowApi, communicationsApi, retreatsApi } from '../services/api';
import { BookingFlowTemplate, EmailTemplate, Retreat } from '../types';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => <IconComponent className={className} />;

type TemplateForm = {
  workflowStage: BookingFlowTemplate['workflowStage'];
  key: string;
  title: string;
  description: string;
  category: BookingFlowTemplate['category'];
  offsetDays: number;
  latestDaysBeforeRetreat: string;
  deadlineBasis: NonNullable<BookingFlowTemplate['deadlineBasis']>;
  active: boolean;
  isBlocking: boolean;
  order: number;
  createsTask: boolean;
  reviewRequired: boolean;
  isRequirement: boolean;
  requirementType: string;
  taskTitle: string;
  taskPriority: 'low' | 'medium' | 'high' | 'urgent';
  readinessGroup: string;
  expectedArtifact: string;
  expectedDocumentStage: string;
  expectedDocumentType: string;
  expectedArtifactPurpose: string;
  autoCompleteOnArtifact: boolean;
  autoCompleteStatus: string;
  emailEnabled: boolean;
  emailTemplateId: string;
};

const emptyForm = (): TemplateForm => ({
  workflowStage: 'potential',
  key: '',
  title: '',
  description: '',
  category: 'other',
  offsetDays: 0,
  latestDaysBeforeRetreat: '',
  deadlineBasis: 'before_retreat_start',
  active: true,
  isBlocking: false,
  order: 0,
  createsTask: false,
  reviewRequired: false,
  isRequirement: false,
  requirementType: '',
  taskTitle: '',
  taskPriority: 'medium',
  readinessGroup: '',
  expectedArtifact: '',
  expectedDocumentStage: '',
  expectedDocumentType: '',
  expectedArtifactPurpose: '',
  autoCompleteOnArtifact: false,
  autoCompleteStatus: 'received',
  emailEnabled: false,
  emailTemplateId: '',
});

const formatDeadlineLabel = (template: BookingFlowTemplate) => {
  const basis = template.deadlineBasis || template.triggerType || 'before_retreat_start';
  const cap = template.latestDaysBeforeRetreat !== undefined ? `, no later than ${template.latestDaysBeforeRetreat} days before retreat` : '';
  if (basis === 'after_signup') return `${template.offsetDays} days after signup`;
  if (basis === 'after_booking') return `${template.offsetDays} days after booking${cap}`;
  if (basis === 'after_initial_payment') return `${template.offsetDays} days after initial payment${cap}`;
  if (basis === 'manual') return 'Manual due date';
  return `${template.offsetDays} days before retreat`;
};

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
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [draggedTemplateId, setDraggedTemplateId] = useState<string>('');

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [templatesResponse, retreatsResponse, emailTemplatesResponse] = await Promise.all([
        bookingFlowApi.getLibraryTemplates(),
        retreatsApi.getAll(),
        communicationsApi.getTemplates(),
      ]);

      const list = templatesResponse.data || [];
      setTemplates(list);
      setRetreats(retreatsResponse.data || []);
      setEmailTemplates((emailTemplatesResponse.data || []).filter((template: EmailTemplate) => template.active !== false));

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
      latestDaysBeforeRetreat: template.latestDaysBeforeRetreat === undefined ? '' : String(template.latestDaysBeforeRetreat),
      deadlineBasis: template.deadlineBasis || (template.triggerType as TemplateForm['deadlineBasis']) || 'before_retreat_start',
      active: template.active !== false,
      isBlocking: !!template.isBlocking,
      order: template.order || 0,
      createsTask: !!template.createsTask,
      reviewRequired: !!template.reviewRequired,
      isRequirement: !!template.isRequirement,
      requirementType: template.requirementType || '',
      taskTitle: template.taskTitle || '',
      taskPriority: template.taskPriority || 'medium',
      readinessGroup: template.readinessGroup || '',
      expectedArtifact: template.expectedArtifact || '',
      expectedDocumentStage: template.expectedDocumentStage || '',
      expectedDocumentType: template.expectedDocumentType || '',
      expectedArtifactPurpose: template.expectedArtifactPurpose || '',
      autoCompleteOnArtifact: !!template.autoCompleteOnArtifact,
      autoCompleteStatus: template.autoCompleteStatus || 'received',
      emailEnabled: !!template.emailEnabled,
      emailTemplateId: typeof template.emailTemplateId === 'string' ? template.emailTemplateId : template.emailTemplateId?._id || '',
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
        latestDaysBeforeRetreat: form.latestDaysBeforeRetreat === '' ? undefined : Number(form.latestDaysBeforeRetreat),
        deadlineBasis: form.deadlineBasis,
        active: form.active,
        isBlocking: form.isBlocking,
        order: form.order,
        createsTask: form.createsTask,
        reviewRequired: form.reviewRequired,
        isRequirement: form.isRequirement,
        requirementType: form.isRequirement ? form.requirementType : undefined,
        taskTitle: form.taskTitle,
        taskPriority: form.taskPriority,
        triggerType: form.deadlineBasis,
        readinessGroup: form.readinessGroup,
        expectedArtifact: form.expectedArtifact,
        expectedDocumentStage: form.expectedDocumentStage || undefined,
        expectedDocumentType: form.expectedDocumentType || undefined,
        expectedArtifactPurpose: form.expectedArtifactPurpose || undefined,
        autoCompleteOnArtifact: form.autoCompleteOnArtifact,
        autoCompleteStatus: form.autoCompleteStatus || 'received',
        emailEnabled: form.emailEnabled,
        emailTemplateId: form.emailEnabled ? form.emailTemplateId : undefined,
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

  const handleNewStep = () => {
    setSelectedTemplateId('');
    setForm({
      ...emptyForm(),
      order: (sortedTemplates.at(-1)?.order || 0) + 10,
    });
  };

  const handleTemplateDrop = async (targetTemplateId?: string) => {
    if (!draggedTemplateId || !targetTemplateId || draggedTemplateId === targetTemplateId) {
      setDraggedTemplateId('');
      return;
    }

    const currentList = sortedTemplates;
    const fromIndex = currentList.findIndex((template) => template._id === draggedTemplateId);
    const toIndex = currentList.findIndex((template) => template._id === targetTemplateId);
    if (fromIndex < 0 || toIndex < 0) {
      setDraggedTemplateId('');
      return;
    }

    const nextList = [...currentList];
    const [movedTemplate] = nextList.splice(fromIndex, 1);
    nextList.splice(toIndex, 0, movedTemplate);
    const reordered = nextList.map((template, index) => ({ ...template, order: (index + 1) * 10 }));
    setTemplates(reordered);
    setDraggedTemplateId('');

    try {
      await Promise.all(reordered.map((template) => (
        template._id ? bookingFlowApi.updateLibraryTemplate(template._id, { order: template.order }) : Promise.resolve()
      )));
      await loadData();
    } catch (error) {
      console.error('Error reordering library templates:', error);
      alert('Error reordering booking steps');
      await loadData();
    }
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

  const renderTemplateEditor = () => (
    <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <div className="border-b border-gray-200 pb-3">
        <h3 className="text-sm font-semibold text-gray-900">{selectedTemplateId ? 'Edit Selected Step' : 'Add New Step'}</h3>
        <p className="text-xs text-gray-500">These fields define what gets generated onto each booking requirement row.</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Step key</span>
          <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="ekg_received" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Display title</span>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Entry EKG received" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Workflow stage</span>
          <select value={form.workflowStage} onChange={(e) => setForm({ ...form, workflowStage: e.target.value as TemplateForm['workflowStage'] })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
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
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Deadline basis</span>
          <select value={form.deadlineBasis} onChange={(e) => setForm({ ...form, deadlineBasis: e.target.value as TemplateForm['deadlineBasis'] })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="before_retreat_start">Before retreat start</option>
            <option value="after_signup">After signup</option>
            <option value="after_booking">After booking</option>
            <option value="after_initial_payment">After initial payment</option>
            <option value="manual">Manual due date</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Offset days</span>
          <input value={form.offsetDays} type="number" onChange={(e) => setForm({ ...form, offsetDays: Number(e.target.value) })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="21" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Latest days before retreat</span>
          <input value={form.latestDaysBeforeRetreat} type="number" onChange={(e) => setForm({ ...form, latestDaysBeforeRetreat: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Optional cap, e.g. 21" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Category</span>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as TemplateForm['category'] })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
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
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Description</span>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Description" />
      </label>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Task title</span>
          <input value={form.taskTitle} onChange={(e) => setForm({ ...form, taskTitle: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Check EKG received" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Task priority</span>
          <select value={form.taskPriority} onChange={(e) => setForm({ ...form, taskPriority: e.target.value as TemplateForm['taskPriority'] })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Display order</span>
          <input value={form.order} type="number" onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="60" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Readiness group</span>
          <input value={form.readinessGroup} onChange={(e) => setForm({ ...form, readinessGroup: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="ekg" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Expected artifact</span>
          <input value={form.expectedArtifact} onChange={(e) => setForm({ ...form, expectedArtifact: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="ekg" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Expected stage</span>
          <select value={form.expectedDocumentStage} onChange={(e) => setForm({ ...form, expectedDocumentStage: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Any entry-stage upload</option>
            <option value="entry">Entry</option>
            <option value="pre_ceremony">Pre-ceremony</option>
            <option value="in_ceremony">In-ceremony</option>
            <option value="post_ceremony">Post-ceremony</option>
            <option value="other">Other</option>
            <option value="additional">Additional</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Expected document type</span>
          <select value={form.expectedDocumentType} onChange={(e) => setForm({ ...form, expectedDocumentType: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Any</option>
            <option value="EKG">EKG</option>
            <option value="Liver">Liver</option>
            <option value="BP">BP</option>
            <option value="meds">Meds</option>
            <option value="Medications">Medications</option>
            <option value="additional">Additional</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Expected purpose</span>
          <select value={form.expectedArtifactPurpose} onChange={(e) => setForm({ ...form, expectedArtifactPurpose: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Any</option>
            <option value="booking_requirement">Booking requirement</option>
            <option value="pre_ceremony">Pre-ceremony</option>
            <option value="paid_review">Paid review</option>
            <option value="repeat_test">Repeat test</option>
            <option value="correction">Correction</option>
            <option value="general">General</option>
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">
          <input
            type="checkbox"
            checked={form.autoCompleteOnArtifact}
            onChange={(e) => setForm({ ...form, autoCompleteOnArtifact: e.target.checked })}
          />
          Auto-mark when matching artifact is uploaded
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Auto status</span>
          <select value={form.autoCompleteStatus} onChange={(e) => setForm({ ...form, autoCompleteStatus: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="received">Received</option>
            <option value="completed">Completed</option>
            <option value="approved">Approved</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Requirement type</span>
          <input value={form.requirementType} onChange={(e) => setForm({ ...form, requirementType: e.target.value, isRequirement: Boolean(e.target.value) || form.isRequirement })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="entry_ekg" />
        </label>
      </div>

      <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <input
            type="checkbox"
            checked={form.emailEnabled}
            onChange={(e) => setForm({ ...form, emailEnabled: e.target.checked })}
          />
          Send email from this step
        </label>
        <select
          value={form.emailTemplateId}
          onChange={(e) => setForm({ ...form, emailTemplateId: e.target.value, emailEnabled: Boolean(e.target.value) })}
          disabled={!form.emailEnabled}
          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
        >
          <option value="">Select email template</option>
          {emailTemplates.map((template) => (
            <option key={template._id} value={template._id}>{template.name} ({template.category || 'general'})</option>
          ))}
        </select>
      </div>

      <div className="mt-3 rounded-md border border-gray-200 bg-white p-3">
        <div className="mb-2 text-xs font-semibold uppercase text-gray-500">Step flags</div>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.isBlocking} onChange={(e) => setForm({ ...form, isBlocking: e.target.checked })} /> Blocking requirement</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.createsTask} onChange={(e) => setForm({ ...form, createsTask: e.target.checked })} /> Creates task</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.reviewRequired} onChange={(e) => setForm({ ...form, reviewRequired: e.target.checked })} /> Review required</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.isRequirement} onChange={(e) => setForm({ ...form, isRequirement: e.target.checked })} /> Booking requirement</label>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            <Icon icon={Save} className="h-4 w-4" />
            {saving ? 'Saving...' : selectedTemplateId ? 'Save Step' : 'Add Step'}
          </button>
          <button onClick={handleNewStep} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            New
          </button>
        </div>
        {selectedTemplateId && (
          <button onClick={handleDelete} className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100">
            <Icon icon={Trash2} className="h-4 w-4" />
            Delete
          </button>
        )}
      </div>
    </div>
  );

  if (loading && templates.length === 0) {
    return <LoadingSpinner message="Loading booking step setup..." />;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Booking Step Setup</h1>
          <p className="text-sm text-gray-600">Configure the master booking steps, deadlines, artifact matching, and order used when bookings are created.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSeed} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Icon icon={Plus} className="h-4 w-4" />
            Seed Defaults
          </button>
          <button onClick={() => navigate(`${routePrefix}/retreat-flow`)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Icon icon={RefreshCw} className="h-4 w-4" />
            Open Retreat Readiness
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
            <h2 className="text-lg font-semibold text-gray-900">Step Definitions</h2>
            <span className="text-xs text-gray-500">{sortedTemplates.length} steps</span>
          </div>
          <div className="space-y-2">
            {sortedTemplates.map((template) => {
              const isSelected = selectedTemplateId === template._id;

              return (
                <React.Fragment key={template._id}>
                  <button
                    draggable
                    onDragStart={() => setDraggedTemplateId(template._id || '')}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleTemplateDrop(template._id)}
                    onClick={() => selectTemplate(template)}
                    className={`block w-full rounded-md border bg-white px-3 py-2 text-left ${
                      isSelected
                        ? 'border-gray-400 ring-1 ring-gray-300'
                        : 'border-gray-200 hover:bg-gray-50'
                    } ${draggedTemplateId === template._id ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <Icon icon={GripVertical} className="h-4 w-4 shrink-0 text-gray-400" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-gray-900">{template.title}</div>
                          <div className="truncate text-xs text-gray-500">{template.key} • {template.category} • {formatDeadlineLabel(template)}</div>
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <div>#{template.order || 0}</div>
                        <div>{template.workflowStage || 'potential'}</div>
                        <div>{template.active === false ? 'Hidden' : 'Active'}</div>
                        <div>{template.isBlocking ? 'Blocking' : 'Non-blocking'}</div>
                        {template.emailEnabled && <div>Email enabled</div>}
                      </div>
                    </div>
                  </button>
                  {isSelected && (
                    <div className="mb-4 mt-2">
                      {renderTemplateEditor()}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
            {sortedTemplates.length === 0 && <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">No booking step definitions yet. Seed defaults to create the standard booking flow.</div>}
          </div>

          {!selectedTemplateId && (
            <div className="mt-4">
              {renderTemplateEditor()}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Apply to Retreat</h2>
          </div>
          <p className="text-sm text-gray-600">
            Apply the selected step or the full setup to a retreat. This copies the global booking step definitions into the retreat-specific readiness setup.
          </p>

          <div className="mt-4 space-y-3">
            <button
              disabled={!selectedRetreatId || applying}
              onClick={handleApplySelected}
              className="inline-flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <Icon icon={Copy} className="h-4 w-4" />
                Apply selected step
              </span>
              <span className="text-xs text-gray-500">{selectedRetreatId ? 'to retreat' : 'select retreat'}</span>
            </button>

            <button
              disabled={!selectedRetreatId || applying}
              onClick={handleApplyAll}
              className="inline-flex w-full items-center justify-between rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <Icon icon={CheckCircle2} className="h-4 w-4" />
                Apply full setup
              </span>
              <span className="text-xs text-white/80">{selectedRetreatId ? 'sync retreat' : 'select retreat'}</span>
            </button>
          </div>

          <div className="mt-6 rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-600">
            Use this page as the master booking step configuration. Generated booking requirement rows keep their own due dates, statuses, notes, and update history.
          </div>
        </div>
      </div>
    </div>
  );
};

export default RetreatFlowLibraryPage;
