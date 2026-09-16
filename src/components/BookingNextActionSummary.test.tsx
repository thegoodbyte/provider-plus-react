import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BookingNextActionSummary from './BookingNextActionSummary';
import { BookingReadinessSource } from './bookingNextAction';
const source: BookingReadinessSource = { bookingId: 'b', loading: false, error: '', requirements: [], items: [{ _id: 'step', key: 'payment_received', title: 'Collect deposit', status: 'pending', isBlocking: true, assignedTo: 'Anna', dueDate: '2030-01-01', category: 'payment', bookingId: 'b', clientId: 'c', retreatId: 'r', offsetDays: 0 }] };
const props = { bookingId: 'b', source, onRetry: jest.fn(), onOpen: jest.fn() };
beforeEach(() => jest.clearAllMocks());
test('shows next action and routes to existing payment controls', () => {
  render(<BookingNextActionSummary {...props} />);
  expect(screen.getByRole('status')).toHaveTextContent('Blocked');
  fireEvent.click(screen.getAllByRole('button', { name: 'Open payments: Collect deposit' })[0]);
  expect(props.onOpen).toHaveBeenCalledWith('payments', 'step');
  expect(screen.getAllByText('Anna').length).toBeGreaterThan(0);
});
test('updates readiness when refreshed source completes the action', () => {
  const { rerender } = render(<BookingNextActionSummary {...props} />);
  rerender(<BookingNextActionSummary {...props} source={{ ...source, items: source.items.map(item => ({ ...item, status: 'completed' })) }} />);
  expect(screen.getByRole('status')).toHaveTextContent('Ready');
  expect(screen.queryByRole('button', { name: /Open payments/ })).not.toBeInTheDocument();
});
test('load failure replaces previous readiness and offers retry', () => {
  render(<BookingNextActionSummary {...props} source={{ ...source, error: 'Offline' }} />);
  expect(screen.getByRole('status')).toHaveTextContent('Readiness unknown');
  expect(screen.getByRole('alert')).toHaveTextContent('Unable to load readiness');
  expect(screen.queryByText('Collect deposit')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry readiness' }));
  expect(props.onRetry).toHaveBeenCalled();
});
test('never displays another booking’s summary', () => {
  render(<BookingNextActionSummary {...props} bookingId="different" />);
  expect(screen.getByText('Loading readiness…')).toBeInTheDocument();
  expect(screen.queryByText('Collect deposit')).not.toBeInTheDocument();
});
test('closed bookings have no suggested preparation action', () => {
  render(<BookingNextActionSummary {...props} bookingStatus="cancelled" />);
  expect(screen.getByRole('status')).toHaveTextContent('Booking closed');
  expect(screen.queryByText('Collect deposit')).not.toBeInTheDocument();
});
