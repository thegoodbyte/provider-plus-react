import React, { useEffect, useRef, useState } from 'react';
import { paymentsApi } from '../services/api';
import { Payment, PaymentReceipt } from '../types';
import { apiErrorMessage } from '../utils/apiErrorMessage';
const idOf = (value: any): string => typeof value === 'object' ? value?._id || '' : value || '';

export default function PaymentReceiptPanel({ payment }: { payment: Payment }) {
  const receiptId = idOf(payment.receiptId), allocationId = payment._id || '';
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [loading, setLoading] = useState(Boolean(receiptId));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState('');
  const [confirming, setConfirming] = useState(false);
  const previewRef = useRef('');
  const active = useRef(true);
  const clearPreview = () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); previewRef.current = ''; setPreview(''); };
  useEffect(() => {
    active.current = true;
    if (receiptId) paymentsApi.getReceipt(receiptId).then(({ data }) => { if (active.current) setReceipt(data); }).catch(err => { if (active.current) setError(apiErrorMessage(err, 'Could not load receipt details.')); }).finally(() => { if (active.current) setLoading(false); });
    return () => { active.current = false; if (previewRef.current) URL.revokeObjectURL(previewRef.current); };
  }, [receiptId]);
  const allocation = receipt?.allocations?.find(item => item._id === allocationId);
  const client: any = typeof allocation?.clientId === 'object' ? allocation.clientId : null;
  const history = (receipt?.deliveryHistory || []).filter(entry => idOf(entry.allocationId) === allocationId);
  const sentEmails = history.filter(entry => entry.channel === 'email' && ['sent', 'delivered'].includes(entry.status));
  const canUse = Boolean(receipt && allocation && receipt.status === 'received' && !['refund', 'currency_adjustment'].includes(receipt.paymentType || '') && payment.status === 'completed' && !['refund', 'currency_adjustment'].includes(payment.paymentType || ''));
  const refresh = async () => { const { data } = await paymentsApi.getReceipt(receiptId); if (active.current) setReceipt(data); };
  const loadPreview = async () => {
    const { data } = await paymentsApi.downloadReceiptPdf(receiptId, allocationId);
    if (!active.current) return;
    clearPreview(); previewRef.current = URL.createObjectURL(data); setPreview(previewRef.current);
  };
  const action = async (kind: 'preview' | 'regenerate' | 'email') => {
    setBusy(kind); setError(''); setMessage(''); setConfirming(false);
    try {
      if (kind === 'regenerate') { setConfirming(false); clearPreview(); await paymentsApi.regenerateReceiptPdf(receiptId, allocationId); }
      await loadPreview();
      await refresh();
      if (active.current) { if (kind === 'email') setConfirming(true); if (kind === 'regenerate') setMessage('PDF regenerated. The preview now shows the new version.'); }
    } catch (err) { if (active.current) setError(apiErrorMessage(err, 'Could not prepare the receipt PDF.')); }
    finally { if (active.current) setBusy(''); }
  };
  const send = async () => {
    setBusy('send'); setError(''); setMessage('');
    try {
      const { data } = await paymentsApi.sendReceipt(receiptId, { allocationId, attachPdf: true });
      if (active.current) { setConfirming(false); setMessage(`Receipt email submitted to ${data.to || client?.email}.`); }
      try { await refresh(); } catch { if (active.current) setError('Email submitted, but delivery history could not refresh. Reload before sending again.'); }
    } catch (err) { if (active.current) setError(apiErrorMessage(err, 'Receipt email failed. You can retry.')); }
    finally { if (active.current) setBusy(''); }
  };
  return <section aria-label="Payment receipt" className="mt-6 min-w-0 rounded-xl border border-blue-200 bg-white p-4 sm:p-6">
    <h2 className="text-xl font-bold text-gray-950">Receipt and client delivery</h2>
    {!receiptId ? <p className="mt-3 text-gray-600">This historical payment has no linked receipt. No receipt email or delivery history is available for it.</p> : loading ? <p className="mt-3">Loading receipt…</p> : <>
      {receipt && <div className="mt-3 space-y-2"><p className="font-semibold">Receipt #{receipt.display_id || '—'}{receipt.allocationCount > 1 ? ' · Shared transaction' : ''}</p><p className="text-sm text-gray-600">Actions and delivery history below apply only to this payment’s client.</p>
        <p className="font-semibold text-gray-900">{sentEmails.length ? `Emailed to client · ${sentEmails.length} successful email(s)` : 'Not emailed to this client yet'}</p>
        {sentEmails.length > 0 && <p className="break-words text-sm text-gray-600">Last successful email: {sentEmails[sentEmails.length - 1].to} · {new Date(sentEmails[sentEmails.length - 1].at).toLocaleString()}</p>}
        {!allocation && <p role="alert" className="text-red-700">This payment is not an allocation of the linked receipt. Receipt actions are unavailable.</p>}
        {!canUse && allocation && <p className="text-sm text-gray-600">Receipt acknowledgment is available only for completed payments on a received receipt.</p>}
        {canUse && <><p className="break-all text-sm">Email recipient: <strong>{client?.email || 'No email address on this client'}</strong></p><div className="flex flex-wrap gap-2 pt-2">
          <button type="button" disabled={!!busy} onClick={() => void action('preview')} className="rounded-lg border px-4 py-2 font-semibold">Preview PDF</button>
          <button type="button" disabled={!!busy} onClick={() => void action('regenerate')} className="rounded-lg border px-4 py-2 font-semibold">Regenerate PDF</button>
          <button type="button" disabled={!!busy || !client?.email} onClick={() => void action('email')} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{sentEmails.length ? 'Email receipt again' : 'Email receipt to client'}</button>
        </div></>}
        {receipt.pdfGenerationFailed && <p className="text-sm text-red-700">The previous PDF generation failed. Regenerate PDF to retry.</p>}
      </div>}
      {busy && <p role="status" className="mt-3 text-sm">{busy === 'send' ? 'Sending receipt email…' : 'Preparing receipt…'}</p>}
      {preview && <div className="mt-4"><h3 className="mb-2 font-semibold">Receipt PDF preview</h3><iframe title="Receipt PDF preview" src={preview} className="h-[520px] w-full rounded-lg border"/><a href={preview} target="_blank" rel="noreferrer" className="mt-2 inline-block text-blue-700 underline">Open PDF in a new tab</a></div>}
      {confirming && <div role="region" aria-label="Confirm receipt email" className="mt-4 rounded-lg bg-blue-50 p-4"><p className="break-words">Send this receipt PDF to <strong>{client?.email}</strong>?</p><p className="mt-1 text-sm text-gray-600">The receipt PDF will be attached. Booking confirmation attachments follow Payment settings.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!!busy || !canUse || !client?.email} onClick={() => void send()} className="rounded bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Send receipt email</button><button type="button" disabled={!!busy} onClick={() => setConfirming(false)} className="rounded border px-4 py-2">Cancel email</button></div></div>}
      {receipt && <div className="mt-5 border-t pt-4"><h3 className="font-semibold">Delivery history for this client</h3>{!history.length && <p className="mt-2 text-sm text-gray-600">No delivery recorded for this payment.</p>}<ul className="mt-2 space-y-2">{history.map((entry, index) => <li key={index} className="break-words text-sm">{entry.channel === 'whatsapp' ? 'WhatsApp (manually recorded)' : 'Email'} · {entry.status} · {entry.to} · {new Date(entry.at).toLocaleString()}{entry.actor ? ` · ${entry.actor}` : ''}</li>)}</ul></div>}
    </>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mt-3 text-sm text-green-800">{message}</p>}
  </section>;
}
