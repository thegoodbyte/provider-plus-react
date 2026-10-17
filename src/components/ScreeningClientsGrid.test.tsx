import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ScreeningClientsGrid from './ScreeningClientsGrid';
import { clientsApi, notesApi } from '../services/api';
import { BrowserRouter } from 'react-router-dom';

jest.mock('../services/api', () => ({
  clientsApi: {
    getAll: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  notesApi: {
    getAll: jest.fn(),
  },
}));

describe('ScreeningClientsGrid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (clientsApi.getAll as jest.Mock).mockResolvedValue({
      data: [
        {
          _id: 'client-1',
          firstName: 'Robert',
          lastName: 'Paulson',
          display_id: 1050,
          phone: '+1 555 987 6543',
          email: 'robert@example.com',
          workflowStatus: 'screening_scheduled',
          recreationalDrugs: 'History of crack use in 2018',
        },
        {
          _id: 'client-2',
          firstName: 'Sarah',
          lastName: 'Connor',
          display_id: 1051,
          phone: '+1 555 111 2222',
          email: 'sarah@example.com',
          workflowStatus: 'screening_scheduled',
          recreationalDrugs: 'None',
        },
      ],
    });
    (notesApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
  });

  it('renders search input with screening placeholder', async () => {
    render(
      <BrowserRouter>
        <ScreeningClientsGrid />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search screening clients, screening info, notes/i)).toBeInTheDocument();
    });
  });

  it('filters clients by deep screening search term (e.g. crack) and displays snippet', async () => {
    render(
      <BrowserRouter>
        <ScreeningClientsGrid />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Robert Paulson')).toBeInTheDocument();
      expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
    });

    const searchInput = screen.getByRole('textbox', { name: /search screening clients/i });
    fireEvent.change(searchInput, { target: { value: 'crack' } });

    await waitFor(() => {
      expect(screen.getByText('Robert Paulson')).toBeInTheDocument();
      expect(screen.queryByText('Sarah Connor')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/crack/i)).toBeInTheDocument();
  });
});
