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
