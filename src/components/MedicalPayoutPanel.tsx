import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { medicalPayoutsApi } from '../services/api';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import './MedicalPayoutPanel.css';
const usd = (value: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
const today = () => new Date().toISOString().slice(0, 10);
const requestId = () => globalThis.crypto?.randomUUID?.() || `medical-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const keyFor = (id: string) => `medical-payout-pending:${id}`;
const readPending = (id: string) => { try { return JSON.parse(sessionStorage.getItem(keyFor(id)) || 'null'); } catch { return null; } };

export default function MedicalPayoutPanel({ retreatId, canManage, onPaymentChanged }: { retreatId: string; canManage: boolean; onPaymentChanged?: () => void }) {
  const location = useLocation();
  const prefix = '/' + (['admin', 'medical', 'staff', 'user'].includes(location.pathname.split('/')[1]) ? location.pathname.split('/')[1] : 'admin');
  const [data, setData] = useState<any>(null), [recipients, setRecipients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [review, setReview] = useState(false), [recipient, setRecipient] = useState(''), [approvalReason, setApprovalReason] = useState('');
  const [rules, setRules] = useState<any>(null), [policyReason, setPolicyReason] = useState('');
  const [payOpen, setPayOpen] = useState(false), [pending, setPending] = useState<any>(() => readPending(retreatId));
  const [payment, setPayment] = useState({ feeAmountUsd: '', payoutAmount: '', currency: 'USD', paymentDate: today(), paymentMethod: 'bank_transfer', reference: '', exchangeRateSource: '', notes: '', existingExpenseId: '' });
  const [voidId, setVoidId] = useState(''), [voidReason, setVoidReason] = useState('');
  const [excludeId, setExcludeId] = useState(''), [excludeReason, setExcludeReason] = useState('');
  const sequence = useRef(0);
  const accept = useCallback((next: any) => {
    // Reject unavailable/malformed responses before committing render state.
    // The expense workspace must remain usable when this optional panel fails.
    if (!next || Array.isArray(next) || !next.estimate || !next.policy?.rules || !Array.isArray(next.history)) {
      throw new Error('Medical fee details are unavailable. Refresh to retry.');
    }
    setData(next); setRecipient(next.obligation?.recipient?.id || ''); setRules(next.policy.rules);
    const saved = readPending(retreatId);
    if (saved && !(next.pendingEntries || []).some((op: any) => op.requestId === saved.requestId) && next.history.some((row: any) => row.medicalPayoutKey === `medical:${retreatId}:${saved.requestId}`)) {
      sessionStorage.removeItem(keyFor(retreatId)); setPending(null); setPayOpen(false); setNotice('Payment found in recorded history.');
    }
  }, [retreatId]);
  const load = useCallback(async () => {
    const token = ++sequence.current; setLoading(true); setError('');
    try { const [summary, people] = await Promise.all([medicalPayoutsApi.summary(retreatId), medicalPayoutsApi.recipients()]); if (token !== sequence.current) return; accept(summary.data); setRecipients(people.data); }
    catch (e) { if (token === sequence.current) setError(apiErrorMessage(e, 'Could not load medical payouts.')); }
    finally { if (token === sequence.current) setLoading(false); }
  }, [retreatId, accept]);
  useEffect(() => { void load(); return () => { sequence.current++; }; }, [load]);
  const mutate = async (work: () => Promise<any>, message: string, financial = false) => {
    setBusy(true); setError(''); setNotice('');
    try { const response = await work(); accept(response.data); setNotice(message); if (financial) onPaymentChanged?.(); return true; }
    catch (e) { setError(apiErrorMessage(e, 'Could not save. Refresh and review the current record.')); return false; }
    finally { setBusy(false); }
  };
  const approve = async (event: React.FormEvent) => { event.preventDefault(); if (await mutate(() => medicalPayoutsApi.approve(retreatId, { recipientId: recipient, quoteHash: data.estimate.quoteHash, expectedRevision: data.obligation?.revision || 0, reason: approvalReason }), 'Medical fee approved.')) { setReview(false); setApprovalReason(''); } };
  const openPayment = (existing?: any) => {
    setError(''); setPayOpen(true);
    if (pending) { setPayment({ feeAmountUsd: String(pending.feeAmountUsd), payoutAmount: String(pending.payoutAmount), currency: pending.currency, paymentDate: pending.paymentDate, paymentMethod: pending.paymentMethod, reference: pending.reference || '', exchangeRateSource: pending.exchangeRateSource || '', notes: pending.notes || '', existingExpenseId: pending.existingExpenseId || '' }); return; }
    const fee = existing?.currency === 'USD' ? existing.amount : existing ? '' : data.remainingAmount;
    setPayment({ feeAmountUsd: String(fee), payoutAmount: String(existing?.amount ?? fee), currency: existing?.currency || 'USD', paymentDate: existing ? String(existing.expenseDate).slice(0, 10) : today(), paymentMethod: existing ? existing.paymentMethod || 'other' : 'bank_transfer', reference: existing?.receiptNumber || '', notes: existing?.notes || '', exchangeRateSource: '', existingExpenseId: existing?._id || '' });
  };
  const pay = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = pending || { ...payment, feeAmountUsd: Number(payment.feeAmountUsd), payoutAmount: Number(payment.payoutAmount), expectedRevision: data.obligation.revision, requestId: requestId() };
    sessionStorage.setItem(keyFor(retreatId), JSON.stringify(body)); setPending(body); setBusy(true); setError(''); setNotice('');
    try {
      const response = await medicalPayoutsApi.pay(retreatId, body); accept(response.data);
      sessionStorage.removeItem(keyFor(retreatId)); setPending(null); setPayOpen(false); setNotice('Payment recorded in Expenses.'); onPaymentChanged?.();
    } catch (e: any) {
      setError(apiErrorMessage(e, 'The payment result is uncertain. Retry the same entry or refresh to check history.'));
      if ([400, 403].includes(e?.response?.status) || (e?.response?.status === 409 && String(e?.response?.data?.message).includes('approved fee changed'))) { sessionStorage.removeItem(keyFor(retreatId)); setPending(null); }
    } finally { setBusy(false); }
  };
  const saveRules = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await medicalPayoutsApi.saveSettings({ expectedVersion: data.policy.version, rules, reason: policyReason }); await load(); setPolicyReason(''); setNotice('A new fee policy version was saved. Approved snapshots were preserved.'); }
    catch (e) { setError(apiErrorMessage(e, 'Could not save the fee rules.')); }
    finally { setBusy(false); }
  };
  if (loading && !data) return <section className="medical-payout-panel"><h2>Medical fees &amp; payouts</h2><p>Loading medical payouts…</p></section>;
  const estimate = data?.estimate, obligation = data?.obligation;
  const unclassified = (data?.legacyExpenses || []).filter((e: any) => !e.medicalFeeExclusion);
  const field = (name: string, value: string) => setPayment(current => ({ ...current, [name]: value, ...(name === 'feeAmountUsd' && current.currency === 'USD' && !current.existingExpenseId ? { payoutAmount: value } : {}), ...(name === 'currency' && value === 'USD' && !current.existingExpenseId ? { payoutAmount: current.feeAmountUsd } : {}) }));
  return <section className="medical-payout-panel" aria-label="Medical fees and payouts">
    <header><div><h2>Medical fees &amp; payouts</h2><p>One medical fee per retreat. Actual payments are recorded in Expenses.</p></div><button type="button" onClick={() => void load()} disabled={busy || loading}>Refresh medical payouts</button></header>
    {error && <p role="alert" className="medical-fee-error">{error}</p>}{notice && <p role="status" className="medical-fee-notice">{notice}</p>}
    {!data ? <button onClick={() => void load()}>Retry medical payouts</button> : <>
      <div className="medical-fee-metrics"><div><span>Current estimate</span><strong>{estimate.available ? usd(estimate.totalAmount) : 'Unavailable'}</strong></div><div><span>Approved fee</span><strong>{obligation ? usd(obligation.snapshot.totalAmount) : 'Not approved'}</strong></div><div><span>Paid against fee</span><strong>{usd(data.paidAmount)}</strong></div><div><span>Remaining approved fee</span><strong>{obligation ? usd(data.remainingAmount) : '—'}</strong></div></div>
      {estimate.reason && <p className="medical-fee-warning">{estimate.reason}</p>}
      {obligation && <p>Recipient: <strong>{obligation.recipient.name}</strong> · Approved version {obligation.revision} · {data.state.replace(/_/g, ' ')}</p>}
      {(data.pendingEntries || []).length > 0 && <div className="medical-fee-warning"><p>A payment entry is incomplete. Its amount is reserved until the entry finishes; it has not been counted twice.</p>{data.pendingEntries.map((entry: any) => <div key={entry.requestId}>{usd(entry.feeAmountUsd)} · {entry.recordedBy} {canManage && <button type="button" disabled={busy} onClick={() => void mutate(() => medicalPayoutsApi.resume(retreatId, entry.requestId), 'Incomplete entry completed.', true)}>Retry incomplete payment entry</button>}</div>)}</div>}
      {data.calculationChanged && <p className="medical-fee-warning">The current calculation differs from the approved snapshot. Payments continue to use the approved amount until you explicitly approve a revision.</p>}
      <div className="medical-fee-actions"><button type="button" onClick={() => setReview(!review)} disabled={busy}>{review ? 'Close calculation' : 'Review calculation'}</button>{canManage && obligation && data.remainingAmount > 0 && <button type="button" disabled={busy || !estimate.available || (!pending && unclassified.length > 0)} onClick={() => openPayment()}>{pending ? 'Retry pending payment' : 'Record medical payment'}</button>}</div>
      {review && <form className="medical-fee-form" onSubmit={approve}>
        <h3>Review current calculation</h3><p>Policy {estimate.policyVersion ?? data.policy.version} · {estimate.basisDate || 'Date unavailable'} · {estimate.package === 'per_person' ? `${estimate.participantCount} eligible participants × ${usd(estimate.rate)}` : `Flat retreat fee ${usd(estimate.rate)}`} · {usd(estimate.totalAmount)}</p>
        <p>Confirmed, checked-in and checked-out participants count once. Cancelled bookings and boosters do not count.</p>
        <ul>{(estimate.participants || []).map((person: any) => <li key={person.clientId}>{person.name || 'Client'} · Booking #{person.bookingNumber || person.bookingId}</li>)}</ul>
        {canManage && <><label>Payout recipient<select required value={recipient} onChange={e => setRecipient(e.target.value)}><option value="">Select a contact</option>{recipients.map(person => <option key={person._id} value={person._id}>{person.name} · {person.role}</option>)}</select></label><p className="medical-fee-help">Recipient missing? Add the person to the Contact Book first.</p><label>{obligation ? 'Reason for revision' : 'Approval note'}<input required={!!obligation} minLength={obligation ? 5 : undefined} maxLength={2000} value={approvalReason} onChange={e => setApprovalReason(e.target.value)}/></label><button disabled={busy || !estimate.available || !recipient} type="submit">{obligation ? 'Approve revised medical fee' : 'Approve medical fee'}</button></>}
      </form>}
      {payOpen && canManage && obligation && <form className="medical-fee-form" onSubmit={pay} aria-label="Record medical payment">
        <h3>{payment.existingExpenseId ? 'Link an existing medical expense' : 'Record payment against approved fee'}</h3><p>Recipient: {obligation.recipient.name}. This records money already paid; it does not send a bank transfer.</p>
        {pending && <p className="medical-fee-warning">A submitted payment is awaiting confirmation. Retry uses the same details and payment identifier.</p>}
        <fieldset disabled={busy || !!pending}><label>Fee amount applied (USD)<input required type="number" min="0.01" step="0.01" max={data.remainingAmount} value={payment.feeAmountUsd} onChange={e => field('feeAmountUsd', e.target.value)}/></label>
          <label>Payout currency<select disabled={!!payment.existingExpenseId} value={payment.currency} onChange={e => field('currency', e.target.value)}>{['USD','EUR','CZK','PLN'].map(code => <option key={code}>{code}</option>)}</select></label>
          <label>Actual amount paid<input required readOnly={!!payment.existingExpenseId || payment.currency === 'USD'} type="number" min="0.01" step="0.01" value={payment.payoutAmount} onChange={e => field('payoutAmount', e.target.value)}/></label>
          {payment.currency !== 'USD' && <label>Recorded bank or exchange quote source<input required minLength={3} maxLength={2000} value={payment.exchangeRateSource} onChange={e => field('exchangeRateSource', e.target.value)}/></label>}
          <label>Payment date<input required readOnly={!!payment.existingExpenseId} type="date" value={payment.paymentDate} onChange={e => field('paymentDate', e.target.value)}/></label>
          <label>Payment method<select disabled={!!payment.existingExpenseId} value={payment.paymentMethod} onChange={e => field('paymentMethod', e.target.value)}>{['bank_transfer','cash','card','other'].map(method => <option key={method} value={method}>{method.replace(/_/g,' ')}</option>)}</select></label>
          <label>Transfer reference<input readOnly={!!payment.existingExpenseId} maxLength={2000} value={payment.reference} onChange={e => field('reference',e.target.value)}/></label><label>Payment notes<textarea maxLength={2000} value={payment.notes} onChange={e => field('notes',e.target.value)}/></label>
        </fieldset><div className="medical-fee-actions"><button disabled={busy} type="submit">{busy ? 'Recording…' : pending ? 'Retry same payment' : payment.existingExpenseId ? 'Confirm existing payment link' : 'Confirm recorded payment'}</button><button disabled={busy} type="button" onClick={() => setPayOpen(false)}>Close payment form</button></div>
      </form>}
      {(data.legacyExpenses || []).length > 0 && <div className="medical-fee-warning"><h3>Earlier medical expenses</h3><p>These are not included in the approved fee's paid balance. Review them before adding new payments.</p>{data.legacyExpenses.map((row: any) => <div className="medical-fee-legacy" key={row._id}><span>{row.amount} {row.currency} · {row.vendor || row.description} · {String(row.expenseDate).slice(0,10)}</span>{row.medicalFeeExclusion ? <span>Excluded: {row.medicalFeeExclusion.reason}</span> : canManage && <div className="medical-fee-actions"><button type="button" disabled={busy || !obligation} onClick={() => openPayment(row)}>Link this existing payment</button><button type="button" disabled={busy} onClick={() => { setExcludeId(row._id); setExcludeReason(''); }}>Exclude unrelated cost</button></div>}</div>)}{unclassified.length > 0 && <p>New payment entries stay blocked until these costs are linked or explicitly excluded.</p>}</div>}
      {excludeId && canManage && <form className="medical-fee-form" onSubmit={async e => { e.preventDefault(); if (await mutate(() => medicalPayoutsApi.exclude(excludeId, excludeReason), 'Existing cost excluded from this fee.')) setExcludeId(''); }}><label>Reason this cost is unrelated<input required minLength={5} maxLength={2000} value={excludeReason} onChange={e => setExcludeReason(e.target.value)}/></label><button disabled={busy}>Confirm exclusion</button><button type="button" onClick={() => setExcludeId('')}>Cancel exclusion</button></form>}
      <h3>Medical payment history</h3>{!data.history.length ? <p>No medical payments recorded for this obligation.</p> : <div className="medical-fee-history">{data.history.map((row: any) => <article key={row._id}>
        <div><strong>{row.medicalPayment.recipient.name} · {usd(row.medicalPayment.feeAmountUsd)} applied</strong><p>{row.medicalPayment.voidedAt ? row.medicalPayment.originalAmount : row.amount} {row.currency} paid · {String(row.expenseDate).slice(0,10)} · {row.paymentMethod?.replace(/_/g,' ')}</p><p>Reference: {row.receiptNumber || '—'} · Recorded by {row.medicalPayment.recordedBy}</p>{row.currency !== 'USD' && <p>USD per {row.currency}: {row.medicalPayment.exchangeRate} · {row.medicalPayment.exchangeRateSource}</p>}</div>
        {row.medicalPayment.voidedAt ? <p>Voided: {row.medicalPayment.voidReason} · {row.medicalPayment.voidedBy}</p> : canManage && <button disabled={busy} type="button" onClick={() => { setVoidId(row._id); setVoidReason(''); }}>Void incorrect payment</button>}<a href={`${prefix}/expenses/${row._id}`}>View expense</a>
      </article>)}</div>}
      {voidId && canManage && <form className="medical-fee-form" onSubmit={async e => { e.preventDefault(); if (await mutate(() => medicalPayoutsApi.void(voidId, voidReason), 'Payment voided; original history retained.', true)) setVoidId(''); }}><label>Reason for voiding payment<input required minLength={5} maxLength={2000} value={voidReason} onChange={e => setVoidReason(e.target.value)}/></label><button disabled={busy}>Confirm void</button><button type="button" onClick={() => setVoidId('')}>Cancel void</button></form>}
      {obligation && <details><summary>Approved calculation history</summary>{obligation.versions.map((version: any) => <p key={version.revision}>Version {version.revision} · {usd(version.snapshot.totalAmount)} · {version.recipient.name} · {version.approvedBy} · {String(version.approvedAt).slice(0,10)} · {version.reason || 'Initial approval'}</p>)}</details>}
      <details><summary>Medical fee rules · version {data.policy.version}</summary><p>Retreat start date selects the package. The cutoff date is included in the flat fee. One fee per retreat; confirmed or attended participants count before the cutoff, excluding cancelled bookings and boosters.</p>{canManage ? <form className="medical-fee-form" onSubmit={saveRules}><label>Flat-fee start date<input required type="date" value={rules.cutoffDate} onChange={e => setRules({ ...rules, cutoffDate: e.target.value })}/></label><label>Earlier fee per person (USD)<input required type="number" min="0" step="0.01" value={rules.beforeRate} onChange={e => setRules({ ...rules, beforeRate: Number(e.target.value) })}/></label><label>Flat retreat fee (USD)<input required type="number" min="0" step="0.01" value={rules.afterRate} onChange={e => setRules({ ...rules, afterRate: Number(e.target.value) })}/></label><label>Reason for policy change<input required minLength={5} maxLength={2000} value={policyReason} onChange={e => setPolicyReason(e.target.value)}/></label><button disabled={busy}>Save new policy version</button></form> : <p>{usd(data.policy.rules.beforeRate)} per person before {data.policy.rules.cutoffDate}; {usd(data.policy.rules.afterRate)} per retreat from that date.</p>}</details>
    </>}
  </section>;
}
