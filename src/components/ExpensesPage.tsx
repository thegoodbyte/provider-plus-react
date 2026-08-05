import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { expenseTypesApi, retreatExpensesApi, retreatsApi } from '../services/api';
import { ExpenseType, Retreat, RetreatExpense } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { expenseCategoryName } from '../utils/expenseCategory';

const retreatLabel = (value: any, retreats: Retreat[]) => {
  if (!value) return 'General';
  if (typeof value === 'object') return value.code || value.retreatCode || value.name || 'Retreat';
  const retreat = retreats.find((item) => item._id === value || item.code === value || item.retreatCode === value);
  return retreat?.code || retreat?.retreatCode || retreat?.name || value;
};
const typeLabel = (value: string | ExpenseType, types: ExpenseType[]) => {
  if (typeof value === 'object') return expenseCategoryName(value);
  return expenseCategoryName(types.find((item) => item._id === value));
};
const money = (expense: RetreatExpense) => new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: expense.currency,
}).format(expense.amount);
const date = (value: Date | string) => new Date(value).toLocaleDateString();
const entityId = (value: any) => typeof value === 'object' ? String(value?._id || '') : String(value || '');

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
  const [retreatFilter, setRetreatFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [currencyFilter, setCurrencyFilter] = useState('all');
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
    const sorted = [...expenses].sort((a, b) =>
      new Date(b.createdAt || b.expenseDate).getTime() - new Date(a.createdAt || a.expenseDate).getTime());
    return sorted.filter((expense) => {
      const retreatId = entityId(expense.retreatId);
      const categoryId = entityId(expense.expenseTypeId);
      const kind = expense.expenseKind || (expense.status === 'planned' ? 'planned' : 'actual');
      const matchesSearch = !needle || [
        expense.vendor,
        expense.description,
        expense.currency,
        expense.status,
        typeLabel(expense.expenseTypeId, types),
        retreatLabel(expense.retreatId, retreats),
      ].some((value) => String(value || '').toLowerCase().includes(needle));
      const matchesRetreat = retreatFilter === 'all'
        || (retreatFilter === '__general__' ? !retreatId : retreatId === retreatFilter);

      return matchesSearch
        && matchesRetreat
        && (categoryFilter === 'all' || categoryId === categoryFilter)
        && (statusFilter === 'all' || expense.status === statusFilter)
        && (kindFilter === 'all' || kind === kindFilter)
        && (currencyFilter === 'all' || expense.currency === currencyFilter);
    });
  }, [categoryFilter, currencyFilter, expenses, kindFilter, query, retreatFilter, retreats, statusFilter, types]);

  const hasFilters = Boolean(query.trim())
    || retreatFilter !== 'all'
    || categoryFilter !== 'all'
    || statusFilter !== 'all'
    || kindFilter !== 'all'
    || currencyFilter !== 'all';

  const clearFilters = () => {
    setQuery('');
    setRetreatFilter('all');
    setCategoryFilter('all');
    setStatusFilter('all');
    setKindFilter('all');
    setCurrencyFilter('all');
  };

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
    <div className="mx-auto max-w-7xl px-0 py-2 sm:px-2">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Expenses</h1>
          <p className="text-sm text-slate-600">{filtered.length} item{filtered.length === 1 ? '' : 's'}</p>
        </div>
        <button type="button" onClick={() => open('/expenses/new')} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-base font-bold text-white shadow-sm">
          <Plus size={21} /> Add expense
        </button>
      </div>

      {error && <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3">
        <div className="grid gap-2 md:grid-cols-[minmax(240px,1.7fr)_repeat(5,minmax(130px,1fr))]">
          <label className="flex min-h-12 items-center gap-2 rounded-lg border border-slate-300 px-3">
            <Search size={20} className="shrink-0 text-slate-500" />
            <span className="sr-only">Search expenses</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search expenses" className="w-full border-0 bg-transparent text-base outline-none" />
          </label>
          <select value={retreatFilter} onChange={(event) => setRetreatFilter(event.target.value)} aria-label="Filter expenses by retreat" className="min-h-12 rounded-lg border border-slate-300 bg-white px-3 font-medium">
            <option value="all">All retreats</option>
            <option value="__general__">Company / no retreat</option>
            {retreats.map((retreat) => <option key={retreat._id} value={retreat._id}>{retreatLabel(retreat, retreats)}</option>)}
          </select>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter expenses by category" className="min-h-12 rounded-lg border border-slate-300 bg-white px-3 font-medium">
            <option value="all">All categories</option>
            {types.map((type) => <option key={type._id} value={type._id}>{expenseCategoryName(type)}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter expenses by status" className="min-h-12 rounded-lg border border-slate-300 bg-white px-3 font-medium">
            <option value="all">All statuses</option>
            <option value="planned">Planned</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
          </select>
          <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)} aria-label="Filter planned or actual expenses" className="min-h-12 rounded-lg border border-slate-300 bg-white px-3 font-medium">
            <option value="all">Planned + actual</option>
            <option value="actual">Actual</option>
            <option value="planned">Planned</option>
          </select>
          <select value={currencyFilter} onChange={(event) => setCurrencyFilter(event.target.value)} aria-label="Filter expenses by currency" className="min-h-12 rounded-lg border border-slate-300 bg-white px-3 font-medium">
            <option value="all">All currencies</option>
            {['CZK', 'EUR', 'PLN', 'USD'].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
          </select>
        </div>
        <div className="mt-2 flex min-h-6 items-center justify-between text-sm text-slate-500">
          <span>{filtered.length} of {expenses.length} expenses</span>
          {hasFilters && <button type="button" onClick={clearFilters} className="font-bold text-blue-700 hover:text-blue-900">Clear filters</button>}
        </div>
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

      <div className="grid gap-2 md:hidden">
        {filtered.map((expense) => (
          <article key={expense._id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <button type="button" onClick={() => open(`/expenses/${expense._id}`)} className="w-full text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><div className="truncate text-lg font-bold">{expense.description || 'Expense'}</div><div className="text-sm text-slate-600">{expense.vendor || 'No vendor'} · {typeLabel(expense.expenseTypeId, types)}</div></div>
                <div className="whitespace-nowrap text-lg font-extrabold">{money(expense)}</div>
              </div>
              <div className="mt-2 flex justify-between text-sm text-slate-500"><span>{date(expense.expenseDate)}</span><span>{retreatLabel(expense.retreatId, retreats)}</span></div>
            </button>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
              <button onClick={() => open(`/expenses/${expense._id}`)} className="min-h-11 rounded-lg bg-blue-50 font-semibold text-blue-700">View</button>
              <button onClick={() => open(`/expenses/${expense._id}/edit`)} className="min-h-11 rounded-lg bg-slate-100 font-semibold text-slate-700">Edit</button>
              <button onClick={() => setDeleteTarget(expense)} className="min-h-11 rounded-lg bg-red-50 font-semibold text-red-700">Delete</button>
            </div>
          </article>
        ))}
      </div>

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
