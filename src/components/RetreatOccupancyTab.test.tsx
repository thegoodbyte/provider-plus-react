import React from 'react';
import { render, screen } from '@testing-library/react';
import RetreatOccupancyTab from './RetreatOccupancyTab';
import { roomInventoryApi } from '../services/roomInventoryApi';

jest.mock('../services/roomInventoryApi', () => ({
  roomInventoryApi: { view: jest.fn() },
}));

const api = roomInventoryApi as jest.Mocked<typeof roomInventoryApi>;

const data = {
  startDate: '2026-10-13',
  endDate: '2026-10-20',
  rooms: [
    {
      roomId: 'room-1',
      name: 'Room A',
      floor: 'Ground floor',
      occupants: [
        { _id: 'booster-1', name: 'Booster I', roomStayStart: '2026-10-13', roomStayEnd: '2026-10-16' },
        { _id: 'booster-2', name: 'Booster II', roomStayStart: '2026-10-17', roomStayEnd: '2026-10-20' },
      ],
      externalOccupants: [],
    },
    {
      roomId: 'room-2',
      name: 'Room B',
      floor: 'Ground floor',
      occupants: [],
      externalOccupants: [],
    },
  ],
};

beforeEach(() => {
  jest.resetAllMocks();
});

const mount = (retreatId = 'retreat-1') => render(<RetreatOccupancyTab retreatId={retreatId} />);

it('shows a loading state, then every room with its occupancy timeline', async () => {
  api.view.mockResolvedValue({ data } as any);
  mount();
  expect(screen.getByRole('status')).toHaveTextContent('Loading occupancy');
  await screen.findByText(/Room A$/);
  expect(screen.getByText('Booster I').title).toContain('3 nights');
  expect(screen.getByText('Booster II').title).toContain('3 nights');
  expect(screen.getByText(/Room B$/)).toBeInTheDocument();
  expect(screen.getByText('Unoccupied')).toBeInTheDocument();
});

it('shows an error when the occupancy report fails to load', async () => {
  api.view.mockRejectedValue(new Error('network down'));
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load room occupancy.');
});

it('reloads when the retreat id changes', async () => {
  api.view.mockResolvedValue({ data } as any);
  const { rerender } = mount('retreat-1');
  await screen.findByText(/Room A$/);
  expect(api.view).toHaveBeenCalledWith('retreat-1');
  rerender(<RetreatOccupancyTab retreatId="retreat-2" />);
  expect(await screen.findByRole('status')).toHaveTextContent('Loading occupancy');
  expect(api.view).toHaveBeenCalledWith('retreat-2');
});
