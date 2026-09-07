import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AnalyticsPage from './AnalyticsPage';
import { bookingsApi } from '../services/api';

jest.mock('../services/api', () => ({
  bookingsApi: { getAll: jest.fn() },
}));

const mockedBookingsApi = bookingsApi as jest.Mocked<typeof bookingsApi>;

const bookings = [
  { _id: 'a', registrationDate: '2026-01-05', totalAmountUsd: 1000, status: 'confirmed' },
  { _id: 'b', registrationDate: '2026-02-10', totalAmountUsd: 3000, status: 'confirmed' },
  { _id: 'c', registrationDate: '2026-02-15', totalAmountUsd: 500, status: 'cancelled' },
];

describe('AnalyticsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedBookingsApi.getAll.mockResolvedValue({ data: bookings } as any);
  });

  it('loads bookings and renders summary stats for the price timeline', async () => {
    render(<AnalyticsPage />);

    await screen.findByText('Bookings plotted');
    expect(screen.getByText('Bookings plotted').previousSibling).toHaveTextContent('2'); // 2 non-cancelled bookings plotted
    expect(screen.getByText('Months covered')).toBeInTheDocument();
  });

  it('excludes cancelled bookings by default and includes them when toggled', async () => {
    render(<AnalyticsPage />);
    await screen.findByText('Bookings plotted');
    expect(screen.getByText('Bookings plotted').previousSibling).toHaveTextContent('2');

    fireEvent.click(screen.getByLabelText('Include cancelled bookings'));

    await waitFor(() => expect(screen.getByText('Bookings plotted').previousSibling).toHaveTextContent('3'));
  });

  it('shows an empty state when no bookings have both a date and a USD price', async () => {
    mockedBookingsApi.getAll.mockResolvedValue({ data: [{ _id: 'x', status: 'confirmed' }] } as any);
    render(<AnalyticsPage />);
    expect(await screen.findByText(/backfilled, this chart will populate automatically/i)).toBeInTheDocument();
  });

  it('shows an error message if the bookings request fails', async () => {
    mockedBookingsApi.getAll.mockRejectedValue(new Error('network error'));
    render(<AnalyticsPage />);
    expect(await screen.findByText(/Could not load booking data/i)).toBeInTheDocument();
  });
});
