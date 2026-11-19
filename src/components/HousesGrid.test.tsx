import React from 'react';
import { render, screen } from '@testing-library/react';
import HousesGrid from './HousesGrid';
import { housesApi } from '../services/api';

jest.mock('../services/api', () => ({
  housesApi: { getAll: jest.fn() },
}));

const mock = (fn: unknown) => fn as jest.Mock;

const houses = [
  { _id: 'h1', name: 'Villa Sunset', city: 'Chiang Mai', address: '123 Main St', capacity: 10, numberOfRooms: 5, pricePerNight: 200, bookingSource: 'Airbnb', heroImageS3Key: 'key1' },
];

// PPVC-1007: the grid's table/status pills/empty state now use the shared
// Table/Badge/EmptyState kit instead of a raw bg-white table and hand-rolled pills.
describe('HousesGrid (PPVC-1007)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the houses table inside the shared Card surface', async () => {
    mock(housesApi.getAll).mockResolvedValue({ data: houses });
    const { container } = render(<HousesGrid />);
    await screen.findByText('Villa Sunset');
    expect(screen.getByText('Airbnb')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(container.querySelectorAll('.border-apple-gray-200.shadow-apple-sm').length).toBeGreaterThan(0);
  });

  it('shows the shared EmptyState when there are no houses', async () => {
    mock(housesApi.getAll).mockResolvedValue({ data: [] });
    render(<HousesGrid />);
    expect(await screen.findByText('No houses found')).toBeInTheDocument();
  });
});
