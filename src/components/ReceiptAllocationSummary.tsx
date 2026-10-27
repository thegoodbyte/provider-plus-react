import React from 'react';
import { Link } from 'react-router-dom';
import { PaymentReceipt } from '../types';
const idOf = (value: any) => String(value?._id || value || '');
export default function ReceiptAllocationSummary({ receipt }: { receipt: PaymentReceipt }) {
  const pending = receipt.splitProgress?.state === 'pending';
  const canAllocate = pending || Boolean(receipt.unallocatedPayment) || receipt.allocationCount === 1 && !receipt.allocations?.[0]?.bookingId && !receipt.splitProgress;
  const money = (value: number) => `${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${receipt.currency}`;
  return <section aria-label="Shared payment allocation" className="my-4 min-w-0 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
    <h3 className="font-semibold">Received payment and booking allocations</h3>
    <div className="mt-3 grid gap-3 sm:grid-cols-3"><p>Received <strong className="block">{money(receipt.totalAmount)}</strong></p><p>Allocated <strong className="block">{money(receipt.allocatedAmount)}</strong></p><p>Unused <strong className="block text-amber-800">{money(receipt.unallocatedAmount || 0)}</strong></p></div>
    {pending && <p role="alert" className="mt-2 text-amber-900">Allocation in progress. The previous totals may be out of date. Resume the saved operation before making further changes.</p>}
    <ul className="mt-3 space-y-2 text-sm">{receipt.allocations?.filter(row => row.bookingId).map(row => <li key={row._id} className="flex flex-wrap gap-2"><Link className="text-blue-700 underline" to={`/admin/bookings/${idOf(row.bookingId)}`}>Booking #{typeof row.bookingId === 'object' ? row.bookingId.bookingNumber : idOf(row.bookingId)}</Link><span>{money(row.amount)}</span><Link className="text-blue-700 underline" to={`/admin/payments/${row._id}`}>Payment #{row.display_id || row._id}</Link></li>)}</ul>
    {canAllocate && receipt.status === 'received' && <Link className="mt-3 inline-block rounded border border-blue-600 bg-white px-3 py-2 text-sm font-semibold text-blue-800" to={`/admin/payments/joint/new?receiptId=${receipt._id}`}>{pending ? 'Resume receipt split' : receipt.unallocatedPayment ? 'Allocate unused funds' : 'Allocate to bookings'}</Link>}
    {Number(receipt.unallocatedAmount) > 0 && <p className="mt-2 text-sm">Unused funds have not been credited to a booking. Reuse this receipt when assigning them; do not record another received payment.</p>}
  </section>;
}
