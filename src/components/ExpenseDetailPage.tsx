import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Image, Pencil } from 'lucide-react';
import { retreatExpensesApi } from '../services/api';
import { RetreatExpense } from '../types';
import LoadingSpinner from './LoadingSpinner';

const ExpenseDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const prefix = `/${location.pathname.split('/').filter(Boolean)[0] || 'admin'}`;
  const [expense, setExpense] = useState<RetreatExpense | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!id) return;
    retreatExpensesApi.getOne(id).then((response) => setExpense(response.data)).catch((loadError) => setError(loadError?.response?.data?.message || 'Expense not found.'));
  }, [id]);
  if (!expense && !error) return <LoadingSpinner message="Loading expense..." />;
  if (error) return <div className="rounded-xl bg-red-50 p-5 font-semibold text-red-700">{error}</div>;
  if (!expense) return null;
  const type = typeof expense.expenseTypeId === 'object' ? expense.expenseTypeId.name : expense.expenseTypeId;
  const retreat = typeof expense.retreatId === 'object' ? expense.retreatId.code || expense.retreatId.retreatCode || expense.retreatId.name : expense.retreatId || 'General company expense';
  const amount = new Intl.NumberFormat(undefined, { style: 'currency', currency: expense.currency }).format(expense.amount);
  const rows = [['Date', new Date(expense.expenseDate).toLocaleDateString()], ['Item', expense.description || '—'], ['Vendor', expense.vendor || '—'], ['Category', type], ['Retreat', retreat], ['Status', expense.status], ['Created', expense.createdAt ? new Date(expense.createdAt).toLocaleString() : '—']];
  return (
    <div className="mx-auto max-w-2xl px-0 py-1">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button onClick={() => navigate(`${prefix}/expenses`)} className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100" aria-label="Back"><ArrowLeft /></button>
        <button onClick={() => navigate(`${prefix}/expenses/${id}/edit`)} className="flex min-h-12 items-center gap-2 rounded-xl bg-blue-600 px-5 font-bold text-white"><Pencil size={19} /> Edit</button>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="border-b border-slate-200 pb-4"><div className="text-sm font-bold uppercase tracking-wide text-slate-500">Expense</div><h1 className="mt-1 text-2xl font-extrabold text-slate-950">{expense.description || expense.vendor || 'Expense'}</h1><div className="mt-2 text-3xl font-black text-blue-700">{amount}</div></div>
        <dl className="divide-y divide-slate-100">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[110px_1fr] gap-3 py-3"><dt className="font-semibold text-slate-500">{label}</dt><dd className="break-words font-semibold text-slate-900">{value}</dd></div>)}</dl>
        {expense.receiptS3Key && id && (
          <button
            type="button"
            onClick={async () => {
              try {
                const response = await retreatExpensesApi.getReceiptUrl(id);
                window.open(response.data.url, '_blank', 'noopener,noreferrer');
              } catch (receiptError: any) {
                setError(receiptError?.response?.data?.message || 'Could not open the receipt.');
              }
            }}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-50 font-bold text-blue-700"
          >
            <Image size={20} /> View receipt{expense.receiptFileName ? ` · ${expense.receiptFileName}` : ''}
          </button>
        )}
      </div>
    </div>
  );
};

export default ExpenseDetailPage;
