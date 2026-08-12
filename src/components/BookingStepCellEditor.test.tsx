import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import BookingStepCellEditor from './BookingStepCellEditor';

const item: any = { _id: 'step-1', status: 'pending', title: 'Contract' };
const callbacks = () => ({ onToggle: jest.fn(), onStatusChange: jest.fn(), onDateDraftChange: jest.fn(), onDateCancel: jest.fn(), onDateSave: jest.fn(), onPaymentChange: jest.fn(), onNoteChange: jest.fn() });
const props = (overrides: any = {}) => ({ item, done: false, isEditing: true, saving: '', confirmedDateInputValue: '2026-08-01', hasPendingDateInput: false, isPaymentReceivedStep: false, bookingPayments: [], selectedPaymentId: '', note: '', ...callbacks(), ...overrides });

describe('BookingStepCellEditor', () => {
  it('edits status, date and notes and toggles completion', () => {
    const handlers = callbacks(); render(<BookingStepCellEditor {...props(handlers)} />);
    fireEvent.click(screen.getByLabelText('Mark complete')); expect(handlers.onToggle).toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Step status'), { target: { value: 'received' } }); expect(handlers.onStatusChange).toHaveBeenCalledWith('received');
    fireEvent.change(screen.getByLabelText('Step date'), { target: { value: '2026-08-02' } }); expect(handlers.onDateDraftChange).toHaveBeenCalledWith('2026-08-02');
    fireEvent.change(screen.getByLabelText('Step notes'), { target: { value: 'Done' } }); expect(handlers.onNoteChange).toHaveBeenCalledWith('Done');
  });

  it('saves and cancels a pending date', () => {
    const handlers = callbacks(); render(<BookingStepCellEditor {...props({ ...handlers, pendingDateInputValue: '2026-08-03', hasPendingDateInput: true })} />);
    expect(screen.getByLabelText('Step date')).toHaveValue('2026-08-03'); fireEvent.click(screen.getByText('Cancel')); expect(handlers.onDateCancel).toHaveBeenCalled(); fireEvent.click(screen.getByText('OK')); expect(handlers.onDateSave).toHaveBeenCalledWith('2026-08-03');
  });

  it('renders payments and reports a selection', () => {
    const handlers = callbacks(); const payment: any = { _id: 'payment-1', display_id: 7, amount: 2000, currency: 'USD', paymentDate: '2026-08-01' };
    render(<BookingStepCellEditor {...props({ ...handlers, isPaymentReceivedStep: true, bookingPayments: [payment] })} />);
    fireEvent.change(screen.getByLabelText('Linked payment'), { target: { value: 'payment-1' } }); expect(handlers.onPaymentChange).toHaveBeenCalledWith('payment-1'); expect(screen.getByText(/#7/)).toBeInTheDocument();
  });

  it('disables missing payments and all controls while locked', () => {
    render(<BookingStepCellEditor {...props({ isPaymentReceivedStep: true, isEditing: false })}><span>Action</span></BookingStepCellEditor>);
    expect(screen.getByLabelText('Linked payment')).toBeDisabled(); expect(screen.getByText('No payments found')).toBeInTheDocument(); expect(screen.getByLabelText('Mark complete')).toBeDisabled(); expect(screen.getByLabelText('Step status')).toBeDisabled(); expect(screen.getByLabelText('Step date')).toBeDisabled(); expect(screen.getByLabelText('Step notes')).toBeDisabled(); expect(screen.getByText('Action')).toBeInTheDocument();
  });

  it('shows completed and saving states with an email placeholder', () => {
    const emailed: any = { ...item, status: 'completed', emailSentAt: '2026-08-01' };
    render(<BookingStepCellEditor {...props({ item: emailed, done: true, saving: 'step-1' })} />);
    expect(screen.getByLabelText('Mark pending')).toBeDisabled(); expect(screen.getByLabelText('Step status')).toBeDisabled(); expect(screen.getByLabelText('Step notes')).toHaveAttribute('placeholder', expect.stringContaining('Email'));
  });
});
