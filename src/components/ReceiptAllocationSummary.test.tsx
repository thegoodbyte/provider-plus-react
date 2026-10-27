import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReceiptAllocationSummary from './ReceiptAllocationSummary';
const receipt: any = { _id: 'receipt', totalAmount: 7600, allocatedAmount: 3800, unallocatedAmount: 3800, currency: 'PLN', status: 'received', allocationCount: 1, unallocatedPayment: { _id: 'reserve' }, allocations: [{ _id: 'payment-a', display_id: 1201, amount: 3800, bookingId: { _id: 'booking-a', bookingNumber: 1301 } }] };
it('shows original funds, allocated/unused shares and linked bookings from any payment view', () => {
  render(<MemoryRouter><ReceiptAllocationSummary receipt={receipt}/></MemoryRouter>);
  expect(screen.getByRole('region', { name: 'Shared payment allocation' })).toHaveTextContent('Received 7,600.00 PLNAllocated 3,800.00 PLNUnused 3,800.00 PLN');
  expect(screen.getByRole('link', { name: 'Booking #1301' })).toHaveAttribute('href', '/admin/bookings/booking-a');
  expect(screen.getByRole('link', { name: 'Allocate unused funds' })).toHaveAttribute('href', '/admin/payments/joint/new?receiptId=receipt');
});
it('shows no allocate-unused action when the whole receipt has been assigned', () => {
  render(<MemoryRouter><ReceiptAllocationSummary receipt={{...receipt, unallocatedAmount: 0, unallocatedPayment: undefined, allocationCount: 2}}/></MemoryRouter>);
  expect(screen.queryByRole('link', { name: 'Allocate unused funds' })).not.toBeInTheDocument();
  expect(screen.getByRole('region', {name:'Shared payment allocation'})).toHaveTextContent('Unused 0.00 PLN');
});
it('pending operations warn that totals may be stale and link only to resume', () => {
  render(<MemoryRouter><ReceiptAllocationSummary receipt={{...receipt, splitProgress: {state:'pending'} as any}}/></MemoryRouter>);
  expect(screen.getByRole('alert')).toHaveTextContent('Allocation in progress');
  expect(screen.getByRole('link', {name:'Resume receipt split'})).toBeInTheDocument();
  expect(screen.queryByRole('link', {name:'Allocate unused funds'})).not.toBeInTheDocument();
});
