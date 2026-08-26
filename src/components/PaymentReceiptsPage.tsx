import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { paymentsApi } from '../services/api';
import { PaymentReceipt, PaymentRequest } from '../types';
import LoadingSpinner from './LoadingSpinner';
import CurrencyDisplay from './CurrencyDisplay';
import { formatCalendarDate } from '../utils/dateFormat';

const Icon: React.FC<{ icon: any }> = ({ icon: Component }) => <Component className="h-4 w-4" />;

const PaymentReceiptsPage: React.FC = () => {
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    paymentsApi.getReceipts().then((response) => setReceipts(response.data || []))
      .catch(() => setError('Unable to load payment receipts.')).finally(() => setLoading(false));
  }, []);
  if (loading) return <LoadingSpinner message="Loading payment receipts..." />;
  return <div className="h-full p-6">
    <div className="mb-6 flex items-center gap-4"><button onClick={() => navigate('/admin/payments')} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"><Icon icon={FiArrowLeft} /> Back</button><div><h1 className="text-2xl font-semibold text-gray-900">Payment Receipts</h1><p className="text-sm text-gray-600">Actual received transactions and their booking allocation totals.</p></div></div>
    {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr>{['Received', 'Payer / reference', 'Payment request', 'Total received', 'Allocated', 'Allocations', 'Status'].map((label) => <th key={label} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{receipts.map((receipt) => {
      const request = typeof receipt.paymentRequestId === 'object' ? receipt.paymentRequestId as PaymentRequest : null;
      return <tr key={receipt._id} className="hover:bg-gray-50"><td className="px-5 py-4 text-sm text-gray-800">{formatCalendarDate(receipt.receivedDate)}</td><td className="px-5 py-4 text-sm"><strong className="block text-gray-900">{receipt.payerName || '—'}</strong><span className="text-gray-500">{receipt.transactionReference || receipt.transactionId || `Receipt ${receipt._id?.slice(-8)}`}</span></td><td className="px-5 py-4 text-sm text-gray-800">{request ? request.invoiceNumber || `#${request.display_id}` : receipt.paymentRequestId ? String(receipt.paymentRequestId).slice(-8) : '—'}</td><td className="px-5 py-4 text-sm font-semibold"><CurrencyDisplay amount={receipt.totalAmount} currency={receipt.currency} /></td><td className="px-5 py-4 text-sm"><CurrencyDisplay amount={receipt.allocatedAmount || 0} currency={receipt.currency} /></td><td className="px-5 py-4 text-sm text-gray-800">{receipt.allocationCount || 0}</td><td className="px-5 py-4"><span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">{receipt.status}</span></td></tr>;
    })}</tbody></table>{!receipts.length && <div className="p-8 text-center text-gray-500">No receipt-backed payments yet. Existing historical payments remain available in Payments.</div>}</div></div>
  </div>;
};

export default PaymentReceiptsPage;
