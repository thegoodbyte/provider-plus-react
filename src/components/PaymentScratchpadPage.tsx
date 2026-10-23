import { clientBookingsPath } from './PaymentRequestBookingLinks';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Modal, message } from 'antd';
import { Eye, Pencil, Link2 } from 'lucide-react';
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
const blankForm = () => ({ captureKey: crypto.randomUUID(), receivedDate: new Date().toLocaleDateString('en-CA'), amount: '', currency: 'PLN', provider: 'csob', account: '', payer: '', phone: '', externalId: '', reference: '', requestNumber: '', notes: '' });
const defaultFilters = { from: '', to: '', provider: '', account: '', currency: '', search: '', status: 'unassigned', sort: 'date-desc' };
const historyFields: Record<string,string> = { receivedDate: 'Received date', amountMinor: 'Amount (minor units)', currency: 'Currency', provider: 'Provider', account: 'Account', payer: 'Payer', phone: 'Phone number', externalId: 'Transaction ID', reference: 'Reference', requestNumber: 'Request hint', notes: 'Notes', status: 'Status', reason: 'Reason', message: 'Result' };
function SearchableSelect({ id, value, options, placeholder, onChange }: { id: string; name: string; value: string; options: Array<{id:string;label:string;sublabel?:string}>; placeholder: string; onChange: (id:string)=>void }) {
  const [search,setSearch] = useState('');
  return <div className="space-y-2"><input className={fieldClass} aria-label={placeholder} placeholder={placeholder} value={search} onChange={e=>setSearch(e.target.value)} /><select id={id} className={fieldClass} value={value} onChange={e=>onChange(e.target.value)}>{options.filter(o=>o.id === value || !o.id || `${o.label} ${o.sublabel || ''}`.toLowerCase().includes(search.toLowerCase())).map(o=><option key={o.id} value={o.id}>{o.label}{o.sublabel ? ` · ${o.sublabel}` : ''}</option>)}</select></div>;
}

export default function PaymentScratchpadPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const base = '/admin/payments/scratchpad';
  const query = new URLSearchParams(location.search);
  const filters = Object.fromEntries(Object.entries(defaultFilters).map(([key, value]) => [key, query.get(key) ?? value])) as typeof defaultFilters;
  const isBookingReview = filters.status === 'booking-review';
  const page = Math.max(1, Number(query.get('page')) || 1);
  const route = location.pathname.split('/scratchpad')[1] || '';
  const recordId = route.split('/')[1];
  const isNew = recordId === 'new';
  const isEdit = route.endsWith('/edit');
  const isIndex = !recordId;
  const filterKey = JSON.stringify(filters);
  const [toast, toastHolder] = message.useMessage();
  const [matching, setMatching] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [neighbors, setNeighbors] = useState<{previous?:string;next?:string;position?:number;total:number}>({total:0});
  const navigateTo = (path: string, search = location.search) => {
    if (busy || (dirty && !window.confirm('Discard unsaved receipt changes?'))) return;
    setDirty(false); navigate(path + search);
  };
  const setPage = (value: number | ((page:number)=>number)) => { const q = new URLSearchParams(location.search); q.set('page', String(typeof value === 'function' ? value(page) : value)); navigate(base + '?' + q); };
  const setFilters = (value: typeof defaultFilters) => { const q = new URLSearchParams(location.search); Object.entries(value).forEach(([k,v]) => q.set(k,v)); q.set('page','1'); navigate(base + '?' + q); };
  const [snapshot, setSnapshot] = useState<ScratchpadSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<string>(location.state?.scratchpadNotice || '');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<ReturnType<typeof blankForm> | null>(null);
  const [selected, setSelected] = useState<ScratchpadReceipt | null>(null);
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState('');
  const [dateDraft, setDateDraft] = useState('');
  const [dateReason, setDateReason] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<{ payments: any[]; requests: any[]; match?: any }>({ payments: [], requests: [] });
  const [target, setTarget] = useState({ clientId: '', bookingId: '', paymentRequestId: '', paymentId: '', action: 'convert', confirmAccount: false });
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateError, setCandidateError] = useState('');
  const [candidateAttempt, setCandidateAttempt] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const root = useRef<HTMLElement>(null);
  const scrollKey = `scratchpad-scroll:${location.search}`;
  const rememberScroll = () => {
    const values = [window.scrollY]; let parent = root.current?.parentElement;
    while (parent) { values.push(parent.scrollTop); parent = parent.parentElement; }
    sessionStorage.setItem(scrollKey, JSON.stringify(values));
  };
  useEffect(() => {
    if (!isIndex || loading || !snapshot) return;
    const frame = requestAnimationFrame(() => {
      try { const values = JSON.parse(sessionStorage.getItem(scrollKey) || '[]'); if (!values.length) return;
        window.scrollTo(0,values[0]); let parent=root.current?.parentElement, index=1;
        while(parent) {parent.scrollTop=values[index++] || 0;parent=parent.parentElement;}
      } catch { /* A malformed browser scroll preference must not block payments. */ }
    }); return () => cancelAnimationFrame(frame);
  }, [isIndex, loading, snapshot, scrollKey]);
  useEffect(() => {
    if (isIndex && snapshot && !loading && !listError && page > Math.max(1, Math.ceil(snapshot.total / snapshot.limit))) {
      const q = new URLSearchParams(location.search); q.set('page', String(Math.max(1,Math.ceil(snapshot.total/snapshot.limit)))); navigate(`${base}?${q}`,{replace:true});
    }
  }, [isIndex, snapshot, loading, listError, page]);
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
  }, [filterKey, page]);
  useEffect(() => { const timer = setTimeout(load, 200); return () => { clearTimeout(timer); ++sequence.current; }; }, [load]);
  const changeFilter = (key: string, value: string) => setFilters({ ...filters, [key]: value });
  const mutate = async (action: () => Promise<void>) => {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); await load(); }
    catch (e) {
      setError(errorText(e)); void toast.error(errorText(e));
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
    setDetailLoading(true);
    try {
      const [detail, suggestions, cs, bs, rs] = await Promise.all([scratchpadApi.detail(id), scratchpadApi.candidates(id), clientsApi.getAll(), bookingsApi.getAll(), paymentRequestsApi.getAllFresh()]);
      if (seq !== detailSequence.current) return;
      setSelected(detail.data); setCandidates(suggestions.data); setClients(cs.data); setBookings(bs.data); setRequests(rs.data);
      const pending = detail.data.reconciliation;
      const exact = suggestions.data.match?.status === 'exact_request' ? suggestions.data.match : null;
      setTarget({ clientId: pending?.targets?.clientId || exact?.clientId || '', bookingId: pending?.targets?.bookingId || exact?.bookingId || '', paymentRequestId: pending?.targets?.paymentRequestId || exact?.requestId || '', paymentId: pending?.paymentId || exact?.paymentId || '', action: pending?.action || (exact?.paymentId ? 'link' : 'convert'), confirmAccount: pending?.confirmAccount || false });
    } catch (e) { if (seq === detailSequence.current) setError(errorText(e)); }
    finally { if (seq === detailSequence.current) setDetailLoading(false); }
  };
  const saveCapture = (e: React.FormEvent) => {
    e.preventDefault(); if (!form) return;
    void mutate(async () => {
      const response = editing && selected ? await scratchpadApi.edit(selected._id, { ...form, revision: selected.revision }) : await scratchpadApi.create(form);
      const duplicate = (response.data as any).possibleDuplicates?.length;
      setNotice(`${(response.data as any).alreadyRecorded ? 'This receipt was already recorded. No duplicate was created.' : 'Receipt saved. No payment or balance was changed.'}${duplicate ? ' Possible duplicate receipts found—review the matching date, amount and reference before reconciliation.' : ''}`);
      void toast.success('Receipt saved.'); setDirty(false); navigate(`${base}/${response.data._id}${location.search}`); await open(response.data._id);
    });
  };
  const setRequest = (id: string) => {
    const request = requests.find(r => r._id === id);
    setTarget(v => ({ ...v, paymentRequestId: id, paymentId: '', confirmAccount: false, ...(request ? { clientId: resolveId(request.clientId), bookingId: resolveId(request.bookingId) } : {}) })); setConfirmed(false);
  };
  const setExisting = (id: string) => {
    const payment = candidates.payments.find(p => p._id === id);
    if (payment) { setTarget(v => ({ ...v, action: 'link', paymentId: id, clientId: resolveId(payment.clientId), bookingId: resolveId(payment.bookingId), paymentRequestId: resolveId(payment.paymentRequestId), confirmAccount: false })); setConfirmed(false); }
  };
  const finish = (e: React.FormEvent) => {
    e.preventDefault(); if (!selected) return;
    void mutate(async () => {
      const { data } = await scratchpadApi.reconcile(selected._id, { ...target, revision: selected.revision, confirm: confirmed });
      setSelected(data); setMatching(false); setNotice('Receipt reconciled. The original received-money total is unchanged.'); void toast.success('Receipt reconciled.'); if (filters.status === 'unassigned') navigate(`${base}${location.search}`);
    });
  };
  const saveDate = (event: React.FormEvent) => {
    event.preventDefault(); if (!selected) return;
    void mutate(async () => {
      const { data } = await scratchpadApi.correctDate(selected._id, { revision: selected.revision, receivedDate: dateDraft, reason: dateReason });
      const message = 'Received date corrected on the scratchpad, payment and receipt. Amounts and allocations are unchanged.';
      setDirty(false); setSelected(data); setNotice(message);
      navigate(`${base}/${selected._id}${location.search}`, { state: { scratchpadNotice: message } });
    });
  };
  const changeState = (status: string) => selected && void mutate(async () => {
    if (!window.confirm(status === 'excluded' ? 'Exclude this receipt? Its audit history will be retained. No payment will be deleted.' : 'Restore this receipt to unassigned?')) return;
    const { data } = await scratchpadApi.state(selected._id, { revision: selected.revision, status, reason });
    setSelected(await scratchpadApi.detail(data._id).then(r => r.data)); setReason(''); setNotice(status === 'excluded' ? 'Receipt excluded with its history retained.' : 'Receipt restored to unassigned.'); void toast.success(status === 'excluded' ? 'Receipt excluded.' : 'Receipt restored.'); navigate(`${base}${location.search}`);
  });

  useEffect(() => {
    setMatching(false); setDirty(false);
    if (isNew) { setSelected(null); setEditing(false); setForm(blankForm()); }
    else if (recordId) void open(recordId);
    else { ++detailSequence.current; setSelected(null); setForm(null); setEditing(false); }
  }, [recordId, isNew]);
  useEffect(() => {
    if (selected && !isIndex && !isNew) {
      setEditing(isEdit);
      setDateDraft(selected.dateCorrection?.receivedDate || selected.receivedDate);
      setDateReason(selected.dateCorrection?.reason || '');
      setForm(isEdit && selected.status === 'unassigned' && !selected.reconciliationPending ? {...blankForm(), ...selected} : null);
    }
  }, [selected, isEdit, isIndex, isNew]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    let canceled = false;
    if (!recordId || isNew) return;
    setNeighbors({total:0});
    void (async () => {
      try {
        let currentPage = 1, prior: string | undefined;
        while (!canceled) {
          const {data} = await scratchpadApi.list({...filters, page:currentPage});
          const index = data.items.findIndex(r=>r._id===recordId);
          if (index >= 0) {
            let next = data.items[index+1]?._id;
            if (!next && currentPage * data.limit < data.total) next = (await scratchpadApi.list({...filters,page:currentPage+1})).data.items[0]?._id;
            if (!canceled) setNeighbors({previous:data.items[index-1]?._id || prior,next,position:(currentPage-1)*data.limit+index+1,total:data.total});
            return;
          }
          if (currentPage * data.limit >= data.total) { if (!canceled) setNeighbors({total:data.total}); return; }
          prior = data.items.at(-1)?._id; currentPage++;
        }
      } catch { if (!canceled) setNeighbors({total:0}); }
    })();
    return () => { canceled=true; };
  }, [recordId, filterKey, selected?.revision]);

  useEffect(() => {
    if (!matching) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving.current) setMatching(false); };
    document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape);
  }, [matching]);
  useEffect(() => {
    if (!matching || !selected || selected.reconciliationPending) {
      setCandidateLoading(false); setCandidateError('');
      return;
    }
    let active = true;
    setCandidateLoading(true); setCandidateError('');
    void scratchpadApi.candidates(selected._id, { clientId: target.clientId, paymentRequestId: target.paymentRequestId }).then(({ data }) => {
      if (active) setCandidates(data);
    }).catch(e => { if (active) setCandidateError(errorText(e)); }).finally(() => { if (active) setCandidateLoading(false); });
    return () => { active = false; };
  }, [matching, selected?._id, selected?.reconciliationPending, target.clientId, target.paymentRequestId, candidateAttempt]);
  const requestOptions = requests.filter(r => r.status !== 'cancelled' && (!target.clientId || resolveId(r.clientId) === target.clientId)).map(r => {
    const client = clients.find(c => c._id === resolveId(r.clientId));
    const clientName = client ? `${client.firstName || ''} ${client.lastName || ''}`.trim() : '';
    const rawAmount = r.requestedAmount ?? r.amountPaid;
    const requested = rawAmount !== undefined && rawAmount !== null && String(rawAmount).trim() !== '' && Number.isFinite(Number(rawAmount))
      ? `Requested: ${Number(rawAmount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${r.currency}`
      : `Requested amount unavailable · ${r.currency}`;
    return { id: r._id, label: `#${r.display_id || r.invoiceNumber} · ${requested} · ${clientName || 'Client name unavailable'} · ${r.status}`, sublabel: [r.invoiceNumber, client?.display_id ? `Client #${client.display_id}` : ''].filter(Boolean).join(' · ') };
  });
  const bookingOptions = bookings.filter(b => !target.clientId || resolveId(b.clientId) === target.clientId).map(b => ({ id: b._id, label: `Booking #${b.bookingNumber || b.display_id} · ${b.currency} · ${b.status}`, sublabel: b.retreatId?.retreatCode || b.retreatId?.name || '' }));
  const close = () => navigateTo(base);
  return <main ref={root} className="mx-auto min-w-0 max-w-7xl space-y-6 p-4 sm:p-6" onClickCapture={event=>{ if (isIndex) rememberScroll(); if (dirty && (event.target as HTMLElement).closest('a') && !window.confirm('Discard unsaved receipt changes?')) {event.preventDefault();event.stopPropagation();} }}>{toastHolder}
    <header className="flex flex-wrap items-start justify-between gap-4"><div><Link className="text-sm text-blue-700" to="/admin/payments">← Payments</Link><h1 className="mt-2 text-2xl font-semibold text-slate-900">Payment scratchpad</h1><p className="mt-1 max-w-2xl text-sm text-slate-600">Record money already received, then match it when you know the client. Capture does not update balances.</p></div>{isIndex ? <button className={primaryClass} disabled={busy} onClick={() => navigateTo(`${base}/new`)}>New receipt</button> : <button className={buttonClass} onClick={close}>← Back to list</button>}</header>
    {!isIndex && !isNew && <nav aria-label="Receipt navigation" className="flex flex-wrap items-center gap-3"><button className={buttonClass} disabled={!neighbors.previous || busy} onClick={()=>navigateTo(`${base}/${neighbors.previous}`)}>Previous receipt</button><span className="text-sm text-slate-600">{neighbors.position ? `Receipt ${neighbors.position} of ${neighbors.total}` : 'Receipt outside the current filters'}</span><button className={buttonClass} disabled={!neighbors.next || busy} onClick={()=>navigateTo(`${base}/${neighbors.next}`)}>Next receipt</button></nav>}
    {detailLoading && !isIndex && <p role="status">Loading receipt…</p>}
    {isEdit && selected && !form && selected.status !== 'converted' && <p role="status">This receipt is locked. Reconciled, excluded or pending receipts cannot be edited.</p>}
    {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">{notice}</div>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">{error} {selected && <button className={buttonClass} disabled={busy} onClick={() => void open(selected._id)}>Reload receipt</button>}</div>}

    {isEdit && selected?.status === 'converted' && !selected.paymentMissing && <section className="rounded-xl border border-slate-200 bg-white p-5" aria-label="Received date correction"><h2 className="mb-3 text-lg font-semibold">Correct received date</h2><p className="mb-4 text-sm text-slate-600">This corrects the date on the linked payment and receipt. Amount, currency, account and allocation stay unchanged. A reason is saved in the audit history.</p>{selected.dateCorrectionError && <p role="alert">{selected.dateCorrectionError}</p>}<form onSubmit={saveDate} onChange={()=>setDirty(true)} className="space-y-4"><label className="block">Correct received date<input className={fieldClass} type="date" required min="1900-01-01" max="2100-12-31" value={dateDraft} disabled={busy || Boolean(selected.dateCorrection)} onChange={event=>setDateDraft(event.target.value)} /></label><label className="block">Reason for date correction<input className={fieldClass} required maxLength={500} value={dateReason} disabled={busy || Boolean(selected.dateCorrection)} onChange={event=>setDateReason(event.target.value)} /></label><button className={primaryClass} type="submit" disabled={busy || !dateDraft || !dateReason.trim()}>{busy ? 'Saving…' : selected.dateCorrection ? 'Retry date correction' : 'Save date correction'}</button></form></section>}

    {form && <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="mb-4 text-lg font-semibold">{editing ? 'Edit unassigned receipt' : 'Record a receipt'}</h2><form onSubmit={saveCapture} onChange={()=>setDirty(true)}><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label>Received date<input className={fieldClass} type="date" required min="1900-01-01" max="2100-12-31" value={form.receivedDate} onChange={e => setForm({ ...form, receivedDate: e.target.value })} /></label>
      <label>Amount received<input className={fieldClass} inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="5100.00" /></label>
      <label>Currency<select className={fieldClass} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>{currencies.map(c => <option key={c}>{c}</option>)}</select></label>
      <label>Provider<select className={fieldClass} value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })}>{Object.entries(providers).map(([key, name]) => <option value={key} key={key}>{name}</option>)}</select></label>
      {(['payer', 'externalId', 'phone', 'requestNumber'] as const).map((key, index) => <label key={key}>{['Payer name (optional)', 'Transaction ID (optional)', 'Phone number (optional)', 'Payment request number (optional)'][index]}<input className={fieldClass} type={key === 'phone' ? 'tel' : 'text'} maxLength={key === 'requestNumber' ? 100 : key === 'phone' ? 50 : 200} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
      <label className="sm:col-span-2">Notes (optional)<textarea className={fieldClass} maxLength={4000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
      <p className="text-sm text-slate-600 sm:col-span-2 lg:col-span-3">An exact request number prefills its relationships for review. Nothing is linked or converted until you approve.</p>
      <div className="flex gap-3 sm:col-span-2 lg:col-span-3"><button className={primaryClass} type="submit">{busy ? 'Saving…' : 'Save receipt'}</button><button className={buttonClass} type="button" onClick={() => navigateTo(selected ? `${base}/${selected._id}` : base)}>Cancel</button></div>
    </fieldset></form></section>}

    {!isIndex && selected && !form && <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5" aria-label="Receipt details"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-lg font-semibold">{selected.amount} {selected.currency} · {providers[selected.provider]}</h2><p>{selected.receivedDate}{selected.account ? ` · ${selected.account}` : ''} · {selected.payer || 'Payer unknown'}</p><p className="break-words text-sm text-slate-600">Reference: {selected.reference || '—'} · Transaction: {selected.externalId || '—'} · Request hint: {selected.requestNumber || '—'}</p></div><button disabled={busy} className={buttonClass} onClick={close}>Close details</button></div>
      {selected.phone && <p className="text-sm text-slate-700">Phone number: {selected.phone}</p>}
      {selected.notes && <p className="whitespace-pre-wrap break-words text-sm text-slate-700">Notes: {selected.notes}</p>}
      {selected.reconciliationPending && <p role="status" className="rounded-lg bg-amber-50 p-3">Reconciliation is pending. Retry to resume the original confirmed target. Receipt editing is locked.</p>}
      {selected.reconciliationError && <p role="alert" className="text-red-800">{selected.reconciliationError}</p>}
      {selected.status === 'converted' ? <div className="rounded-lg bg-slate-50 p-4"><p>Reconciled receipt. Financial fields are locked.</p>{!selected.paymentMissing && !isEdit && <button className={buttonClass} disabled={busy} onClick={()=>navigateTo(`${base}/${selected._id}/edit`)}>Edit received date</button>}{selected.dateCorrectionError && <p role="alert">{selected.dateCorrectionError}</p>}{selected.payment ? <><Link className="text-blue-700 underline" to={`/admin/payments/${selected.paymentId}`}>View payment #{selected.payment.display_id || selected.paymentId}</Link><p>Current payment: {selected.payment.amount} {selected.payment.currency} · {selected.payment.status}</p>{selected.payment.bookingId && <Link className="mr-4 text-blue-700 underline" to={`/admin/bookings/${resolveId(selected.payment.bookingId)}`}>View booking</Link>}{selected.payment.paymentRequestId && <Link className="text-blue-700 underline" to={`/admin/payment-requests/${resolveId(selected.payment.paymentRequestId)}`}>View payment request</Link>}</> : <p role="alert">The linked payment was removed. Review the existing payment correction workflow; this receipt cannot be converted again.</p>}</div> : <>
        {!selected.reconciliationPending && <div className="flex flex-wrap items-end gap-3">{selected.status === 'unassigned' && <button className={buttonClass} disabled={busy} onClick={() => navigateTo(`${base}/${selected._id}/edit`)}>Edit receipt</button>}<label className="min-w-0 flex-1">Reason for exclusion / restore<input className={fieldClass} value={reason} onChange={e => setReason(e.target.value)} maxLength={500} /></label><button className={buttonClass} disabled={busy || !reason.trim()} onClick={() => changeState(selected.status === 'excluded' ? 'unassigned' : 'excluded')}>{selected.status === 'excluded' ? 'Restore receipt' : 'Exclude receipt'}</button></div>}
        {selected.status === 'unassigned' && <button className={primaryClass} onClick={()=>setMatching(true)}>Match receipt</button>}

      </>}
      <details><summary className="cursor-pointer font-medium">Receipt history ({selected.history?.length || 0})</summary><ol className="mt-3 space-y-3 text-sm">{selected.history?.map((h,i) => <li className="border-l-2 border-slate-200 pl-3" key={i}><p>{h.action.replace(/_/g, ' ')} · {h.actor} · {new Date(h.at).toLocaleString()}</p>{['before','after'].map(side => <div className="break-words text-xs text-slate-500" key={side}>{Object.entries((h as any)[side] || {}).filter(([key]) => historyFields[key]).map(([key,value]) => <p key={key}>{side === 'before' ? 'Previous' : 'Saved'} {key === 'amountMinor' ? 'amount' : historyFields[key]}: {key === 'amountMinor' ? (Number(value)/100).toFixed(2) : String(value || '—')}</p>)}</div>)}</li>)}</ol></details>
    </section>}

    <Modal open={matching && Boolean(selected)} title="Match receipt" onCancel={()=>{if (!busy) setMatching(false);}} footer={null} width={760} destroyOnHidden={false} maskClosable={!busy} closable={!busy} keyboard={!busy}>
      {selected && <><p className="mb-4 break-words">{selected.receivedDate} · {selected.amount} {selected.currency}{selected.account ? ` · ${selected.account}` : ''} · {selected.payer || 'Payer unknown'}</p>{error && <p role="alert" className="mb-3 text-red-800">{error}</p>}
        <form onSubmit={finish} className="space-y-4 border-t border-slate-200 pt-4"><h3 className="font-semibold">Match this receipt</h3><p className="text-sm text-slate-600">Find a payment request by number or client name, or choose a client directly. Selecting a request fills its client and booking; review before confirming.</p><p className="text-sm text-slate-600">Review possible existing payments first. Only the full amount can be reconciled. Different currencies and split allocations need the existing payment workflow.</p>
          {candidates.match && candidates.match.status !== 'none' && <div role={candidates.match.warning ? 'alert' : 'status'} className="rounded-lg bg-blue-50 p-3 text-sm">{candidates.match.status === 'exact_request' && <p>Exact request number found. {target.paymentRequestId === candidates.match.requestId ? 'Relationships are prefilled; staff approval is still required.' : 'Review your selected request before approving.'}</p>}{candidates.match.warning && <p>{candidates.match.warning}</p>}</div>}
          {candidates.requests.length > 0 && <p className="text-sm">Exact request number matches: {candidates.requests.map(r => `#${r.display_id || r.invoiceNumber}`).join(', ')}. Review before approving.</p>}
          <fieldset disabled={busy || selected.reconciliationPending} className="space-y-4">
            <label>Action<select className={fieldClass} value={target.action} onChange={e => { setTarget(v => ({ ...v, action: e.target.value, paymentId: '', confirmAccount: false })); setConfirmed(false); }}><option value="convert">Convert to a new payment</option><option value="link">Link an existing payment</option></select></label>
            <div className="rounded-lg bg-slate-50 p-3"><p className="mb-2 text-sm font-medium">Potential existing payments (up to 50; selected client/request, transaction, reference and date matches first)</p>{candidateLoading ? <p role="status">Loading matching payments…</p> : candidateError ? <p role="alert">{candidateError} <button type="button" className={buttonClass} onClick={() => setCandidateAttempt(v => v + 1)}>Retry matching payments</button></p> : candidates.payments.length ? candidates.payments.map(p => <div className="mb-2 flex flex-wrap items-center gap-3 text-sm" key={p._id}><Link target="_blank" className="text-blue-700 underline" to={`/admin/payments/${p._id}`}>Payment #{p.display_id || p._id}</Link><span>{String(p.paymentDate || '').slice(0,10)} · {p.amount} {p.currency} · {p.receivingAccount || 'Account not recorded'} · {p.transactionReference || p.transactionId || 'No reference'}{p.sourceScratchpadId ? ' · Already linked' : ''}</span><button className={buttonClass} type="button" disabled={Boolean(p.sourceScratchpadId) || candidateLoading} onClick={() => setExisting(p._id)}>Select existing payment</button></div>) : <p className="text-sm text-slate-600">No matching payment found.</p>}</div>
            <label htmlFor="scratchpad-request">Payment request (optional)</label><SearchableSelect id="scratchpad-request" name="paymentRequestId" value={target.paymentRequestId} options={[{ id: '', label: 'No payment request' }, ...requestOptions]} placeholder="Search payment request number or client" onChange={setRequest} />
            <label>Client<SearchableClientSelect clients={clients} ariaLabel="Reconciliation client" value={target.clientId} onChange={clientId => { setTarget(v => ({ ...v, clientId, bookingId: '', paymentRequestId: '', paymentId: '' })); setConfirmed(false); }} /></label>
            <label htmlFor="scratchpad-booking">Booking (optional)</label><SearchableSelect id="scratchpad-booking" name="bookingId" value={target.bookingId} options={[{ id: '', label: 'No booking' }, ...bookingOptions]} placeholder="Search booking number" onChange={bookingId => { const b = bookings.find(item => item._id === bookingId); setTarget(v => ({ ...v, bookingId, clientId: b ? resolveId(b.clientId) : v.clientId, paymentRequestId: '', paymentId: '', confirmAccount: false })); setConfirmed(false); }} />
            {target.action === 'link' && <label className="flex items-start gap-2"><input type="checkbox" checked={target.confirmAccount} onChange={e => setTarget(v => ({ ...v, confirmAccount: e.target.checked }))} />I checked the original transaction and confirm the selected payment, provider, amount and client match this receipt.</label>}
          </fieldset>
          <p className="rounded-lg bg-blue-50 p-3 text-sm">Review: {selected.receivedDate} · {selected.amount} {selected.currency}{selected.account ? ` · ${selected.account}` : ''}. {target.action === 'link' ? 'Linking does not create a payment or change balances.' : 'Conversion creates one completed payment and updates the selected client/booking/request through existing rules.'} No email will be sent.</p>
          <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy} required />I reviewed the receipt and selected relationships.</label>
          <button className={primaryClass} type="submit" disabled={busy || candidateLoading || Boolean(candidateError) || !confirmed || !target.clientId || (target.action === 'link' && !target.paymentId)}>{busy ? 'Reconciling…' : selected.reconciliationPending ? 'Retry reconciliation' : target.action === 'link' ? 'Confirm link to existing payment' : 'Confirm conversion'}</button>
        </form>
      </>}
    </Modal>
    {isIndex && <>
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label="Received-money overview">
    <div className="flex flex-wrap items-center gap-2">
      <input className={`${fieldClass} min-w-[200px] flex-1`} aria-label="Search payer, phone, transaction or request number" placeholder="Search payer, reference, transaction or request #" value={filters.search} onChange={e => changeFilter('search', e.target.value)} />
      <input className={`${fieldClass} w-auto`} type="date" aria-label="From date" value={filters.from} onChange={e => changeFilter('from', e.target.value)} />
      <span aria-hidden="true" className="text-slate-400">–</span>
      <input className={`${fieldClass} w-auto`} type="date" aria-label="To date" value={filters.to} onChange={e => changeFilter('to', e.target.value)} />
      <select className={`${fieldClass} w-auto`} aria-label="Filter provider" value={filters.provider} onChange={e => changeFilter('provider', e.target.value)}><option value="">All providers</option>{Object.entries(providers).map(([key,name]) => <option key={key} value={key}>{name}</option>)}</select>
      <select className={`${fieldClass} w-auto`} aria-label="Filter currency" value={filters.currency} onChange={e => changeFilter('currency', e.target.value)}><option value="">All currencies</option>{currencies.map(c => <option key={c}>{c}</option>)}</select>
      <input className={`${fieldClass} w-auto`} aria-label="Filter account" placeholder="Account" value={filters.account} onChange={e => changeFilter('account', e.target.value)} />
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <select className={`${fieldClass} w-auto`} aria-label="Sort receipts" value={filters.sort} onChange={e=>changeFilter('sort',e.target.value)}><option value="date-desc">Received date: newest first</option><option value="date-asc">Received date: oldest first</option><option value="amount-desc">Amount: highest first</option><option value="amount-asc">Amount: lowest first</option><option value="payer-asc">Payer: A–Z</option></select>
      <button className={buttonClass} onClick={() => setFilters(defaultFilters)}>Clear filters</button><button className={buttonClass} disabled={loading} onClick={() => void load()}>Refresh</button>
    </div>
    {isBookingReview && <div className="rounded-lg border border-blue-200 bg-blue-50 p-4"><h2 className="font-semibold">Booking review</h2><p className="mt-1 text-sm">Reconciled receipts without a valid booking allocation. Review the client, request and any existing bookings before creating a booking. Client-only payments may be for another purpose; standalone services are excluded.</p></div>}
    <p className="text-xs text-slate-500">Logged receipts only—not a bank balance. Totals use the date, provider, account, currency and search filters across all pages, independently of the status tab. Excluded receipts are shown separately.</p>
    {listError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-900">{listError} {snapshot ? 'Previous snapshot shown below; it may not match the current filters.' : 'No snapshot available.'}</p>}
    {loading && <p role="status">Loading receipts…</p>}
    {snapshot && <div className={loading || listError ? 'opacity-60' : ''}><p className="mb-2 text-xs text-slate-500">Last successful refresh: {new Date(snapshot.refreshedAt).toLocaleString()}</p>
      <div className="mb-4 overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[520px] text-left text-sm"><caption className="sr-only">Totals by currency and status</caption><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Totals</th><th className="px-3 py-2 text-right">Logged</th><th className="px-3 py-2 text-right">Unassigned</th><th className="px-3 py-2 text-right">Converted / linked</th><th className="px-3 py-2 text-right">Excluded</th></tr></thead><tbody className="divide-y divide-slate-100">{currencies.filter(c => snapshot.totals.some(t => t.currency === c)).map(c => <tr key={c}><th scope="row" className="px-3 py-2 font-semibold">{c}</th>{(['logged','unassigned','converted','excluded'] as const).map(status => { const total = snapshot.totals.find(t => t.currency === c && t.status === status); return <td key={status} className="px-3 py-2 text-right"><span className="text-slate-500">({total?.count || 0})</span> <strong>{total?.amount || '0.00'}</strong></td>; })}</tr>)}</tbody></table></div>
      <div className="mb-4 flex flex-wrap gap-4 border-b border-slate-200 text-sm" role="group" aria-label="Receipt status">{([['unassigned','Unassigned'],['converted','Converted / linked'],['booking-review','Booking review'],['excluded','Excluded'],['all','All']] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={filters.status === value} onClick={() => changeFilter('status', value)} className={`-mb-px border-b-2 px-1 pb-2 font-medium ${filters.status === value ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{label}</button>)}</div>
      <div className="overflow-x-auto rounded-xl border border-slate-200"><table aria-label="Receipts" className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['Received date','Payer / reference','Provider','Amount','Request','Status',...(isBookingReview ? ['Booking review'] : []),'Actions'].map(label=><th className="px-4 py-3" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-200">{snapshot.items.map(row=><tr key={row._id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-4 py-4">{row.receivedDate}</td><td className="max-w-[220px] break-words px-4 py-4"><Link className="font-medium text-slate-900 hover:underline" to={`${base}/${row._id}${location.search}`}>{row.payer || 'Payer unknown'}</Link><p className="text-xs text-slate-500">{row.reference || 'No reference'}</p>{row.externalId && <p className="text-xs text-slate-500">{row.externalId}</p>}</td><td className="max-w-[160px] break-words px-4 py-4">{providers[row.provider]}<p className="text-xs text-slate-500">{row.account}</p></td><td className="whitespace-nowrap px-4 py-4 font-semibold">{row.amount} {row.currency}</td><td className="px-4 py-4">{isBookingReview ? (row.bookingReview?.request ? `#${row.bookingReview.request.invoiceNumber || row.bookingReview.request.display_id || row.bookingReview.request._id}` : 'No linked request') : row.requestNumber || '—'}</td><td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{row.reconciliationPending ? 'Pending' : row.status === 'converted' ? 'Linked' : row.status}</span>{row.paymentMissing && <p className="text-xs text-red-800">Linked payment removed</p>}</td>{isBookingReview && <td className="min-w-[280px] max-w-[400px] px-4 py-4"><strong>{row.bookingReview?.label || 'Review booking'}</strong>{row.bookingReview?.client && <p className="text-sm">{[row.bookingReview.client.firstName,row.bookingReview.client.lastName].filter(Boolean).join(' ')}</p>}<p className="my-2 text-xs text-slate-600">{row.bookingReview?.message}</p><div className="flex flex-wrap gap-2 text-sm">{row.bookingReview?.request && <Link className="text-blue-700 underline" to={`/admin/payment-requests/${row.bookingReview.request._id}`}>Review request</Link>}{row.bookingReview?.client && <Link className="text-blue-700 underline" to={`/admin/clients/${row.bookingReview.client._id}`}>Review client</Link>}{row.bookingReview?.client && <Link className="text-blue-700 underline" to={clientBookingsPath(row.bookingReview.client._id)}>Client bookings</Link>}{row.bookingReview?.bookings.map(booking=><Link key={booking._id} className="text-blue-700 underline" to={`/admin/bookings/${booking._id}`}>Booking #{booking.bookingNumber || booking._id} · {booking.status}</Link>)}</div></td>}<td className="px-4 py-4"><div className="flex gap-2"><Link aria-label={`View receipt ${row.payer || row._id}`} title="View receipt" className="rounded-lg border p-2" to={`${base}/${row._id}${location.search}`}><Eye size={16}/></Link><button aria-label={`Edit receipt ${row.payer || row._id}`} title={row.status === 'converted' ? 'Correct received date' : row.status !== 'unassigned' || row.reconciliationPending ? 'Financial fields are locked' : 'Edit receipt'} className="rounded-lg border p-2 disabled:opacity-40" disabled={(row.status !== 'unassigned' && row.status !== 'converted') || row.reconciliationPending || row.paymentMissing} onClick={()=>navigateTo(`${base}/${row._id}/edit`)}><Pencil size={16}/></button><button aria-label={`Match receipt ${row.payer || row._id}`} title="Match receipt" className="rounded-lg border p-2 disabled:opacity-40" disabled={row.status !== 'unassigned' || busy || loading} onClick={async()=>{await open(row._id);setMatching(true);}}><Link2 size={16}/></button></div></td></tr>)}</tbody></table></div>
      {!snapshot.items.length && !loading && !listError && <p className="py-6 text-center text-slate-600">{isBookingReview ? 'No reconciled receipts need booking review in these filters.' : 'No receipts match this view. Record received money or adjust the filters.'}</p>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">{snapshot.total} matching receipts · Page {snapshot.page}</p><div className="flex gap-2"><button className={buttonClass} disabled={page <= 1 || loading || Boolean(listError)} onClick={() => setPage(v => v - 1)}>Previous page</button><button className={buttonClass} disabled={page * snapshot.limit >= snapshot.total || loading || Boolean(listError)} onClick={() => setPage(v => v + 1)}>Next page</button></div></div>
    </div>}
    </section></>}
  </main>;
}
