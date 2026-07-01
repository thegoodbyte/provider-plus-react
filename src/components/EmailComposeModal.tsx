import React, { useCallback, useEffect, useState } from 'react';
import { FiSend, FiX } from 'react-icons/fi';
import { communicationsApi } from '../services/api';
import { EmailTemplate, MailSettings } from '../types';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

export interface EmailComposeInitialValues {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  bodyText?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  templateId?: string;
  clientId?: string;
  retreatId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  bookingFlowStepKey?: string;
  bookingFlowStatusOnSend?: string;
  variables?: Record<string, any>;
  attachments?: Array<{
    fileName: string;
    mimeType?: string;
    contentBase64: string;
  }>;
}

interface EmailComposeModalProps {
  title?: string;
  initialValues: EmailComposeInitialValues;
  extraContent?: React.ReactNode;
  onClose: () => void;
  onSent?: (sentEmail: any) => void | Promise<void>;
}

const EmailComposeModal: React.FC<EmailComposeModalProps> = ({
  title = 'Send Email',
  initialValues,
  extraContent,
  onClose,
  onSent,
}) => {
  const [settings, setSettings] = useState<MailSettings | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [sending, setSending] = useState(false);
  const [formData, setFormData] = useState({
    to: initialValues.to || '',
    cc: initialValues.cc || '',
    bcc: initialValues.bcc || '',
    subject: initialValues.subject || '',
    bodyText: initialValues.bodyText || '',
    fromName: initialValues.fromName || '',
    fromEmail: initialValues.fromEmail || '',
    replyTo: initialValues.replyTo || '',
  });

  useEffect(() => {
    setSelectedTemplateId(initialValues.templateId || '');
    setFormData({
      to: initialValues.to || '',
      cc: initialValues.cc || '',
      bcc: initialValues.bcc || '',
      subject: initialValues.subject || '',
      bodyText: initialValues.bodyText || '',
      fromName: initialValues.fromName || '',
      fromEmail: initialValues.fromEmail || '',
      replyTo: initialValues.replyTo || '',
    });
  }, [initialValues]);

  useEffect(() => {
    let active = true;
    Promise.all([
      communicationsApi.getSettings(),
      communicationsApi.getTemplates(),
    ])
      .then(([settingsResponse, templatesResponse]) => {
        if (!active) return;
        setSettings(settingsResponse.data);
        setTemplates((templatesResponse.data || []).filter((template: EmailTemplate) => template.active !== false));
        setFormData((prev) => ({
          ...prev,
          fromName: prev.fromName || settingsResponse.data?.senderName || '',
          fromEmail: prev.fromEmail || settingsResponse.data?.senderEmail || '',
          replyTo: prev.replyTo || settingsResponse.data?.replyTo || '',
        }));
      })
      .catch((error) => {
        console.error('Error loading mail settings:', error);
      });
    return () => {
      active = false;
    };
  }, []);

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTemplateChange = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((item) => item._id === templateId);
    if (!template) return;
    setFormData((prev) => ({
      ...prev,
      subject: template.subject || prev.subject,
      bodyText: template.bodyText || prev.bodyText,
    }));
  }, [templates]);

  useEffect(() => {
    if (!initialValues.templateId || templates.length === 0) return;
    handleTemplateChange(initialValues.templateId);
  }, [handleTemplateChange, initialValues.templateId, templates]);

  const handleSend = async () => {
    const to = formData.to.trim();
    const subject = formData.subject.trim();

    if (!to) {
      alert('Recipient email is required.');
      return;
    }
    if (!subject) {
      alert('Subject is required.');
      return;
    }

    setSending(true);
    try {
      const response = await communicationsApi.sendEmail({
        to,
        cc: formData.cc.trim() || undefined,
        bcc: formData.bcc.trim() || undefined,
        subject,
        bodyText: formData.bodyText,
        templateId: selectedTemplateId || initialValues.templateId || undefined,
        fromName: formData.fromName.trim() || settings?.senderName,
        fromEmail: formData.fromEmail.trim() || settings?.senderEmail,
        replyTo: formData.replyTo.trim() || settings?.replyTo,
        clientId: initialValues.clientId || undefined,
        retreatId: initialValues.retreatId || undefined,
        relatedEntityType: initialValues.relatedEntityType || undefined,
        relatedEntityId: initialValues.relatedEntityId || undefined,
        bookingFlowStepKey: initialValues.bookingFlowStepKey || undefined,
        bookingFlowStatusOnSend: initialValues.bookingFlowStatusOnSend || undefined,
        variables: initialValues.variables,
        attachments: initialValues.attachments || undefined,
      });
      await onSent?.(response.data);
      alert('Email sent.');
      onClose();
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Email send failed.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500">Review and edit before sending.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <Icon icon={FiX} className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {extraContent}

          {templates.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Template</label>
              <select
                value={selectedTemplateId}
                onChange={(event) => handleTemplateChange(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">No template</option>
                {templates.map((template) => (
                  <option key={template._id} value={template._id || ''}>
                    {template.display_id ? `#${template.display_id} ` : ''}{template.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(initialValues.attachments || []).length > 0 && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              <div className="font-medium">Attached PDF</div>
              {(initialValues.attachments || []).map((attachment) => (
                <div key={attachment.fileName} className="mt-1 font-mono text-xs">
                  {attachment.fileName}
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">To</label>
              <input
                value={formData.to}
                onChange={(event) => updateField('to', event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">CC</label>
              <input
                value={formData.cc}
                onChange={(event) => updateField('cc', event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">BCC</label>
              <input
                value={formData.bcc}
                onChange={(event) => updateField('bcc', event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">From Name</label>
              <input
                value={formData.fromName}
                onChange={(event) => updateField('fromName', event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">From Email</label>
              <input
                value={formData.fromEmail}
                onChange={(event) => updateField('fromEmail', event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Reply To</label>
              <input
                value={formData.replyTo}
                onChange={(event) => updateField('replyTo', event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Subject</label>
            <input
              value={formData.subject}
              onChange={(event) => updateField('subject', event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Message</label>
            <textarea
              rows={14}
              value={formData.bodyText}
              onChange={(event) => updateField('bodyText', event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Icon icon={FiSend} className="h-4 w-4" />
            {sending ? 'Sending...' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailComposeModal;
