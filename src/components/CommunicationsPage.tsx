import React, { useEffect, useMemo, useState } from 'react';
import { FiAlertCircle, FiCheckCircle, FiInbox, FiMail, FiPlus, FiRefreshCw, FiSave, FiSend, FiTrash2 } from 'react-icons/fi';
import { useLocation } from 'react-router-dom';
import { communicationsApi, clientsApi, retreatsApi } from '../services/api';
import { Client, EmailTemplate, InboundEmail, MailSettings, Retreat, SentEmail } from '../types';
import SearchableClientSelect from './SearchableClientSelect';
import SearchableRetreatSelect from './SearchableRetreatSelect';

type TabKey = 'settings' | 'templates' | 'compose' | 'sent' | 'inbound';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const defaultTemplateForm: Partial<EmailTemplate> = {
  name: '',
  description: '',
  subject: '',
  bodyText: '',
  bodyHtml: '',
  category: 'general',
  language: 'en',
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

const CommunicationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('settings');
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<MailSettings | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [inboundEmails, setInboundEmails] = useState<InboundEmail[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedSentEmailId, setSelectedSentEmailId] = useState('');
  const [templateForm, setTemplateForm] = useState<Partial<EmailTemplate>>(defaultTemplateForm);
  const [composeForm, setComposeForm] = useState(defaultComposeForm);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [seedingTemplates, setSeedingTemplates] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [processingInbound, setProcessingInbound] = useState(false);
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template._id === selectedTemplateId) || null,
    [templates, selectedTemplateId],
  );

  const selectedSentEmail = useMemo(
    () => sentEmails.find((email) => email._id === selectedSentEmailId) || null,
    [sentEmails, selectedSentEmailId],
  );

  const selectedClient = useMemo(
    () => clients.find((client) => client._id === composeForm.clientId) || null,
    [clients, composeForm.clientId],
  );

  const selectedRetreat = useMemo(
    () => retreats.find((retreat) => retreat._id === composeForm.retreatId) || null,
    [retreats, composeForm.retreatId],
  );

  const loadAll = async () => {
    setLoading(true);
    setLoadWarnings([]);
    try {
      const quietRequest = { suppressGlobalError: true };
      const [settingsRes, templatesRes, sentRes, inboundRes, clientsRes, retreatsRes] = await Promise.allSettled([
        communicationsApi.getSettings(quietRequest),
        communicationsApi.getTemplates(),
        communicationsApi.getSentEmails(quietRequest),
        communicationsApi.getInboundEmails({ limit: 100 }, quietRequest),
        clientsApi.getAll(),
        retreatsApi.getAll(),
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

  const handleSeedDefaultTemplates = async () => {
    setSeedingTemplates(true);
    try {
      const response = await communicationsApi.seedDefaultTemplates();
      await loadAll();
      alert(`Default templates seeded. Created: ${response.data.created}. Updated: ${response.data.updated}.`);
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

      await communicationsApi.sendEmail(payload);
      await loadAll();
      setActiveTab('sent');
      alert('Email sent');
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Communications</h1>
          <p className="text-sm text-gray-500 mt-1">Gmail connection, templates, compose, and sent log.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['settings', 'templates', 'compose', 'sent', 'inbound'] as TabKey[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 rounded-md text-sm font-medium border ${activeTab === tab ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              {tab === 'settings' ? 'Settings' : tab === 'templates' ? 'Templates' : tab === 'compose' ? 'Compose' : tab === 'sent' ? 'Sent Mail' : 'Inbound'}
            </button>
          ))}
        </div>
      </div>

      {loadWarnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
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
                  onClick={handleSeedDefaultTemplates}
                  disabled={seedingTemplates}
                  className="inline-flex items-center gap-2 rounded-md border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                >
                  <Icon icon={FiRefreshCw} />
                  {seedingTemplates ? 'Seeding...' : 'Seed Defaults'}
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
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {templates.map((template) => (
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
                      <div className="mt-1 text-[11px] uppercase text-gray-400">{template.language || 'en'}</div>
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
                value={templateForm.bodyText || ''}
                onChange={(e) => setTemplateForm((prev) => ({
                  ...prev,
                  bodyText: e.target.value,
                  bodyHtml: `<pre style="white-space: pre-wrap; font-family: inherit;">${e.target.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`,
                }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm"
              />
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
                  <option key={template._id} value={template._id}>{template.display_id ? `#${template.display_id} ` : ''}{template.name}</option>
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
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Sent Mail</h2>
              <span className="text-xs text-gray-500">{sentEmails.length} messages</span>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-gray-500">
                  <tr className="border-b">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Subject</th>
                    <th className="py-2 pr-3">To</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {sentEmails.map((email) => (
                    <tr
                      key={email._id}
                      onClick={() => setSelectedSentEmailId(email._id || '')}
                      className={`cursor-pointer border-b hover:bg-gray-50 ${selectedSentEmailId === email._id ? 'bg-blue-50' : ''}`}
                    >
                      <td className="py-2 pr-3 font-mono text-gray-700">#{email.display_id || 'n/a'}</td>
                      <td className="py-2 pr-3 font-medium text-gray-900">{email.subject}</td>
                      <td className="py-2 pr-3 text-gray-600">{(email.to || []).join(', ')}</td>
                      <td className="py-2 pr-3 text-gray-600">{email.status}</td>
                      <td className="py-2 pr-3 text-gray-600">{email.sentAt ? new Date(email.sentAt).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                  {sentEmails.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-gray-500">No messages sent yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Message Detail</h2>
            {selectedSentEmail ? (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleDeleteSentEmail(selectedSentEmail._id)}
                    className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <Icon icon={FiTrash2} />
                    Delete Log
                  </button>
                </div>
                <div><span className="text-gray-500">Message #:</span> <span className="font-mono">#{selectedSentEmail.display_id || 'n/a'}</span></div>
                <div><span className="text-gray-500">Status:</span> {selectedSentEmail.status}</div>
                <div><span className="text-gray-500">To:</span> {(selectedSentEmail.to || []).join(', ')}</div>
                <div><span className="text-gray-500">Subject:</span> {selectedSentEmail.subject}</div>
                <div className="text-xs text-gray-500">
                  {selectedSentEmail.sentAt ? `Sent ${new Date(selectedSentEmail.sentAt).toLocaleString()}` : 'Not sent'}
                </div>
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-2 text-sm font-medium text-gray-700">Body</div>
                  <pre className="whitespace-pre-wrap text-sm text-gray-800">{selectedSentEmail.bodyText}</pre>
                </div>
                {selectedSentEmail.errorMessage && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {selectedSentEmail.errorMessage}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">Select a sent message to inspect it.</div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default CommunicationsPage;
