import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { authService } from '../services/authService';

type Submission = { _id: string; formType: string; contact: { firstName: string; lastName: string; email: string; phone: string }; source: string; state: string; clientId?: string; artifactId?: string; createdAt: string; payload?: Record<string, any>; attachments?: any[]; matches?: any[] };
const stateLabels: Record<string, string> = { received: 'Received', needs_matching: 'Needs client matching', failed: 'Needs processing retry', processing: 'Processing' };
export default function PublicEntrySubmissionsPanel() {
  const [rows, setRows] = useState<Submission[]>([]);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [clientId, setClientId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canReview = authService.getUser()?.role === 'admin';
  const load = () => api.get(`/public-entry-forms/admin/submissions?page=${page}`).then(({ data }) => setRows(data));
  useEffect(() => { setError(''); load().catch(() => setError('Unable to load public submissions.')); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = async (row: Submission) => {
    setBusy(true); setError(''); setClientId('');
    try { const { data } = await api.get(`/public-entry-forms/admin/submissions/${row._id}`); setSelected(data); }
    catch { setError('Unable to load this submission.'); }
    finally { setBusy(false); }
  };
  const process = async () => {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const { data } = await api.post(`/public-entry-forms/admin/submissions/${selected._id}/retry`, { ...(clientId ? { clientId } : {}) });
      setSelected(data); setClientId(''); await load();
    } catch (e: any) { setError(e.response?.data?.message || 'Unable to process this submission.'); }
    finally { setBusy(false); }
  };
  return <section>
    <p className="mb-5 text-sm text-gray-600">Public submissions create clients with the <strong>Self-submit</strong> status. Portal access stays disabled until staff changes the client to <strong>Entered</strong>. Submissions using an existing email need manual matching.</p>
    {error && <p role="alert" className="mb-4 text-red-700">{error}</p>}
    <div className="overflow-x-auto border border-gray-200 bg-white"><table className="w-full text-left text-sm">
      <thead className="bg-gray-50"><tr>{['Submitted', 'Name / email', 'Form', 'Source', 'State', 'Action'].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row._id} className="border-t border-gray-200">
        <td className="p-3">{new Date(row.createdAt).toLocaleString()}</td><td className="p-3">{row.contact.firstName} {row.contact.lastName}<div className="text-gray-500">{row.contact.email}</div></td>
        <td className="p-3">{row.formType === 'questionnaire' ? 'Initial questionnaire' : 'Medications form'}</td><td className="p-3">{row.source}</td><td className="p-3">{stateLabels[row.state]}</td><td className="p-3"><button disabled={busy} onClick={() => open(row)} className="font-semibold text-blue-700">Review submission</button></td>
      </tr>)}{!rows.length && <tr><td colSpan={6} className="p-6">No public submissions on this page.</td></tr>}</tbody>
    </table></div>
    <div className="my-4 flex gap-4"><button disabled={!page} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1}</span><button disabled={rows.length < 50} onClick={() => setPage(page + 1)}>Next</button></div>
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Public submission">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-auto bg-white p-6 shadow-xl">
        <button onClick={() => setSelected(null)} className="float-right text-blue-700">Close</button>
        <h2 className="text-xl font-semibold">{selected.contact.firstName} {selected.contact.lastName}</h2>
        <p>{selected.contact.email} · {selected.contact.phone}</p><p className="my-3">{stateLabels[selected.state]}</p>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <div className="my-4 flex gap-4">{selected.clientId && <Link className="text-blue-700 underline" to={`/admin/clients/${selected.clientId}`}>Open client / change status</Link>}{selected.artifactId && <Link className="text-blue-700 underline" to={`/admin/medical-artifacts/${selected.artifactId}`}>Open submitted document</Link>}</div>
        {selected.payload && <dl className="space-y-3">{Object.entries(selected.payload).filter(([key]) => key !== 'signature_data').map(([key, value]) => <div key={key}><dt className="font-semibold">{key.replace(/_/g, ' ')}</dt><dd className="whitespace-pre-wrap break-words text-sm">{typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}</dd></div>)}</dl>}
        {Boolean(selected.attachments?.length) && <p className="mt-4">{selected.attachments!.length} image attachment(s) saved with this submission. Images are included in the document after processing.</p>}
        {canReview && !selected.clientId && Boolean(selected.matches?.length) && <label className="mt-5 block">Match this submission to an existing client after checking their identity:
          <select className="mt-2 block w-full border p-2" value={clientId} onChange={event => setClientId(event.target.value)}><option value="">Choose a client</option>{selected.matches!.map(client => <option value={client._id} key={client._id}>#{client.display_id} — {client.firstName} {client.lastName} ({client.email})</option>)}</select>
        </label>}
        {canReview && selected.state !== 'received' && <button className="mt-5 bg-blue-700 px-4 py-2 text-white disabled:opacity-50" disabled={busy || (selected.state === 'needs_matching' && !clientId)} onClick={process}>{busy ? 'Processing…' : clientId ? 'Attach submission to selected client' : 'Retry processing'}</button>}
      </section>
    </div>}
  </section>;
}
