import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
export default function InvoiceVisitHistory({ requestId }: { requestId: string }) {
  const [page, setPage] = useState(1), [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ items: any[]; total: number; pageSize: number } | null>(null);
  const [error, setError] = useState(''), [loading, setLoading] = useState(true);
  useEffect(() => { setPage(1); }, [requestId]);
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setResult(null);
    api.get(`/invoice-visits/payment-request/${encodeURIComponent(requestId)}`, { params: { page }, suppressGlobalError: true } as any)
      .then(({ data }) => {
        if (!data || !Array.isArray(data.items) || !Number.isFinite(data.total) || data.total < 0 || !Number.isFinite(data.pageSize) || data.pageSize <= 0 || data.items.some((item: any) => !item || typeof item !== 'object')) {
          throw new Error('Invalid invoice visit response');
        }
        if (active) setResult(data);
      }).catch(() => { if (active) setError('Could not load invoice visits.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [requestId, page, refresh]);
  return <section aria-label="Invoice link visits" className="mt-6 rounded-xl border border-slate-200 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Invoice link visits</h2><button type="button" disabled={loading} className="rounded border px-3 py-2" onClick={() => setRefresh(n => n + 1)}>Refresh visits</button></div>
    <p className="my-2 text-sm text-slate-600">Repeated loads from the same IP/browser are grouped into 30-minute windows. Browser and OS are inferred; these details do not identify the person. Known bots/previews are flagged. Queued email does not confirm delivery.</p>
    {loading && <p role="status">Loading visits…</p>}
    {error && <p role="alert">{error}</p>}
    {result && <><p className="my-3 text-sm">{result.total} recorded visit window{result.total === 1 ? '' : 's'}</p>
      {result.items.length ? <ul className="space-y-3">{result.items.map(visit => <li key={visit._id} className="break-words rounded-lg bg-slate-50 p-3 text-sm">
        <p className="font-medium">{new Date(visit.createdAt).toLocaleString()} {visit.automated ? '· Automated / preview' : ''}</p>
        <p>IP: {visit.ip || 'Unknown'} · Browser: {visit.browser} · OS: {visit.os}</p>
        {visit.forwardedFor && <p>Forwarded IP chain (unverified): {visit.forwardedFor}</p>}
        <p>Language: {visit.language || 'Unknown'} · Notification: {visit.notificationStatus}{visit.notificationError ? ` · ${visit.notificationError}` : ''}</p>
        <details><summary>Request details</summary><p>User agent: {visit.userAgent || 'Unknown'}</p><p>Origin: {visit.origin || 'Not supplied'}</p><p>Referrer origin: {visit.referrerOrigin || 'Not supplied'}</p></details>
      </li>)}</ul> : <p>No visits recorded yet.</p>}
      <div className="mt-3 flex items-center gap-3"><button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous visits</button><span>Page {page}</span><button type="button" disabled={page * result.pageSize >= result.total} onClick={() => setPage(p => p + 1)}>Next visits</button></div>
    </>}
  </section>;
}
