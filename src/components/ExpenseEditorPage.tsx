import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, X } from 'lucide-react';
import { expenseTypesApi, retreatExpensesApi, retreatsApi } from '../services/api';
import { ExpenseType, Retreat, RetreatExpense } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { getCurrentRetreatForDate } from './expensesQuickAdd';

const today = () => new Date().toISOString().slice(0, 10);
const idOf = (value: any) => typeof value === 'object' ? value?._id || '' : String(value || '');

const ExpenseEditorPage: React.FC = () => {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const prefix = `/${location.pathname.split('/').filter(Boolean)[0] || 'admin'}`;
  const amountRef = useRef<HTMLInputElement>(null);
  const [types, setTypes] = useState<ExpenseType[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [existingReceiptName, setExistingReceiptName] = useState('');
  const [form, setForm] = useState({
    expenseDate: today(),
    amount: '',
    currency: 'CZK' as RetreatExpense['currency'],
    description: '',
    vendor: '',
    paymentMethod: '' as '' | NonNullable<RetreatExpense['paymentMethod']>,
    paymentAccount: '',
    notes: '',
    expenseTypeId: '',
    retreatId: '',
    status: 'pending' as RetreatExpense['status'],
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [typeResponse, retreatResponse, expenseResponse] = await Promise.all([
          expenseTypesApi.getAll(),
          retreatsApi.getAll(),
          id ? retreatExpensesApi.getOne(id) : Promise.resolve({ data: null }),
        ]);
        const loadedTypes = (typeResponse.data || []).filter((type) => type.isActive !== false);
        const loadedRetreats = retreatResponse.data || [];
        setTypes(loadedTypes);
        setRetreats(loadedRetreats);
        if (expenseResponse.data) {
          const expense = expenseResponse.data;
          setExistingReceiptName(expense.receiptFileName || '');
          setForm({
            expenseDate: new Date(expense.expenseDate).toISOString().slice(0, 10),
            amount: String(expense.amount),
            currency: expense.currency,
            description: expense.description || '',
            vendor: expense.vendor || '',
            paymentMethod: expense.paymentMethod || '',
            paymentAccount: expense.paymentAccount || '',
            notes: expense.notes || '',
            expenseTypeId: idOf(expense.expenseTypeId),
            retreatId: idOf(expense.retreatId),
            status: expense.status,
          });
        } else {
          const suggested = getCurrentRetreatForDate(loadedRetreats, new Date());
          setForm((current) => ({ ...current, expenseTypeId: loadedTypes[0]?._id || '', retreatId: suggested?._id || '' }));
        }
      } catch (loadError: any) {
        setError(loadError?.response?.data?.message || 'Could not load the expense form.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  const save = async (next: boolean) => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      setError('Enter a valid price.');
      amountRef.current?.focus();
      return;
    }
    if (!form.expenseTypeId) {
      setError('Choose a category.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      expenseDate: form.expenseDate,
      amount,
      currency: form.currency,
      description: form.description.trim(),
      vendor: form.vendor.trim(),
      paymentMethod: form.paymentMethod || undefined,
      paymentAccount: form.paymentAccount.trim(),
      notes: form.notes.trim(),
      expenseTypeId: form.expenseTypeId,
      retreatId: form.retreatId || undefined,
      status: form.status,
      expenseKind: 'actual' as const,
    };
    try {
      let expenseId = id || '';
      if (id) {
        await retreatExpensesApi.update(id, payload);
      } else {
        const response = await retreatExpensesApi.create(payload as Omit<RetreatExpense, '_id'>);
        expenseId = response.data._id || '';
      }
      if (receipt && expenseId) {
        await retreatExpensesApi.uploadReceipt(expenseId, receipt);
      }
      if (id) {
        navigate(`${prefix}/expenses/${id}`);
      } else {
        if (next) {
          setForm((current) => ({ ...current, amount: '', description: '', vendor: '', paymentMethod: '', paymentAccount: '', notes: '' }));
          setReceipt(null);
          setExistingReceiptName('');
          amountRef.current?.focus();
        } else {
          navigate(`${prefix}/expenses/${expenseId}`);
        }
      }
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || 'Could not save this expense.');
    } finally {
      setSaving(false);
    }
  };

  const submit = (event: FormEvent) => { event.preventDefault(); void save(false); };
  if (loading) return <LoadingSpinner message="Loading expense..." />;

  const field = 'min-h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100';
  const setQuickDate = (daysAgo: number) => {
    const value = new Date();
    value.setDate(value.getDate() - daysAgo);
    setForm({ ...form, expenseDate: value.toISOString().slice(0, 10) });
  };
  return (
    <div className="mx-auto max-w-3xl px-0 pb-28 pt-1">
      <div className="mb-7 flex items-center gap-3">
        <button type="button" onClick={() => navigate(`${prefix}/expenses`)} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100" aria-label="Back to expenses"><ArrowLeft /></button>
        <div><h1 className="text-3xl font-extrabold tracking-tight text-slate-950">{editing ? 'Edit expense' : 'Add expense'}</h1><p className="mt-0.5 text-sm font-medium text-slate-500">Actual expense</p></div>
      </div>
      {error && <div className="mb-3 rounded-xl bg-red-50 p-3 font-semibold text-red-700">{error}</div>}
      <form onSubmit={submit} className="space-y-6">
        <section>
          <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Amount</span>
          <div className="flex items-end border-b-2 border-slate-900 pb-2">
            <span className="mb-2 mr-3 text-2xl font-bold text-slate-500">{form.currency === 'CZK' ? 'Kč' : form.currency === 'EUR' ? '€' : form.currency === 'PLN' ? 'zł' : '$'}</span>
            <input ref={amountRef} type="number" inputMode="decimal" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="min-w-0 flex-1 border-0 bg-transparent text-5xl font-extrabold tracking-tight text-slate-950 outline-none placeholder:text-slate-300" placeholder="0.00" required />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(['CZK', 'EUR', 'PLN', 'USD'] as RetreatExpense['currency'][]).map((currency) => <button key={currency} type="button" onClick={() => setForm({ ...form, currency })} className={`rounded-lg border px-4 py-2.5 text-sm font-extrabold ${form.currency === currency ? 'border-cyan-600 bg-cyan-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{currency}</button>)}
          </div>
        </section>

        <label className="block"><span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Item</span><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} placeholder="What did you buy?" /></label>
        <label className="block"><span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Vendor</span><input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} className={field} placeholder="Store or supplier" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Payment method</span><select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as typeof form.paymentMethod })} className={field}><option value="">Not specified</option><option value="card">Card</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></label>
          <label className="block"><span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Account</span><input list="expense-editor-account-options" value={form.paymentAccount} onChange={(e) => setForm({ ...form, paymentAccount: e.target.value })} className={field} placeholder="Revolut, CSOB, cash drawer…" /><datalist id="expense-editor-account-options"><option value="Revolut" /><option value="CSOB" /><option value="Cash drawer" /></datalist></label>
        </div>
        <label className="block"><span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Notes</span><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${field} min-h-28 py-3`} placeholder="Additional payment or expense details" /></label>
        <div><span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Category</span><div className="flex flex-wrap gap-2">{types.map((type) => <button type="button" key={type._id} onClick={() => setForm({ ...form, expenseTypeId: type._id || '' })} className={`rounded-lg border px-4 py-2.5 text-sm font-bold ${form.expenseTypeId === type._id ? 'border-cyan-600 bg-cyan-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{type.name}</button>)}</div></div>

        <div><span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Date</span><div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => setQuickDate(0)} className={`min-h-12 rounded-lg border font-bold ${form.expenseDate === today() ? 'border-cyan-600 bg-cyan-600 text-white' : 'border-slate-200 bg-white'}`}>Today</button><button type="button" onClick={() => setQuickDate(1)} className="min-h-12 rounded-lg border border-slate-200 bg-white font-bold">Yesterday</button><label className="relative flex min-h-12 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white font-bold"><span>Pick a date</span><input aria-label="Expense date" type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" required /></label></div></div>

        <label className="block"><span className="mb-1 block text-base font-bold">Retreat</span><select value={form.retreatId} onChange={(e) => setForm({ ...form, retreatId: e.target.value })} className={field}><option value="">General company expense</option>{retreats.map((retreat) => <option key={retreat._id} value={retreat._id}>{retreat.code || retreat.retreatCode || retreat.name}</option>)}</select></label>
        <div className="rounded-xl border border-slate-300 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div><div className="text-base font-bold">Receipt image</div><div className="text-sm text-slate-500">Photo or image, maximum 10 MB</div></div>
            {(receipt || existingReceiptName) && <button type="button" onClick={() => { setReceipt(null); setExistingReceiptName(''); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Clear selected receipt"><X size={18} /></button>}
          </div>
          <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 px-4 font-bold text-blue-700">
            <Camera size={21} /> {receipt ? receipt.name : existingReceiptName || 'Add receipt photo'}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => setReceipt(event.target.files?.[0] || null)} />
          </label>
        </div>
        {editing && <label className="block"><span className="mb-1 block text-base font-bold">Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as RetreatExpense['status'] })} className={field}><option value="pending">Pending</option><option value="approved">Approved</option><option value="paid">Paid</option><option value="rejected">Rejected</option></select></label>}
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:sticky md:px-0">
          <div className={`mx-auto grid max-w-3xl gap-2 ${editing ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <button type="submit" disabled={saving} className="min-h-14 rounded-xl bg-cyan-600 px-3 text-base font-extrabold text-white">{saving ? 'Saving…' : editing ? 'Save' : 'Add'}</button>
            {!editing && <button type="button" onClick={() => void save(true)} disabled={saving} className="min-h-14 rounded-xl border border-slate-300 bg-white px-3 text-base font-extrabold text-slate-800">Add &amp; next</button>}
          </div>
          <button type="button" onClick={() => navigate(`${prefix}/expenses`)} disabled={saving} className="mx-auto mt-2 block text-sm font-semibold text-slate-500">Cancel</button>
        </div>
      </form>
    </div>
  );
};

export default ExpenseEditorPage;
