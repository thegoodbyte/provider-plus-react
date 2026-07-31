import React, { useEffect, useMemo, useState } from 'react';
import { FiAlertCircle, FiCheckCircle, FiEdit2, FiInbox, FiMail, FiPlus, FiRefreshCw, FiSave, FiSearch, FiSend, FiTrash2 } from 'react-icons/fi';
import { Link, useLocation } from 'react-router-dom';
import { communicationsApi, clientsApi, retreatsApi } from '../services/api';
import { Client, EmailTemplate, EmailTemplateSeedOption, InboundEmail, MailSettings, Retreat, SentEmail } from '../types';
import SearchableClientSelect from './SearchableClientSelect';
import SearchableRetreatSelect from './SearchableRetreatSelect';
import './CommunicationsPage.css';

type TabKey = 'settings' | 'templates' | 'compose' | 'sent' | 'inbound';
const WELCOME_STEP_OPTIONS = [
  ['booking_confirmation_sent', 'Booking confirmation sent'], ['medical_labs_requested', 'EKG and liver requested'],
  ['medications_form_initial_sent', 'Medications form sent'], ['questionnaire_sent', 'Questionnaire sent'],
  ['food_form_sent', 'Food form sent'], ['contract_sent', 'Contract requested'],
];

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const looksLikeHtml = (value: string) => /<!doctype\s+html|<html[\s>]|<body[\s>]|<(?:p|div|table|h[1-6]|ul|ol|br|a)\b/i.test(value);
const htmlToPlainText = (value: string) => value
  .replace(/<(?:br|\/p|\/div|\/h[1-6]|\/li)>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\n{3,}/g, '\n\n')
  .trim();
const plainTextToHtml = (value: string) => `<pre style="white-space: pre-wrap; font-family: inherit;">${value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;

const defaultTemplateForm: Partial<EmailTemplate> = {
  name: '',
  description: '',
  subject: '',
  bodyText: '',
  bodyHtml: '',
  category: 'general',
  templateKey: '',
  language: 'en',
  bookingFlowStepKey: '',
  bookingFlowStepKeys: [],
  bookingFlowStatusOnSend: 'sent',
  active: true,
  notes: '',
  tags: '',
};

const defaultComposeForm = {
  clientId: '',
  retreatId: '',
  to: '',
  cc: '',
  bcc: '',
  subject: '',
  bodyText: '',
  templateId: '',
  fromName: '',
  fromEmail: '',
  replyTo: '',
  relatedEntityType: '',
  relatedEntityId: '',
};

const formatSentEmailReceipt = (sentEmail: SentEmail) => {
  const lines = [
    `Email ${sentEmail.status || 'queued'}.`,
    sentEmail.display_id ? `Log #${sentEmail.display_id}` : '',
    sentEmail.gmailMessageId ? `Gmail message ID: ${sentEmail.gmailMessageId}` : '',
    (sentEmail.cc || []).length ? `CC: ${(sentEmail.cc || []).join(', ')}` : 'CC: none',
    (sentEmail.attachments || []).length ? `Attachments: ${(sentEmail.attachments || []).length}` : '',
    sentEmail.errorMessage ? `Error: ${sentEmail.errorMessage}` : '',
  ].filter(Boolean);
  return lines.join('\n');
};

const CommunicationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('sent');
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<MailSettings | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [inboundEmails, setInboundEmails] = useState<InboundEmail[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('all');
  const [templateLanguageFilter, setTemplateLanguageFilter] = useState('en');
  const [templateStatusFilter, setTemplateStatusFilter] = useState('all');
  const [selectedSentEmailId, setSelectedSentEmailId] = useState('');
  const [sentEmailSearch, setSentEmailSearch] = useState('');
  const [sentEmailStatusFilter, setSentEmailStatusFilter] = useState('all');
  const [templateForm, setTemplateForm] = useState<Partial<EmailTemplate>>(defaultTemplateForm);
  const [composeForm, setComposeForm] = useState(defaultComposeForm);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [seedingTemplates, setSeedingTemplates] = useState(false);
  const [seedOptions, setSeedOptions] = useState<EmailTemplateSeedOption[]>([]);
  const [showSeedOptions, setShowSeedOptions] = useState(false);
  const [selectedSeedKeys, setSelectedSeedKeys] = useState<string[]>([]);
  const [overwriteSeedTemplates, setOverwriteSeedTemplates] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [processingInbound, setProcessingInbound] = useState(false);
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template._id === selectedTemplateId) || null,
    [templates, selectedTemplateId],
  );

  const selectedTemplateCounterparts = useMemo(() => {
    const key = String(selectedTemplate?.templateKey || '').trim().toLowerCase();
    if (!key) return [];
    return templates
      .filter((template) => template._id !== selectedTemplate?._id
        && String(template.templateKey || '').trim().toLowerCase() === key)
      .sort((a, b) => String(a.language || 'en').localeCompare(String(b.language || 'en')));
  }, [selectedTemplate, templates]);

  const templateCategories = useMemo(() => Array.from(new Set(
    templates.map((template) => String(template.category || 'general').trim()).filter(Boolean),
  )).sort((a, b) => a.localeCompare(b)), [templates]);

  const filteredTemplates = useMemo(() => {
    const search = templateSearch.trim().toLowerCase();
    return templates.filter((template) => {
      const category = String(template.category || 'general').trim();
      const language = String(template.language || 'en').trim().toLowerCase().replace('cs', 'cz');
      const status = template.active === false ? 'hidden' : 'active';
      const searchableText = [
        template.display_id,
        template.name,
        template.subject,
        template.description,
        category,
        template.templateKey,
        language,
        template.tags,
        template.notes,
      ].filter((value) => value !== undefined && value !== null).join(' ').toLowerCase();

      return (!search || searchableText.includes(search))
        && (templateCategoryFilter === 'all' || category === templateCategoryFilter)
        && (templateLanguageFilter === 'all' || language === templateLanguageFilter)
        && (templateStatusFilter === 'all' || status === templateStatusFilter);
    });
  }, [templates, templateSearch, templateCategoryFilter, templateLanguageFilter, templateStatusFilter]);

  const hasTemplateFilters = Boolean(templateSearch.trim())
    || templateCategoryFilter !== 'all'
    || templateLanguageFilter !== 'en'
    || templateStatusFilter !== 'all';

  const groupedSeedOptions = useMemo(() => {
    return seedOptions.reduce((groups: Record<string, EmailTemplateSeedOption[]>, option) => {
      const groupKey = option.templateKey || option.category || 'other';
      groups[groupKey] = [...(groups[groupKey] || []), option];
      return groups;
    }, {});
  }, [seedOptions]);

  const selectedClient = useMemo(
    () => clients.find((client) => client._id === composeForm.clientId) || null,
    [clients, composeForm.clientId],
  );

  const selectedRetreat = useMemo(
    () => retreats.find((retreat) => retreat._id === composeForm.retreatId) || null,
    [retreats, composeForm.retreatId],
  );

  const getSentEmailClient = (email: SentEmail) => {
    const clientValue = email.clientId;
    const clientId = typeof clientValue === 'string' ? clientValue : clientValue?._id || '';
    const populatedClient = typeof clientValue === 'object' ? clientValue : null;
    const client = populatedClient || clients.find((item) => item._id === clientId) || null;
    const displayId = client?.display_id || email.clientDisplayId;
    const name = [client?.firstName || (client as any)?.fname, client?.lastName || (client as any)?.lname].filter(Boolean).join(' ').trim();
    return {
      clientId,
      displayId,
      name,
      email: client?.email || '',
      label: displayId ? `#${displayId}` : clientId ? `#${clientId.slice(-6)}` : 'No client',
    };
  };

  const filteredSentEmails = useMemo(() => {
    const search = sentEmailSearch.trim().toLowerCase();
    return sentEmails.filter((email) => {
      const client = getSentEmailClient(email);
      const searchable = [
        email.display_id, email.subject, email.bodyText, email.templateName, email.status,
        ...(email.to || []), ...(email.cc || []), client.displayId, client.name, client.email,
      ].filter(Boolean).join(' ').toLowerCase();
      return (!search || searchable.includes(search))
        && (sentEmailStatusFilter === 'all' || email.status === sentEmailStatusFilter);
    });
  // getSentEmailClient also resolves clients loaded on this page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, sentEmailSearch, sentEmailStatusFilter, sentEmails]);

  const renderClientLink = (email: SentEmail, compact = false) => {
    const client = getSentEmailClient(email);
    if (!client.clientId) {
      return <span className="text-gray-400">No client</span>;
    }
    return (
      <Link
        to={`/admin/clients/${client.clientId}`}
        onClick={(event) => event.stopPropagation()}
        className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
      >
        {compact ? client.label : `${client.label}${client.name ? ` ${client.name}` : ''}`}
      </Link>
    );
  };

  const loadAll = async () => {
    setLoading(true);
    setLoadWarnings([]);
    try {
      const quietRequest = { suppressGlobalError: true };
      const [settingsRes, templatesRes, sentRes, inboundRes, clientsRes, retreatsRes, seedOptionsRes] = await Promise.allSettled([
        communicationsApi.getSettings(quietRequest),
        communicationsApi.getTemplates(),
        communicationsApi.getSentEmails({}, quietRequest),
        communicationsApi.getInboundEmails({ limit: 100 }, quietRequest),
        clientsApi.getAll(),
        retreatsApi.getAll(),
        communicationsApi.getTemplateSeedOptions(),
      ]);
      const warnings: string[] = [];
      if (settingsRes.status === 'fulfilled') setSettings(settingsRes.value.data);
      else warnings.push('Gmail settings could not be loaded.');
      if (templatesRes.status === 'fulfilled') setTemplates(Array.isArray(templatesRes.value.data) ? templatesRes.value.data : []);
      else warnings.push('Email templates could not be loaded.');
      if (sentRes.status === 'fulfilled') setSentEmails(Array.isArray(sentRes.value.data) ? sentRes.value.data : []);
      else warnings.push('Sent mail log could not be loaded.');
      if (inboundRes.status === 'fulfilled') {
        setInboundEmails(Array.isArray(inboundRes.value.data) ? inboundRes.value.data : []);
      } else {
        console.error('Error loading inbound emails:', inboundRes.reason);
        warnings.push('Inbound mail could not be loaded.');
        setInboundEmails([]);
      }
      if (clientsRes.status === 'fulfilled') setClients(Array.isArray(clientsRes.value.data) ? clientsRes.value.data : []);
      else warnings.push('Client list could not be loaded.');
      if (retreatsRes.status === 'fulfilled') setRetreats(Array.isArray(retreatsRes.value.data) ? retreatsRes.value.data : []);
      else warnings.push('Retreat list could not be loaded.');
      if (seedOptionsRes.status === 'fulfilled') {
        const options = Array.isArray(seedOptionsRes.value.data) ? seedOptionsRes.value.data : [];
        setSeedOptions(options);
        setSelectedSeedKeys((current) => current.length > 0
          ? current.filter((key) => options.some((option) => option.key === key))
          : options
            .filter((option) => ['questionnaire_request', 'medical_form_request'].includes(option.templateKey || '') && ['en', 'cz', 'pl'].includes(option.language || ''))
            .map((option) => option.key)
        );
      } else {
        warnings.push('Template seed options could not be loaded.');
      }
      setLoadWarnings(warnings);
    } catch (error) {
      console.error('Error loading communications data:', error);
      setLoadWarnings(['Communications data could not be loaded.']);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab') as TabKey | null;
    if (tab && ['settings', 'templates', 'compose', 'sent', 'inbound'].includes(tab)) {
      setActiveTab(tab);
    }
    if (location.search.length > 1) {
      setComposeForm((prev) => ({
        ...prev,
        clientId: params.get('clientId') || prev.clientId,
        retreatId: params.get('retreatId') || prev.retreatId,
        to: params.get('to') || prev.to,
        subject: params.get('subject') || prev.subject,
        bodyText: params.get('bodyText') || prev.bodyText,
        relatedEntityType: params.get('relatedEntityType') || prev.relatedEntityType,
        relatedEntityId: params.get('relatedEntityId') || prev.relatedEntityId,
      }));
    }
  }, [location.search]);

  useEffect(() => {
    if (!selectedTemplateId) {
      setTemplateForm(defaultTemplateForm);
      return;
    }
    const template = templates.find((item) => item._id === selectedTemplateId);
    if (template) {
      setTemplateForm({
        ...template,
        bodyHtml: template.bodyHtml || '',
        active: template.active !== false,
      });
    }
  }, [selectedTemplateId, templates]);

  const handleSelectTemplate = (template: EmailTemplate) => {
    setSelectedTemplateId(template._id || '');
  };

  const handleNewTemplate = async () => {
    try {
      const nextIdResponse = await communicationsApi.getNextTemplateDisplayId();
      setSelectedTemplateId('');
      setTemplateForm({
        ...defaultTemplateForm,
        display_id: nextIdResponse.data,
      });
    } catch (error) {
      console.error('Error getting next template ID:', error);
      setSelectedTemplateId('');
      setTemplateForm(defaultTemplateForm);
    }
  };

  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    try {
      const payload = {
        ...templateForm,
        name: String(templateForm.name || '').trim(),
        subject: String(templateForm.subject || '').trim(),
        bodyText: String(templateForm.bodyText || ''),
        bodyHtml: String(templateForm.bodyHtml || '').trim() || undefined,
        language: String(templateForm.language || 'en').trim().toLowerCase(),
        templateKey: String(templateForm.templateKey || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || undefined,
        bookingFlowStepKey: String(templateForm.bookingFlowStepKey || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || undefined,
        bookingFlowStatusOnSend: String(templateForm.bookingFlowStatusOnSend || 'sent').trim().toLowerCase(),
      };

      if (!payload.name || !payload.subject || !payload.bodyText) {
        alert('Template name, subject, and body are required');
        return;
      }

      if (selectedTemplateId) {
        await communicationsApi.updateTemplate(selectedTemplateId, payload);
      } else {
        await communicationsApi.createTemplate(payload as Omit<EmailTemplate, '_id' | 'createdAt' | 'updatedAt'>);
      }

      await loadAll();
      alert('Template saved');
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Error saving template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplateId) return;
    if (!window.confirm('Delete this template?')) return;
    try {
      await communicationsApi.deleteTemplate(selectedTemplateId);
      await loadAll();
      setSelectedTemplateId('');
      setTemplateForm(defaultTemplateForm);
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Error deleting template');
    }
  };

  const toggleSeedOption = (key: string) => {
    setSelectedSeedKeys((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]
    );
  };

  const selectQuestionnaireSeedOptions = () => {
    setSelectedSeedKeys(seedOptions
      .filter((option) => ['questionnaire_request', 'medical_form_request'].includes(option.templateKey || '') && ['en', 'cz', 'pl'].includes(option.language || ''))
      .map((option) => option.key)
    );
  };

  const handleSeedDefaultTemplates = async () => {
    const selectedOptions = seedOptions.filter((option) => selectedSeedKeys.includes(option.key));
    if (selectedOptions.length === 0) {
      alert('Select at least one template to seed.');
      return;
    }
    const confirmed = window.confirm(
      `${overwriteSeedTemplates ? 'Overwrite' : 'Create missing'} ${selectedOptions.length} selected template variant(s)?`,
    );
    if (!confirmed) return;
    setSeedingTemplates(true);
    try {
      const response = await communicationsApi.seedDefaultTemplates({
        overwrite: overwriteSeedTemplates,
        templateSelections: selectedOptions.map((option) => ({
          templateKey: option.templateKey,
          language: option.language,
        })),
      });
      await loadAll();
      alert(`Selected templates seeded. Created: ${response.data.created}. Updated: ${response.data.updated}. Skipped unchanged existing templates: ${response.data.skipped || 0}.`);
    } catch (error: any) {
      console.error('Error seeding default templates:', error);
      alert(error?.response?.data?.message || error?.message || 'Unable to seed default templates.');
    } finally {
      setSeedingTemplates(false);
    }
  };

  const handleUseTemplateInCompose = (templateId: string) => {
    const template = templates.find((item) => item._id === templateId);
    setComposeForm((prev) => ({
      ...prev,
      templateId,
      subject: template?.subject || '',
      bodyText: template?.bodyText || '',
    }));
  };

  const handleClientSelect = (clientId: string) => {
    const client = clients.find((item) => item._id === clientId);
    setComposeForm((prev) => ({
      ...prev,
      clientId,
      to: client?.email || prev.to,
    }));
  };

  const handleRetreatSelect = (retreatId: string) => {
    setComposeForm((prev) => ({ ...prev, retreatId }));
  };

  const buildVariables = () => ({
    client: selectedClient || {},
    retreat: selectedRetreat || {},
    settings: settings || {},
  });

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      const payload = {
        ...composeForm,
        to: composeForm.to.trim(),
        cc: composeForm.cc.trim() || undefined,
        bcc: composeForm.bcc.trim() || undefined,
        subject: composeForm.subject.trim(),
        bodyText: composeForm.bodyText,
        fromName: composeForm.fromName.trim() || settings?.senderName,
        fromEmail: composeForm.fromEmail.trim() || settings?.senderEmail,
        replyTo: composeForm.replyTo.trim() || settings?.replyTo,
        clientId: composeForm.clientId || undefined,
        retreatId: composeForm.retreatId || undefined,
        relatedEntityType: composeForm.relatedEntityType || undefined,
        relatedEntityId: composeForm.relatedEntityId || undefined,
        variables: buildVariables(),
      };

      if (!payload.to) {
        alert('A recipient email is required');
        return;
      }

      const response = await communicationsApi.sendEmail(payload);
      await loadAll();
      setActiveTab('sent');
      alert(formatSentEmailReceipt(response.data));
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Email send failed');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSettingsSave = async () => {
    setSavingSettings(true);
    try {
      const response = await communicationsApi.saveSettings({
        senderName: settings?.senderName || '',
        senderEmail: settings?.senderEmail || '',
        replyTo: settings?.replyTo || '',
        autoCcEnabled: settings?.autoCcEnabled !== false,
        autoCcEmail: settings?.autoCcEmail || 'info@ibogaspirit.cz',
      });
      setSettings(response.data);
      alert('Settings saved');
    } catch (error) {
      console.error('Error saving communications settings:', error);
      alert('Error saving settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteSentEmail = async (id?: string) => {
    if (!id) return;
    if (!window.confirm('Delete this communication log entry? This will not delete it from Gmail.')) return;
    try {
      await communicationsApi.deleteSentEmail(id);
      setSelectedSentEmailId('');
      await loadAll();
    } catch (error) {
      console.error('Error deleting communication log:', error);
      alert('Unable to delete communication log');
    }
  };

  const handleConnectGmail = async () => {
    try {
      const response = await communicationsApi.getAuthUrl();
      window.open(response.data.authUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error opening Gmail auth URL:', error);
      alert('Unable to start Gmail authorization');
    }
  };

  const handleTestConnection = async () => {
    try {
      await communicationsApi.testConnection();
      await loadAll();
      alert('Gmail connection verified');
    } catch (error) {
      console.error('Error testing Gmail connection:', error);
      alert('Gmail connection test failed');
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Gmail from Provider Plus?')) return;
    try {
      await communicationsApi.disconnect();
      await loadAll();
    } catch (error) {
      console.error('Error disconnecting Gmail:', error);
      alert('Unable to disconnect Gmail');
    }
  };

  const loadInboundEmails = async () => {
    try {
      const response = await communicationsApi.getInboundEmails({ limit: 100 }, { suppressGlobalError: true });
      setInboundEmails(Array.isArray(response.data) ? response.data : []);
      setLoadWarnings((current) => current.filter((warning) => warning !== 'Inbound mail could not be loaded.'));
    } catch (error) {
      console.error('Error loading inbound emails:', error);
      setInboundEmails([]);
      setLoadWarnings((current) => Array.from(new Set([...current, 'Inbound mail could not be loaded.'])));
    }
  };

  const handleSetupGmailWatch = async () => {
    try {
      const response = await communicationsApi.setupGmailWatch();
      alert(`Gmail watch started. History ID: ${response.data?.gmailHistoryId || 'n/a'}`);
      await loadAll();
    } catch (error: any) {
      console.error('Error starting Gmail watch:', error);
      alert(error?.response?.data?.message || error?.message || 'Unable to start Gmail watch');
    }
  };

  const handleProcessInbound = async () => {
    setProcessingInbound(true);
    try {
      const response = await communicationsApi.processInboundEmails(25);
      alert(`Processed ${response.data?.processed || 0} inbound emails.`);
      await loadInboundEmails();
    } catch (error: any) {
      console.error('Error processing inbound emails:', error);
      alert(error?.response?.data?.message || error?.message || 'Unable to process inbound emails');
    } finally {
      setProcessingInbound(false);
    }
  };

  const handleReprocessInbound = async (email: InboundEmail) => {
    if (!email._id) return;
    await communicationsApi.reprocessInboundEmail(email._id);
    await loadInboundEmails();
  };

  const handleIgnoreInbound = async (email: InboundEmail) => {
    if (!email._id) return;
    await communicationsApi.updateInboundEmail(email._id, { status: 'ignored', aiClassification: { manualOverride: true, reason: 'Ignored by admin' } });
    await loadInboundEmails();
  };

  const handleCreateTaskFromInbound = async (email: InboundEmail) => {
    if (!email._id) return;
    const title = window.prompt('Task title', email.aiClassification?.taskTitle || email.subject || 'Follow up on inbound email');
    if (!title) return;
    const priority = window.prompt('Priority: low, medium, high, urgent', email.aiClassification?.priority || 'medium') || 'medium';
    await communicationsApi.updateInboundEmail(email._id, {
      createTask: true,
      taskTitle: title,
      priority,
      taskDescription: email.aiClassification?.taskDescription || email.bodyText || email.snippet || '',
      tags: ['inbound-email', 'manual'],
    });
    await loadInboundEmails();
  };

  if (loading) {
    return <div className="p-6 text-gray-500">Loading communications...</div>;
  }

  const connectedEmail = settings?.gmailUserEmail || settings?.senderEmail || 'Gmail';
  const connectionLabel = settings?.connected
    ? 'connected'
    : settings?.oauthConfigured
      ? 'disconnected'
      : 'needs re-auth';

  return (
    <div className="communications-redesign">
      <header className="communications-header">
        <div className="communications-title">
          <h1>Communications</h1>
          <p>
            <span className={`communications-status-dot ${settings?.connected ? 'is-connected' : ''}`} />
            Gmail · {connectedEmail} · {connectionLabel}
          </p>
        </div>
        <div className="communications-header-actions">
          <button type="button" onClick={handleTestConnection} className="communications-secondary-action">
            Test connection
          </button>
          <button type="button" onClick={() => setActiveTab('compose')} className="communications-primary-action">
            <Icon icon={FiEdit2} />
            Compose
          </button>
        </div>
      </header>

      <nav className="communications-tabs" aria-label="Communication sections">
          {(['sent', 'compose', 'templates', 'settings', 'inbound'] as TabKey[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={activeTab === tab ? 'is-active' : ''}
            >
              {tab === 'settings' ? 'Settings' : tab === 'templates' ? 'Templates' : tab === 'compose' ? 'Compose' : tab === 'sent' ? 'Sent' : 'Inbound'}
              {tab === 'sent' && <span>{sentEmails.length}</span>}
              {tab === 'templates' && <span>{templates.length}</span>}
            </button>
          ))}
      </nav>

      {loadWarnings.length > 0 && (
        <div className="communications-warning">
          <div className="font-semibold">Some communications data is temporarily unavailable.</div>
          <div className="mt-1">{loadWarnings.join(' ')}</div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Gmail Connection</h2>
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${settings?.connected ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                <Icon icon={settings?.connected ? FiCheckCircle : FiAlertCircle} />
                {settings?.connected ? 'Connected' : 'Not connected'}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sender Name</label>
                <input
                  value={settings?.senderName || ''}
                  onChange={(e) => setSettings((prev) => ({ ...(prev || {}), senderName: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="Provider Plus"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sender Email</label>
                <input
                  type="email"
                  value={settings?.senderEmail || ''}
                  onChange={(e) => setSettings((prev) => ({ ...(prev || {}), senderEmail: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="info@ibogaspirit.cz"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reply-To</label>
              <input
                type="email"
                value={settings?.replyTo || ''}
                onChange={(e) => setSettings((prev) => ({ ...(prev || {}), replyTo: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="support@example.com"
              />
            </div>

            <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-blue-950">
                <input
                  type="checkbox"
                  checked={settings?.autoCcEnabled !== false}
                  onChange={(e) => setSettings((prev) => ({ ...(prev || {}), autoCcEnabled: e.target.checked }))}
                />
                Automatically CC every sent email
              </label>
              <div className="mt-3">
                <label className="block text-xs font-semibold uppercase text-blue-900">Auto CC email</label>
                <input
                  type="email"
                  value={settings?.autoCcEmail || 'info@ibogaspirit.cz'}
                  onChange={(e) => setSettings((prev) => ({ ...(prev || {}), autoCcEmail: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-blue-200 px-3 py-2 text-sm"
                  placeholder="info@ibogaspirit.cz"
                  disabled={settings?.autoCcEnabled === false}
                />
              </div>
              <p className="mt-2 text-xs text-blue-900">Applied by the API to popup sends, direct sends, and retreat bulk emails.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSettingsSave}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                disabled={savingSettings}
              >
                <Icon icon={FiSave} />
                Save Settings
              </button>
              <button
                type="button"
                onClick={handleConnectGmail}
                className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
              >
                <Icon icon={FiMail} />
                Connect Gmail
              </button>
              <button
                type="button"
                onClick={handleTestConnection}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Icon icon={FiRefreshCw} />
                Test Connection
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                className="inline-flex items-center gap-2 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <Icon icon={FiTrash2} />
                Disconnect
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Connection Status</h2>
            <div className="space-y-2 text-sm text-gray-700">
              <div>Google OAuth configured: <span className="font-medium">{settings?.oauthConfigured ? 'Yes' : 'No'}</span></div>
              <div>Connected account: <span className="font-medium">{settings?.gmailUserEmail || 'Not connected'}</span></div>
              <div>Sender name: <span className="font-medium">{settings?.senderName || 'Not set'}</span></div>
              <div>Reply-to: <span className="font-medium">{settings?.replyTo || 'Not set'}</span></div>
              <div>Auto CC: <span className="font-medium">{settings?.autoCcEnabled === false ? 'Off' : settings?.autoCcEmail || 'info@ibogaspirit.cz'}</span></div>
              <div>Last connected: <span className="font-medium">{settings?.lastConnectedAt ? new Date(settings.lastConnectedAt).toLocaleString() : 'Never'}</span></div>
              <div>Last test: <span className="font-medium">{settings?.lastTestAt ? new Date(settings.lastTestAt).toLocaleString() : 'Never'}</span></div>
              <div>Last error: <span className="font-medium text-red-600">{settings?.lastError || 'None'}</span></div>
            </div>
            <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-600">
              Configure Google OAuth redirect URI to point at <code>/communications/gmail/callback</code> on the API host. The sending domain should be an authorized Gmail or Google Workspace mailbox for <code>ibogaspirit.cz</code>.
            </div>
          </section>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Templates</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSeedOptions((current) => !current)}
                  disabled={seedingTemplates}
                  className="inline-flex items-center gap-2 rounded-md border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                >
                  <Icon icon={FiRefreshCw} />
                  {seedingTemplates ? 'Seeding...' : 'Reseed'}
                </button>
                <button
                  type="button"
                  onClick={handleNewTemplate}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Icon icon={FiPlus} />
                  New
                </button>
              </div>
            </div>
            {showSeedOptions && (
              <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-blue-950">Reseed default templates</div>
                    <div className="text-xs text-blue-800">Questionnaire and medications templates include dynamic Jotform link placeholders <code>{'{{links.questionnaire}}'}</code> and <code>{'{{links.medicationsForm}}'}</code>.</div>
                  </div>
                  <button
                    type="button"
                    onClick={selectQuestionnaireSeedOptions}
                    className="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    Questionnaire + Meds EN/CZ/PL
                  </button>
                </div>
                <label className="mb-3 inline-flex items-center gap-2 text-xs font-medium text-blue-900">
                  <input
                    type="checkbox"
                    checked={overwriteSeedTemplates}
                    onChange={(event) => setOverwriteSeedTemplates(event.target.checked)}
                  />
                  Overwrite selected existing templates with code defaults
                </label>
                <div className="max-h-64 space-y-3 overflow-y-auto rounded-md bg-white p-2">
                  {Object.entries(groupedSeedOptions).map(([groupKey, options]) => (
                    <div key={groupKey} className="rounded border border-gray-100 p-2">
                      <div className="mb-2 text-xs font-semibold uppercase text-gray-500">{groupKey}</div>
                      <div className="space-y-1">
                        {options.map((option) => (
                          <label key={option.key} className="flex items-start gap-2 rounded px-2 py-1 hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={selectedSeedKeys.includes(option.key)}
                              onChange={() => toggleSeedOption(option.key)}
                              className="mt-1"
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-gray-900">{option.name}</span>
                              <span className="block truncate text-xs text-gray-500">
                                {(option.language || 'en').toUpperCase()} · {option.category || 'general'}{option.bookingFlowStepKey ? ` · step ${option.bookingFlowStepKey}` : ''}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  {seedOptions.length === 0 && <div className="p-2 text-xs text-gray-500">No seed options loaded.</div>}
                </div>
                <button
                  type="button"
                  onClick={handleSeedDefaultTemplates}
                  disabled={seedingTemplates || selectedSeedKeys.length === 0}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Icon icon={FiRefreshCw} />
                  {seedingTemplates ? 'Seeding selected...' : `Seed ${selectedSeedKeys.length} selected`}
                </button>
              </div>
            )}
            <div className="grid grid-cols-3 rounded-lg border border-gray-200 bg-gray-100 p-1" role="tablist" aria-label="Template language">
              {[
                { key: 'pl', label: 'PL' },
                { key: 'cz', label: 'CZ' },
                { key: 'en', label: 'EN' },
              ].map((language) => (
                <button
                  key={language.key}
                  type="button"
                  role="tab"
                  aria-selected={templateLanguageFilter === language.key}
                  onClick={() => {
                    setTemplateLanguageFilter(language.key);
                    const selectedLanguage = String(selectedTemplate?.language || 'en').toLowerCase().replace('cs', 'cz');
                    if (selectedTemplate && selectedLanguage !== language.key) {
                      const counterpart = templates.find((template) =>
                        String(template.templateKey || '').trim().toLowerCase() === String(selectedTemplate.templateKey || '').trim().toLowerCase()
                        && String(template.language || 'en').toLowerCase().replace('cs', 'cz') === language.key);
                      setSelectedTemplateId(counterpart?._id || '');
                    }
                  }}
                  className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                    templateLanguageFilter === language.key
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {language.label}
                </button>
              ))}
            </div>
            <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
              <div className="relative">
                <Icon icon={FiSearch} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={templateSearch}
                  onChange={(event) => setTemplateSearch(event.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm"
                  placeholder="Search templates..."
                  aria-label="Search communication templates"
                />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
                <select
                  value={templateCategoryFilter}
                  onChange={(event) => setTemplateCategoryFilter(event.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
                  aria-label="Filter templates by category"
                >
                  <option value="all">All categories</option>
                  {templateCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                <select
                  value={templateStatusFilter}
                  onChange={(event) => setTemplateStatusFilter(event.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
                  aria-label="Filter templates by status"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{filteredTemplates.length} of {templates.length} templates</span>
                {hasTemplateFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setTemplateSearch('');
                      setTemplateCategoryFilter('all');
                      setTemplateLanguageFilter('en');
                      setTemplateStatusFilter('all');
                    }}
                    className="font-medium text-blue-600 hover:text-blue-800"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {filteredTemplates.map((template) => (
                <button
                  key={template._id}
                  type="button"
                  onClick={() => handleSelectTemplate(template)}
                  className={`w-full rounded-md border px-3 py-2 text-left ${selectedTemplateId === template._id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900">{template.name}</div>
                      <div className="truncate text-xs text-gray-500">{template.subject}</div>
                      <div className="mt-1 text-[11px] uppercase text-gray-400">
                        {template.language || 'en'}{template.templateKey ? ` / ${template.templateKey}` : ''}
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <div>#{template.display_id || 'n/a'}</div>
                      <div>{template.active === false ? 'Hidden' : 'Active'}</div>
                    </div>
                  </div>
                </button>
              ))}
              {templates.length === 0 && <div className="text-sm text-gray-500">No templates yet.</div>}
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{selectedTemplateId ? `Edit Template #${templateForm.display_id || selectedTemplate?.display_id || ''}` : 'New Template'}</h2>
              {selectedTemplateId && (
                <button
                  type="button"
                  onClick={handleDeleteTemplate}
                  className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <Icon icon={FiTrash2} />
                  Delete
                </button>
              )}
            </div>
            {selectedTemplateId && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm">
                <span className="font-medium text-blue-950">Other languages:</span>
                {selectedTemplateCounterparts.length > 0 ? selectedTemplateCounterparts.map((template) => (
                  <button
                    key={template._id}
                    type="button"
                    onClick={() => {
                      handleSelectTemplate(template);
                      setTemplateLanguageFilter(String(template.language || 'en').toLowerCase().replace('cs', 'cz'));
                    }}
                    className="rounded-full border border-blue-200 bg-white px-3 py-1 font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    {String(template.language || 'en').toUpperCase()} · #{template.display_id || 'n/a'}
                  </button>
                )) : (
                  <span className="text-blue-700">
                    No counterparts found. Give translated versions the same Variant Key.
                  </span>
                )}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                <input
                  value={templateForm.name || ''}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  value={templateForm.category || ''}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="general"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Variant Key</label>
                <input
                  value={templateForm.templateKey || ''}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, templateKey: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="contract_sent"
                />
                <p className="mt-1 text-xs text-gray-500">Use the same key for all language versions of the same email.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                <select
                  value={templateForm.language || 'en'}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, language: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="en">English</option>
                  <option value="cz">Czech</option>
                  <option value="pl">Polish</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Booking Steps Updated After Successful Send</label>
                <div className="space-y-2 rounded-md border border-gray-300 bg-white p-3">
                  {WELCOME_STEP_OPTIONS.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={(templateForm.bookingFlowStepKeys || []).includes(key)} onChange={(event) => setTemplateForm((prev) => ({ ...prev, bookingFlowStepKeys: event.target.checked ? Array.from(new Set([...(prev.bookingFlowStepKeys || []), key])) : (prev.bookingFlowStepKeys || []).filter((item) => item !== key) }))}/><span>{label}</span><code className="ml-auto text-xs text-gray-400">{key}</code></label>)}
                </div>
                <p className="mt-1 text-xs text-gray-500">All selected steps are updated only after Gmail confirms the email was sent.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status After Send</label>
                <select
                  value={templateForm.bookingFlowStatusOnSend || 'sent'}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, bookingFlowStatusOnSend: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="sent">Sent</option>
                  <option value="completed">Completed</option>
                  <option value="received">Received</option>
                  <option value="approved">Approved</option>
                  <option value="waived">Waived</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <input
                value={templateForm.subject || ''}
                onChange={(e) => setTemplateForm((prev) => ({ ...prev, subject: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message Body</label>
              <textarea
                rows={12}
                value={looksLikeHtml(String(templateForm.bodyHtml || '')) ? templateForm.bodyHtml : templateForm.bodyText || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  const isHtml = looksLikeHtml(value);
                  setTemplateForm((prev) => ({
                    ...prev,
                    bodyText: isHtml ? htmlToPlainText(value) : value,
                    bodyHtml: isHtml ? value : plainTextToHtml(value),
                  }));
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                HTML is detected automatically. Paste the complete HTML source here; no special label is required.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={templateForm.description || ''}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    rows={3}
                    value={templateForm.notes || ''}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={templateForm.active !== false}
                    onChange={(e) => setTemplateForm((prev) => ({ ...prev, active: e.target.checked }))}
                  />
                  Active
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Use placeholders like <code className="rounded bg-gray-100 px-1">{'{{ client.firstName }}'}</code> or <code className="rounded bg-gray-100 px-1">{'{{ retreat.name }}'}</code>.
              </div>
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={savingTemplate}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Icon icon={FiSave} />
                Save Template
              </button>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'compose' && (
        <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Compose Email</h2>
            <div className="text-xs text-gray-500">Messages are sent through Gmail and logged as sent records.</div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <SearchableClientSelect
                clients={clients}
                selectedClientId={composeForm.clientId}
                onClientSelect={handleClientSelect}
                placeholder="Search client by name, email, or ID"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Retreat</label>
              <SearchableRetreatSelect
                retreats={retreats}
                selectedRetreatId={composeForm.retreatId}
                onRetreatSelect={handleRetreatSelect}
                placeholder="Search retreat"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input
                value={composeForm.to}
                onChange={(e) => setComposeForm((prev) => ({ ...prev, to: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="recipient@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CC</label>
              <input
                value={composeForm.cc}
                onChange={(e) => setComposeForm((prev) => ({ ...prev, cc: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="optional"
              />
              {settings?.autoCcEnabled !== false && (
                <p className="mt-1 text-xs text-gray-500">Auto CC will add {settings?.autoCcEmail || 'info@ibogaspirit.cz'}.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">BCC</label>
              <input
                value={composeForm.bcc}
                onChange={(e) => setComposeForm((prev) => ({ ...prev, bcc: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="optional"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
              <select
                value={composeForm.templateId}
                onChange={(e) => {
                  setComposeForm((prev) => ({ ...prev, templateId: e.target.value }));
                  if (e.target.value) handleUseTemplateInCompose(e.target.value);
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 bg-white"
              >
                <option value="">Manual message</option>
                {templates.map((template) => (
                  <option key={template._id} value={template._id}>
                    {template.display_id ? `#${template.display_id} ` : ''}{template.name}
                    {` (${template.templateKey || template.category || 'general'} / ${template.language || 'en'})`}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
                <input
                  value={composeForm.fromName}
                  onChange={(e) => setComposeForm((prev) => ({ ...prev, fromName: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
                <input
                  type="email"
                  value={composeForm.fromEmail}
                  onChange={(e) => setComposeForm((prev) => ({ ...prev, fromEmail: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reply-To</label>
                <input
                  type="email"
                  value={composeForm.replyTo}
                  onChange={(e) => setComposeForm((prev) => ({ ...prev, replyTo: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input
              value={composeForm.subject}
              onChange={(e) => setComposeForm((prev) => ({ ...prev, subject: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message Body</label>
            <textarea
              rows={16}
              value={composeForm.bodyText}
              onChange={(e) => setComposeForm((prev) => ({ ...prev, bodyText: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm"
              placeholder="Write the email body here. Use placeholders like {{ client.firstName }}."
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="text-xs text-gray-500">
              {selectedClient ? `Selected client: ${selectedClient.firstName} ${selectedClient.lastName} (${selectedClient.email})` : 'No client selected'}
              {selectedRetreat ? ` • Retreat: ${selectedRetreat.name}` : ''}
            </div>
            <button
              type="button"
              onClick={handleSendEmail}
              disabled={sendingEmail}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Icon icon={FiSend} />
              Send Email
            </button>
          </div>
        </section>
      )}

      {activeTab === 'inbound' && (
        <div className="space-y-4">
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Inbound Gmail</h2>
                <p className="text-sm text-gray-500">Received Gmail messages, AI task classification, and manual overrides.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSetupGmailWatch}
                  className="inline-flex items-center gap-2 rounded-md border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                >
                  <Icon icon={FiInbox} />
                  Start Gmail Watch
                </button>
                <button
                  type="button"
                  onClick={loadInboundEmails}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Icon icon={FiRefreshCw} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={handleProcessInbound}
                  disabled={processingInbound}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Icon icon={FiCheckCircle} />
                  {processingInbound ? 'Processing...' : 'Process Pending'}
                </button>
              </div>
            </div>
          </section>

          <section className="overflow-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-gray-500">
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">AI</th>
                  <th className="px-4 py-3">Task</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inboundEmails.map((email) => {
                  const task = typeof email.createdTaskId === 'object' ? email.createdTaskId : null;
                  const client = typeof email.linkedClientId === 'object' ? email.linkedClientId : null;
                  const contact = typeof email.linkedContactId === 'object' ? email.linkedContactId : null;
                  return (
                    <tr key={email._id || email.gmailMessageId} className="border-b align-top">
                      <td className="px-4 py-3 text-gray-600">{email.receivedAt ? new Date(email.receivedAt).toLocaleString() : '-'}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{email.fromName || email.fromEmail || 'Unknown'}</div>
                        <div className="text-xs text-gray-500">{email.fromEmail}</div>
                        {client && <div className="mt-1 text-xs text-blue-700">Client: {client.firstName} {client.lastName}</div>}
                        {contact && <div className="mt-1 text-xs text-blue-700">Contact: {contact.name}</div>}
                      </td>
                      <td className="max-w-md px-4 py-3">
                        <div className="font-medium text-gray-900">{email.subject || '(no subject)'}</div>
                        <div className="mt-1 line-clamp-2 text-xs text-gray-500">{email.snippet || email.bodyText}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          email.status === 'task_created' ? 'bg-green-50 text-green-700' :
                          email.status === 'needs_review' ? 'bg-amber-50 text-amber-700' :
                          email.status === 'error' ? 'bg-red-50 text-red-700' :
                          email.status === 'ignored' ? 'bg-gray-100 text-gray-600' :
                          'bg-blue-50 text-blue-700'
                        }`}>
                          {email.status.replace(/_/g, ' ')}
                        </span>
                        {email.errorMessage && <div className="mt-1 text-xs text-red-600">{email.errorMessage}</div>}
                      </td>
                      <td className="max-w-sm px-4 py-3 text-xs text-gray-600">
                        {email.aiClassification ? (
                          <div className="space-y-1">
                            <div>Task needed: <span className="font-medium">{email.aiClassification.taskNeeded ? 'Yes' : 'No'}</span></div>
                            <div>Priority: <span className="font-medium">{email.aiClassification.priority || '-'}</span></div>
                            <div className="line-clamp-3">{email.aiClassification.reason}</div>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {task ? (
                          <div>
                            <div className="font-medium text-gray-900">{task.name}</div>
                            <div className="text-xs text-gray-500">{task.status} · {task.urgency}</div>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-2">
                          <button type="button" onClick={() => handleReprocessInbound(email)} className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">Reprocess</button>
                          <button type="button" onClick={() => handleCreateTaskFromInbound(email)} className="rounded-md border border-blue-200 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50">Create task</button>
                          <button type="button" onClick={() => handleIgnoreInbound(email)} className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50">Ignore</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {inboundEmails.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No inbound emails stored yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {activeTab === 'sent' && (
        <div>
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Sent Mail</h2>
                <span className="text-xs text-gray-500">{filteredSentEmails.length} of {sentEmails.length} messages</span>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <label className="relative min-w-[240px]">
                  <span className="sr-only">Search sent emails</span>
                  <Icon icon={FiSearch} className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    value={sentEmailSearch}
                    onChange={(event) => setSentEmailSearch(event.target.value)}
                    placeholder="Search subject, client, recipient or body"
                    className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <select
                  value={sentEmailStatusFilter}
                  onChange={(event) => setSentEmailStatusFilter(event.target.value)}
                  aria-label="Filter sent emails by status"
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
                >
                  <option value="all">All statuses</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                  <option value="queued">Queued</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-gray-500">
                  <tr className="border-b">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Client</th>
                    <th className="py-2 pr-3">Subject</th>
                    <th className="py-2 pr-3">To</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSentEmails.map((email) => {
                    const isOpen = selectedSentEmailId === email._id;
                    return (
                      <React.Fragment key={email._id}>
                        <tr
                          onClick={() => setSelectedSentEmailId(isOpen ? '' : (email._id || ''))}
                          className={`cursor-pointer border-b hover:bg-gray-50 ${isOpen ? 'bg-blue-50' : ''}`}
                          aria-expanded={isOpen}
                        >
                          <td className="py-2 pr-3 font-mono text-gray-700">#{email.display_id || 'n/a'}</td>
                          <td className="py-2 pr-3">{renderClientLink(email, true)}</td>
                          <td className="py-2 pr-3 font-medium text-gray-900">{email.subject}</td>
                          <td className="py-2 pr-3 text-gray-600">{(email.to || []).join(', ')}</td>
                          <td className="py-2 pr-3 text-gray-600">{email.status}</td>
                          <td className="py-2 pr-3 text-gray-600">{email.sentAt ? new Date(email.sentAt).toLocaleString() : '-'}</td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b bg-blue-50/40">
                            <td colSpan={6} className="px-4 py-4">
                              <div className="space-y-3 rounded-lg border border-blue-200 bg-white p-4 shadow-sm">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="space-y-1 text-sm">
                                    <div><span className="text-gray-500">Subject:</span> <span className="font-semibold text-gray-900">{email.subject}</span></div>
                                    <div><span className="text-gray-500">To:</span> {(email.to || []).join(', ')}</div>
                                    <div><span className="text-gray-500">CC:</span> {(email.cc || []).join(', ') || 'None'}</div>
                                    <div><span className="text-gray-500">Status:</span> {email.status || 'queued'} · {email.sentAt ? new Date(email.sentAt).toLocaleString() : 'Not sent'}</div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSentEmail(email._id)}
                                    className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                                  >
                                    <Icon icon={FiTrash2} />
                                    Delete Log
                                  </button>
                                </div>
                                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                                  <div className="mb-2 text-sm font-medium text-gray-700">Body</div>
                                  <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-gray-800">{email.bodyText || 'No message body stored.'}</pre>
                                </div>
                                {email.errorMessage && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{email.errorMessage}</div>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {filteredSentEmails.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-gray-500">{sentEmails.length ? 'No sent emails match these filters.' : 'No messages sent yet.'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default CommunicationsPage;
