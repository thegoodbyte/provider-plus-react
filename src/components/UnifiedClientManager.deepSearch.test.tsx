import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UnifiedClientManager from './UnifiedClientManager';
import { clientsApi, bookingsApi, retreatsApi, referralsApi, notesApi } from '../services/api';

jest.mock('../services/api', () => ({
  clientsApi: { getAll: jest.fn(), update: jest.fn(), quickAdd: jest.fn() },
  bookingsApi: { getAll: jest.fn().mockResolvedValue({ data: [] }) },
  retreatsApi: { getAll: jest.fn().mockResolvedValue({ data: [] }) },
  referralsApi: { getAll: jest.fn().mockResolvedValue({ data: [] }) },
  notesApi: { getAll: jest.fn().mockResolvedValue({ data: [] }) },
}));
jest.mock('./useClientProfilePictureUrl', () => ({ useClientProfilePictureUrl: () => null }));

describe('UnifiedClientManager deep search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (clientsApi.getAll as jest.Mock).mockResolvedValue({
      data: [
        {
          _id: 'client-drugs',
          firstName: 'Dave',
          lastName: 'Bowman',
          email: 'dave@example.com',
          phone: '+1 555 123 4567',
          display_id: 1101,
          status: 'active',
          recreationalDrugs: 'Past crack cocaine use in college',
        },
        {
          _id: 'client-notes',
          firstName: 'Frank',
          lastName: 'Poole',
          email: 'frank@example.com',
          phone: '+1 555 987 6543',
          display_id: 1102,
          status: 'active',
          notes: 'Client mentioned anxiety and previous trauma',
        },
        {
          _id: 'client-plain',
          firstName: 'Arthur',
          lastName: 'Clarke',
          email: 'arthur@example.com',
          phone: '+1 555 000 1111',
          display_id: 1103,
          status: 'active',
        },
      ],
    });
    (notesApi.getAll as jest.Mock).mockResolvedValue({
      data: [
        {
          _id: 'note-1',
          clientId: 'client-plain',
          title: 'Special intake',
          content: 'Follow-up regarding dietary restrictions and crack addiction history',
        },
      ],
    });
  });

  it('filters clients by screening recreational drugs and shows match badge with snippet', async () => {
    render(
      <MemoryRouter>
        <UnifiedClientManager />
      </MemoryRouter>
    );

    await screen.findByText('Dave Bowman');
    expect(screen.getByText('Frank Poole')).toBeInTheDocument();
    expect(screen.getByText('Arthur Clarke')).toBeInTheDocument();

    const searchInput = screen.getByRole('textbox', { name: /search clients/i });
    fireEvent.change(searchInput, { target: { value: 'crack' } });

    await waitFor(() => {
      // Dave Bowman matched via recreationalDrugs
      expect(screen.getByText('Dave Bowman')).toBeInTheDocument();
      // Arthur Clarke matched via Note collection
      expect(screen.getByText('Arthur Clarke')).toBeInTheDocument();
      // Frank Poole did not match
      expect(screen.queryByText('Frank Poole')).not.toBeInTheDocument();
    });

    expect(screen.getAllByText(/Screening \(drugs\):/i).length).toBeGreaterThanOrEqual(1);
  });

  it('filters clients by notes and displays matching note snippet', async () => {
    render(
      <MemoryRouter>
        <UnifiedClientManager />
      </MemoryRouter>
    );

    await screen.findByText('Frank Poole');

    const searchInput = screen.getByRole('textbox', { name: /search clients/i });
    fireEvent.change(searchInput, { target: { value: 'trauma' } });

    await waitFor(() => {
      expect(screen.getByText('Frank Poole')).toBeInTheDocument();
      expect(screen.queryByText('Dave Bowman')).not.toBeInTheDocument();
      expect(screen.queryByText('Arthur Clarke')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/Note:/i)).toBeInTheDocument();
  });
});
