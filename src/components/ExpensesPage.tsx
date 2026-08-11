import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, Pencil, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { expenseTypesApi, retreatExpensesApi, retreatsApi } from '../services/api';
import { ExpenseType, Retreat, RetreatExpense } from '../types';
import LoadingSpinner from './LoadingSpinner';

const idOf = (value: any) => typeof value === 'object' ? value?._id || '' : String(value || '');

const retreatLabel = (value: any, retreats: Retreat[]) => {
  if (!value) return 'General';
  if (typeof value === 'object') return value.code || value.retreatCode || value.name || 'Retreat';
  const retreat = retreats.find((item) => item._id === value || item.code === value || item.retreatCode === value);
  return retreat?.code || retreat?.retreatCode || retreat?.name || value;
};
const typeLabel = (value: string | ExpenseType, types: ExpenseType[]) => {
  if (typeof value === 'object') return value.name;
  return types.find((item) => item._id === value)?.name || 'Uncategorized';
};
const money = (expense: RetreatExpense) => new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: expense.currency,
}).format(expense.amount);
const date = (value: Date | string) => new Date(value).toLocaleDateString();

const ExpensesPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefix = `/${location.pathname.split('/').filter(Boolean)[0] || 'admin'}`;
  const [expenses, setExpenses] = useState<RetreatExpense[]>([]);
  const [types, setTypes] = useState<ExpenseType[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<RetreatExpense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [expenseResponse, typeResponse, retreatResponse] = await Promise.all([
        retreatExpensesApi.getAll(),
        expenseTypesApi.getAll(),
        retreatsApi.getAll(),
      ]);
      setExpenses(expenseResponse.data || []);
      setTypes(typeResponse.data || []);
      setRetreats(retreatResponse.data || []);
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Could not load expenses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...expenses].sort((a, b) => {
      const createdDifference = new Date(b.createdAt || b.expenseDate).getTime() - new Date(a.createdAt || a.expenseDate).getTime();
      return createdDifference || new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime();
    });
    return sorted.filter((expense) => {
      if (quickFilter === 'week' && Date.now() - new Date(expense.expenseDate).getTime() > 7 * 86400000) return false;
      if (quickFilter.startsWith('type:') && idOf(expense.expenseTypeId) !== quickFilter.slice(5)) return false;
      if (!needle) return true;
      return [
      expense.vendor,
      expense.description,
      expense.currency,
      expense.status,
      typeLabel(expense.expenseTypeId, types),
      retreatLabel(expense.retreatId, retreats),
      ].some((value) => String(value || '').toLowerCase().includes(needle));
    });
  }, [expenses, query, quickFilter, retreats, types]);

  const totalUsd = filtered.reduce((sum, expense) => sum + Number(expense.usd_amount || (expense.currency === 'USD' ? expense.amount : 0)), 0);
  const quickTypes = types.slice(0, 3);

  const open = (path: string) => navigate(`${prefix}${path}`);
  const confirmDelete = async () => {
    if (!deleteTarget?._id || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await retreatExpensesApi.delete(deleteTarget._id);
      setExpenses((current) => current.filter((expense) => expense._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (deleteError: any) {
      setError(deleteError?.response?.data?.message || 'Could not delete this expense.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading expenses..." />;

  return (
    <div className="mx-auto max-w-7xl px-0 pb-24 pt-2 sm:px-2 md:pb-4">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Expenses</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">{filtered.length} item{filtered.length === 1 ? '' : 's'}{totalUsd > 0 ? ` · $${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD total` : ''}</p>
        </div>
        <button type="button" aria-label="Expense filters" className="mt-1 rounded-xl p-3 text-cyan-700 hover:bg-cyan-50"><SlidersHorizontal size={23} /></button>
        <button type="button" onClick={() => open('/expenses/new')} className="hidden min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 text-base font-bold text-white shadow-sm hover:bg-cyan-700 md:flex">
          <Plus size={21} /> Add expense
        </button>
      </div>

      {error && <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}

      <label className="mb-4 flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-100">
        <Search size={20} className="text-slate-500" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search expenses" className="w-full border-0 bg-transparent text-base outline-none" />
      </label>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {[{ id: 'all', label: 'All' }, { id: 'week', label: 'This week' }, ...quickTypes.map((type) => ({ id: `type:${type._id}`, label: type.name }))].map((filter) => (
          <button key={filter.id} type="button" onClick={() => setQuickFilter(filter.id)} className={`whitespace-nowrap rounded-lg border px-4 py-2.5 text-sm font-bold transition ${quickFilter === filter.id ? 'border-cyan-600 bg-cyan-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-300'}`}>{filter.label}</button>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
            <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Item</th><th className="px-4 py-3">Vendor</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Retreat</th><th className="px-4 py-3 text-right">Price</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((expense) => (
              <tr key={expense._id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3">{date(expense.expenseDate)}</td>
                <td className="max-w-xs truncate px-4 py-3 font-semibold">{expense.description || 'Expense'}</td>
                <td className="px-4 py-3">{expense.vendor || '—'}</td>
                <td className="px-4 py-3">{typeLabel(expense.expenseTypeId, types)}</td>
                <td className="px-4 py-3">{retreatLabel(expense.retreatId, retreats)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-base font-bold">{money(expense)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button aria-label="View expense" onClick={() => open(`/expenses/${expense._id}`)} className="rounded-lg p-2 text-blue-700 hover:bg-blue-50"><Eye size={19} /></button>
                    <button aria-label="Edit expense" onClick={() => open(`/expenses/${expense._id}/edit`)} className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"><Pencil size={19} /></button>
                    <button aria-label="Delete expense" onClick={() => setDeleteTarget(expense)} className="rounded-lg p-2 text-red-700 hover:bg-red-50"><Trash2 size={19} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-200 border-y border-slate-200 md:hidden">
        {filtered.map((expense) => (
          <article key={expense._id} className="bg-white py-4">
            <button type="button" onClick={() => open(`/expenses/${expense._id}`)} className="w-full text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><div className="truncate text-lg font-extrabold text-slate-950">{expense.description || 'Expense'}</div><div className="mt-1 truncate text-sm text-slate-500">{expense.vendor || 'No vendor'} · {typeLabel(expense.expenseTypeId, types)}</div></div>
                <div className="whitespace-nowrap text-lg font-extrabold text-slate-950">{money(expense)}</div>
              </div>
              <div className="mt-2 flex justify-between text-xs font-semibold uppercase tracking-wide text-slate-400"><span>{date(expense.expenseDate)}</span><span>{retreatLabel(expense.retreatId, retreats)}</span></div>
            </button>
          </article>
        ))}
      </div>

      <button type="button" onClick={() => open('/expenses/new')} className="fixed bottom-4 left-4 right-4 z-30 flex min-h-14 items-center justify-center gap-2 rounded-xl bg-cyan-600 text-lg font-extrabold text-white shadow-lg md:hidden"><Plus size={22} /> Add expense</button>

      {filtered.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No expenses found.</div>}

      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="delete-expense-title">
          <div className="w-full rounded-t-2xl bg-white p-5 sm:max-w-md sm:rounded-2xl">
            <h2 id="delete-expense-title" className="text-xl font-bold text-slate-950">Delete expense?</h2>
            <p className="mt-2 text-slate-600">This will permanently delete <strong>{deleteTarget.description || deleteTarget.vendor || money(deleteTarget)}</strong>.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} className="min-h-12 rounded-xl border border-slate-300 font-bold">Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={deleting} className="min-h-12 rounded-xl bg-red-600 font-bold text-white">{deleting ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpensesPage;
