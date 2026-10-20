import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BookingsGrid from './BookingsGrid';
import { bookingsApi, retreatsApi } from '../services/api';

jest.mock('../services/api', () => ({
  bookingsApi: { getAllFresh: jest.fn(), delete: jest.fn() },
  retreatsApi: { getAll: jest.fn() },
}));

// Default sort is bookingNumber descending, so the initial page holds the
// highest 100 booking numbers (1050-1149) and withholds the lowest 50
// (1000-1049) behind "Show more".
const bookings = Array.from({ length: 150 }, (_, index) => ({
  _id: `booking-${index}`,
  bookingNumber: 1000 + index,
  status: 'confirmed',
  createdAt: '2026-01-01T00:00:00.000Z',
}));

beforeEach(() => {
  (bookingsApi.getAllFresh as jest.Mock).mockResolvedValue({ data: bookings });
  (retreatsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
});

test('renders only a bounded page of bookings and reveals more on demand', async () => {
  render(<MemoryRouter><BookingsGrid /></MemoryRouter>);
  await screen.findByText('#1149');
  expect(screen.getAllByText(/^#\d+$/)).toHaveLength(100);
  expect(screen.queryByText('#1000')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Show more \(50 remaining\)/ }));
  expect(await screen.findByText('#1000')).toBeInTheDocument();
  expect(screen.getAllByText(/^#\d+$/)).toHaveLength(150);
  expect(screen.queryByRole('button', { name: /Show more/ })).not.toBeInTheDocument();
});

test('resets the visible page when the search filter narrows the list', async () => {
  render(<MemoryRouter><BookingsGrid /></MemoryRouter>);
  await screen.findByText('#1149');
  fireEvent.click(screen.getByRole('button', { name: /Show more/ }));
  await screen.findByText('#1000');
  fireEvent.change(screen.getByRole('textbox', { name: /search/i }), { target: { value: '104' } });
  expect(await within(screen.getAllByRole('table')[0]).findByText('#1040')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Show more/ })).not.toBeInTheDocument();
});
