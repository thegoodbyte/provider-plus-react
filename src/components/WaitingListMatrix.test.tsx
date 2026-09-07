import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import WaitingListMatrix from './WaitingListMatrix';
import { waitingListApi, clientsApi } from '../services/api';

jest.mock('../services/api', () => ({
  waitingListApi: {
    getMatrix: jest.fn(),
    addToWaitingList: jest.fn(),
    removeFromWaitingList: jest.fn(),
    updatePositions: jest.fn(),
  },
  clientsApi: {
    searchClients: jest.fn(),
  },
}));

const mockedWaitingListApi = waitingListApi as jest.Mocked<typeof waitingListApi>;
const mockedClientsApi = clientsApi as jest.Mocked<typeof clientsApi>;

const matrix = [
  {
    _id: 'col-1',
    retreat: {
      _id: 'r1',
      name: 'September Retreat',
      startDate: '2026-09-10',
      endDate: '2026-09-17',
      location: 'Bali',
      capacity: 10,
      currentOccupancy: 8,
    },
    waitingList: [
      {
        id: 'w1',
        position: 1,
        status: 'waiting',
        priority: 'high',
        joinedDate: '2026-08-01',
        client: { id: 'c1', name: 'Anna Nowak', email: 'anna@example.com', phone: '123456' },
        notes: '',
        noticeDays: 3,
        source: 'iboga_ready',
      },
      {
        id: 'w2',
        position: 2,
        status: 'waiting',
        priority: 'low',
        joinedDate: '2026-08-05',
        client: { id: 'c2', name: 'Jan Kowalski', email: 'jan@example.com', phone: '654321' },
        notes: 'Prefers a window seat',
        noticeDays: 7,
        source: 'admin',
      },
    ],
  },
];

describe('WaitingListMatrix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedWaitingListApi.getMatrix.mockResolvedValue({ data: matrix } as any);
  });

  it('renders each retreat as a row-section (holistic-group) with clients listed one row per client below it', async () => {
    render(<WaitingListMatrix />);

    const group = (await screen.findByText('September Retreat')).closest('section');
    expect(group).not.toBeNull();
    expect(group).toHaveClass('holistic-group');

    const withinGroup = within(group as HTMLElement);
    expect(withinGroup.getByText('Anna Nowak')).toBeInTheDocument();
    expect(withinGroup.getByText('Jan Kowalski')).toBeInTheDocument();
  });

  it('toggles the client table visibility per retreat', async () => {
    render(<WaitingListMatrix />);
    await screen.findByText('Anna Nowak');

    fireEvent.click(screen.getByRole('button', { name: 'Hide people' }));
    expect(screen.queryByText('Anna Nowak')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show people' }));
    expect(await screen.findByText('Anna Nowak')).toBeInTheDocument();
  });

  it('searches and adds a client to a retreat waiting list', async () => {
    mockedClientsApi.searchClients.mockResolvedValue({
      data: [{ _id: 'c3', firstName: 'Maria', lastName: 'Lopez', email: 'maria@example.com', phone: '111' }],
    } as any);
    mockedWaitingListApi.addToWaitingList.mockResolvedValue({ data: {} } as any);

    render(<WaitingListMatrix />);
    await screen.findByText('Anna Nowak');

    fireEvent.change(screen.getByPlaceholderText('Search clients to add...'), { target: { value: 'mar' } });
    await waitFor(() => expect(mockedClientsApi.searchClients).toHaveBeenCalledWith('mar'));

    fireEvent.click(await screen.findByText('Maria Lopez'));

    await waitFor(() =>
      expect(mockedWaitingListApi.addToWaitingList).toHaveBeenCalledWith({
        clientId: 'c3',
        retreatId: 'col-1',
        priority: 'medium',
      })
    );
  });

  it('moves a client position up and down', async () => {
    mockedWaitingListApi.updatePositions.mockResolvedValue({ data: {} } as any);
    render(<WaitingListMatrix />);
    await screen.findByText('Anna Nowak');

    fireEvent.click(screen.getAllByTitle('Move down')[0]);
    await waitFor(() =>
      expect(mockedWaitingListApi.updatePositions).toHaveBeenCalledWith('col-1', {
        positions: [{ waitingListId: 'w1', newPosition: 2 }],
      })
    );
  });

  it('removes a client from the waiting list after confirmation', async () => {
    window.confirm = jest.fn(() => true);
    mockedWaitingListApi.removeFromWaitingList.mockResolvedValue({ data: {} } as any);
    render(<WaitingListMatrix />);
    await screen.findByText('Anna Nowak');

    fireEvent.click(screen.getAllByTitle('Remove from list')[0]);
    await waitFor(() => expect(mockedWaitingListApi.removeFromWaitingList).toHaveBeenCalledWith('w1'));
  });

  it('shows an empty state when there are no upcoming retreats', async () => {
    mockedWaitingListApi.getMatrix.mockResolvedValue({ data: [] } as any);
    render(<WaitingListMatrix />);
    expect(await screen.findByText('No Upcoming Retreats')).toBeInTheDocument();
  });
});
