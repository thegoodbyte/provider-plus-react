import React, { useCallback, useEffect, useState } from 'react';
import { referralsApi } from '../services/api';
import { apiErrorMessage } from '../utils/apiErrorMessage';
export default function ReferralAssignmentNotifications({ referralId }: { referralId: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [retrying, setRetrying] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setEvents((await referralsApi.getAssignmentNotifications(referralId)).data); }
    catch (e) { setError(apiErrorMessage(e, 'Could not load assignment notifications.')); }
    finally { setLoading(false); }
  }, [referralId]);
  useEffect(() => { void load(); }, [load]);
  const retry = async (event: any) => {
    if (retrying) return;
    setRetrying(event.id); setError('');
    try { setEvents((await referralsApi.retryAssignmentNotification(referralId, event.clientId, event.id)).data); }
    catch (e) { setError(apiErrorMessage(e, 'Could not retry this notification.')); }
    finally { setRetrying(''); }
  };
  return <section aria-label="Assignment notification history" className="my-5 rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Assignment notification history</h2><button type="button" onClick={load} disabled={loading || !!retrying} className="rounded-lg border px-3 py-2">Refresh notifications</button></div>
    <p className="mt-2 text-sm text-slate-600">Sent means accepted by the mail service. Development emails are captured locally. Uncertain delivery needs review in Communications before any resend.</p>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    {loading ? <p role="status">Loading notifications…</p> : events.length === 0 ? <p className="mt-3 text-sm">No assignment notifications recorded.</p> : <ul className="mt-3 space-y-3">{events.map(event => <li key={event.id} className="rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><strong>{event.firstName} {event.lastName}</strong><span className="rounded-full bg-slate-100 px-3 py-1 text-sm">{event.status}</span></div>
      <p className="mt-1 text-sm text-slate-600">{event.detail || 'Awaiting delivery.'} {event.provider === 'development_capture' ? 'Captured in development.' : ''}</p>
      <p className="mt-1 break-words text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()} · Attempts: {event.attempts || 0}{event.recipient ? ` · ${event.recipient}` : ''}</p>
      {['pending', 'blocked', 'disabled', 'failed'].includes(event.status) && <button type="button" onClick={() => retry(event)} disabled={!!retrying} className="mt-2 min-h-11 rounded-lg border border-slate-300 px-3">{retrying === event.id ? 'Retrying…' : `Retry notification for ${event.firstName} ${event.lastName}`}</button>}
    </li>)}</ul>}
  </section>;
}
