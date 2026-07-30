import React, { FormEvent, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { referralsApi } from '../services/api';
import { Referral } from '../types';

const empty = { name: '', defaultCommissionPercentage: 0, email: '', phone: '', notes: '', isActive: true };

const ReferralsPage: React.FC = () => {
  const [rows, setRows] = useState<Referral[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState('');
  const [error, setError] = useState('');
  const load = async () => {
    try { setRows((await referralsApi.getAll()).data || []); } catch (e: any) { setError(e?.response?.data?.message || 'Could not load referrals.'); }
  };
  useEffect(() => { void load(); }, []);
  const reset = () => { setForm(empty); setEditingId(''); setError(''); };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return setError('Referral name is required.');
    try {
      if (editingId) await referralsApi.update(editingId, form);
      else await referralsApi.create(form);
      reset();
      await load();
    } catch (e: any) { setError(e?.response?.data?.message || 'Could not save referral.'); }
  };
  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-5"><h1 className="text-3xl font-black text-slate-950">Referrals</h1><p className="text-slate-500">Manage the people and partners who refer clients.</p></div>
      {error && <div className="mb-4 rounded-xl bg-red-50 p-3 font-semibold text-red-700">{error}</div>}
      <form onSubmit={save} className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">{editingId ? 'Edit referral' : 'Add referral'}</h2>{editingId && <button type="button" onClick={reset} className="rounded-lg p-2"><X size={20} /></button>}</div>
        <div className="grid gap-3 md:grid-cols-4">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name *" className="min-h-12 rounded-xl border border-slate-300 px-3" required />
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="min-h-12 rounded-xl border border-slate-300 px-3" />
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="min-h-12 rounded-xl border border-slate-300 px-3" />
          <label className="text-sm font-semibold text-slate-700">Base commission %
            <input type="number" min="0" max="100" step="0.01" value={form.defaultCommissionPercentage} onChange={(e) => setForm({ ...form, defaultCommissionPercentage: Number(e.target.value) })} className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base font-normal" />
          </label>
        </div>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className="mt-3 min-h-20 w-full rounded-xl border border-slate-300 p-3" />
        <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
        <button className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-600 px-5 font-bold text-white"><Plus size={19} />{editingId ? 'Save changes' : 'Add referral'}</button>
      </form>
      <div className="space-y-3">
        {rows.map((row) => <div key={row._id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div><div className="text-lg font-bold text-slate-950">{row.name} {row.isActive === false && <span className="text-sm font-semibold text-slate-400">Inactive</span>}</div><div className="text-sm text-slate-500">{[row.email, row.phone].filter(Boolean).join(' · ') || 'No contact details'} · {Number(row.defaultCommissionPercentage || 0)}% base commission</div>{row.notes && <div className="mt-1 text-sm text-slate-700">{row.notes}</div>}</div>
          <div className="flex gap-2">
            <button onClick={() => { setEditingId(row._id || ''); setForm({ name: row.name, defaultCommissionPercentage: Number(row.defaultCommissionPercentage || 0), email: row.email || '', phone: row.phone || '', notes: row.notes || '', isActive: row.isActive !== false }); }} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-100 px-4 font-bold"><Pencil size={17} />Edit</button>
            <button onClick={async () => { if (row._id && window.confirm(`Delete referral “${row.name}”? Existing clients will keep the referral name.`)) { await referralsApi.delete(row._id); await load(); } }} className="flex min-h-11 items-center gap-2 rounded-xl bg-red-50 px-4 font-bold text-red-700"><Trash2 size={17} />Delete</button>
          </div>
        </div>)}
        {!rows.length && <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">No referrals yet.</div>}
      </div>
    </div>
  );
};
export default ReferralsPage;
