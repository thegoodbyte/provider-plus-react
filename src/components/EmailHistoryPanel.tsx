import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiChevronDown, FiChevronUp, FiInbox, FiMail, FiPlus, FiRefreshCw } from 'react-icons/fi';
import { communicationsApi } from '../services/api';
import { InboundEmail, SentEmail } from '../types';
import { taskService } from '../services/taskService';
import EmailComposeModal from './EmailComposeModal';
import { emailLanguageLabel, getInboundEmailLanguage, getSentEmailLanguage } from './emailLanguage';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => <IconComponent className={className} />;

type EmailDirectionFilter = 'all' | 'sent' | 'received';
type EmailLanguageFilter = 'all' | string;

interface EmailHistoryPanelProps {
  clientId?: string;
  bookingId?: string;
  retreatId?: string;
  title?: string;
  subtitle?: string;
  recipientEmail?: string;
  recipientName?: string;
}

const formatDate = (value?: string | Date) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
};

const getClientLabel = (email: SentEmail) => {
  const client = typeof email.clientId === 'object' ? email.clientId : null;
  const displayId = client?.display_id || email.clientDisplayId;
  const name = [client?.firstName, client?.lastName].filter(Boolean).join(' ');
  if (displayId && name) return `#${displayId} ${name}`;
  if (displayId) return `#${displayId}`;
  if (name) return name;
  return email.to?.[0] || 'Unknown';
};

const getInboundClientLabel = (email: InboundEmail) => {
  const client = typeof email.linkedClientId === 'object' ? email.linkedClientId : null;
  const name = [client?.firstName, client?.lastName].filter(Boolean).join(' ');
  const displayId = client?.display_id;
  if (displayId && name) return `#${displayId} ${name}`;
  if (displayId) return `#${displayId}`;
  if (name) return name;
  return email.fromName || email.fromEmail || 'Unknown';
};

const EmailHistoryPanel: React.FC<EmailHistoryPanelProps> = ({ clientId, bookingId, retreatId, title = 'Email history', subtitle, recipientEmail, recipientName }) => {
  const [loading, setLoading] = useState(true);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [inboundEmails, setInboundEmails] = useState<InboundEmail[]>([]);
  const [error, setError] = useState('');
  const [direction, setDirection] = useState<EmailDirectionFilter>('all');
  const [language, setLanguage] = useState<EmailLanguageFilter>('all');
  const [composerOpen, setComposerOpen] = useState(false);
  const [sendMessage, setSendMessage] = useState('');

  const loadEmails = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [sentResponse, inboundResponse] = await Promise.allSettled([
        communicationsApi.getSentEmails({ clientId, bookingId, retreatId }, { suppressGlobalError: true }),
        communicationsApi.getInboundEmails({ clientId, limit: 100 }, { suppressGlobalError: true }),
      ]);
      setSentEmails(sentResponse.status === 'fulfilled' ? (Array.isArray(sentResponse.value.data) ? sentResponse.value.data : []) : []);
      setInboundEmails(inboundResponse.status === 'fulfilled' ? (Array.isArray(inboundResponse.value.data) ? inboundResponse.value.data : []) : []);
      if (sentResponse.status === 'rejected' && inboundResponse.status === 'rejected') {
        setError('Unable to load communication history.');
      }
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Unable to load communication history.');
    } finally {
      setLoading(false);
    }
  }, [clientId, bookingId, retreatId]);

  useEffect(() => {
    void loadEmails();
  }, [loadEmails]);

  const combinedRows = useMemo(() => {
    const sentRows = sentEmails.map((email) => ({ kind: 'sent' as const, id: email._id || email.gmailMessageId || email.subject, email }));
    const inboundRows = inboundEmails.map((email) => ({ kind: 'received' as const, id: email._id || email.gmailMessageId || email.subject, email }));
    const rows = [...sentRows, ...inboundRows].sort((a, b) => {
      const aDate = new Date((a.kind === 'sent' ? a.email.sentAt : a.email.receivedAt) || (a.email as any).createdAt || 0).getTime();
      const bDate = new Date((b.kind === 'sent' ? b.email.sentAt : b.email.receivedAt) || (b.email as any).createdAt || 0).getTime();
      return bDate - aDate;
    });
    return rows.filter((row) => {
      if (direction !== 'all' && row.kind !== direction) return false;
      if (language === 'all') return true;
      return row.kind === 'sent' ? getSentEmailLanguage(row.email) === language : getInboundEmailLanguage(row.email) === language;
    });
  }, [direction, inboundEmails, language, sentEmails]);

  const availableLanguages = useMemo(() => {
    const values = new Set<string>();
    sentEmails.forEach((email) => values.add(getSentEmailLanguage(email)));
    inboundEmails.forEach((email) => values.add(getInboundEmailLanguage(email)));
    return Array.from(values).sort((a, b) => emailLanguageLabel(a).localeCompare(emailLanguageLabel(b)));
  }, [inboundEmails, sentEmails]);

  const handleCreateTask = async (email: InboundEmail) => {
    const titleValue = window.prompt('Task title', email.aiClassification?.taskTitle || email.subject || 'Follow up on email');
    if (!titleValue) return;
    const priority = window.prompt('Priority: low, medium, high, urgent', email.aiClassification?.priority || 'medium') || 'medium';
    await taskService.createTask({
      name: titleValue,
      description: email.bodyText || email.snippet || email.subject || '',
      type: clientId ? 'client' : 'generic',
      urgency: priority as any,
      clientId,
      retreatId,
      bookingId,
      sourceType: 'inbound_email',
      sourceId: email._id,
      tags: ['email', 'follow-up'],
    });
    await loadEmails();
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">{subtitle || 'Sent and received emails connected to this record.'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setComposerOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Icon icon={FiMail} className="h-4 w-4" /> Send message <Icon icon={composerOpen ? FiChevronUp : FiChevronDown} className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => void loadEmails()} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Icon icon={FiRefreshCw} className="h-4 w-4" />
            Refresh
          </button>
          <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-1 text-xs font-medium text-gray-700">
            {(['all', 'sent', 'received'] as EmailDirectionFilter[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setDirection(item)}
                className={`rounded px-3 py-1.5 ${direction === item ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {item === 'all' ? 'All' : item === 'sent' ? 'Sent' : 'Received'}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
            <span>Language</span>
            <select
              aria-label="Filter emails by language"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All languages</option>
              {availableLanguages.map((item) => <option key={item} value={item}>{emailLanguageLabel(item)}</option>)}
            </select>
          </label>
        </div>
      </div>

      {sendMessage && <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{sendMessage}</div>}
      {composerOpen && (
        <EmailComposeModal
          title="Send booking email"
          initialValues={{
            to: recipientEmail || '',
            clientId,
            bookingId,
            retreatId,
            relatedEntityType: bookingId ? 'booking' : 'client',
            relatedEntityId: bookingId || clientId,
            variables: {
              client: {
                id: clientId,
                email: recipientEmail,
                name: recipientName || '',
              },
            },
          }}
          onClose={() => setComposerOpen(false)}
          onSent={async () => {
            setComposerOpen(false);
            setSendMessage(`Email sent to ${recipientEmail}.`);
            await loadEmails();
          }}
        />
      )}

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-gray-500">Sent</div>
          <div className="text-lg font-semibold text-gray-900">{sentEmails.length}</div>
        </div>
        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-gray-500">Received</div>
          <div className="text-lg font-semibold text-gray-900">{inboundEmails.length}</div>
        </div>
        <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-gray-500">Visible</div>
          <div className="text-lg font-semibold text-gray-900">{combinedRows.length}</div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Client / From</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Language</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {loading ? (
              <tr>
                <td className="px-4 py-8 text-center text-gray-500" colSpan={7}>Loading email history...</td>
              </tr>
            ) : combinedRows.length ? (
              combinedRows.map((row) => {
                if (row.kind === 'sent') {
                  const email = row.email;
                  return (
                    <tr key={row.id}>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                          <Icon icon={FiMail} className="h-3.5 w-3.5" />
                          Sent
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{email.subject}</div>
                        <div className="text-xs text-gray-500">{email.templateName || 'Manual email'}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{getClientLabel(email)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(email.sentAt || email.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-600">{emailLanguageLabel(getSentEmailLanguage(email))}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          email.status === 'sent' ? 'bg-green-100 text-green-800' :
                          email.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {email.status || 'queued'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {(email.cc || []).length ? `CC: ${email.cc?.join(', ')}` : 'No extra action'}
                      </td>
                    </tr>
                  );
                }
                const email = row.email;
                const task = typeof email.createdTaskId === 'object' ? email.createdTaskId : null;
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                        <Icon icon={FiInbox} className="h-3.5 w-3.5" />
                        Received
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{email.subject || '(no subject)'}</div>
                      <div className="text-xs text-gray-500 line-clamp-2">{email.snippet || email.bodyText || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{getInboundClientLabel(email)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(email.receivedAt || email.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-600">{emailLanguageLabel(getInboundEmailLanguage(email))}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        email.status === 'task_created' ? 'bg-green-100 text-green-800' :
                        email.status === 'needs_review' ? 'bg-amber-100 text-amber-800' :
                        email.status === 'ignored' ? 'bg-gray-100 text-gray-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {email.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {task ? (
                          <span className="text-xs text-gray-500">Task: {task.name}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleCreateTask(email)}
                            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          >
                            <Icon icon={FiPlus} className="h-3.5 w-3.5" />
                            Create task
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-4 py-8 text-center text-gray-500" colSpan={7}>No email history matches the selected filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmailHistoryPanel;
