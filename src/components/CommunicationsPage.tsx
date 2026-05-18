import React, { useEffect, useMemo, useState } from 'react';
import { FiAlertCircle, FiCheckCircle, FiMail, FiPlus, FiRefreshCw, FiSave, FiSend, FiTrash2 } from 'react-icons/fi';
import { communicationsApi, clientsApi, retreatsApi } from '../services/api';
import { Client, EmailTemplate, MailSettings, Retreat, SentEmail } from '../types';
import SearchableClientSelect from './SearchableClientSelect';
import SearchableRetreatSelect from './SearchableRetreatSelect';

type TabKey = 'settings' | 'templates' | 'compose' | 'sent';

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
};

const CommunicationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('settings');
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<MailSettings | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedSentEmailId, setSelectedSentEmailId] = useState('');
  const [templateForm, setTemplateForm] = useState<Partial<EmailTemplate>>(defaultTemplateForm);
  const [composeForm, setComposeForm] = useState(defaultComposeForm);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

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
    try {
      const [settingsRes, templatesRes, sentRes, clientsRes, retreatsRes] = await Promise.all([
        communicationsApi.getSettings(),
        communicationsApi.getTemplates(),
        communicationsApi.getSentEmails(),
        clientsApi.getAll(),
        retreatsApi.getAll(),
      ]);
      setSettings(settingsRes.data);
      setTemplates(Array.isArray(templatesRes.data) ? templatesRes.data : []);
      setSentEmails(Array.isArray(sentRes.data) ? sentRes.data : []);
      setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);
      setRetreats(Array.isArray(retreatsRes.data) ? retreatsRes.data : []);
    } catch (error) {
      console.error('Error loading communications data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

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
          {(['settings', 'templates', 'compose', 'sent'] as TabKey[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 rounded-md text-sm font-medium border ${activeTab === tab ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
              {tab === 'settings' ? 'Settings' : tab === 'templates' ? 'Templates' : tab === 'compose' ? 'Compose' : 'Sent Mail'}
            </button>
          ))}
        </div>
      </div>

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
                  placeholder="hello@example.com"
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
              Configure Google OAuth redirect URI to point at <code>/communications/gmail/callback</code> on the API host.
            </div>
          </section>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Templates</h2>
              <button
                type="button"
                onClick={handleNewTemplate}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Icon icon={FiPlus} />
                New
              </button>
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
