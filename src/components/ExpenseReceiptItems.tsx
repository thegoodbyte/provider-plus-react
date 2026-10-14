import { message } from 'antd';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import React, { useEffect, useState } from 'react';
import { Alert, Button, Table } from 'antd';
import { retreatExpensesApi } from '../services/api';
import { ExpenseReceiptItemization } from '../types';

export default function ExpenseReceiptItems({ expenseId, currency }: { expenseId: string; currency: string }) {
  const [result, setResult] = useState<ExpenseReceiptItemization | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    const load = () => retreatExpensesApi.getDetailItems(expenseId).then(({ data }) => { if (!disposed) { setResult(data); setError(''); } }).catch(() => { if (!disposed) setError('Could not load receipt items.'); }).finally(() => { if (!disposed) setLoading(false); });
    void load();
    return () => { disposed = true; };
  }, [expenseId]);
  useEffect(() => {
    if (result?.status !== 'processing' || working) return;
    const timer = window.setInterval(() => { retreatExpensesApi.getDetailItems(expenseId).then(({ data }) => setResult(data)).catch(() => setError('Could not refresh receipt items.')); }, 10000);
    return () => window.clearInterval(timer);
  }, [expenseId, result?.status, working]);
  const money = (value: number | null, code = result?.summary?.currency) => value == null ? 'Not shown' : !code ? `${value.toFixed(2)} (currency not shown)` : new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(value);
  const busy = working || (result?.status === 'processing' && (!result.startedAt || Date.now() - new Date(result.startedAt).getTime() < 180000));
  const itemize = async () => {
    setWorking(true); setError('');
    try { setResult((await retreatExpensesApi.itemizeReceipt(expenseId)).data); }
    catch (err: any) { message.error(apiErrorMessage(err, 'Could not itemize this receipt.')); }
    finally { setWorking(false); }
  };
  return <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-label="Receipt items">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Receipt items</h2><Button onClick={itemize} loading={busy} disabled={loading}> {result?.items.length ? 'Re-itemize receipt' : 'Itemize receipt'} </Button></div>
    <p className="mb-3 text-sm text-slate-500">AI reads the receipt automatically on upload. Check the extracted details against the original receipt. This breakdown does not change the saved expense amount.</p>
    {busy && <p role="status">Reading receipt…</p>}
    {(error || result?.status === 'failed') && <Alert type="error" showIcon message={error || result?.error} className="mb-3" />}
    {result?.summary && <dl className="mb-4 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Paid by (on receipt)</dt><dd className="font-semibold">{result.summary.paymentMethod || 'Not shown'}</dd></div><div><dt className="text-slate-500">Receipt currency</dt><dd className="font-semibold">{result.summary.currency || 'Not shown'}</dd></div><div><dt className="text-slate-500">Receipt tax</dt><dd className="font-semibold">{money(result.summary.taxAmount)}</dd></div><div><dt className="text-slate-500">Printed receipt total</dt><dd className="font-semibold">{money(result.summary.totalAmount)}</dd></div><div><dt className="text-slate-500">Sum of items</dt><dd className="font-semibold">{money(result.summary.itemTotal)}</dd></div></dl>}
    {result?.summary?.warnings.map(warning => <Alert key={warning} type="warning" showIcon message={warning} className="mb-3" />)}
    <Table size="small" loading={loading} dataSource={result?.items || []} rowKey="_id" pagination={false} scroll={{ x: 650 }} locale={{ emptyText: busy ? 'Reading receipt…' : 'No items yet. Use Itemize receipt for an existing upload.' }} columns={[
      { title: 'Item', dataIndex: 'name' }, { title: 'Qty', dataIndex: 'quantity', render: value => value ?? '—' },
      { title: 'Unit price', dataIndex: 'unitPrice', render: value => money(value) }, { title: 'Price', dataIndex: 'amount', render: value => money(value) },
      { title: 'Tax', dataIndex: 'taxAmount', render: value => money(value) }, { title: 'Tax %', dataIndex: 'taxRate', render: value => value == null ? 'Not shown' : `${value}%` },
    ]} />
  </section>;
}
