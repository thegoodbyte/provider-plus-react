import React, { useEffect, useState } from 'react';
import { medicalReviewRequestsApi } from '../services/api';
import { SentEmail } from '../types';
import { emailLanguageLabel, getSentEmailLanguage } from './emailLanguage';

type SkippedNotification = { decision?: string; reason?: 'master_switch_disabled' | 'decision_type_disabled' | 'no_client_email'; processedAt?: string };

const SKIP_REASON_LABELS: Record<string, string> = {
  master_switch_disabled: 'client medical-review emails are turned off for all decisions in Settings → Communications',
  decision_type_disabled: 'client emails for this decision type are turned off in Settings → Communications',
  no_client_email: 'this client has no email address on file',
};

export default function MedicalReviewClientMessages({ requestId, refreshKey = 0 }: { requestId: string; refreshKey?: number }) {
  const [messages, setMessages] = useState<SentEmail[]>([]);
  const [skippedNotifications, setSkippedNotifications] = useState<SkippedNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setMessages([]);
    setSkippedNotifications([]);
    medicalReviewRequestsApi.getClientMessages(requestId)
      .then(({ data }) => {
        if (!active) return;
        setMessages(data?.messages || []);
        setSkippedNotifications(data?.skippedNotifications || []);
      })
      .catch(() => { if (active) setError('Unable to load client message history. Please try Refresh.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [requestId, refreshKey, reload]);

  return (
    <section aria-label="Client message history" className="mt-6 rounded-lg border border-indigo-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-950">Client message history{!loading && !error ? ` (${messages.length})` : ''}</h2>
          <p className="mt-1 text-sm text-gray-600">Emails for this MRR, including the translated text sent to the client. Latest first.</p>
        </div>
        <button type="button" disabled={loading} onClick={() => setReload(value => value + 1)} className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50">Refresh</button>
      </div>
      {loading && <p role="status" className="mt-3 text-sm text-gray-600">Loading client messages…</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {!loading && !error && messages.length === 0 && skippedNotifications.length === 0 && <p className="mt-3 text-sm text-gray-600">No client emails recorded for this MRR.</p>}
      {!loading && !error && skippedNotifications.length > 0 && (
        <div className="mt-4 space-y-2">
          {skippedNotifications.map((skipped, index) => {
            const time = skipped.processedAt && !Number.isNaN(new Date(skipped.processedAt).getTime()) ? new Date(skipped.processedAt).toLocaleString() : 'Not recorded';
            return (
              <p key={index} role="status" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                No email was sent for the <strong>{skipped.decision || 'review'}</strong> result ({time}) — {skipped.reason && SKIP_REASON_LABELS[skipped.reason] ? SKIP_REASON_LABELS[skipped.reason] : 'reason not recorded'}.
              </p>
            );
          })}
        </div>
      )}
      <div className="mt-4 space-y-4">
        {messages.map((message, index) => {
          const date = message.sentAt || message.createdAt;
          const time = date && !Number.isNaN(new Date(date).getTime()) ? new Date(date).toLocaleString() : 'Not recorded';
          const language = getSentEmailLanguage(message);
          const source = message.variablesSnapshot?.review?.message;
          const recipients = message.safetyRedirected ? message.intendedRecipients?.to || [] : message.to;
          return (
            <article key={message._id || index} className="rounded-md border border-gray-200 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-gray-900">{message.subject || '(no subject)'}</h3>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${message.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}`}>
                  {message.status === 'sent' ? message.safetyRedirected ? 'Sent to test recipient' : 'Sent' : message.status === 'failed' ? 'Failed' : 'Queued'}
                </span>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                <p>{message.sentAt ? 'Sent' : 'Created'}: {time} · To: {recipients?.join(', ') || 'Not recorded'}</p>
                {message.createdBy && <p>Sent by: {message.createdBy}</p>}
                {language !== 'unknown' && <p>Language: {emailLanguageLabel(language)}</p>}
                {message.safetyRedirected && <p>Test recipient: {message.to?.join(', ')}. This email was redirected and was not delivered to the client.</p>}
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm text-gray-900">{message.bodyText}</p>
              {message.errorMessage && <p className="mt-2 text-sm text-red-700">{message.errorMessage}</p>}
              {typeof source === 'string' && source.trim() && <details className="mt-3 border-t border-gray-100 pt-2 text-sm"><summary className="cursor-pointer text-gray-600">Original custom message</summary><p className="mt-2 whitespace-pre-wrap break-words">{source}</p></details>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
