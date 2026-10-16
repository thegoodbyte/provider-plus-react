import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { clientsApi, bookingsApi, paymentRequestsApi, scratchpadApi, ScratchpadReceipt, ScratchpadSnapshot } from '../services/api';
import SearchableClientSelect from './SearchableClientSelect';

const fieldClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900';
const buttonClass = 'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50';
const primaryClass = 'rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50';
const providers: Record<string, string> = { csob: 'ČSOB', revolut: 'Revolut', paypal: 'PayPal' };
const currencies = ['CZK', 'EUR', 'PLN', 'USD'];
const resolveId = (v: any): string => typeof v === 'object' ? v?._id || '' : v || '';
const errorText = (e: any) => {
  const message = e?.response?.data?.message;
  return Array.isArray(message) ? message.join(' ') : message || 'Could not save or load this information. Your form values are retained; please retry.';
};
const blankForm = () => ({ captureKey: crypto.randomUUID(), receivedDate: new Date().toLocaleDateString('en-CA'), amount: '', currency: 'PLN', provider: 'csob', account: '', payer: '', externalId: '', reference: '', requestNumber: '', notes: '' });
const defaultFilters = { from: '', to: '', provider: '', account: '', currency: '', search: '', status: 'unassigned' };
const historyFields: Record<string,string> = { receivedDate: 'Received date', amountMinor: 'Amount (minor units)', currency: 'Currency', provider: 'Provider', account: 'Account', payer: 'Payer', externalId: 'Transaction ID', reference: 'Reference', requestNumber: 'Request hint', notes: 'Notes', status: 'Status', reason: 'Reason', message: 'Result' };
function SearchableSelect({ id, value, options, placeholder, onChange }: { id: string; name: string; value: string; options: Array<{id:string;label:string;sublabel?:string}>; placeholder: string; onChange: (id:string)=>void }) {
  const [search,setSearch] = useState('');
  return <div className="space-y-2"><input className={fieldClass} aria-label={placeholder} placeholder={placeholder} value={search} onChange={e=>setSearch(e.target.value)} /><select id={id} className={fieldClass} value={value} onChange={e=>onChange(e.target.value)}>{options.filter(o=>o.id === value || !o.id || `${o.label} ${o.sublabel || ''}`.toLowerCase().includes(search.toLowerCase())).map(o=><option key={o.id} value={o.id}>{o.label}{o.sublabel ? ` · ${o.sublabel}` : ''}</option>)}</select></div>;
}

export default function PaymentScratchpadPage() {
  const [filters, setFilters] = useState(defaultFilters);
  const [page, setPage] = useState(1);
  const [snapshot, setSnapshot] = useState<ScratchpadSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<ReturnType<typeof blankForm> | null>(null);
  const [selected, setSelected] = useState<ScratchpadReceipt | null>(null);
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<{ payments: any[]; requests: any[] }>({ payments: [], requests: [] });
  const [target, setTarget] = useState({ clientId: '', bookingId: '', paymentRequestId: '', paymentId: '', action: 'convert', confirmAccount: false });
  const [confirmed, setConfirmed] = useState(false);
  const sequence = useRef(0);
  const saving = useRef(false);
  const detailSequence = useRef(0);

  const load = useCallback(async () => {
    const seq = ++sequence.current; setLoading(true); setListError('');
    try {
      const { data } = await scratchpadApi.list({ ...filters, page });
      if (seq === sequence.current) setSnapshot(data);
    } catch (e) { if (seq === sequence.current) setListError(errorText(e)); }
    finally { if (seq === sequence.current) setLoading(false); }
  }, [filters, page]);
  useEffect(() => { const timer = setTimeout(load, 200); return () => { clearTimeout(timer); ++sequence.current; }; }, [load]);
  const changeFilter = (key: string, value: string) => { setFilters(v => ({ ...v, [key]: value })); setPage(1); };
  const mutate = async (action: () => Promise<void>) => {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); await load(); }
    catch (e) {
      setError(errorText(e));
      if (selected && !form) try {
        const { data } = await scratchpadApi.detail(selected._id); setSelected(data);
        if (data.reconciliationPending) setTarget(v => ({ ...v, ...data.reconciliation.targets, paymentId: data.reconciliation.paymentId, action: data.reconciliation.action, confirmAccount: data.reconciliation.confirmAccount }));
      } catch { /* Keep the last known receipt and visible error for explicit reload. */ }
    }
    finally { saving.current = false; setBusy(false); }
  };
  const open = async (id: string) => {
    const seq = ++detailSequence.current;
    setError(''); setSelected(null); setForm(null); setEditing(false); setReason(''); setConfirmed(false);
    try {
      const [detail, suggestions, cs, bs, rs] = await Promise.all([scratchpadApi.detail(id), scratchpadApi.candidates(id), clientsApi.getAll(), bookingsApi.getAll(), paymentRequestsApi.getAllFresh()]);
      if (seq !== detailSequence.current) return;
      setSelected(detail.data); setCandidates(suggestions.data); setClients(cs.data); setBookings(bs.data); setRequests(rs.data);
      const pending = detail.data.reconciliation;
      setTarget({ clientId: pending?.targets?.clientId || '', bookingId: pending?.targets?.bookingId || '', paymentRequestId: pending?.targets?.paymentRequestId || '', paymentId: pending?.paymentId || '', action: pending?.action || 'convert', confirmAccount: pending?.confirmAccount || false });
    } catch (e) { if (seq === detailSequence.current) setError(errorText(e)); }
  };
  const saveCapture = (e: React.FormEvent) => {
    e.preventDefault(); if (!form) return;
    void mutate(async () => {
      const response = editing && selected ? await scratchpadApi.edit(selected._id, { ...form, revision: selected.revision }) : await scratchpadApi.create(form);
      const duplicate = (response.data as any).possibleDuplicates?.length;
      setNotice(`${(response.data as any).alreadyRecorded ? 'This receipt was already recorded. No duplicate was created.' : 'Receipt saved. No payment or balance was changed.'}${duplicate ? ' Possible duplicate receipts found—review the matching date, amount and reference before reconciliation.' : ''}`);
      await open(response.data._id);
    });
  };
  const setRequest = (id: string) => {
    const request = requests.find(r => r._id === id);
    setTarget(v => ({ ...v, paymentRequestId: id, ...(request ? { clientId: resolveId(request.clientId), bookingId: resolveId(request.bookingId) } : {}) })); setConfirmed(false);
  };
  const setExisting = (id: string) => {
    const payment = candidates.payments.find(p => p._id === id);
    if (payment) { setTarget(v => ({ ...v, action: 'link', paymentId: id, clientId: resolveId(payment.clientId), bookingId: resolveId(payment.bookingId), paymentRequestId: resolveId(payment.paymentRequestId), confirmAccount: false })); setConfirmed(false); }
  };
  const finish = (e: React.FormEvent) => {
    e.preventDefault(); if (!selected) return;
    void mutate(async () => {
      const { data } = await scratchpadApi.reconcile(selected._id, { ...target, revision: selected.revision, confirm: confirmed });
      setSelected(data); setNotice('Receipt reconciled. The original received-money total is unchanged.');
    });
  };
  const changeState = (status: string) => selected && void mutate(async () => {
    const { data } = await scratchpadApi.state(selected._id, { revision: selected.revision, status, reason });
    setSelected(await scratchpadApi.detail(data._id).then(r => r.data)); setReason(''); setNotice(status === 'excluded' ? 'Receipt excluded with its history retained.' : 'Receipt restored to unassigned.');
  });

  const requestOptions = requests.filter(r => !target.clientId || resolveId(r.clientId) === target.clientId).map(r => ({ id: r._id, label: `#${r.display_id || r.invoiceNumber} · ${r.currency} · ${r.status}`, sublabel: r.invoiceNumber || '' }));
  const bookingOptions = bookings.filter(b => !target.clientId || resolveId(b.clientId) === target.clientId).map(b => ({ id: b._id, label: `Booking #${b.bookingNumber || b.display_id} · ${b.currency} · ${b.status}`, sublabel: b.retreatId?.retreatCode || b.retreatId?.name || '' }));
  const close = () => { ++detailSequence.current; setSelected(null); setForm(null); setEditing(false); setError(''); };
  return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><Link className="text-sm text-blue-700" to="/admin/payments">← Payments</Link><h1 className="mt-2 text-2xl font-semibold text-slate-900">Payment scratchpad</h1><p className="mt-1 max-w-2xl text-sm text-slate-600">Record money already received, then match it when you know the client. Capture does not update balances.</p></div><button className={primaryClass} disabled={busy} onClick={() => { close(); setNotice(''); setForm(blankForm()); }}>Record received money</button></header>
    {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">{notice}</div>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">{error} {selected && <button className={buttonClass} disabled={busy} onClick={() => void open(selected._id)}>Reload receipt</button>}</div>}

    {form && <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="mb-4 text-lg font-semibold">{editing ? 'Edit unassigned receipt' : 'Record a receipt'}</h2><form onSubmit={saveCapture}><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label>Received date<input className={fieldClass} type="date" required min="1900-01-01" max="2100-12-31" value={form.receivedDate} onChange={e => setForm({ ...form, receivedDate: e.target.value })} /></label>
      <label>Amount received<input className={fieldClass} inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="5100.00" /></label>
      <label>Currency<select className={fieldClass} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>{currencies.map(c => <option key={c}>{c}</option>)}</select></label>
      <label>Provider<select className={fieldClass} value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })}>{Object.entries(providers).map(([key, name]) => <option value={key} key={key}>{name}</option>)}</select></label>
      <label>Receiving account / wallet<input className={fieldClass} required maxLength={150} value={form.account} onChange={e => setForm({ ...form, account: e.target.value })} placeholder="e.g. ČSOB PLN account" /></label>
      {(['payer', 'externalId', 'reference', 'requestNumber'] as const).map((key, index) => <label key={key}>{['Payer name (optional)', 'External transaction ID (optional)', 'Transfer reference (optional)', 'Payment request number (optional)'][index]}<input className={fieldClass} maxLength={key === 'requestNumber' ? 100 : key === 'reference' ? 500 : 200} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
      <label className="sm:col-span-2">Notes (optional)<textarea className={fieldClass} maxLength={4000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
      <p className="text-sm text-slate-600 sm:col-span-2 lg:col-span-3">A request number is a search hint. No client or booking will be assigned automatically.</p>
      <div className="flex gap-3 sm:col-span-2 lg:col-span-3"><button className={primaryClass} type="submit">{busy ? 'Saving…' : 'Save receipt'}</button><button className={buttonClass} type="button" onClick={() => { setForm(null); setEditing(false); }}>Cancel</button></div>
    </fieldset></form></section>}

    {selected && !form && <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5" aria-label="Receipt details"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-lg font-semibold">{selected.amount} {selected.currency} · {providers[selected.provider]}</h2><p>{selected.receivedDate} · {selected.account} · {selected.payer || 'Payer unknown'}</p><p className="break-words text-sm text-slate-600">Reference: {selected.reference || '—'} · Transaction: {selected.externalId || '—'} · Request hint: {selected.requestNumber || '—'}</p></div><button disabled={busy} className={buttonClass} onClick={close}>Close details</button></div>
      {selected.reconciliationPending && <p role="status" className="rounded-lg bg-amber-50 p-3">Reconciliation is pending. Retry to resume the original confirmed target. Receipt editing is locked.</p>}
      {selected.reconciliationError && <p role="alert" className="text-red-800">{selected.reconciliationError}</p>}
      {selected.status === 'converted' ? <div className="rounded-lg bg-slate-50 p-4"><p>Reconciled receipt. Financial fields are locked.</p>{selected.payment ? <><Link className="text-blue-700 underline" to={`/admin/payments/${selected.paymentId}`}>View payment #{selected.payment.display_id || selected.paymentId}</Link><p>Current payment: {selected.payment.amount} {selected.payment.currency} · {selected.payment.status}</p>{selected.payment.bookingId && <Link className="mr-4 text-blue-700 underline" to={`/admin/bookings/${resolveId(selected.payment.bookingId)}`}>View booking</Link>}{selected.payment.paymentRequestId && <Link className="text-blue-700 underline" to={`/admin/payment-requests/${resolveId(selected.payment.paymentRequestId)}`}>View payment request</Link>}</> : <p role="alert">The linked payment was removed. Review the existing payment correction workflow; this receipt cannot be converted again.</p>}</div> : <>
        {!selected.reconciliationPending && <div className="flex flex-wrap items-end gap-3">{selected.status === 'unassigned' && <button className={buttonClass} disabled={busy} onClick={() => { setEditing(true); setForm({ ...blankForm(), ...selected }); }}>Edit receipt</button>}<label className="min-w-0 flex-1">Reason for exclusion / restore<input className={fieldClass} value={reason} onChange={e => setReason(e.target.value)} maxLength={500} /></label><button className={buttonClass} disabled={busy || !reason.trim()} onClick={() => changeState(selected.status === 'excluded' ? 'unassigned' : 'excluded')}>{selected.status === 'excluded' ? 'Restore receipt' : 'Exclude receipt'}</button></div>}
        {selected.status === 'unassigned' && <form onSubmit={finish} className="space-y-4 border-t border-slate-200 pt-4"><h3 className="font-semibold">Match this receipt</h3><p className="text-sm text-slate-600">Review possible existing payments first. Only the full amount can be reconciled. Different currencies and split allocations need the existing payment workflow.</p>
          {candidates.requests.length > 0 && <p className="text-sm">Possible request numbers: {candidates.requests.map(r => `#${r.display_id || r.invoiceNumber}`).join(', ')}. Choose explicitly below.</p>}
          <fieldset disabled={busy || selected.reconciliationPending} className="space-y-4">
            <label>Action<select className={fieldClass} value={target.action} onChange={e => { setTarget(v => ({ ...v, action: e.target.value, paymentId: '', confirmAccount: false })); setConfirmed(false); }}><option value="convert">Convert to a new payment</option><option value="link">Link an existing payment</option></select></label>
            <div className="rounded-lg bg-slate-50 p-3"><p className="mb-2 text-sm font-medium">Potential existing payments (up to 50; reference, transaction, date and account matches first)</p>{candidates.payments.length ? candidates.payments.map(p => <div className="mb-2 flex flex-wrap items-center gap-3 text-sm" key={p._id}><Link target="_blank" className="text-blue-700 underline" to={`/admin/payments/${p._id}`}>Payment #{p.display_id || p._id}</Link><span>{String(p.paymentDate || '').slice(0,10)} · {p.amount} {p.currency} · {p.receivingAccount || 'Account not recorded'} · {p.transactionReference || p.transactionId || 'No reference'}{p.sourceScratchpadId ? ' · Already linked' : ''}</span><button className={buttonClass} type="button" disabled={Boolean(p.sourceScratchpadId)} onClick={() => setExisting(p._id)}>Select existing payment</button></div>) : <p className="text-sm text-slate-600">No matching payment found.</p>}</div>
            <label>Client<SearchableClientSelect clients={clients} ariaLabel="Reconciliation client" value={target.clientId} onChange={clientId => { setTarget(v => ({ ...v, clientId, bookingId: '', paymentRequestId: '', paymentId: '' })); setConfirmed(false); }} /></label>
            <label htmlFor="scratchpad-booking">Booking (optional)</label><SearchableSelect id="scratchpad-booking" name="bookingId" value={target.bookingId} options={[{ id: '', label: 'No booking' }, ...bookingOptions]} placeholder="Search booking number" onChange={bookingId => { const b = bookings.find(item => item._id === bookingId); setTarget(v => ({ ...v, bookingId, clientId: b ? resolveId(b.clientId) : v.clientId, paymentRequestId: '' })); setConfirmed(false); }} />
            <label htmlFor="scratchpad-request">Payment request (optional)</label><SearchableSelect id="scratchpad-request" name="paymentRequestId" value={target.paymentRequestId} options={[{ id: '', label: 'No payment request' }, ...requestOptions]} placeholder="Search request number" onChange={setRequest} />
            {target.action === 'link' && <label className="flex items-start gap-2"><input type="checkbox" checked={target.confirmAccount} onChange={e => setTarget(v => ({ ...v, confirmAccount: e.target.checked }))} />I checked the original transaction and confirm this receiving account matches the selected existing payment.</label>}
          </fieldset>
          <p className="rounded-lg bg-blue-50 p-3 text-sm">Review: {selected.receivedDate} · {selected.amount} {selected.currency} · {selected.account}. {target.action === 'link' ? 'Linking does not create a payment or change balances.' : 'Conversion creates one completed payment and updates the selected client/booking/request through existing rules.'} No email will be sent.</p>
          <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy} required />I reviewed the receipt and selected relationships.</label>
          <button className={primaryClass} type="submit" disabled={busy || !confirmed || !target.clientId || (target.action === 'link' && !target.paymentId)}>{busy ? 'Reconciling…' : selected.reconciliationPending ? 'Retry reconciliation' : target.action === 'link' ? 'Confirm link to existing payment' : 'Confirm conversion'}</button>
        </form>}
      </>}
      <details><summary className="cursor-pointer font-medium">Receipt history ({selected.history?.length || 0})</summary><ol className="mt-3 space-y-3 text-sm">{selected.history?.map((h,i) => <li className="border-l-2 border-slate-200 pl-3" key={i}><p>{h.action.replace(/_/g, ' ')} · {h.actor} · {new Date(h.at).toLocaleString()}</p>{['before','after'].map(side => <div className="break-words text-xs text-slate-500" key={side}>{Object.entries((h as any)[side] || {}).filter(([key]) => historyFields[key]).map(([key,value]) => <p key={key}>{side === 'before' ? 'Previous' : 'Saved'} {key === 'amountMinor' ? 'amount' : historyFields[key]}: {key === 'amountMinor' ? (Number(value)/100).toFixed(2) : String(value || '—')}</p>)}</div>)}</li>)}</ol></details>
    </section>}

    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5" aria-label="Received-money overview"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label>From date<input className={fieldClass} type="date" value={filters.from} onChange={e => changeFilter('from', e.target.value)} /></label><label>To date<input className={fieldClass} type="date" value={filters.to} onChange={e => changeFilter('to', e.target.value)} /></label>
      <label>Filter provider<select className={fieldClass} value={filters.provider} onChange={e => changeFilter('provider', e.target.value)}><option value="">All providers</option>{Object.entries(providers).map(([key,name]) => <option key={key} value={key}>{name}</option>)}</select></label><label>Filter currency<select className={fieldClass} value={filters.currency} onChange={e => changeFilter('currency', e.target.value)}><option value="">All currencies</option>{currencies.map(c => <option key={c}>{c}</option>)}</select></label>
      <label>Filter account<input className={fieldClass} value={filters.account} onChange={e => changeFilter('account', e.target.value)} /></label><label className="sm:col-span-2">Search payer, reference, transaction or request number<input className={fieldClass} value={filters.search} onChange={e => changeFilter('search', e.target.value)} /></label>
      <div className="flex items-end gap-2"><button className={buttonClass} onClick={() => { setFilters(defaultFilters); setPage(1); }}>Clear filters</button><button className={buttonClass} disabled={loading} onClick={() => void load()}>Refresh</button></div>
    </div>
    <p className="text-sm text-slate-600">Logged receipts only—not a bank balance. Totals use the date, provider, account, currency and search filters across all pages, independently of the status tab. Excluded receipts are shown separately.</p>
    {listError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-900">{listError} {snapshot ? 'Previous snapshot shown below; it may not match the current filters.' : 'No snapshot available.'}</p>}
    {loading && <p role="status">Loading receipts…</p>}
    {snapshot && <div className={loading || listError ? 'opacity-60' : ''}><p className="mb-3 text-xs text-slate-500">Last successful refresh: {new Date(snapshot.refreshedAt).toLocaleString()}</p><div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{currencies.filter(c => snapshot.totals.some(t => t.currency === c)).map(c => <article key={c} className="rounded-xl bg-slate-50 p-4"><h3 className="font-semibold">{c}</h3>{[['logged','Logged'],['unassigned','Unassigned'],['converted','Converted / linked'],['excluded','Excluded']].map(([status,label]) => { const total = snapshot.totals.find(t => t.currency === c && t.status === status); return <p key={status} className="mt-2 flex justify-between gap-3 text-sm"><span>{label} ({total?.count || 0})</span><strong>{total?.amount || '0.00'}</strong></p>; })}</article>)}</div>
      <label>Receipt status<select className={`${fieldClass} mb-4 mt-1 max-w-xs`} value={filters.status} onChange={e => changeFilter('status', e.target.value)}><option value="unassigned">Unassigned</option><option value="all">All receipts</option><option value="converted">Converted / linked</option><option value="excluded">Excluded</option></select></label>
      <div className="space-y-3">{snapshot.items.map(row => <article className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4" key={row._id}><div className="min-w-0"><p className="font-semibold">{row.amount} {row.currency} <span className="text-sm font-normal text-slate-500">· {row.receivedDate}</span></p><p className="text-sm">{providers[row.provider]} · {row.account} · {row.payer || 'Payer unknown'}</p><p className="max-w-full break-words text-xs text-slate-500">{row.reference || 'No reference'}{row.requestNumber ? ` · Request hint: ${row.requestNumber}` : ''}{row.externalId ? ` · Transaction: ${row.externalId}` : ''}</p><p className="text-sm">{row.reconciliationPending ? 'Reconciliation pending — retry needed' : row.status === 'converted' ? 'Converted / linked' : row.status}{row.payment && <> · <Link className="text-blue-700 underline" to={`/admin/payments/${row.paymentId}`}>Payment #{row.payment.display_id || row.paymentId} ({row.payment.status})</Link></>}{row.paymentMissing && <span className="text-red-800"> · Linked payment removed; review correction history</span>}</p></div><button className={buttonClass} disabled={busy || loading || Boolean(listError)} onClick={() => void open(row._id)}>Manage receipt</button></article>)}</div>
      {!snapshot.items.length && !loading && !listError && <p className="py-6 text-center text-slate-600">No receipts match this view. Record received money or adjust the filters.</p>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">{snapshot.total} matching receipts · Page {snapshot.page}</p><div className="flex gap-2"><button className={buttonClass} disabled={page <= 1 || loading || Boolean(listError)} onClick={() => setPage(v => v - 1)}>Previous page</button><button className={buttonClass} disabled={page * snapshot.limit >= snapshot.total || loading || Boolean(listError)} onClick={() => setPage(v => v + 1)}>Next page</button></div></div>
    </div>}
    </section>
  </main>;
}
