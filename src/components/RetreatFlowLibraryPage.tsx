import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BadgeCheck, BellRing, CalendarCheck2, CalendarClock, ClipboardList, CreditCard, FileSearch, Flag, GripVertical, HeartPulse, KeyRound, LayoutTemplate, ListChecks, Mail, Save, Scale, ShieldCheck, Trash2, Utensils, X } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import SearchableRetreatSelect from './SearchableRetreatSelect';
import { bookingFlowApi, communicationsApi, retreatsApi } from '../services/api';
import { BookingFlowAction, BookingFlowTemplate, BookingReminderRule, EmailTemplate, Retreat } from '../types';
import {
  getBookingStepDefaultColor,
  getBookingStepColorStyles,
  getBookingStepToneWithColor,
  normalizeBookingStepColor,
  titleizeBookingStepGroup,
} from '../utils/bookingStepColors';
import BookingStepColorField from './BookingStepColorField';
import { BOOKING_STEP_TYPES, BookingStepTypeIcon, getBookingStepType } from './bookingStepTypes';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => <IconComponent className={className} />;

type TemplateForm = {
  workflowStage: BookingFlowTemplate['workflowStage'];
  applicableRetreatTypes: string;
  key: string;
  title: string;
  description: string;
  category: BookingFlowTemplate['category'];
  stepType: NonNullable<BookingFlowTemplate['stepType']>;
  offsetDays: number;
  latestDaysBeforeRetreat: string;
  deadlineBasis: NonNullable<BookingFlowTemplate['deadlineBasis']>;
  active: boolean;
  isBlocking: boolean;
  order: number;
  createsTask: boolean;
  reviewRequired: boolean;
  isRequirement: boolean;
  requiredFromClient: boolean;
  clientFacingName: { en: string; pl: string; cz: string };
  clientFacingDescription: { en: string; pl: string; cz: string };
  requirementType: string;
  taskTitle: string;
  taskPriority: 'low' | 'medium' | 'high' | 'urgent';
  readinessGroup: string;
  readinessGroupColor: string;
  expectedArtifact: string;
  expectedDocumentStage: string;
  expectedDocumentType: string;
  expectedArtifactPurpose: string;
  clientTagOnComplete: string;
  autoCompleteOnArtifact: boolean;
  autoCompleteStatus: string;
  autoCompleteCondition: 'manual' | 'matching_artifact' | 'balance_fully_paid';
  emailEnabled: boolean;
  emailTemplateId: string;
  actions: BookingFlowAction[];
  reminderRules: BookingReminderRule[];
};

type EditorTab = 'basics' | 'deadline' | 'artifact' | 'reminders' | 'flags';

const bookingStepCategoryIcons: Record<string, React.ElementType> = {
  screening: ShieldCheck, booking: CalendarCheck2, contract: Scale, questionnaire: ClipboardList,
  medical: HeartPulse, payment: CreditCard, payments: CreditCard, dietary: Utensils,
  message: Mail, access: KeyRound, approval: BadgeCheck, approvals: BadgeCheck,
  reminder: BellRing, reminders: BellRing, other: ListChecks,
};

const emptyForm = (): TemplateForm => ({
  workflowStage: 'potential',
  applicableRetreatTypes: '',
  key: '',
  title: '',
  description: '',
  category: 'other',
  stepType: 'internal_task',
  offsetDays: 0,
  latestDaysBeforeRetreat: '',
  deadlineBasis: 'before_retreat_start',
  active: true,
  isBlocking: false,
  order: 0,
  createsTask: false,
  reviewRequired: false,
  isRequirement: false,
  requiredFromClient: false,
  clientFacingName: { en: '', pl: '', cz: '' },
  clientFacingDescription: { en: '', pl: '', cz: '' },
  requirementType: '',
  taskTitle: '',
  taskPriority: 'medium',
  readinessGroup: '',
  readinessGroupColor: '',
  expectedArtifact: '',
  expectedDocumentStage: '',
  expectedDocumentType: '',
  expectedArtifactPurpose: '',
  clientTagOnComplete: '',
  autoCompleteOnArtifact: false,
  autoCompleteStatus: 'received',
  autoCompleteCondition: 'manual',
  emailEnabled: false,
  emailTemplateId: '',
  actions: [],
  reminderRules: [],
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

const normalizeGroupKey = (value?: string) => String(value || 'other').trim().toLowerCase().replace(/[\s-]+/g, '_') || 'other';

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
  const [importBackup, setImportBackup] = useState<any>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importMode, setImportMode] = useState<'merge_by_key' | 'restore_exact_ids'>('merge_by_key');
  const [importing, setImporting] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab>('basics');
  const [clientFacingLanguageTab, setClientFacingLanguageTab] = useState<'en' | 'pl' | 'cz'>('en');
  const [stepSearch, setStepSearch] = useState('');
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const normalizeTemplateActionsForForm = (template: BookingFlowTemplate): BookingFlowAction[] => {
    const actions = (template.actions || []).map((action) => ({
      ...action,
      emailTemplateId: typeof action.emailTemplateId === 'string' ? action.emailTemplateId : action.emailTemplateId?._id || '',
    }));
    const legacyEmailTemplateId = typeof template.emailTemplateId === 'string' ? template.emailTemplateId : template.emailTemplateId?._id || '';
    if (template.emailEnabled && legacyEmailTemplateId && !actions.some((action) => action.type === 'email' && action.emailTemplateId)) {
      actions.unshift({
        key: 'default_email',
        label: 'Send email',
        type: 'email',
        active: true,
        emailTemplateId: legacyEmailTemplateId,
        statusAfterSuccess: 'sent',
        allowRepeat: true,
        openComposer: true,
        order: -1,
      });
    }
    return actions;
  };

  const groupColorByKey = useMemo(() => {
    const colors: Record<string, string> = {};
    templates.forEach((template) => {
      const groupKey = normalizeGroupKey(template.readinessGroup || template.category);
      const color = normalizeBookingStepColor(template.readinessGroupColor);
      if (color && !colors[groupKey]) colors[groupKey] = color;
    });
    return colors;
  }, [templates]);

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
        setClientFacingLanguageTab('en');
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
    const groupKey = normalizeGroupKey(template.readinessGroup || template.category);
    setSelectedTemplateId(template._id || '');
    setClientFacingLanguageTab('en');
      setForm({
        workflowStage: template.workflowStage || 'potential',
      applicableRetreatTypes: (template.applicableRetreatTypes || []).join(', '),
        key: template.key,
      title: template.title,
      description: template.description || '',
      category: template.category,
      stepType: template.stepType || 'internal_task',
      offsetDays: template.offsetDays,
      latestDaysBeforeRetreat: template.latestDaysBeforeRetreat === undefined ? '' : String(template.latestDaysBeforeRetreat),
      deadlineBasis: template.deadlineBasis || (template.triggerType as TemplateForm['deadlineBasis']) || 'before_retreat_start',
      active: template.active !== false,
      isBlocking: !!template.isBlocking,
      order: template.order || 0,
      createsTask: !!template.createsTask,
      reviewRequired: !!template.reviewRequired,
      isRequirement: !!template.isRequirement,
      requiredFromClient: template.requiredFromClient ?? !!template.isRequirement,
      clientFacingName: { en: template.clientFacingName?.en || '', pl: template.clientFacingName?.pl || '', cz: template.clientFacingName?.cz || '' },
      clientFacingDescription: { en: template.clientFacingDescription?.en || '', pl: template.clientFacingDescription?.pl || '', cz: template.clientFacingDescription?.cz || '' },
      requirementType: template.requirementType || '',
      taskTitle: template.taskTitle || '',
      taskPriority: template.taskPriority || 'medium',
      readinessGroup: template.readinessGroup || '',
      readinessGroupColor: template.readinessGroupColor || groupColorByKey[groupKey] || getBookingStepDefaultColor(groupKey),
      expectedArtifact: template.expectedArtifact || '',
      expectedDocumentStage: template.expectedDocumentStage || '',
      expectedDocumentType: template.expectedDocumentType || '',
      expectedArtifactPurpose: template.expectedArtifactPurpose || '',
      clientTagOnComplete: template.clientTagOnComplete || '',
      autoCompleteOnArtifact: !!template.autoCompleteOnArtifact,
      autoCompleteStatus: template.autoCompleteStatus || 'received',
      autoCompleteCondition: template.autoCompleteCondition || (template.autoCompleteOnArtifact ? 'matching_artifact' : 'manual'),
      emailEnabled: !!template.emailEnabled,
      emailTemplateId: typeof template.emailTemplateId === 'string' ? template.emailTemplateId : template.emailTemplateId?._id || '',
      actions: normalizeTemplateActionsForForm(template),
      reminderRules: template.reminderRules || [],
    });
  };

  const addReminderRule = () => setForm((current) => ({
    ...current,
    reminderRules: [...current.reminderRules, {
      key: `reminder_${current.reminderRules.length + 1}`,
      offsetDays: 0,
      actionType: 'send_email',
      active: true,
    }],
  }));

  const updateReminderRule = (index: number, patch: Partial<BookingReminderRule>) => setForm((current) => ({
    ...current,
    reminderRules: current.reminderRules.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...patch } : rule),
  }));

  const removeReminderRule = (index: number) => setForm((current) => ({
    ...current,
    reminderRules: current.reminderRules.filter((_rule, ruleIndex) => ruleIndex !== index),
  }));

  const handleSave = async () => {
    try {
      setSaving(true);
      const normalizedActions = form.actions.map((action, index) => ({
        ...action,
        key: action.key || `${action.type}_${index + 1}`,
        label: action.label || 'Action',
        emailTemplateId: action.type === 'email' ? (typeof action.emailTemplateId === 'string' ? action.emailTemplateId : action.emailTemplateId?._id) : undefined,
        urlTemplate: action.type === 'whatsapp' || action.type === 'link' ? action.urlTemplate : undefined,
        order: action.order ?? index,
      }));
      const primaryEmailAction = normalizedActions.find((action) => action.type === 'email' && action.emailTemplateId);
      const payload = {
        templateScope: 'global' as const,
        workflowStage: form.workflowStage,
        applicableRetreatTypes: form.applicableRetreatTypes.split(',').map((value) => value.trim()).filter(Boolean),
        key: form.key,
        title: form.title,
        description: form.description,
        category: form.category,
        stepType: form.stepType,
        offsetDays: form.offsetDays,
        latestDaysBeforeRetreat: form.latestDaysBeforeRetreat === '' ? undefined : Number(form.latestDaysBeforeRetreat),
        deadlineBasis: form.deadlineBasis,
        active: form.active,
        isBlocking: form.isBlocking,
        order: form.order,
        createsTask: form.createsTask,
        reviewRequired: form.reviewRequired,
        isRequirement: form.isRequirement,
        requiredFromClient: form.requiredFromClient,
        clientFacingName: form.clientFacingName.en || form.clientFacingName.pl || form.clientFacingName.cz ? form.clientFacingName : undefined,
        clientFacingDescription: form.clientFacingDescription.en || form.clientFacingDescription.pl || form.clientFacingDescription.cz ? form.clientFacingDescription : undefined,
        requirementType: form.isRequirement ? form.requirementType : undefined,
        taskTitle: form.taskTitle,
        taskPriority: form.taskPriority,
        triggerType: form.deadlineBasis,
        readinessGroup: form.readinessGroup,
        readinessGroupColor: normalizeBookingStepColor(form.readinessGroupColor) || undefined,
        expectedArtifact: form.expectedArtifact,
        expectedDocumentStage: form.expectedDocumentStage || undefined,
        expectedDocumentType: form.expectedDocumentType || undefined,
        expectedArtifactPurpose: form.expectedArtifactPurpose || undefined,
        clientTagOnComplete: form.clientTagOnComplete || undefined,
        autoCompleteOnArtifact: form.autoCompleteOnArtifact,
        autoCompleteStatus: form.autoCompleteStatus || 'received',
        autoCompleteCondition: form.autoCompleteCondition,
        emailEnabled: Boolean(primaryEmailAction),
        emailTemplateId: primaryEmailAction?.emailTemplateId,
        actions: normalizedActions,
        reminderRules: form.reminderRules,
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

  const exportBackup = async () => {
    try {
      const response = await bookingFlowApi.exportLibraryBackup();
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `booking-step-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Unable to export booking-step backup.');
    }
  };

  const previewImport = async (backup: any, mode: 'merge_by_key' | 'restore_exact_ids') => {
    const response = await bookingFlowApi.previewLibraryImport(backup, mode);
    setImportPreview(response.data);
  };

  const chooseImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      setImportBackup(backup);
      setImportMode('merge_by_key');
      await previewImport(backup, 'merge_by_key');
    } catch (error: any) {
      setImportBackup(null);
      setImportPreview(null);
      alert(error?.response?.data?.message || error?.message || 'Unable to read or validate this backup file.');
    }
  };

  const changeImportMode = async (mode: 'merge_by_key' | 'restore_exact_ids') => {
    setImportMode(mode);
    if (importBackup) await previewImport(importBackup, mode);
  };

  const applyImport = async () => {
    if (!importBackup || !importPreview?.valid) return;
    setImporting(true);
    try {
      const response = await bookingFlowApi.importLibraryBackup(importBackup, importMode);
      alert(`Restore complete. Added ${response.data.added}, updated ${response.data.updated}, unchanged ${response.data.unchanged}. An automatic pre-import backup was saved to Audit Logs.`);
      setImportBackup(null);
      setImportPreview(null);
      await loadData();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Unable to restore booking-step configuration.');
    } finally {
      setImporting(false);
    }
  };

  const applyColorToGroup = async () => {
    const groupKey = normalizeGroupKey(form.readinessGroup || form.category);
    const color = normalizeBookingStepColor(form.readinessGroupColor) || getBookingStepDefaultColor(groupKey);
    const sameGroupTemplates = templates.filter((template) => normalizeGroupKey(template.readinessGroup || template.category) === groupKey);
    if (!sameGroupTemplates.length) return;

    try {
      setSaving(true);
      await Promise.all(
        sameGroupTemplates
          .filter((template) => template._id)
          .map((template) => bookingFlowApi.updateLibraryTemplate(template._id!, { readinessGroupColor: color })),
      );
      await loadData();
      setForm((prev) => ({ ...prev, readinessGroupColor: color }));
    } catch (error) {
      console.error('Error applying color to library group:', error);
      alert('Unable to apply this color to the whole section.');
    } finally {
      setSaving(false);
    }
  };

  const handleNewStep = () => {
    setSelectedTemplateId('');
    setForm({
      ...emptyForm(),
      order: (sortedTemplates.at(-1)?.order || 0) + 10,
    });
    setClientFacingLanguageTab('en');
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
  const visibleTemplates = useMemo(() => {
    const query = stepSearch.trim().toLowerCase();
    return query
      ? sortedTemplates.filter((template) => `${template.title} ${template.key} ${template.category}`.toLowerCase().includes(query))
      : sortedTemplates;
  }, [sortedTemplates, stepSearch]);

  const updateAction = (index: number, patch: Partial<BookingFlowAction>) => {
    setForm((current) => ({
      ...current,
      actions: current.actions.map((action, actionIndex) => (
        actionIndex === index ? { ...action, ...patch } : action
      )),
    }));
  };

  const addAction = () => {
    setForm((current) => ({
      ...current,
      actions: [
        ...current.actions,
        {
          key: `action_${current.actions.length + 1}`,
          label: 'Upload file',
          type: 'upload',
          active: true,
          allowRepeat: true,
          openComposer: false,
          statusAfterSuccess: 'received',
          order: current.actions.length,
        },
      ],
    }));
  };

  const removeAction = (index: number) => {
    setForm((current) => ({
      ...current,
      actions: current.actions.filter((_action, actionIndex) => actionIndex !== index),
    }));
  };

  const editorTabs: Array<{ id: EditorTab; label: string; icon: React.ElementType }> = [
    { id: 'basics', label: 'Basics', icon: LayoutTemplate },
    { id: 'deadline', label: 'Deadline & task', icon: CalendarClock },
    { id: 'artifact', label: 'Artifact matching', icon: FileSearch },
    { id: 'reminders', label: 'Reminders & actions', icon: BellRing },
    { id: 'flags', label: 'Flags & colour', icon: Flag },
  ];

  const ruleSummary = `${form.title || 'This step'} is due ${form.offsetDays} days ${form.deadlineBasis === 'before_retreat_start' ? 'before the retreat starts' : form.deadlineBasis.replaceAll('_', ' ')}${form.isBlocking ? '. The booking cannot be marked ready until it is done.' : '.'}`;

  const fieldClass = 'w-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600';
  const labelClass = 'mb-1.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-gray-500';

  const renderTemplateEditor = () => (
    <div className="flex min-h-[650px] flex-col bg-[#fbfaf9]">
      <div className="px-6 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500">{selectedTemplateId ? `Editing step #${form.order} · ${form.key}` : 'New booking step'}</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">{form.title || 'Untitled step'}</h2>
          </div>
          <div className="flex gap-2">
            {form.active && <span className="rounded-full border border-green-300 bg-green-50 px-2.5 py-1 text-[10px] uppercase tracking-wider text-green-800">Active</span>}
            {form.isBlocking && <span className="rounded-full border border-red-300 bg-red-50 px-2.5 py-1 text-[10px] uppercase tracking-wider text-red-700">Blocking</span>}
          </div>
        </div>
        <div className="mt-5 border-l-2 border-sky-600 bg-sky-50 px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.15em] text-sky-800">The rule in words</div>
          <p className="mt-2 text-sm text-gray-900">{ruleSummary}</p>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto border-b border-gray-300 pb-2" role="tablist" aria-label="Step editor sections">
          {editorTabs.map((tab) => { const TabIcon = tab.icon; const selected = editorTab === tab.id; return <button key={tab.id} type="button" role="tab" aria-selected={selected} onClick={() => setEditorTab(tab.id)} className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg border px-3.5 py-2.5 text-sm font-medium transition ${selected ? 'border-sky-600 bg-sky-600 text-white shadow-sm ring-2 ring-sky-200' : 'border-gray-200 bg-white text-gray-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900'}`}><TabIcon className="h-4 w-4" aria-hidden="true" />{tab.label}</button>; })}
        </div>
      </div>

      <div className="flex-1 px-6 py-5">
        {editorTab === 'basics' && <div className="grid max-w-4xl gap-5 sm:grid-cols-2">
          <label><span className={labelClass}>Display title</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={fieldClass} /></label>
          <label><span className={labelClass}>Step key (never changes)</span><input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} className={`${fieldClass} bg-gray-50`} /></label>
          <label><span className={labelClass}>Workflow stage</span><select value={form.workflowStage} onChange={(e) => setForm({ ...form, workflowStage: e.target.value as TemplateForm['workflowStage'] })} className={fieldClass}>{['potential','screening','payment','conditional_booking','contract','questionnaire','medical','prep','approved','cancelled'].map(v => <option key={v} value={v}>{titleizeBookingStepGroup(v)}</option>)}</select></label>
          <label><span className={labelClass}>Category</span><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as TemplateForm['category'] })} className={fieldClass}>{['screening','booking','contract','questionnaire','medical','payment','dietary','message','access','approval','reminder','other'].map(v => <option key={v} value={v}>{titleizeBookingStepGroup(v)}</option>)}</select></label>
          <label className="sm:col-span-2"><span className={labelClass}>Step type</span><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{BOOKING_STEP_TYPES.map((type) => <button key={type.value} type="button" onClick={() => setForm({ ...form, stepType: type.value })} className={`flex items-start gap-3 rounded-lg border p-3 text-left ${form.stepType === type.value ? 'border-sky-500 bg-sky-50 text-sky-900 ring-1 ring-sky-500' : 'border-gray-200 bg-white hover:border-gray-300'}`}><BookingStepTypeIcon type={type.value} className="mt-0.5 h-5 w-5 shrink-0"/><span><strong className="block text-sm">{type.label}</strong><span className="mt-0.5 block text-xs text-gray-500">{type.description}</span></span></button>)}</div></label>
          <label className="sm:col-span-2"><span className={labelClass}>Retreat types</span><input value={form.applicableRetreatTypes} onChange={(e) => setForm({ ...form, applicableRetreatTypes: e.target.value })} className={fieldClass} placeholder="Leave empty for all, or enter regular, booster" /><span className="mt-1 block text-xs text-gray-500">Comma-separated. Specific retreat copies still override the global policy.</span></label>
          <label className="sm:col-span-2"><span className={labelClass}>What this step means</span><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className={fieldClass} /></label>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.requiredFromClient} onChange={(e) => setForm({ ...form, requiredFromClient: e.target.checked })} /> Required from client — include in the Requirements tab and missing-items email</label>
          <div className="sm:col-span-2">
            <span className={labelClass}>Client-facing name &amp; description</span>
            <p className="mb-2 text-xs text-gray-500">Shown to the client instead of the admin title/description above &mdash; in the missing-items email today. Translate manually; English is the fallback for any language left blank.</p>
            <div className="mb-3 inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1" role="tablist" aria-label="Client-facing copy language">
              {([{ key: 'en', label: 'EN' }, { key: 'pl', label: 'PL' }, { key: 'cz', label: 'CZ' }] as const).map((language) => (
                <button
                  key={language.key}
                  type="button"
                  role="tab"
                  aria-selected={clientFacingLanguageTab === language.key}
                  onClick={() => setClientFacingLanguageTab(language.key)}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                    clientFacingLanguageTab === language.key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {language.label}
                  {!form.clientFacingName[language.key] && !form.clientFacingDescription[language.key] && language.key !== 'en' && (
                    <span className="ml-1 text-[10px] font-normal text-gray-400">(empty)</span>
                  )}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className={labelClass}>Name ({clientFacingLanguageTab.toUpperCase()})</span>
                <textarea
                  value={form.clientFacingName[clientFacingLanguageTab]}
                  onChange={(e) => setForm({ ...form, clientFacingName: { ...form.clientFacingName, [clientFacingLanguageTab]: e.target.value } })}
                  rows={2}
                  className={fieldClass}
                  placeholder="Short, friendly label the client sees"
                />
              </label>
              <label>
                <span className={labelClass}>Description ({clientFacingLanguageTab.toUpperCase()})</span>
                <textarea
                  value={form.clientFacingDescription[clientFacingLanguageTab]}
                  onChange={(e) => setForm({ ...form, clientFacingDescription: { ...form.clientFacingDescription, [clientFacingLanguageTab]: e.target.value } })}
                  rows={2}
                  className={fieldClass}
                  placeholder="Tell the client what to do and why"
                />
              </label>
            </div>
          </div>
          <label><span className={labelClass}>Order in the list</span><input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} className={fieldClass} /></label>
          <label><span className={labelClass}>Readiness group</span><input value={form.readinessGroup} onChange={(e) => setForm({ ...form, readinessGroup: e.target.value })} className={fieldClass} /></label>
        </div>}

        {editorTab === 'deadline' && <div className="max-w-4xl space-y-7">
          <div className="flex flex-wrap items-end gap-3 text-base"><span className="pb-2">Due</span><label className="w-20"><span className={labelClass}>Days</span><input type="number" value={form.offsetDays} onChange={(e) => setForm({ ...form, offsetDays: Number(e.target.value) })} className={fieldClass} /></label><label className="min-w-56"><span className={labelClass}>Relative to</span><select value={form.deadlineBasis} onChange={(e) => setForm({ ...form, deadlineBasis: e.target.value as TemplateForm['deadlineBasis'] })} className={fieldClass}><option value="before_retreat_start">before retreat start</option><option value="after_signup">after signup</option><option value="after_booking">after booking</option><option value="after_initial_payment">after initial payment</option><option value="manual">manual due date</option></select></label><span className="pb-2">and never later than</span><label className="w-24"><span className={labelClass}>Days</span><input type="number" value={form.latestDaysBeforeRetreat} onChange={(e) => setForm({ ...form, latestDaysBeforeRetreat: e.target.value })} className={fieldClass} /></label><span className="pb-2">days before the retreat starts.</span></div>
          <div className="grid gap-5 sm:grid-cols-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.createsTask} onChange={(e) => setForm({ ...form, createsTask: e.target.checked })} /> Yes — add to the admin task list</label><label><span className={labelClass}>Task priority</span><select value={form.taskPriority} onChange={(e) => setForm({ ...form, taskPriority: e.target.value as TemplateForm['taskPriority'] })} className={fieldClass}>{['low','medium','high','urgent'].map(v => <option key={v}>{v}</option>)}</select></label><label className="sm:col-span-2"><span className={labelClass}>Task title</span><input value={form.taskTitle} onChange={(e) => setForm({ ...form, taskTitle: e.target.value })} className={fieldClass} /></label></div>
        </div>}

        {editorTab === 'artifact' && <div className="max-w-4xl space-y-5"><p className="max-w-2xl text-sm text-gray-700">Matching lets an upload close this step by itself. Leave it empty and an admin marks the step by hand.</p><div className="grid gap-5 sm:grid-cols-2"><label><span className={labelClass}>Expected artifact tag</span><input value={form.expectedArtifact} onChange={(e) => setForm({ ...form, expectedArtifact: e.target.value })} className={fieldClass} placeholder="ekg" /></label><label><span className={labelClass}>Upload stage</span><select value={form.expectedDocumentStage} onChange={(e) => setForm({ ...form, expectedDocumentStage: e.target.value })} className={fieldClass}><option value="">Any entry-stage upload</option>{['entry','pre_ceremony','in_ceremony','post_ceremony','other','additional'].map(v => <option key={v} value={v}>{titleizeBookingStepGroup(v)}</option>)}</select></label><label><span className={labelClass}>Document type</span><select value={form.expectedDocumentType} onChange={(e) => setForm({ ...form, expectedDocumentType: e.target.value })} className={fieldClass}><option value="">Any</option>{['EKG','Liver','BP','meds','Medications','additional','other'].map(v => <option key={v}>{v}</option>)}</select></label><label><span className={labelClass}>Purpose</span><select value={form.expectedArtifactPurpose} onChange={(e) => setForm({ ...form, expectedArtifactPurpose: e.target.value })} className={fieldClass}><option value="">Any</option>{['booking_requirement','pre_ceremony','paid_review','repeat_test','correction','general'].map(v => <option key={v} value={v}>{titleizeBookingStepGroup(v)}</option>)}</select></label></div><div className="flex flex-wrap items-center gap-8 border-t border-gray-200 pt-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.autoCompleteOnArtifact} onChange={(e) => setForm({ ...form, autoCompleteOnArtifact: e.target.checked })} /> Mark this step automatically when a matching artifact arrives</label><label className="flex items-center gap-3"><span className="text-xs uppercase tracking-wider text-gray-500">Set status to</span><select value={form.autoCompleteStatus} onChange={(e) => setForm({ ...form, autoCompleteStatus: e.target.value })} className={fieldClass}>{['received','completed','approved'].map(v => <option key={v}>{v}</option>)}</select></label></div></div>}

        {editorTab === 'reminders' && <div className="max-w-5xl space-y-7"><section><div className="mb-3 flex justify-between"><div><span className={labelClass}>Reminder sequence</span><p className="text-xs text-gray-500">Offsets are relative to the step due date. Repeats stop automatically when the step is completed.</p></div><button type="button" onClick={addReminderRule} className="text-sm text-sky-700 underline">Add rule</button></div><div className="space-y-3">{form.reminderRules.length === 0 && <div className="border-y border-gray-300 py-3 text-sm text-gray-500">No custom reminders. The standard sequence will be used.</div>}{form.reminderRules.map((rule,index) => <div key={`${rule.key}-${index}`} className="grid gap-3 border border-gray-200 bg-white p-3 sm:grid-cols-4"><label><span className={labelClass}>Rule key</span><input value={rule.key} onChange={(e) => updateReminderRule(index,{key:e.target.value})} className={fieldClass} /></label><label><span className={labelClass}>Days from due date</span><input type="number" value={rule.offsetDays} onChange={(e) => updateReminderRule(index,{offsetDays:Number(e.target.value)})} className={fieldClass} /></label><label><span className={labelClass}>Action</span><select value={rule.actionType} onChange={(e) => updateReminderRule(index,{actionType:e.target.value as BookingReminderRule['actionType']})} className={fieldClass}><option value="send_email">Send email</option><option value="create_staff_task">Create staff task</option></select></label><label><span className={labelClass}>Email template</span><select disabled={rule.actionType !== 'send_email'} value={rule.emailTemplateId || ''} onChange={(e) => updateReminderRule(index,{emailTemplateId:e.target.value || undefined})} className={fieldClass}><option value="">Generic reminder</option>{emailTemplates.map((template) => <option key={template._id} value={template._id}>{template.name} ({template.language})</option>)}</select></label><label><span className={labelClass}>Repeat every days</span><input type="number" min="1" value={rule.repeatEveryDays || 1} onChange={(e) => updateReminderRule(index,{repeatEveryDays:Number(e.target.value)})} className={fieldClass} /></label><label><span className={labelClass}>Maximum repeats</span><input type="number" min="0" max="20" value={rule.maxRepeats || 0} onChange={(e) => updateReminderRule(index,{maxRepeats:Number(e.target.value)})} className={fieldClass} /></label><label><span className={labelClass}>Stop days before retreat</span><input type="number" min="0" value={rule.stopDaysBeforeRetreat ?? ''} onChange={(e) => updateReminderRule(index,{stopDaysBeforeRetreat:e.target.value === '' ? undefined : Number(e.target.value)})} className={fieldClass} /></label><div className="flex items-end justify-end"><button type="button" onClick={() => removeReminderRule(index)} className="px-3 py-2 text-xs text-red-600">Remove</button></div></div>)}</div></section><section><div className="mb-3 flex justify-between"><span className={labelClass}>Buttons shown on the booking</span><button type="button" onClick={addAction} className="text-sm text-sky-700 underline">Add action</button></div>{form.actions.length === 0 ? <p className="text-sm text-gray-600">None yet. Add an action to give staff a button on this step.</p> : <div className="space-y-2">{form.actions.map((action,index) => <div key={`${action.key}-${index}`} className="grid grid-cols-[1fr_1fr_150px_auto] gap-3 border-b border-gray-200 py-2"><input value={action.label} onChange={(e) => updateAction(index,{label:e.target.value})} className={fieldClass}/><input value={action.key} onChange={(e) => updateAction(index,{key:e.target.value})} className={fieldClass}/><select value={action.type} onChange={(e) => updateAction(index,{type:e.target.value as BookingFlowAction['type']})} className={fieldClass}>{['email','upload','link_mrr','whatsapp','link','manual'].map(v=><option key={v} value={v}>{titleizeBookingStepGroup(v)}</option>)}</select><button type="button" onClick={() => removeAction(index)} className="text-xs text-red-600">Remove</button></div>)}</div>}</section></div>}

        {editorTab === 'flags' && <div className="grid max-w-4xl gap-8 sm:grid-cols-2"><div className="divide-y divide-gray-300">{[{label:'Active',hint:'Included when new bookings are created',value:form.active,key:'active'},{label:'Blocking requirement',hint:'Booking cannot be marked ready until this is done',value:form.isBlocking,key:'isBlocking'},{label:'Creates task',hint:'Adds a task to the admin list',value:form.createsTask,key:'createsTask'},{label:'Review required',hint:'Controls whether the Reviewed column must be completed',value:form.reviewRequired,key:'reviewRequired'},{label:'Show in Requirements tab',hint:'Display as a document or form requirement; operational steps stay only in Booking Requirements',value:form.isRequirement,key:'isRequirement'}].map(item => <label key={item.key} className="flex gap-3 py-3"><input type="checkbox" checked={item.value} onChange={(e) => setForm({ ...form, [item.key]: e.target.checked })}/><span><span className="block text-sm font-medium text-gray-900">{item.label}</span><span className="block text-xs text-gray-500">{item.hint}</span></span></label>)}</div><div><BookingStepColorField groupKey={form.readinessGroup || form.category} value={form.readinessGroupColor} onChange={(value) => setForm({ ...form, readinessGroupColor: value })}/><button type="button" onClick={applyColorToGroup} disabled={saving} className="mt-4 border border-gray-300 bg-white px-3 py-2 text-xs">Apply this colour to the whole section</button><label className="mt-6 block"><span className={labelClass}>Requirement type</span><select value={form.requirementType} onChange={(e) => setForm({ ...form, requirementType: e.target.value, isRequirement: Boolean(e.target.value) })} className={fieldClass}><option value="">Not a document/form requirement</option><option value="contract_signed">Contract</option><option value="entry_ekg">EKG</option><option value="entry_liver_panel">Liver panel</option><option value="medications_form_initial">Medications form</option><option value="questionnaire">Questionnaire</option><option value="food_intake">Food form</option><option value="blood_pressure">Blood pressure</option><option value="other">Other</option></select><span className="mt-1 block text-xs text-gray-500">Steps with the same type are collapsed into one Requirements row.</span></label><label className="mt-4 block"><span className={labelClass}>Client tag on complete</span><input value={form.clientTagOnComplete} onChange={(e) => setForm({ ...form, clientTagOnComplete: e.target.value })} className={fieldClass}/></label></div></div>}
      </div>

      <div className="sticky bottom-0 flex items-center justify-between border-t border-gray-300 bg-[#f7f5f4] px-6 py-4">
        <span className="text-xs text-gray-500">Changes apply to bookings created from now on.</span>
        <div className="flex items-center gap-3">{selectedTemplateId && <button onClick={handleDelete} className="text-sm text-red-700 underline">Delete step</button>}<button type="button" onClick={() => selectedTemplateId ? selectTemplate(templates.find(t => t._id === selectedTemplateId)!) : handleNewStep()} className="border border-gray-300 bg-white px-4 py-2 text-sm">Discard</button><button onClick={handleSave} disabled={saving} className="bg-[#211d1e] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : selectedTemplateId ? 'Save step' : 'Add step'}</button></div>
      </div>
      <div className="hidden">
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
          <input value={form.readinessGroup} list="booking-step-groups" onChange={(e) => setForm({ ...form, readinessGroup: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="medical" />
          <datalist id="booking-step-groups">
            <option value="admin" />
            <option value="medical" />
            <option value="questionnaires" />
            <option value="payments" />
            <option value="travel" />
            <option value="preparation" />
            <option value="dietary" />
            <option value="other" />
          </datalist>
        </label>
        <div className="space-y-2">
          <BookingStepColorField
            groupKey={form.readinessGroup || form.category}
            value={form.readinessGroupColor}
            onChange={(value) => setForm({ ...form, readinessGroupColor: value })}
          />
          <button
            type="button"
            onClick={applyColorToGroup}
            disabled={saving}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Apply this color to the whole section
          </button>
          <p className="text-xs text-gray-500">This updates every step in the same readiness group at once.</p>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Expected artifact</span>
          <input value={form.expectedArtifact} onChange={(e) => setForm({ ...form, expectedArtifact: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="ekg" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Client tag on complete</span>
          <input value={form.clientTagOnComplete} onChange={(e) => setForm({ ...form, clientTagOnComplete: e.target.value })} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="medically-approved" />
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

      <div className="mt-3 rounded-md border border-violet-200 bg-violet-50/40 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><div className="text-xs font-semibold uppercase text-violet-700">Automated reminder sequence</div><div className="text-xs text-gray-500">Offsets are relative to this step’s deadline. Negative days run before it.</div></div>
          <button type="button" onClick={addReminderRule} className="rounded-md border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-800">Add rule</button>
        </div>
        <div className="space-y-2">
          {form.reminderRules.length === 0 && <div className="rounded border border-dashed border-violet-200 bg-white p-3 text-sm text-gray-500">Uses the default sequence: −7 days, deadline day, +3 days, then a staff task at +7 days.</div>}
          {form.reminderRules.map((rule, index) => (
            <div key={`${rule.key}-${index}`} className="grid gap-2 rounded-md border border-violet-100 bg-white p-2 sm:grid-cols-[1fr_100px_170px_auto]">
              <input value={rule.key} onChange={(event) => updateReminderRule(index, { key: event.target.value })} className="rounded border border-gray-300 px-2 py-1.5 text-sm" placeholder="friendly_7_days_before" />
              <input type="number" value={rule.offsetDays} onChange={(event) => updateReminderRule(index, { offsetDays: Number(event.target.value) })} className="rounded border border-gray-300 px-2 py-1.5 text-sm" title="Days relative to deadline" />
              <select value={rule.actionType} onChange={(event) => updateReminderRule(index, { actionType: event.target.value as BookingReminderRule['actionType'] })} className="rounded border border-gray-300 px-2 py-1.5 text-sm"><option value="send_email">Send email</option><option value="create_staff_task">Create staff task</option></select>
              <button type="button" onClick={() => removeReminderRule(index)} className="px-2 text-xs font-medium text-red-600">Remove</button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-md border border-gray-200 bg-white p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase text-gray-500">Step actions</div>
            <div className="text-xs text-gray-500">Buttons shown in booking views and Retreat Readiness for this booking step.</div>
          </div>
          <button type="button" onClick={addAction} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
            Add action
          </button>
        </div>
        <div className="space-y-3">
          {form.actions.length === 0 && (
            <div className="rounded-md border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500">
              No actions yet. Add an email action to show a send button for this booking step.
            </div>
          )}
          {form.actions.map((action, index) => (
            <div key={`${action.key}-${index}`} className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <div className="grid gap-2 sm:grid-cols-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Key</span>
                  <input value={action.key} onChange={(e) => updateAction(index, { key: e.target.value })} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Button label</span>
                  <input value={action.label} onChange={(e) => updateAction(index, { label: e.target.value })} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Type</span>
                  <select value={action.type} onChange={(e) => updateAction(index, { type: e.target.value as BookingFlowAction['type'] })} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                    <option value="email">Email</option>
                    <option value="upload">Upload document</option>
                    <option value="link_mrr">Link existing MRR</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="link">Link</option>
                    <option value="manual">Manual</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">After success</span>
                  <select value={action.statusAfterSuccess || ''} onChange={(e) => updateAction(index, { statusAfterSuccess: e.target.value as BookingFlowAction['statusAfterSuccess'] || undefined })} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                    <option value="">No status change</option>
                    <option value="sent">Sent</option>
                    <option value="completed">Completed</option>
                    <option value="received">Received</option>
                    <option value="approved">Approved</option>
                  </select>
                </label>
              </div>
              {action.type === 'email' ? (
                <label className="mt-2 block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Email template</span>
                  <select value={typeof action.emailTemplateId === 'string' ? action.emailTemplateId : action.emailTemplateId?._id || ''} onChange={(e) => updateAction(index, { emailTemplateId: e.target.value })} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                    <option value="">Select email template</option>
                    {emailTemplates.map((template) => (
                      <option key={template._id} value={template._id}>{template.name} ({template.category || 'general'} / {template.language || 'en'})</option>
                    ))}
                  </select>
                  <span className="mt-1 block text-xs text-gray-500">
                    The selected template is the fallback; matching client-language templates are picked by variant key.
                  </span>
                </label>
              ) : action.type === 'upload' ? (
                <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  Shows an upload button on the booking step. When Expected artifact is configured for a supported medical artifact, the file is stored in Medical Artifacts; otherwise it is stored in Booking Documents.
                </div>
              ) : action.type === 'link_mrr' ? (
                <div className="mt-2 rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                  Shows a button to link an existing medical review request to this booking step.
                </div>
              ) : (
                <label className="mt-2 block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">URL template</span>
                  <input value={action.urlTemplate || ''} onChange={(e) => updateAction(index, { urlTemplate: e.target.value })} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" placeholder="https://wa.me/{{client.phone}}" />
                </label>
              )}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input type="checkbox" checked={action.active !== false} onChange={(e) => updateAction(index, { active: e.target.checked })} />
                  Active
                </label>
                <button type="button" onClick={() => removeAction(index)} className="text-xs font-medium text-red-600 hover:text-red-700">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
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
    </div>
  );

  if (loading && templates.length === 0) {
    return <LoadingSpinner message="Loading booking step setup..." />;
  }

  return (
    <div className="min-h-screen bg-[#e8e6e5] p-4 lg:p-6">
      <div className="mx-auto max-w-[1500px] border border-gray-300 bg-[#fbfaf9] shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-900 px-7 py-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Master configuration</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">Booking step setup</h1>
          <p className="mt-1 max-w-xl text-xs text-gray-700">One library of {templates.length} steps. Every booking created copies these definitions, then keeps its own dates, statuses and notes.</p>
        </div>
        <div className="flex max-w-2xl flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="w-64"><SearchableRetreatSelect retreats={retreats} selectedRetreatId={selectedRetreatId} onRetreatSelect={setSelectedRetreatId} placeholder="Apply library to retreat…" /></div>
            <button disabled={!selectedRetreatId || applying} onClick={handleApplyAll} className="bg-[#211d1e] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">Apply full setup</button>
            <button disabled={!selectedRetreatId || !selectedTemplateId || applying} onClick={handleApplySelected} className="border border-gray-300 bg-white px-4 py-2 text-xs disabled:opacity-40">Apply this step</button>
          </div>
          <div className="flex flex-wrap gap-4 text-[11px] text-sky-800">
          <button onClick={exportBackup} className="underline">Export backup</button>
          <button onClick={() => importInputRef.current?.click()} className="underline">Import / restore</button>
          <input ref={importInputRef} type="file" accept="application/json,.json" onChange={chooseImportFile} className="hidden" />
          <button onClick={handleSeed} className="underline">Seed defaults</button>
          <button onClick={() => navigate(`${routePrefix}/retreat-flow`)} className="underline">Retreat readiness setup</button>
          </div>
        </div>
      </div>

      {importBackup && importPreview && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-gray-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="restore-title">
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 p-5">
              <div><h2 id="restore-title" className="text-lg font-semibold text-gray-900">Preview booking-step restore</h2><p className="mt-1 text-sm text-gray-600">No configuration changes have been made.</p></div>
              <button onClick={() => { setImportBackup(null); setImportPreview(null); }} className="rounded p-1 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-5">
              <label className="block text-sm font-semibold text-gray-800">Restore mode
                <select value={importMode} onChange={(event) => changeImportMode(event.target.value as any)} className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 font-normal">
                  <option value="merge_by_key">Merge by stable key (recommended)</option>
                  <option value="restore_exact_ids">Disaster recovery: restore exact IDs</option>
                </select>
              </label>
              {importMode === 'restore_exact_ids' && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Exact-ID restore fails safely if an imported ID or key belongs to a different record.</div>}
              <div className="grid grid-cols-4 gap-3">
                {(['add', 'update', 'unchanged', 'conflict'] as const).map((status) => <div key={status} className="rounded-lg border border-gray-200 p-3 text-center"><div className="text-xl font-bold text-gray-900">{importPreview.summary?.[status] || 0}</div><div className="text-xs font-semibold uppercase text-gray-500">{status}</div></div>)}
              </div>
              <div className="max-h-72 overflow-auto rounded-md border border-gray-200">
                <table className="min-w-full text-sm"><thead className="sticky top-0 bg-gray-50"><tr><th className="px-3 py-2 text-left">Step key</th><th className="px-3 py-2 text-left">Result</th><th className="px-3 py-2 text-left">Details</th></tr></thead><tbody className="divide-y divide-gray-100">{(importPreview.results || []).map((result: any) => <tr key={`${result.key}-${result.id}`}><td className="px-3 py-2 font-medium">{result.key}</td><td className="px-3 py-2">{result.status}</td><td className="px-3 py-2 text-gray-500">{result.reason || ''}</td></tr>)}</tbody></table>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 p-5">
              <button onClick={() => { setImportBackup(null); setImportPreview(null); }} disabled={importing} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">Cancel</button>
              <button onClick={applyImport} disabled={importing || !importPreview.valid} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{importing ? 'Restoring...' : 'Create backup & restore'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid min-h-[760px] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-r border-gray-300 bg-[#f7f5f4]">
          <div className="flex gap-2 border-b border-gray-200 p-4">
            <input value={stepSearch} onChange={(event) => setStepSearch(event.target.value)} placeholder="Find a step" className="min-w-0 flex-1 border border-gray-300 bg-white px-3 py-2 text-sm" />
            <button onClick={handleNewStep} className="border border-gray-300 bg-white px-3 text-sm text-sky-800">+ New</button>
          </div>
          <div className="py-2">
            {visibleTemplates.map((template) => {
              const isSelected = selectedTemplateId === template._id;
              const groupKey = template.readinessGroup || template.category || 'other';
              const effectiveGroupColor = template.readinessGroupColor || groupColorByKey[normalizeGroupKey(groupKey)];
              const tone = getBookingStepToneWithColor(groupKey, effectiveGroupColor);
              const stepStyle = getBookingStepColorStyles(tone, 'step');
              const selectedStepStyle = isSelected ? {
                ...stepStyle,
                backgroundColor: '#e0f2fe',
                borderLeftColor: '#0369a1',
                boxShadow: 'inset 0 0 0 2px #0369a1',
              } : stepStyle;
              const CategoryIcon = bookingStepCategoryIcons[normalizeGroupKey(groupKey)] || bookingStepCategoryIcons[normalizeGroupKey(template.category)] || ListChecks;

              return (
                <React.Fragment key={template._id}>
                  <button
                    draggable
                    onDragStart={() => setDraggedTemplateId(template._id || '')}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleTemplateDrop(template._id)}
                    onClick={() => selectTemplate(template)}
                    aria-current={isSelected ? 'true' : undefined}
                    className={`block w-full border-0 border-l-2 px-4 py-3 text-left ${tone.stepStripe} ${
                      isSelected
                        ? 'relative z-10 border-sky-700 bg-sky-100 focus:outline-none'
                        : 'border-transparent bg-transparent hover:bg-white'
                    } ${draggedTemplateId === template._id ? 'opacity-60' : ''}`}
                    style={selectedStepStyle}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <Icon icon={GripVertical} className={`h-4 w-4 shrink-0 ${isSelected ? 'text-sky-700' : 'text-gray-400'}`} />
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${isSelected ? 'border-sky-300 bg-white text-sky-800' : 'border-gray-200 bg-white/80 text-gray-600'}`} title={titleizeBookingStepGroup(groupKey)}><CategoryIcon className="h-4 w-4" aria-hidden="true" /></span>
                        <div className="min-w-0">
                          <div className={`truncate text-sm font-semibold ${isSelected ? 'text-sky-950' : 'text-gray-900'}`}>{template.title}</div>
                          <div className="mt-1 truncate text-[11px] text-gray-500">{getBookingStepType(template.stepType).label} · {titleizeBookingStepGroup(groupKey)} · Due {formatDeadlineLabel(template)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-gray-500">
                        {isSelected && <span className="rounded bg-sky-700 px-1.5 py-0.5 font-semibold tracking-wide text-white">EDITING</span>}
                        {template.isBlocking && <span className="border border-red-300 bg-red-50 px-1 text-red-700">B</span>}
                        <span>#{template.order || 0}</span>
                      </div>
                    </div>
                  </button>
                </React.Fragment>
              );
            })}
            {visibleTemplates.length === 0 && <div className="p-4 text-sm text-gray-500">No matching booking steps.</div>}
          </div>
        </aside>
        <main className="min-w-0">{renderTemplateEditor()}</main>
      </div>
      </div>
    </div>
  );
};

export default RetreatFlowLibraryPage;
