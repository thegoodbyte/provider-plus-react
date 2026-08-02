import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, Save, X } from 'lucide-react';
import { expenseTypesApi, paymentMethodsApi, retreatExpensesApi, retreatsApi } from '../services/api';
import { ExpenseType, PaymentMethod, Retreat, RetreatExpense } from '../types';
import { expenseCategoryName } from '../utils/expenseCategory';
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
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [receipts, setReceipts] = useState<File[]>([]);
  const [existingReceiptNames, setExistingReceiptNames] = useState<string[]>([]);
  const [form, setForm] = useState({
    expenseDate: today(),
    amount: '',
    currency: 'CZK' as RetreatExpense['currency'],
    description: '',
    vendor: '',
    expenseTypeId: '',
    paymentMethodId: '',
    retreatId: '',
    status: 'pending' as RetreatExpense['status'],
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [typeResponse, paymentMethodResponse, retreatResponse, expenseResponse] = await Promise.all([
          expenseTypesApi.getAll(),
          paymentMethodsApi.getAll(),
          retreatsApi.getAll(),
          id ? retreatExpensesApi.getOne(id) : Promise.resolve({ data: null }),
        ]);
        const loadedTypes = (typeResponse.data || []).filter((type) => type.isActive !== false);
        const loadedRetreats = retreatResponse.data || [];
        setTypes(loadedTypes);
        setPaymentMethods(paymentMethodResponse.data || []);
        setRetreats(loadedRetreats);
        if (expenseResponse.data) {
          const expense = expenseResponse.data;
          setExistingReceiptNames(
            expense.receiptImages?.map((item) => item.fileName || 'Receipt image')
              || (expense.receiptFileName ? [expense.receiptFileName] : [])
          );
          setForm({
            expenseDate: new Date(expense.expenseDate).toISOString().slice(0, 10),
            amount: String(expense.amount),
            currency: expense.currency,
            description: expense.description || '',
            vendor: expense.vendor || '',
            expenseTypeId: idOf(expense.expenseTypeId),
            paymentMethodId: idOf(expense.paymentMethodId),
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
      expenseTypeId: form.expenseTypeId,
      paymentMethodId: form.paymentMethodId || undefined,
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
      if (receipts.length && expenseId) {
        await retreatExpensesApi.uploadReceipts(expenseId, receipts);
      }
      if (id) {
        navigate(`${prefix}/expenses/${id}`);
      } else {
        if (next) {
          setForm((current) => ({ ...current, amount: '', description: '', vendor: '' }));
          setReceipts([]);
          setExistingReceiptNames([]);
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

  const field = 'min-h-14 w-full rounded-xl border border-slate-300 bg-white px-3 text-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
  return (
    <div className="mx-auto max-w-2xl px-0 py-1">
      <div className="mb-3 flex items-center gap-3">
        <button type="button" onClick={() => navigate(`${prefix}/expenses`)} className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100" aria-label="Back to expenses"><ArrowLeft /></button>
        <div><h1 className="text-2xl font-extrabold text-slate-950">{editing ? 'Edit expense' : 'Add expense'}</h1><p className="text-sm text-slate-500">Actual expense</p></div>
      </div>
      {error && <div className="mb-3 rounded-xl bg-red-50 p-3 font-semibold text-red-700">{error}</div>}
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-base font-bold">Date</span><input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} className={field} required /></label>
          <div><span className="mb-1 block text-base font-bold">Price</span><div className="grid grid-cols-[1fr_105px] gap-2"><input ref={amountRef} type="number" inputMode="decimal" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={field} placeholder="0.00" required /><select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as RetreatExpense['currency'] })} className={field}><option>CZK</option><option>PLN</option><option>EUR</option><option>USD</option></select></div></div>
        </div>
        <label className="block"><span className="mb-1 block text-base font-bold">Item</span><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} placeholder="What did you buy?" /></label>
        <label className="block"><span className="mb-1 block text-base font-bold">Vendor</span><input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} className={field} placeholder="Store or supplier" /></label>
        <label className="block"><span className="mb-1 block text-base font-bold">Category</span><select value={form.expenseTypeId} onChange={(e) => setForm({ ...form, expenseTypeId: e.target.value })} className={field} required><option value="">Choose category</option>{types.map((type) => <option key={type._id} value={type._id}>{expenseCategoryName(type)}</option>)}</select></label>
        <label className="block"><span className="mb-1 block text-base font-bold">Payment method</span><select value={form.paymentMethodId} onChange={(e) => setForm({ ...form, paymentMethodId: e.target.value })} className={field}><option value="">Not specified</option>{paymentMethods.map((method) => <option key={method._id} value={method._id}>{method.name}</option>)}</select></label>
        <label className="block"><span className="mb-1 block text-base font-bold">Retreat</span><select value={form.retreatId} onChange={(e) => setForm({ ...form, retreatId: e.target.value })} className={field}><option value="">General company expense</option>{retreats.map((retreat) => <option key={retreat._id} value={retreat._id}>{retreat.code || retreat.retreatCode || retreat.name}</option>)}</select></label>
        <div className="rounded-xl border border-slate-300 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div><div className="text-base font-bold">Receipt images</div><div className="text-sm text-slate-500">Select multiple photos, maximum 10 MB each</div></div>
            {receipts.length > 0 && <button type="button" onClick={() => setReceipts([])} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Clear selected receipts"><X size={18} /></button>}
          </div>
          <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 px-4 font-bold text-blue-700">
            <Camera size={21} /> {receipts.length ? `${receipts.length} image${receipts.length === 1 ? '' : 's'} selected` : 'Add receipt photos'}
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(event) => setReceipts(Array.from(event.target.files || []))} />
          </label>
          {(existingReceiptNames.length > 0 || receipts.length > 0) && (
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {existingReceiptNames.map((name, index) => <li key={`existing-${index}`}>Saved: {name}</li>)}
              {receipts.map((file, index) => <li key={`${file.name}-${index}`}>New: {file.name}</li>)}
            </ul>
          )}
        </div>
        {editing && <label className="block"><span className="mb-1 block text-base font-bold">Status</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as RetreatExpense['status'] })} className={field}><option value="pending">Pending</option><option value="approved">Approved</option><option value="paid">Paid</option><option value="rejected">Rejected</option></select></label>}
        <div className={`sticky bottom-0 grid gap-2 border-t border-slate-200 bg-white py-3 ${editing ? 'grid-cols-2' : 'grid-cols-3'}`}>
          <button type="button" onClick={() => navigate(`${prefix}/expenses`)} disabled={saving} className="min-h-14 rounded-xl border border-slate-300 text-base font-bold">Cancel</button>
          {!editing && <button type="button" onClick={() => void save(true)} disabled={saving} className="min-h-14 rounded-xl bg-slate-800 px-2 text-base font-bold text-white">Add &amp; next</button>}
          <button type="submit" disabled={saving} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-blue-600 px-2 text-base font-bold text-white"><Save size={19} />{saving ? 'Saving…' : editing ? 'Save' : 'Add'}</button>
        </div>
      </form>
    </div>
  );
};

export default ExpenseEditorPage;
