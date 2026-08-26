import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiPlus, FiSave, FiTrash2 } from 'react-icons/fi';
import { bookingsApi, paymentRequestsApi, paymentsApi } from '../services/api';
import { Client, Payment, PaymentRequest, Retreat, RetreatClient } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { todayDateInputValue } from '../utils/dateFormat';

type Allocation = { bookingId: string; amount: string };
const Icon: React.FC<{ icon: any }> = ({ icon: IconComponent }) => <IconComponent className="h-4 w-4" />;
const blankAllocation = (): Allocation => ({ bookingId: '', amount: '' });
const clientName = (booking?: RetreatClient) => {
  const client = typeof booking?.clientId === 'object' ? booking.clientId as Client : null;
  return client ? `${client.firstName || ''} ${client.lastName || ''}`.trim() : 'Client';
};
const retreatName = (booking?: RetreatClient) => {
  const retreat = typeof booking?.retreatId === 'object' ? booking.retreatId as Retreat : null;
  return retreat?.retreatCode || retreat?.code || retreat?.name || 'Retreat';
};

const JointPaymentEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [bookings, setBookings] = useState<RetreatClient[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([blankAllocation(), blankAllocation()]);
  const [form, setForm] = useState({
    totalAmount: '', currency: 'EUR' as Payment['currency'], payerName: '', paymentDate: todayDateInputValue(),
    paymentMethod: 'bank_transfer' as Payment['paymentMethod'], paymentType: 'deposit_non_refundable' as Payment['paymentType'],
    transactionId: '', paymentRequestId: '', notes: '', status: 'completed' as 'pending' | 'completed' | 'failed',
  });

  useEffect(() => {
    Promise.all([bookingsApi.getAll(), paymentRequestsApi.getAll()])
      .then(([bookingResponse, requestResponse]) => {
        setBookings((bookingResponse.data || []).filter((booking: RetreatClient) => !['cancelled', 'checked-out'].includes(String(booking.status))));
        setRequests(requestResponse.data || []);
      })
      .catch(() => setError('Unable to load bookings and payment requests.'))
      .finally(() => setLoading(false));
  }, []);

  const allocatedTotal = useMemo(() => allocations.reduce((sum, allocation) => sum + (Number(allocation.amount) || 0), 0), [allocations]);
  const difference = (Number(form.totalAmount) || 0) - allocatedTotal;
  const updateAllocation = (index: number, changes: Partial<Allocation>) => setAllocations((current) => current.map((allocation, itemIndex) => itemIndex === index ? { ...allocation, ...changes } : allocation));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (allocations.length < 2 || allocations.some((allocation) => !allocation.bookingId || Number(allocation.amount) <= 0)) {
      setError('Select at least two bookings and enter a positive amount for each allocation.');
      return;
    }
    if (new Set(allocations.map((allocation) => allocation.bookingId)).size !== allocations.length) {
      setError('Each booking can appear only once.');
      return;
    }
    if (Math.abs(difference) > 0.005) {
      setError(`Allocations must exactly match the received total. Difference: ${difference.toFixed(2)} ${form.currency}.`);
      return;
    }
    try {
      setSaving(true);
      await paymentsApi.createJoint({
        ...form,
        totalAmount: Number(form.totalAmount),
        isDeposit: form.paymentType === 'deposit_non_refundable' || form.paymentType === 'deposit_refundable',
        isFinalPayment: form.paymentType === 'balance_payment',
        paymentRequestId: form.paymentRequestId || undefined,
        allocations: allocations.map((allocation) => ({ bookingId: allocation.bookingId, amount: Number(allocation.amount) })),
      });
      navigate('/admin/payments');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Unable to save the joint payment.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading joint payment form..." />;
  return <div className="h-full p-6">
    <div className="mb-6 flex items-center gap-4">
      <button type="button" onClick={() => navigate('/admin/payments')} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"><Icon icon={FiArrowLeft} /> Back</button>
      <div><h1 className="text-2xl font-semibold text-gray-900">Joint / Split Payment</h1><p className="text-sm text-gray-600">Record one received transaction and allocate it across multiple bookings.</p></div>
    </div>
    <form onSubmit={submit} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Received transaction</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">Payer name<input value={form.payerName} onChange={(event) => setForm({ ...form, payerName: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" placeholder="Person who sent the money" /></label>
          <label className="text-sm font-medium text-gray-700">Transaction reference<input value={form.transactionId} onChange={(event) => setForm({ ...form, transactionId: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" placeholder="Bank, Revolut, PayPal reference" /></label>
          <label className="text-sm font-medium text-gray-700 md:col-span-2">Payment request (optional)<select value={form.paymentRequestId} onChange={(event) => { const request = requests.find((item) => item._id === event.target.value); setForm({ ...form, paymentRequestId: event.target.value, totalAmount: request ? String(request.requestedAmount) : form.totalAmount, currency: request?.currency || form.currency }); }} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"><option value="">No payment request</option>{requests.filter((request) => request.status !== 'cancelled').map((request) => <option key={request._id} value={request._id}>{request.invoiceNumber || `#${request.display_id}`} · {request.requestedAmount} {request.currency}</option>)}</select><span className="mt-1 block text-xs font-normal text-gray-500">The request belongs to the receipt once; allocations may belong to different clients.</span></label>
          <label className="text-sm font-medium text-gray-700">Total received *<input type="number" min="0.01" step="0.01" required value={form.totalAmount} onChange={(event) => setForm({ ...form, totalAmount: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" /></label>
          <label className="text-sm font-medium text-gray-700">Currency *<select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as Payment['currency'] })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"><option>EUR</option><option>USD</option><option>CZK</option><option>PLN</option></select></label>
          <label className="text-sm font-medium text-gray-700">Payment date *<input type="date" required value={form.paymentDate} onChange={(event) => setForm({ ...form, paymentDate: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" /></label>
          <label className="text-sm font-medium text-gray-700">Method *<select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as Payment['paymentMethod'] })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"><option value="bank_transfer">Bank Transfer</option><option value="revolut">Revolut</option><option value="paypal">PayPal</option><option value="wise">Wise</option><option value="card">Card</option><option value="cash">Cash</option><option value="other">Other</option></select></label>
          <label className="text-sm font-medium text-gray-700">Type<select value={form.paymentType} onChange={(event) => setForm({ ...form, paymentType: event.target.value as Payment['paymentType'] })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"><option value="deposit_non_refundable">Deposit (Non-refundable)</option><option value="deposit_refundable">Deposit (Refundable)</option><option value="regular_payment">Regular Payment</option><option value="balance_payment">Balance Payment</option></select></label>
          <label className="text-sm font-medium text-gray-700">Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as typeof form.status })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"><option value="completed">Completed</option><option value="pending">Pending</option><option value="failed">Failed</option></select></label>
        </div>
      </section>
      <section className="border-t border-gray-200 pt-6">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-gray-900">Booking allocations</h2><p className="text-sm text-gray-600">Split the received receipt across the bookings it pays for.</p></div><button type="button" onClick={() => setAllocations([...allocations, blankAllocation()])} className="inline-flex items-center gap-2 rounded-md border border-blue-600 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"><Icon icon={FiPlus} /> Add booking</button></div>
        <div className="space-y-4">
          {allocations.map((allocation, index) => {
            return <div key={index} className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-[1.8fr_.7fr_auto]">
              <label className="text-sm font-medium text-gray-700">Booking *<select required value={allocation.bookingId} onChange={(event) => updateAllocation(index, { bookingId: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2"><option value="">Select booking</option>{bookings.map((booking) => <option key={booking._id} value={booking._id}>#{booking.bookingNumber} · {clientName(booking)} · {retreatName(booking)}</option>)}</select></label>
              <label className="text-sm font-medium text-gray-700">Allocated amount *<input type="number" min="0.01" step="0.01" required value={allocation.amount} onChange={(event) => updateAllocation(index, { amount: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2" /></label>
              <button type="button" disabled={allocations.length <= 2} onClick={() => setAllocations(allocations.filter((_, itemIndex) => itemIndex !== index))} className="mt-6 rounded-md p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30" title="Remove allocation"><Icon icon={FiTrash2} /></button>
            </div>;
          })}
        </div>
        <div className={`mt-4 flex justify-end gap-6 rounded-md px-4 py-3 text-sm font-semibold ${Math.abs(difference) <= 0.005 && Number(form.totalAmount) > 0 ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}><span>Received: {(Number(form.totalAmount) || 0).toFixed(2)} {form.currency}</span><span>Allocated: {allocatedTotal.toFixed(2)} {form.currency}</span><span>Difference: {difference.toFixed(2)} {form.currency}</span></div>
      </section>
      <label className="block text-sm font-medium text-gray-700">Notes<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" placeholder="Context about the joint payment" /></label>
      <div className="flex justify-end gap-3 border-t border-gray-200 pt-4"><button type="button" onClick={() => navigate('/admin/payments')} className="rounded-md bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300">Cancel</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"><Icon icon={FiSave} />{saving ? 'Saving allocations...' : 'Save Joint Payment'}</button></div>
    </form>
  </div>;
};

export default JointPaymentEditorPage;
