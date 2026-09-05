import React, { useEffect, useMemo, useState } from 'react';
import { Check as FiCheck, Clipboard as FiClipboard, Edit2 as FiEdit2, ExternalLink as FiExternalLink, Plus as FiPlus, RefreshCw as FiRefreshCw, X as FiX } from 'lucide-react';
import { revolutPaymentLinksApi, RevolutPaymentLink } from '../services/api';

const emptyForm = { name: '', checkoutUrl: '', amount: '3400', currency: 'PLN', paymentLimit: '100', observedPaymentCount: '0', paymentCountOverride: '', status: 'active', notes: '' };

const RevolutPaymentLinksPage: React.FC = () => {
  const [links, setLinks] = useState<RevolutPaymentLink[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try { setLinks((await revolutPaymentLinksApi.list()).data || []); }
    catch (e: any) { setError(e?.response?.data?.message || 'Unable to load Revolut payment links.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const summary = useMemo(() => links.reduce((out, link) => ({
    links: out.links + 1,
    payments: out.payments + link.effectivePaymentCount,
    remaining: out.remaining + (link.remainingPayments || 0),
  }), { links: 0, payments: 0, remaining: 0 }), [links]);

  const edit = (link: RevolutPaymentLink) => {
    setEditing(link._id); setShowForm(true); setError('');
    setForm({ name: link.name, checkoutUrl: link.checkoutUrl, amount: String(link.amount), currency: link.currency, paymentLimit: link.paymentLimit == null ? '' : String(link.paymentLimit), observedPaymentCount: String(link.observedPaymentCount), paymentCountOverride: link.paymentCountOverride == null ? '' : String(link.paymentCountOverride), status: link.status, notes: link.notes || '' });
  };
  const close = () => { setEditing(null); setShowForm(false); setForm(emptyForm); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    const payload = { ...form, amount: Number(form.amount), paymentLimit: form.paymentLimit === '' ? null : Number(form.paymentLimit), observedPaymentCount: Number(form.observedPaymentCount), paymentCountOverride: form.paymentCountOverride === '' ? null : Number(form.paymentCountOverride) };
    try { editing ? await revolutPaymentLinksApi.update(editing, payload) : await revolutPaymentLinksApi.create(payload); close(); await load(); }
    catch (e: any) { const message = e?.response?.data?.message; setError(Array.isArray(message) ? message.join(' ') : message || 'Unable to save the payment link.'); }
    finally { setSaving(false); }
  };
  const copy = async (link: RevolutPaymentLink) => { await navigator.clipboard.writeText(link.checkoutUrl); setCopied(link._id); window.setTimeout(() => setCopied(''), 1500); };

  return <div className="max-w-7xl mx-auto p-6 space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold tracking-widest text-indigo-600 uppercase">Payments</p><h1 className="text-3xl font-bold text-gray-900">Revolut payment-link catalog</h1><p className="mt-1 text-gray-600">Reusable fixed-price links and their payment capacity.</p></div>
      <div className="flex gap-2"><button onClick={() => void load()} className="inline-flex items-center gap-2 border rounded-lg px-4 py-2 bg-white"><FiRefreshCw /> Refresh</button><button onClick={() => { close(); setShowForm(true); }} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 bg-indigo-600 text-white"><FiPlus /> Add link</button></div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{[['Catalog links', summary.links], ['Effective payments', summary.payments], ['Known remaining uses', summary.remaining]].map(([label, value]) => <div key={label} className="bg-white border rounded-xl p-4"><div className="text-sm text-gray-500">{label}</div><div className="text-2xl font-bold text-gray-900">{value}</div></div>)}</div>
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><strong>Count source:</strong> update “Observed in Revolut” from the Revolut dashboard. An override replaces that number until you clear it. Automatic sync can be enabled later with Merchant API credentials.</div>
    {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700">{error}</div>}
    {showForm && <form onSubmit={save} className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex justify-between"><h2 className="font-bold text-xl">{editing ? 'Edit payment link' : 'Add payment link'}</h2><button type="button" onClick={close}><FiX /></button></div>
      <div className="grid md:grid-cols-2 gap-4"><label className="text-sm font-medium">Name<input required className="mt-1 w-full border rounded-lg p-2.5" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="3400 PLN payment" /></label><label className="text-sm font-medium">Revolut checkout URL<input required type="url" className="mt-1 w-full border rounded-lg p-2.5" value={form.checkoutUrl} onChange={e => setForm({ ...form, checkoutUrl: e.target.value })} placeholder="https://checkout.revolut.com/pay/..." /></label></div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <label className="text-sm font-medium">Amount<input required type="number" min="0" step="0.01" className="mt-1 w-full border rounded-lg p-2.5" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label>
        <label className="text-sm font-medium">Currency<select className="mt-1 w-full border rounded-lg p-2.5" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>{['PLN','EUR','CZK','USD'].map(c => <option key={c}>{c}</option>)}</select></label>
        <label className="text-sm font-medium">Payment limit<input type="number" min="1" className="mt-1 w-full border rounded-lg p-2.5" value={form.paymentLimit} onChange={e => setForm({ ...form, paymentLimit: e.target.value })} placeholder="No limit" /></label>
        <label className="text-sm font-medium">Observed in Revolut<input required type="number" min="0" className="mt-1 w-full border rounded-lg p-2.5" value={form.observedPaymentCount} onChange={e => setForm({ ...form, observedPaymentCount: e.target.value })} /></label>
        <label className="text-sm font-medium">Override count<input type="number" min="0" className="mt-1 w-full border rounded-lg p-2.5" value={form.paymentCountOverride} onChange={e => setForm({ ...form, paymentCountOverride: e.target.value })} placeholder="None" /></label>
      </div>
      <div className="grid md:grid-cols-2 gap-4"><label className="text-sm font-medium">Status<select className="mt-1 w-full border rounded-lg p-2.5" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{['active','paused','exhausted','archived'].map(s => <option key={s}>{s}</option>)}</select></label><label className="text-sm font-medium">Notes<input className="mt-1 w-full border rounded-lg p-2.5" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label></div>
      <div className="flex justify-end gap-2"><button type="button" onClick={close} className="border rounded-lg px-4 py-2">Cancel</button><button disabled={saving} className="rounded-lg px-4 py-2 bg-gray-900 text-white">{saving ? 'Saving…' : 'Save link'}</button></div>
    </form>}
    <div className="bg-white border rounded-2xl overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 text-left text-gray-500"><tr><th className="p-4">Link</th><th className="p-4">Price</th><th className="p-4">Payment count</th><th className="p-4">Capacity</th><th className="p-4">Status</th><th className="p-4 text-right">Actions</th></tr></thead><tbody className="divide-y">{links.map(link => { const pct = link.paymentLimit ? Math.min(100, link.effectivePaymentCount / link.paymentLimit * 100) : 0; return <tr key={link._id}><td className="p-4"><div className="font-semibold text-gray-900">{link.name}</div><div className="text-xs text-gray-500 font-mono">{link.externalId}</div></td><td className="p-4 font-semibold">{new Intl.NumberFormat(undefined,{style:'currency',currency:link.currency}).format(link.amount)}</td><td className="p-4"><div className="font-semibold">{link.effectivePaymentCount}{link.paymentLimit != null ? ` / ${link.paymentLimit}` : ''}{link.overrideActive && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">overridden</span>}</div><div className="text-xs text-gray-500">Observed: {link.observedPaymentCount}{link.paymentCountOverride != null ? ` · Override: ${link.paymentCountOverride}` : ''}</div></td><td className="p-4 min-w-[180px]"><div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500" style={{width:`${pct}%`}} /></div><div className="text-xs text-gray-500 mt-1">{link.remainingPayments == null ? 'Unlimited' : `${link.remainingPayments} remaining`}</div></td><td className="p-4 capitalize">{link.status}</td><td className="p-4"><div className="flex justify-end gap-2"><button title="Copy link" onClick={() => void copy(link)} className="border rounded-lg p-2">{copied === link._id ? <FiCheck /> : <FiClipboard />}</button><a title="Open link" href={link.checkoutUrl} target="_blank" rel="noreferrer" className="border rounded-lg p-2"><FiExternalLink /></a><button title="Edit" onClick={() => edit(link)} className="border rounded-lg p-2"><FiEdit2 /></button></div></td></tr>; })}{!loading && !links.length && <tr><td colSpan={6} className="p-10 text-center text-gray-500">No Revolut payment links yet. Add your first reusable link.</td></tr>}</tbody></table></div>{loading && <div className="p-10 text-center text-gray-500">Loading…</div>}</div>
  </div>;
};

export default RevolutPaymentLinksPage;
