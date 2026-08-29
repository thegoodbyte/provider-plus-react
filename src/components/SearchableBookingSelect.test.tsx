import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SearchableBookingSelect from './SearchableBookingSelect';

const bookings: any[] = [
  { _id: 'booking-1276', bookingNumber: 1276, clientId: 'client-1', retreatId: 'retreat-1', status: 'confirmed' },
  { _id: 'booking-1258', bookingNumber: 1258, clientId: 'client-2', retreatId: 'retreat-2', status: 'pending' },
];
const clients: any[] = [
  { _id: 'client-1', firstName: 'Emil', lastName: 'Karkocha', email: 'emil@example.com', display_id: 1205 },
  { _id: 'client-2', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', display_id: 1206 },
];
const retreats: any[] = [
  { _id: 'retreat-1', name: 'November Poland', code: 'JNO-11-17-26' },
  { _id: 'retreat-2', name: 'October Czechia', code: 'OCT-10-26' },
];

it('searches Add Payment bookings by number and selects the exact booking', () => {
  const onBookingSelect = jest.fn();
  render(<SearchableBookingSelect bookings={bookings} clients={clients} retreats={retreats} selectedBookingId="" onBookingSelect={onBookingSelect} />);

  const input = screen.getByRole('combobox', { name: 'Search and select booking' });
  fireEvent.change(input, { target: { value: '1276' } });

  expect(screen.getByText('#1276 · Emil Karkocha')).toBeInTheDocument();
  expect(screen.queryByText('#1258 · Ada Lovelace')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('#1276 · Emil Karkocha'));
  expect(onBookingSelect).toHaveBeenCalledWith('booking-1276');
});

it('searches bookings by client and retreat details', () => {
  render(<SearchableBookingSelect bookings={bookings} clients={clients} retreats={retreats} selectedBookingId="" onBookingSelect={jest.fn()} />);
  const input = screen.getByRole('combobox', { name: 'Search and select booking' });

  fireEvent.change(input, { target: { value: 'ada@example.com' } });
  expect(screen.getByText('#1258 · Ada Lovelace')).toBeInTheDocument();

  fireEvent.change(input, { target: { value: 'JNO-11-17-26' } });
  expect(screen.getByText('#1276 · Emil Karkocha')).toBeInTheDocument();
});

it('shows the selected label, clears it, and uses custom labels', () => {
  const onBookingSelect = jest.fn();
  const { rerender } = render(<SearchableBookingSelect bookings={bookings} clients={clients} retreats={retreats} selectedBookingId="booking-1276" onBookingSelect={onBookingSelect} placeholder="Find" emptyLabel="No request" className="wide" />);
  const input = screen.getByRole('combobox');
  expect(input).toHaveValue('#1276 · Emil Karkocha · November Poland');
  fireEvent.click(screen.getByLabelText('Clear booking'));
  expect(onBookingSelect).toHaveBeenCalledWith('');
  rerender(<SearchableBookingSelect bookings={bookings} clients={clients} retreats={retreats} selectedBookingId="" onBookingSelect={onBookingSelect} placeholder="Find" emptyLabel="No request" className="wide" />);
  fireEvent.click(screen.getByLabelText('Toggle booking options'));
  expect(screen.getByText('No request')).toBeInTheDocument();
});

it('supports keyboard navigation, selection and Escape', () => {
  const onBookingSelect = jest.fn();
  render(<SearchableBookingSelect bookings={bookings} clients={clients} retreats={retreats} selectedBookingId="" onBookingSelect={onBookingSelect} />);
  const input = screen.getByRole('combobox');
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.keyDown(input, { key: 'ArrowUp' });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onBookingSelect).toHaveBeenCalledWith('booking-1276');
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'Ada' } });
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(screen.queryByText('#1258 · Ada Lovelace')).not.toBeInTheDocument();
});

it('handles embedded client/retreat records and missing metadata', () => {
  const embedded: any[] = [
    { _id: 'embedded-123456', clientId: { firstName: 'Grace', lastName: 'Hopper', display_id: 88 }, retreatId: { retreatCode: 'SEA-1' } },
    { _id: 'unknown-654321', clientId: 'missing-client', retreatId: 'missing-retreat' },
  ];
  render(<SearchableBookingSelect bookings={embedded} clients={[]} retreats={[]} selectedBookingId="" onBookingSelect={jest.fn()} />);
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: 'Grace' } });
  expect(screen.getByText('#123456 · Grace Hopper')).toBeInTheDocument();
  expect(screen.getByText(/SEA-1.*Client #88/)).toBeInTheDocument();
  fireEvent.change(input, { target: { value: 'unknown client' } });
  expect(screen.getByText('#654321 · Unknown client')).toBeInTheDocument();
  expect(screen.getByText('Unknown retreat')).toBeInTheDocument();
});

it('shows no-match feedback and closes after an outside click', () => {
  render(<div><SearchableBookingSelect bookings={bookings} clients={clients} retreats={retreats} selectedBookingId="" onBookingSelect={jest.fn()} /><button>Outside</button></div>);
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: 'not-there' } });
  expect(screen.getByText('No bookings match “not-there”.')).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByText('Outside'));
  expect(screen.queryByText('No bookings match “not-there”.')).not.toBeInTheDocument();
});
