import React, { ReactNode } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { BookingFlowItem, Payment } from '../types';
import { formatStepDate, formatStepPaymentOption, getStepItemDisplayValue } from './bookingStepPresentation';

const statusOptions: BookingFlowItem['status'][] = ['pending', 'sent', 'received', 'sent_for_review', 'in_review', 'reviewed', 'approved', 'caution', 'rejected', 'needs_resubmission', 'completed', 'blocked', 'waived', 'scheduled'];

type Props = {
  item: BookingFlowItem; done: boolean; isEditing: boolean; saving: string;
  confirmedDateInputValue: string; pendingDateInputValue?: string; hasPendingDateInput: boolean;
  isPaymentReceivedStep: boolean; bookingPayments: Payment[]; selectedPaymentId: string; note: string;
  onToggle: () => void; onStatusChange: (status: BookingFlowItem['status']) => void; onDateDraftChange: (value: string) => void;
  onDateCancel: () => void; onDateSave: (value: string) => void; onPaymentChange: (paymentId: string) => void; onNoteChange: (note: string) => void;
  children?: ReactNode;
};

const BookingStepCellEditor: React.FC<Props> = ({ item, done, isEditing, saving, confirmedDateInputValue, pendingDateInputValue, hasPendingDateInput, isPaymentReceivedStep, bookingPayments, selectedPaymentId, note, onToggle, onStatusChange, onDateDraftChange, onDateCancel, onDateSave, onPaymentChange, onNoteChange, children }) => <div className="space-y-1">
  <div className="grid grid-cols-[18px_minmax(88px,1fr)_92px] items-center gap-1">
    <button type="button" disabled={!isEditing || saving === item._id} onClick={onToggle} className="inline-flex justify-center disabled:opacity-50" title={isEditing ? (done ? 'Mark pending' : 'Mark complete') : 'Unlock editing to change status'} aria-label={done ? 'Mark pending' : 'Mark complete'}>{done ? <CheckCircle2 className="h-4 w-4 flex-none" /> : <Circle className="h-4 w-4 flex-none" />}</button>
    <select aria-label="Step status" value={item.status || 'pending'} disabled={!isEditing || saving === item._id} onChange={event => onStatusChange(event.target.value as BookingFlowItem['status'])} className="w-full rounded border border-black/10 bg-white/80 px-1.5 py-1 text-xs font-medium text-gray-800 disabled:cursor-not-allowed disabled:bg-white/40" title={getStepItemDisplayValue(item) || item.status || 'pending'}>{statusOptions.map(status => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}</select>
    <div className="grid gap-1"><input aria-label="Step date" type="date" value={pendingDateInputValue ?? confirmedDateInputValue} disabled={!isEditing || saving === `date:${item._id}`} onChange={event => onDateDraftChange(event.target.value)} className="w-full rounded border border-black/10 bg-white/80 px-1.5 py-1 text-xs text-gray-800 disabled:cursor-not-allowed disabled:bg-white/40" />{hasPendingDateInput && <div className="flex justify-end gap-1"><button type="button" onClick={onDateCancel} className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50">Cancel</button><button type="button" onClick={() => onDateSave(pendingDateInputValue || '')} className="rounded bg-blue-600 px-1.5 py-0.5 text-[11px] font-medium text-white hover:bg-blue-700">OK</button></div>}</div>
  </div>
  {isPaymentReceivedStep && <select aria-label="Linked payment" value={selectedPaymentId} disabled={!isEditing || saving === `payment:${item._id}` || bookingPayments.length === 0} onChange={event => onPaymentChange(event.target.value)} className="w-full rounded border border-emerald-200 bg-white/90 px-1.5 py-1 text-xs font-medium text-emerald-900 disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-gray-500" title={bookingPayments.length > 0 ? 'Choose client payment to mark this step received' : 'No payments found for this client in this retreat'}><option value="">{bookingPayments.length > 0 ? 'Choose payment...' : 'No payments found'}</option>{bookingPayments.map(payment => <option key={payment._id || `${payment.display_id}:${payment.paymentDate}`} value={payment._id || ''}>{formatStepPaymentOption(payment)}</option>)}</select>}
  <div className="grid grid-cols-[1fr_auto] gap-1"><textarea aria-label="Step notes" value={note} disabled={!isEditing} onChange={event => onNoteChange(event.target.value)} rows={1} placeholder={item.emailSentAt ? `Email ${formatStepDate(item.emailSentAt)}` : 'Notes'} className="min-h-[28px] w-full resize-y rounded border border-black/10 bg-white/80 px-1.5 py-1 text-xs text-gray-800 placeholder:text-gray-400 disabled:cursor-not-allowed disabled:bg-white/40" />{children}</div>
</div>;

export default BookingStepCellEditor;
