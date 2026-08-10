import React, { useCallback, useEffect, useState } from 'react';
import { FiSend, FiX } from 'react-icons/fi';
import { bookingDocumentsApi, bookingsApi, communicationsApi } from '../services/api';
import { EmailTemplate, MailSettings } from '../types';
import { createBookingConfirmationPdf } from './BookingConfirmationPDF';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const formatSentEmailReceipt = (sentEmail: any) => {
  const lines = [
    `Email ${sentEmail?.status || 'queued'}.`,
    sentEmail?.display_id ? `Log #${sentEmail.display_id}` : '',
    sentEmail?.gmailMessageId ? `Gmail message ID: ${sentEmail.gmailMessageId}` : '',
    (sentEmail?.cc || []).length ? `CC: ${(sentEmail.cc || []).join(', ')}` : 'CC: none',
    (sentEmail?.attachments || []).length ? `Attachments: ${sentEmail.attachments.length}` : '',
    sentEmail?.errorMessage ? `Error: ${sentEmail.errorMessage}` : '',
  ].filter(Boolean);
  return lines.join('\n');
};

const interpolateTemplate = (text: string | undefined, variables: Record<string, any> = {}) => {
  return String(text || '').replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, path) => {
    const value = String(path).split('.').reduce((current, key) => current?.[key], variables);
    return value === undefined || value === null ? '' : String(value);
  });
};

const estimateAttachmentSize = (contentBase64: string) => {
  const normalized = String(contentBase64 || '').replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  if (!normalized) return 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4));
};

const formatAttachmentSize = (bytes: number) => {
  if (!bytes) return 'unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(String(reader.result || '').split(',')[1] || '');
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

const normalizeBookingConfirmationLanguage = (language?: string): 'pl' | 'cz' | 'en' => {
  const normalized = String(language || '').toLowerCase();
  if (normalized === 'pl' || normalized === 'polish') return 'pl';
  if (normalized === 'cz' || normalized === 'cs' || normalized === 'czech') return 'cz';
  return 'en';
};

const htmlToEditableText = (html: string) => {
  if (!html) return '';
  const document = new DOMParser().parseFromString(html, 'text/html');
  document.querySelectorAll('br').forEach((element) => element.replaceWith('\n'));
  document.querySelectorAll('p,div,li,tr,h1,h2,h3,h4,h5,h6').forEach((element) => {
    element.append(document.createTextNode('\n'));
  });
  return String(document.body.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const looksLikeHtml = (value?: string) => /<!doctype\s+html|<html[\s>]|<body[\s>]|<(?:p|div|table|h[1-6]|ul|ol|li|br|a)\b/i.test(String(value || ''));

const normalizeMessageFields = (bodyText?: string, bodyHtml?: string) => {
  const html = bodyHtml || (looksLikeHtml(bodyText) ? String(bodyText) : '');
  return {
    bodyText: html ? htmlToEditableText(html) : String(bodyText || ''),
    bodyHtml: html,
  };
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
  templateKey?: string;
  requestedLanguage?: string;
  resolvedLanguage?: string;
  actionKey?: string;
  actionLabel?: string;
  bookingId?: string;
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
  const [selectedLanguage, setSelectedLanguage] = useState<'pl' | 'cz' | 'en'>(() =>
    normalizeBookingConfirmationLanguage(
      initialValues.resolvedLanguage || initialValues.requestedLanguage || initialValues.variables?.client?.language,
    ),
  );
  const [preparedAttachments, setPreparedAttachments] = useState(initialValues.attachments || []);
  const [preparedVariables, setPreparedVariables] = useState(initialValues.variables || {});
  const [attachmentPreparationError, setAttachmentPreparationError] = useState('');
  const [attachmentPreparing, setAttachmentPreparing] = useState(false);
  const [sending, setSending] = useState(false);
  const initialMessage = normalizeMessageFields(initialValues.bodyText);
  const [formData, setFormData] = useState({
    to: initialValues.to || '',
    cc: initialValues.cc || '',
    bcc: initialValues.bcc || '',
    subject: initialValues.subject || '',
    ...initialMessage,
    fromName: initialValues.fromName || '',
    fromEmail: initialValues.fromEmail || '',
    replyTo: initialValues.replyTo || '',
  });
  const selectedTemplate = templates.find((item) => item._id === selectedTemplateId);
  const filteredTemplates = templates.filter((template) =>
    normalizeBookingConfirmationLanguage(template.language) === selectedLanguage,
  );
  const isBookingEmailContext =
    initialValues.relatedEntityType === 'booking' ||
    initialValues.relatedEntityType === 'booking_flow_item' ||
    Boolean(initialValues.bookingId || initialValues.variables?.bookingId || initialValues.variables?.booking?._id) ||
    title.toLowerCase().includes('booking');

  useEffect(() => {
    setSelectedTemplateId(initialValues.templateId || '');
    setSelectedLanguage(normalizeBookingConfirmationLanguage(
      initialValues.resolvedLanguage || initialValues.requestedLanguage || initialValues.variables?.client?.language,
    ));
    setPreparedAttachments(initialValues.attachments || []);
    setPreparedVariables(initialValues.variables || {});
    setAttachmentPreparationError('');
    const message = normalizeMessageFields(initialValues.bodyText);
    setFormData({
      to: initialValues.to || '',
      cc: initialValues.cc || '',
      bcc: initialValues.bcc || '',
      subject: initialValues.subject || '',
      ...message,
      fromName: initialValues.fromName || '',
      fromEmail: initialValues.fromEmail || '',
      replyTo: initialValues.replyTo || '',
    });
  }, [initialValues]);

  useEffect(() => {
    let active = true;
    const prepareBookingConfirmationAttachment = async () => {
      const isBookingConfirmation =
        initialValues.templateKey === 'booking_confirmation' ||
        initialValues.bookingFlowStepKey === 'booking_confirmation_sent' ||
        selectedTemplate?.templateKey === 'welcome_booking' || selectedTemplate?.templateKey === 'booking_confirmation' ||
        selectedTemplate?.category === 'booking_confirmation' ||
        selectedTemplate?.bookingFlowStepKeys?.includes('booking_confirmation_sent');
      const bookingId =
        initialValues.bookingId ||
        initialValues.variables?.booking?._id ||
        initialValues.variables?.booking?.id ||
        initialValues.variables?.bookingId;
      if (!isBookingConfirmation || preparedAttachments.length > 0 || !bookingId) return;

      setAttachmentPreparing(true);
      setAttachmentPreparationError('');
      try {
        const language = selectedLanguage;
        const bookingResponse = await bookingsApi.getOne(String(bookingId));
        const booking: any = bookingResponse.data;
        const storedVersion = booking?.bookingConfirmationPdfs?.[language];
        let blob: Blob;
        let fileName: string;
        if (storedVersion?.s3Key) {
          const storedPdf = await bookingsApi.getConfirmationPdf(String(bookingId), language);
          blob = storedPdf.data;
          fileName = storedVersion.fileName || `booking-confirmation-${booking?.bookingNumber || bookingId}.pdf`;
        } else {
          const generated = await createBookingConfirmationPdf({ booking, language });
          blob = generated.blob;
          fileName = generated.fileName;
          await bookingsApi.storeConfirmationPdf(String(bookingId), language, blob, fileName);
        }
        const contentBase64 = await blobToBase64(blob);
        if (!active) return;
        const nextAttachments = [{
          fileName,
          mimeType: 'application/pdf',
          contentBase64,
        }];
        const contractDocuments = await bookingDocumentsApi.getAll({ bookingId: String(bookingId), documentType: 'contract' }).catch(() => ({ data: [] }));
        const contractDocument = contractDocuments.data?.[0];
        const contractFile = contractDocument?.files?.[0];
        const storedPath = contractFile?.s3Key || contractFile?.filePath;
        if (contractDocument?._id && storedPath) {
          const contractResponse = await bookingDocumentsApi.getFile(contractDocument._id, storedPath).catch(() => null);
          if (contractResponse?.data instanceof Blob) {
            nextAttachments.push({
              fileName: contractFile.fileName || 'retreat-contract.pdf',
              mimeType: contractFile.mimeType || contractResponse.data.type || 'application/pdf',
              contentBase64: await blobToBase64(contractResponse.data),
            });
          }
        }
        if (active) setPreparedAttachments(nextAttachments);
      } catch (error) {
        console.error('Unable to prepare booking confirmation PDF attachment:', error);
        if (active) setAttachmentPreparationError('Unable to prepare booking confirmation PDF attachment.');
      } finally {
        if (active) setAttachmentPreparing(false);
      }
    };

    prepareBookingConfirmationAttachment();
    return () => {
      active = false;
    };
  }, [
    initialValues.bookingFlowStepKey,
    initialValues.bookingId,
    initialValues.requestedLanguage,
    initialValues.resolvedLanguage,
    initialValues.templateKey,
    initialValues.variables,
    selectedLanguage,
    selectedTemplate?.templateKey,
    selectedTemplate?.category,
    selectedTemplate?.bookingFlowStepKeys,
    preparedAttachments.length,
  ]);

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

  useEffect(() => {
    let active = true;
    const bookingId = initialValues.bookingId || initialValues.variables?.bookingId || initialValues.variables?.booking?._id || initialValues.variables?.booking?.id;
    if (!selectedTemplateId || !bookingId) return () => { active = false; };
    communicationsApi.previewEmail({
      templateId: selectedTemplateId,
      bookingId: String(bookingId),
      clientId: initialValues.clientId,
      retreatId: initialValues.retreatId,
      relatedEntityType: initialValues.relatedEntityType || 'booking',
      relatedEntityId: initialValues.relatedEntityId,
      bookingFlowStepKey: initialValues.bookingFlowStepKey,
      variables: initialValues.variables,
    }).then((response) => {
      if (!active) return;
      setPreparedVariables(response.data.variables || {});
      setFormData((previous) => ({
        ...previous,
        subject: response.data.subject || previous.subject,
        ...normalizeMessageFields(response.data.bodyText || previous.bodyText, response.data.bodyHtml),
      }));
    }).catch((error) => {
      console.error('Unable to prepare email preview:', error);
    });
    return () => { active = false; };
  }, [
    initialValues.bookingFlowStepKey,
    initialValues.bookingId,
    initialValues.clientId,
    initialValues.relatedEntityId,
    initialValues.relatedEntityType,
    initialValues.retreatId,
    initialValues.variables,
    selectedTemplateId,
  ]);

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTemplateChange = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((item) => item._id === templateId);
    if (!template) return;
    setFormData((prev) => {
      const message = normalizeMessageFields(
        template.bodyText ? interpolateTemplate(template.bodyText, preparedVariables) : prev.bodyText,
        template.bodyHtml ? interpolateTemplate(template.bodyHtml, preparedVariables) : undefined,
      );
      return {
        ...prev,
        subject: template.subject ? interpolateTemplate(template.subject, preparedVariables) : prev.subject,
        ...message,
      };
    });
  }, [preparedVariables, templates]);

  useEffect(() => {
    if (!isBookingEmailContext || templates.length === 0) return;
    const current = templates.find((template) => template._id === selectedTemplateId);
    if (current && normalizeBookingConfirmationLanguage(current.language) === selectedLanguage) return;
    const matchingTemplate = templates.find((template) =>
      normalizeBookingConfirmationLanguage(template.language) === selectedLanguage &&
      (
        template.templateKey === 'welcome_booking' ||
        template.templateKey === 'booking_confirmation' ||
        template.category === 'booking_confirmation' ||
        template.bookingFlowStepKey === 'booking_confirmation_sent' ||
        template.bookingFlowStepKeys?.includes('booking_confirmation_sent')
      ),
    );
    if (matchingTemplate?._id) handleTemplateChange(matchingTemplate._id);
  }, [handleTemplateChange, isBookingEmailContext, selectedLanguage, selectedTemplateId, templates]);

  useEffect(() => {
    if (!initialValues.templateId || templates.length === 0) return;
    if (initialValues.subject || initialValues.bodyText) return;
    handleTemplateChange(initialValues.templateId);
  }, [handleTemplateChange, initialValues.bodyText, initialValues.subject, initialValues.templateId, templates]);

  const attachments = preparedAttachments;
  const isBookingConfirmationEmail =
    isBookingEmailContext &&
    (
      initialValues.templateKey === 'booking_confirmation' ||
      initialValues.bookingFlowStepKey === 'booking_confirmation_sent' ||
      selectedTemplate?.templateKey === 'welcome_booking' ||
      selectedTemplate?.category === 'booking_confirmation' ||
      selectedTemplate?.bookingFlowStepKeys?.includes('booking_confirmation_sent') ||
      title.toLowerCase().includes('booking confirmation')
    );

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
    if (isBookingConfirmationEmail && preparedAttachments.length === 0) {
      alert(attachmentPreparationError || 'Booking confirmation PDF is not ready. Please close this window and open Send again.');
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
        bodyHtml: formData.bodyHtml || undefined,
        templateId: selectedTemplateId || initialValues.templateId || undefined,
        fromName: formData.fromName.trim() || settings?.senderName,
        fromEmail: formData.fromEmail.trim() || settings?.senderEmail,
        replyTo: formData.replyTo.trim() || settings?.replyTo,
        clientId: initialValues.clientId || undefined,
        retreatId: initialValues.retreatId || undefined,
        bookingId: initialValues.bookingId || initialValues.variables?.bookingId || initialValues.variables?.booking?._id || initialValues.variables?.booking?.id || undefined,
        relatedEntityType: initialValues.relatedEntityType || undefined,
        relatedEntityId: initialValues.relatedEntityId || undefined,
        actionKey: initialValues.actionKey || undefined,
        actionLabel: initialValues.actionLabel || undefined,
        bookingFlowStepKey: initialValues.bookingFlowStepKey || undefined,
        bookingFlowStatusOnSend: initialValues.bookingFlowStatusOnSend || undefined,
        variables: preparedVariables,
        attachments: preparedAttachments.length > 0 ? preparedAttachments : undefined,
      });
      await onSent?.(response.data);
      alert(formatSentEmailReceipt(response.data));
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
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Language</label>
                <select
                  value={selectedLanguage}
                  onChange={(event) => {
                    setSelectedLanguage(event.target.value as 'pl' | 'cz' | 'en');
                    setSelectedTemplateId('');
                    setPreparedAttachments([]);
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="en">English</option>
                  <option value="cz">Čeština</option>
                  <option value="pl">Polski</option>
                </select>
              </div>
              <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Template</label>
              <select
                value={selectedTemplateId}
                onChange={(event) => handleTemplateChange(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">No template</option>
                {filteredTemplates.map((template) => (
                  <option key={template._id} value={template._id || ''}>
                    {template.display_id ? `#${template.display_id} ` : ''}{template.name}
                  </option>
                ))}
              </select>
              </div>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              <div className="font-medium">{attachments.length} attachment{attachments.length === 1 ? '' : 's'} will be sent</div>
              {attachments.map((attachment) => {
                const sizeText = formatAttachmentSize(estimateAttachmentSize(attachment.contentBase64));
                return (
                  <div key={attachment.fileName} className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono">{attachment.fileName}</span>
                    <span className="text-blue-700">{attachment.mimeType || 'file'}</span>
                    <span className="text-blue-700">{sizeText}</span>
                  </div>
                );
              })}
            </div>
          )}

          {attachments.length === 0 && isBookingConfirmationEmail && (
            <div className={`rounded-md border px-3 py-2 text-sm ${attachmentPreparationError ? 'border-red-200 bg-red-50 text-red-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}>
              <div className="font-medium">{attachmentPreparationError || 'Preparing booking confirmation PDF…'}</div>
              <div className="mt-1 text-xs">
                {attachmentPreparationError
                  ? 'Close and reopen Send to retry preparing the attachment.'
                  : 'The Send button will become available as soon as the attachment is ready.'}
              </div>
            </div>
          )}

          {settings?.autoCcEnabled !== false && (
            <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              Auto CC will add {settings?.autoCcEmail || 'info@ibogaspirit.cz'} when this email is sent.
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
              onChange={(event) => {
                const value = event.target.value;
                // Editing the readable preview intentionally switches this email
                // to plain text so stale HTML cannot override the user's changes.
                setFormData((prev) => ({ ...prev, bodyText: value, bodyHtml: '' }));
              }}
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
            disabled={sending || (isBookingConfirmationEmail && (attachmentPreparing || attachments.length === 0))}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Icon icon={FiSend} className="h-4 w-4" />
            {sending ? 'Sending...' : attachmentPreparing ? 'Preparing PDF…' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailComposeModal;
