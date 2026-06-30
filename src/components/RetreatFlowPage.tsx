import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { GripVertical, Mail, Plus, Save, Trash2 } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import { bookingFlowApi, communicationsApi, retreatsApi } from '../services/api';
import { BookingFlowTemplate, EmailTemplate, Retreat } from '../types';
import {
  getBookingStepColorStyles,
  getBookingStepToneWithColor,
  normalizeBookingStepColor,
  titleizeBookingStepGroup,
} from '../utils/bookingStepColors';

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
  taskTitle: string;
  taskPriority: 'low' | 'medium' | 'high' | 'urgent';
  readinessGroup: string;
  readinessGroupColor: string;
  expectedArtifact: string;
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
  taskTitle: '',
  taskPriority: 'medium',
  readinessGroup: '',
  readinessGroupColor: '',
  expectedArtifact: '',
  emailEnabled: false,
  emailTemplateId: '',
});

const formatDate = (value?: string | Date | null) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

const formatDeadlineLabel = (template: BookingFlowTemplate) => {
  const basis = template.deadlineBasis || template.triggerType || 'before_retreat_start';
  const cap = template.latestDaysBeforeRetreat !== undefined ? `, no later than ${template.latestDaysBeforeRetreat} days before retreat` : '';
  if (basis === 'after_signup') return `${template.offsetDays} days after signup`;
  if (basis === 'after_booking') return `${template.offsetDays} days after booking${cap}`;
  if (basis === 'after_initial_payment') return `${template.offsetDays} days after initial payment${cap}`;
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
  const [sendingTemplateId, setSendingTemplateId] = useState('');
  const [draggedTemplateId, setDraggedTemplateId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [form, setForm] = useState<TemplateForm>(emptyForm());
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);

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
      const [response, emailTemplatesResponse] = await Promise.all([
        retreatsApi.getAll(),
        communicationsApi.getTemplates(),
      ]);
      const list = response.data || [];
      setRetreats(list);
      setEmailTemplates((emailTemplatesResponse.data || []).filter((template: EmailTemplate) => template.active !== false));
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
          latestDaysBeforeRetreat: firstTemplate.latestDaysBeforeRetreat === undefined ? '' : String(firstTemplate.latestDaysBeforeRetreat),
          deadlineBasis: firstTemplate.deadlineBasis || (firstTemplate.triggerType as TemplateForm['deadlineBasis']) || 'before_retreat_start',
          active: firstTemplate.active !== false,
          isBlocking: !!firstTemplate.isBlocking,
          order: firstTemplate.order || 0,
          createsTask: !!firstTemplate.createsTask,
          reviewRequired: !!firstTemplate.reviewRequired,
          taskTitle: firstTemplate.taskTitle || '',
          taskPriority: firstTemplate.taskPriority || 'medium',
          readinessGroup: firstTemplate.readinessGroup || '',
          readinessGroupColor: firstTemplate.readinessGroupColor || '',
          expectedArtifact: firstTemplate.expectedArtifact || '',
          emailEnabled: !!firstTemplate.emailEnabled,
          emailTemplateId: typeof firstTemplate.emailTemplateId === 'string' ? firstTemplate.emailTemplateId : firstTemplate.emailTemplateId?._id || '',
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
      latestDaysBeforeRetreat: template.latestDaysBeforeRetreat === undefined ? '' : String(template.latestDaysBeforeRetreat),
      deadlineBasis: template.deadlineBasis || (template.triggerType as TemplateForm['deadlineBasis']) || 'before_retreat_start',
      active: template.active !== false,
      isBlocking: !!template.isBlocking,
      order: template.order || 0,
      createsTask: !!template.createsTask,
      reviewRequired: !!template.reviewRequired,
      taskTitle: template.taskTitle || '',
      taskPriority: template.taskPriority || 'medium',
      readinessGroup: template.readinessGroup || '',
      readinessGroupColor: template.readinessGroupColor || '',
      expectedArtifact: template.expectedArtifact || '',
      emailEnabled: !!template.emailEnabled,
      emailTemplateId: typeof template.emailTemplateId === 'string' ? template.emailTemplateId : template.emailTemplateId?._id || '',
    });
  };

  const handleNewStep = () => {
    setSelectedTemplateId('');
    setForm({
      ...emptyForm(),
      order: (sortedTemplates.at(-1)?.order || 0) + 10,
    });
  };

  const handleSave = async () => {
    if (!selectedRetreatId) return;
    try {
      setSaving(true);
      const payload = {
        retreatId: selectedRetreatId,
        ...form,
        latestDaysBeforeRetreat: form.latestDaysBeforeRetreat === '' ? undefined : Number(form.latestDaysBeforeRetreat),
        emailTemplateId: form.emailEnabled ? form.emailTemplateId : undefined,
        readinessGroupColor: normalizeBookingStepColor(form.readinessGroupColor) || undefined,
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

  const handleSendTemplateEmail = async (template: BookingFlowTemplate) => {
    if (!selectedRetreatId || !template._id || !template.emailEnabled || !template.emailTemplateId) return;
    if (!window.confirm(`Send "${template.title}" email to all participants in this retreat?`)) return;
    try {
      setSendingTemplateId(template._id);
      const response = await bookingFlowApi.sendTemplateEmailToRetreat(selectedRetreatId, template._id);
      const { sent, failed, skipped } = response.data;
      alert(`Email send finished. Sent: ${sent}. Failed: ${failed}. Skipped: ${skipped}.`);
      await loadFlow(selectedRetreatId);
    } catch (error: any) {
      console.error('Error sending step email:', error);
      alert(error?.response?.data?.message || error?.message || 'Unable to send email for this step.');
    } finally {
      setSendingTemplateId('');
    }
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

  const renderStepForm = () => (
    <div className="rounded-lg border border-blue-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
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
        <input
          value={form.latestDaysBeforeRetreat}
          type="number"
          onChange={(e) => setForm({ ...form, latestDaysBeforeRetreat: e.target.value })}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="Latest days before retreat"
        />
        <select value={form.deadlineBasis} onChange={(e) => setForm({ ...form, deadlineBasis: e.target.value as TemplateForm['deadlineBasis'] })} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="before_retreat_start">Before retreat start</option>
          <option value="after_signup">After signup</option>
          <option value="after_booking">After booking</option>
          <option value="after_initial_payment">After initial payment</option>
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
        <div className="flex gap-2">
          <input
            type="color"
            value={normalizeBookingStepColor(form.readinessGroupColor) || '#e2e8f0'}
            onChange={(e) => setForm({ ...form, readinessGroupColor: e.target.value })}
            className="h-[38px] w-12 rounded-md border border-gray-300 bg-white p-1"
            title="Section background color"
          />
          <input
            value={form.readinessGroupColor}
            onChange={(e) => setForm({ ...form, readinessGroupColor: e.target.value })}
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="Section color #dbeafe"
          />
        </div>
        <input
          value={form.expectedArtifact}
          onChange={(e) => setForm({ ...form, expectedArtifact: e.target.value })}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="Expected artifact"
        />
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

      <div className="max-w-5xl">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Flow Steps</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">{templates.length} templates</span>
              <button onClick={handleNewStep} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <Icon icon={Plus} className="h-4 w-4" />
                New Step
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {sortedTemplates.map((template) => (
              <React.Fragment key={template._id}>
                {(() => {
                  const groupKey = template.readinessGroup || template.category || 'other';
                  const tone = getBookingStepToneWithColor(groupKey, template.readinessGroupColor);
                  const stepStyle = getBookingStepColorStyles(tone, 'step');
                  const dotStyle = getBookingStepColorStyles(tone, 'dot');
                  return (
                <>
                <div
                  draggable
                  onDragStart={() => setDraggedTemplateId(template._id || '')}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => template._id && handleDropTemplate(template._id)}
                  className={`flex w-full items-center gap-2 rounded-md border border-l-4 px-3 py-2 text-left ${tone.stepStripe} ${selectedTemplateId === template._id ? `${tone.border} ${tone.stepCell} ring-1 ${tone.ring}` : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                  style={stepStyle}
                >
                  <Icon icon={GripVertical} className="h-4 w-4 flex-shrink-0 cursor-grab text-gray-400" />
                  <button type="button" onClick={() => handleSelectTemplate(template)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={`h-2.5 w-2.5 flex-none rounded-full ${tone.dot}`} style={dotStyle} />
                          <div className="truncate text-sm font-semibold text-gray-900">{template.title}</div>
                        </div>
                        <div className="truncate text-xs text-gray-500">{titleizeBookingStepGroup(groupKey)} • {formatDeadlineLabel(template)}</div>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <div>{template.workflowStage || 'potential'}</div>
                        <div>{template.active === false ? 'Hidden' : 'Active'}</div>
                        <div>{template.isBlocking ? 'Blocking' : 'Non-blocking'}</div>
                        {template.emailEnabled && <div>Email enabled</div>}
                      </div>
                    </div>
                  </button>
                  {template.emailEnabled && template.emailTemplateId && (
                    <button
                      type="button"
                      onClick={() => handleSendTemplateEmail(template)}
                      disabled={sendingTemplateId === template._id}
                      className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                      title="Send this step email to all retreat participants"
                    >
                      <Icon icon={Mail} className="h-3.5 w-3.5" />
                      {sendingTemplateId === template._id ? 'Sending...' : 'Send all'}
                    </button>
                  )}
                </div>
                {selectedTemplateId === template._id && renderStepForm()}
                </>
                  );
                })()}
              </React.Fragment>
            ))}
            {!selectedTemplateId && renderStepForm()}
            {templates.length === 0 && <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">No templates for this retreat yet. Seed defaults or add a custom step.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RetreatFlowPage;
