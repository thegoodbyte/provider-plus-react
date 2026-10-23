import { ArrowLeft, Plus, Save as SaveIcon, Trash2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Select } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { bookingsApi, clientsApi, paymentRequestsApi, paymentsApi } from '../services/api';
import { Client, Payment, PaymentRequest, Retreat, RetreatClient } from '../types';
import LoadingSpinner from './LoadingSpinner';
import { todayDateInputValue } from '../utils/dateFormat';
import { splitPaymentEvenly } from './jointPaymentAllocation';

type Allocation = { bookingId: string; amount: string; clientId?: string; bookingPrice?: string };
const Icon: React.FC<{ icon: any }> = ({ icon: IconComponent }) => <IconComponent className="h-4 w-4" />;
const newOperationKey = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2,'0')).join('');
const blankAllocation = (): Allocation => ({ bookingId: '', amount: '' });
const clientName = (booking?: RetreatClient) => {
  const client = typeof booking?.clientId === 'object' ? booking.clientId as Client : null;
  return client ? `${client.firstName || ''} ${client.lastName || ''}`.trim() : 'Client';
};
const retreatName = (booking?: RetreatClient) => {
  const retreat = typeof booking?.retreatId === 'object' ? booking.retreatId as Retreat : null;
  return retreat?.retreatCode || retreat?.code || retreat?.name || 'Retreat';
};

const bookingLabel = (booking: RetreatClient) => `#${booking.bookingNumber} · ${clientName(booking)} · ${retreatName(booking)}`;
const requestLabel = (request: PaymentRequest) => {
  const client = typeof request.clientId === 'object' ? request.clientId as Client : null;
  const retreat = typeof request.retreatId === 'object' ? request.retreatId as Retreat : null;
  return [
    request.invoiceNumber || `#${request.display_id}`,
    client && [client.firstName, client.lastName].filter(Boolean).join(' '),
    retreat && (retreat.retreatCode || retreat.code || retreat.name),
    `${request.requestedAmount} ${request.currency}`,
  ].filter(Boolean).join(' · ');
};
const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/gi, 'l').toLowerCase();
const matchesSearch = (label: string, input: string) => normalizeSearch(input).trim().split(/\s+/).every(term => normalizeSearch(label).includes(term));

const JointPaymentEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const receiptId = new URLSearchParams(location.search).get('receiptId') || '';
  const draftKey = `receipt-split:${receiptId}`;
  const [receipt, setReceipt] = useState<any>(null);
  const [receiptReady, setReceiptReady] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [operationKey, setOperationKey] = useState(() => newOperationKey());
  const id = (value: any): string => String(value?._id || value || '');
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
    let active = true;
    setLoading(true);
    setReceiptReady(false);
    setError('');
    Promise.all([bookingsApi.getAll(), paymentRequestsApi.getAll(), receiptId ? paymentsApi.getReceipt(receiptId) : Promise.resolve(null), receiptId ? clientsApi.getBookingOptions() : Promise.resolve(null)])
      .then(([bookingResponse, requestResponse, receiptResponse, clientResponse]) => {
        if (!active) return;
        const allBookings = (bookingResponse.data || []).filter((booking: RetreatClient) => !['cancelled', 'checked-out'].includes(String(booking.status)));
        setBookings(allBookings);
        setRequests(requestResponse.data || []);
        setClients(clientResponse?.data || []);
        if (receiptResponse) {
          const existing: any = receiptResponse.data;
          setReceipt(existing);
          const source = existing.allocations?.[0];
          const parent = (requestResponse.data || []).find((request: PaymentRequest) => request._id === id(existing.paymentRequestId || source?.paymentRequestId));
          if (!parent) throw new Error('This receipt needs an existing retreat payment request before it can be split.');
          if (existing.splitProgress?.state === 'completed' || !existing.splitProgress && (existing.allocations?.length !== 1 || source?.bookingId || source?.status !== 'completed' || Number(source?.refundedAmount) > 0 || existing.status !== 'received')) {
            throw new Error('This receipt is already allocated or needs refund/conflict review.');
          }
          setForm(current => ({ ...current, totalAmount: String(existing.totalAmount), currency: existing.currency, payerName: existing.payerName || '', paymentDate: String(existing.receivedDate).slice(0,10), paymentMethod: existing.paymentMethod, paymentType: existing.paymentType || source?.paymentType, transactionId: existing.transactionId || existing.transactionReference || '', paymentRequestId: parent?._id || '', notes: existing.notes || '', status: 'completed' }));
          let draft: any = null;
          try { draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null'); } catch { /* Start a clean draft if storage was malformed. */ }
          const progress = existing.splitProgress;
          let next: Allocation[] = progress?.state === 'pending' ? progress.allocations.map((row: any) => ({ bookingId: row.bookingId, amount: String(row.amount) })) : draft?.allocations || [blankAllocation(), blankAllocation()];
          if (!progress && !draft) {
            const shares = splitPaymentEvenly(existing.totalAmount, 2);
            next = next.map((row, index) => ({ ...row, amount: shares[index].toFixed(2), bookingPrice: parent?.fullPrice ? (Number(parent.fullPrice) / 2).toFixed(2) : '' }));
          }
          const query = new URLSearchParams(location.search);
          const created = allBookings.find((booking: RetreatClient) => booking._id === query.get('createdBookingId'));
          const rowIndex = Number(query.get('allocationRow'));
          if (!progress && created && query.has('allocationRow') && Number.isInteger(rowIndex) && next[rowIndex] && id(created.clientId) === next[rowIndex].clientId && id(created.retreatId) === id(parent?.retreatId)) next = next.map((row,index) => index === rowIndex ? { ...row, bookingId: created._id } : row);
          setAllocations(next);
          setOperationKey(progress?.operationKey || draft?.operationKey || newOperationKey());
          setConfirmed(false);
          setReceiptReady(true);
        }
      })
      .catch((e) => { if (active) setError(e.message || 'Unable to load bookings and payment requests.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [receiptId, location.search]);

  useEffect(() => {
    if (receiptId && receipt && !loading && !receipt.splitProgress) sessionStorage.setItem(draftKey, JSON.stringify({ allocations, operationKey }));
  }, [receiptId, receipt, loading, allocations, operationKey, draftKey]);

  const parentRequest = requests.find(request => request._id === form.paymentRequestId);
  const createBooking = (index: number) => {
    const row = allocations[index];
    if (!row.clientId || !parentRequest?.retreatId || !(Number(row.bookingPrice) > 0)) { setError('Select the participant and enter the agreed booking price first.'); return; }
    sessionStorage.setItem(draftKey, JSON.stringify({ allocations, operationKey }));
    const returnTo = `/admin/payments/joint/new?${new URLSearchParams({ receiptId, allocationRow: String(index) })}`;
    const query = new URLSearchParams({ clientId: row.clientId, retreatId: id(parentRequest.retreatId), totalAmount: row.bookingPrice!, currency: form.currency, paymentPlanEnabled: 'false', returnTo });
    if (parentRequest.bookingType) query.set('bookingType',parentRequest.bookingType);
    navigate(`/admin/bookings/new?${query}`);
  };

  const allocatedTotal = useMemo(() => allocations.reduce((sum, allocation) => sum + (Number(allocation.amount) || 0), 0), [allocations]);
  const difference = (Number(form.totalAmount) || 0) - allocatedTotal;
  const updateAllocation = (index: number, changes: Partial<Allocation>) => setAllocations((current) => current.map((allocation, itemIndex) => itemIndex === index ? { ...allocation, ...changes } : allocation));
  const divideEvenly = (total = Number(form.totalAmount) || 0) => {
    const amounts = splitPaymentEvenly(total, allocations.length);
    setAllocations(current => current.map((allocation, index) => ({ ...allocation, amount: amounts[index]?.toFixed(2) || '' })));
  };

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
      if (receiptId) {
        if (!confirmed) throw new Error('Confirm the reviewed allocations before splitting the existing receipt.');
        await paymentsApi.splitExistingReceipt(receiptId, { confirm: true, operationKey, sourcePaymentId: receipt.splitProgress?.sourcePaymentId || receipt.allocations[0]._id, expectedRevision: receipt.splitProgress?.expectedRevision ?? receipt.allocationRevision ?? 0, allocations: allocations.map(row => ({ bookingId: row.bookingId, amount: Number(row.amount) })) });
        sessionStorage.removeItem(draftKey);
      } else await paymentsApi.createJoint({
        ...form,
        totalAmount: Number(form.totalAmount),
        isDeposit: form.paymentType === 'deposit_non_refundable' || form.paymentType === 'deposit_refundable',
        isFinalPayment: form.paymentType === 'balance_payment',
        paymentRequestId: form.paymentRequestId || undefined,
        allocations: allocations.map((allocation) => ({ bookingId: allocation.bookingId, amount: Number(allocation.amount) })),
      });
      navigate('/admin/payments');
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Unable to save the joint payment.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading joint payment form..." />;
  return <div className="h-full p-6 max-sm:p-3">
    <div className="mb-6 flex items-center gap-4">
      <button type="button" onClick={() => navigate('/admin/payments')} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"><Icon icon={ArrowLeft} /> Back</button>
      <div><h1 className="text-2xl font-semibold text-gray-900">Joint / Split Payment</h1><p className="text-sm text-gray-600">{receiptId ? 'Allocate an existing receipt to participant bookings.' : 'Record one received transaction and allocate it across multiple bookings.'}</p></div>
    </div>
    <form onSubmit={submit} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
      {receiptId && <div className="rounded border border-blue-200 bg-blue-50 p-4 text-sm">Receipt #{receipt?.display_id || receiptId} · Payment request #{parentRequest?.invoiceNumber || parentRequest?.display_id || '—'}. The existing amount, payer and received date are preserved. Create or select each booking, review the shares, then confirm. {receipt?.splitProgress?.state === 'pending' && <strong> An unfinished split was found. Resume the saved allocations below.</strong>}</div>}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Received transaction</h2>
        <fieldset disabled={!!receiptId} className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">Payer name<input value={form.payerName} onChange={(event) => setForm({ ...form, payerName: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" placeholder="Person who sent the money" /></label>
          <label className="text-sm font-medium text-gray-700">Transaction reference<input value={form.transactionId} onChange={(event) => setForm({ ...form, transactionId: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" placeholder="Bank, Revolut, PayPal reference" /></label>
          <div className="md:col-span-2">
            <Select
              id="joint-payment-request-select"
              disabled={!!receiptId}
              allowClear
              showSearch
              virtual={false}
              size="small"
              className="w-full"
              aria-label="Payment request (optional)"
              placeholder="Payment request (optional) — type invoice number, client, retreat, or amount"
              value={form.paymentRequestId || undefined}
              filterOption={(input, option) => matchesSearch(option?.searchText || '', input)}
              notFoundContent="No payment requests match your search"
              options={requests.filter(request => request.status !== 'cancelled').map(request => ({
                value: request._id,
                label: requestLabel(request),
                searchText: `${requestLabel(request)} ${request.display_id || ''}`,
              }))}
              onChange={(nextId) => {
                const request = requests.find(candidate => candidate._id === nextId);
                setForm(current => ({ ...current, paymentRequestId: nextId || '', totalAmount: request ? String(request.requestedAmount) : current.totalAmount, currency: request?.currency || current.currency }));
                if (request) divideEvenly(Number(request.requestedAmount));
              }}
            />
            <span className="mt-1 block text-xs font-normal text-gray-500">This sets the actual amount received—not the combined booking price—and proposes an equal split you can edit.</span>
          </div>
          <label className="text-sm font-medium text-gray-700">Total received *<input type="number" min="0.01" step="0.01" required value={form.totalAmount} onChange={(event) => setForm({ ...form, totalAmount: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" /></label>
          <label className="text-sm font-medium text-gray-700">Currency *<select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as Payment['currency'] })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"><option>EUR</option><option>USD</option><option>CZK</option><option>PLN</option></select></label>
          <label className="text-sm font-medium text-gray-700">Payment date *<input type="date" min="2020-01-01" max="2035-12-31" required value={form.paymentDate} onChange={(event) => setForm({ ...form, paymentDate: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" /></label>
          <label className="text-sm font-medium text-gray-700">Method *<select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as Payment['paymentMethod'] })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"><option value="bank_transfer">Bank Transfer</option><option value="revolut">Revolut</option><option value="paypal">PayPal</option><option value="wise">Wise</option><option value="card">Card</option><option value="cash">Cash</option><option value="other">Other</option></select></label>
          <label className="text-sm font-medium text-gray-700">Type<select value={form.paymentType} onChange={(event) => setForm({ ...form, paymentType: event.target.value as Payment['paymentType'] })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"><option value="deposit_non_refundable">Deposit (Non-refundable)</option><option value="deposit_refundable">Deposit (Refundable)</option><option value="regular_payment">Regular Payment</option><option value="balance_payment">Balance Payment</option></select></label>
          <label className="text-sm font-medium text-gray-700">Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as typeof form.status })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"><option value="completed">Completed</option><option value="pending">Pending</option><option value="failed">Failed</option></select></label>
        </fieldset>
      </section>
      <section className="border-t border-gray-200 pt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-gray-900">Booking allocations</h2><p className="text-sm text-gray-600">Split the received receipt across the bookings it pays for. These amounts are editable.</p></div><div className="flex gap-2"><button type="button" disabled={receipt?.splitProgress?.state === 'pending'} onClick={() => divideEvenly()} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Divide equally</button><button type="button" disabled={receipt?.splitProgress?.state === 'pending'} onClick={() => setAllocations([...allocations, blankAllocation()])} className="inline-flex items-center gap-2 rounded-md border border-blue-600 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"><Icon icon={Plus} /> Add booking</button></div></div>
        <div className="space-y-4">
          {allocations.map((allocation, index) => {
            const selectedBooking = bookings.find(booking => booking._id === allocation.bookingId);
            const eligible = bookings.filter(booking => !receiptId || booking.currency === form.currency && id(booking.retreatId) === id(parentRequest?.retreatId) && (!allocation.clientId || id(booking.clientId) === allocation.clientId));
            return <div key={index} className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-[1.8fr_.7fr_auto]">
              {receiptId && <div className="space-y-2 md:col-span-3">
                <Select aria-label={`Participant ${index + 1}`} disabled={receipt?.splitProgress?.state === 'pending'} className="w-full" showSearch virtual={false} placeholder="Find participant by name or client number" value={allocation.clientId || undefined} filterOption={(input, option) => matchesSearch(String(option?.label || ''),input)} options={clients.map(client => ({ value: client._id, label: `#${client.display_id || ''} ${client.firstName} ${client.lastName}` }))} onChange={clientId => updateAllocation(index, { clientId, bookingId: '' })} />
                <div className="flex flex-wrap items-end gap-2"><label className="text-sm">Agreed booking price ({form.currency})<input aria-label={`Booking price ${index + 1}`} type="number" min="0.01" step="0.01" disabled={receipt?.splitProgress?.state === 'pending'} value={allocation.bookingPrice || ''} onChange={event => updateAllocation(index,{ bookingPrice: event.target.value })} className="block w-full rounded border p-2" /></label><button type="button" disabled={!allocation.clientId || receipt?.splitProgress?.state === 'pending'} className="rounded border border-blue-600 p-2 text-sm text-blue-800 disabled:opacity-50" onClick={() => createBooking(index)}>Create booking for participant {index + 1}</button></div>
                {selectedBooking && <p className="text-sm">{bookingLabel(selectedBooking)} · Price: {selectedBooking.totalAmount} {selectedBooking.currency} · This receipt share: {allocation.amount} {form.currency}</p>}
              </div>}
              <Select
                disabled={receipt?.splitProgress?.state === 'pending'}
                id={`joint-payment-booking-select-${index}`}
                allowClear
                showSearch
                virtual={false}
                size="small"
                className="w-full"
                status={!allocation.bookingId ? 'warning' : undefined}
                aria-label={`Booking ${index + 1}`}
                placeholder={`Booking ${index + 1} — type booking number, client, or retreat`}
                value={allocation.bookingId || undefined}
                filterOption={(input, option) => matchesSearch(option?.label as string || '', input)}
                notFoundContent="No bookings match your search"
                options={eligible.map(booking => ({ value: booking._id, label: bookingLabel(booking) }))}
                onChange={(nextId) => updateAllocation(index, { bookingId: nextId || '' })}
              />
              <label className="min-w-0 text-sm font-medium text-gray-700">Allocated amount *<input type="number" min="0.01" step="0.01" disabled={receipt?.splitProgress?.state === 'pending'} required value={allocation.amount} onChange={(event) => updateAllocation(index, { amount: event.target.value })} className="mt-1 w-full min-w-0 max-w-full rounded-md border border-gray-300 bg-white px-3 py-2" /></label>
              <button type="button" disabled={allocations.length <= 2 || receipt?.splitProgress?.state === 'pending'} onClick={() => setAllocations(allocations.filter((_, itemIndex) => itemIndex !== index))} className="mt-6 rounded-md p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30" title="Remove allocation"><Icon icon={Trash2} /></button>
            </div>;
          })}
        </div>
        <div className={`mt-4 flex flex-wrap justify-end gap-x-6 gap-y-2 rounded-md px-4 py-3 text-sm font-semibold ${Math.abs(difference) <= 0.005 && Number(form.totalAmount) > 0 ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}><span>Received: {(Number(form.totalAmount) || 0).toFixed(2)} {form.currency}</span><span>Allocated: {allocatedTotal.toFixed(2)} {form.currency}</span><span>Difference: {difference.toFixed(2)} {form.currency}</span></div>
      </section>
      <label className="block text-sm font-medium text-gray-700">Notes<textarea disabled={!!receiptId} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" placeholder="Context about the joint payment" /></label>
      {receiptId && <label className="flex items-start gap-3 rounded border p-4 text-sm"><input className="mt-1 h-4 w-4 shrink-0" type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I reviewed the participant bookings and amounts. Allocate this existing receipt without recording another payment.</label>}
      <div className="flex justify-end gap-3 border-t border-gray-200 pt-4"><button type="button" onClick={() => navigate('/admin/payments')} className="rounded-md bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300">Cancel</button><button type="submit" disabled={saving || (!!receiptId && (!confirmed || !receiptReady))} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"><Icon icon={SaveIcon} />{saving ? 'Saving allocations...' : receiptId ? receipt?.splitProgress?.state === 'pending' ? 'Resume receipt split' : 'Confirm receipt split' : 'Save Joint Payment'}</button></div>
    </form>
  </div>;
};

export default JointPaymentEditorPage;
