import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GlobalSearch from './GlobalSearch';
import {
  clientsApi,
  bookingsApi,
  retreatsApi,
  medicalArtifactsApi,
  medicalReviewRequestsApi,
  paymentsApi,
  paymentRequestsApi,
  bookingDocumentsApi,
  notesApi,
} from '../services/api';

jest.mock('../services/api', () => ({
  clientsApi: { getAll: jest.fn() },
  bookingsApi: { getAll: jest.fn() },
  retreatsApi: { getAll: jest.fn() },
  medicalArtifactsApi: { getAll: jest.fn() },
  medicalReviewRequestsApi: { getAll: jest.fn() },
  paymentsApi: { getAll: jest.fn() },
  paymentRequestsApi: { getAll: jest.fn() },
  bookingDocumentsApi: { getAll: jest.fn() },
  notesApi: { getAll: jest.fn() },
}));

describe('GlobalSearch', () => {
  const onNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (clientsApi.getAll as jest.Mock).mockResolvedValue({
      data: [
        {
          _id: 'client-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '+1 555 123 4567',
          display_id: 1042,
          recreationalDrugs: 'Previous crack cocaine use, sober 5 years',
          screeningData: { generalNotes: 'Client very eager' },
        },
      ],
    });
    (bookingsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (retreatsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (medicalArtifactsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (medicalReviewRequestsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (paymentsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (paymentRequestsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (bookingDocumentsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (notesApi.getAll as jest.Mock).mockResolvedValue({
      data: [
        {
          _id: 'note-1',
          clientId: 'client-1',
          title: 'Intake discussion',
          content: 'Discussed past addiction and crack recovery journey',
        },
      ],
    });
  });

  it('renders search input with expanded placeholder', () => {
    render(<GlobalSearch routePrefix="admin" onNavigate={onNavigate} />);
    expect(screen.getByPlaceholderText(/Search clients, screening, notes/i)).toBeInTheDocument();
  });

  it('finds client by screening substance (e.g. crack) and displays snippet', async () => {
    render(<GlobalSearch routePrefix="admin" onNavigate={onNavigate} />);
    const input = screen.getByRole('textbox', { name: /global search/i });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'crack' } });

    await waitFor(() => {
      expect(screen.getByText('1042 · John Doe')).toBeInTheDocument();
    });

    const matchesWithCrack = screen.getAllByText(/crack/i);
    expect(matchesWithCrack.length).toBeGreaterThanOrEqual(1);
    expect(matchesWithCrack[0]).toHaveTextContent(/crack/i);
  });

  it('navigates to client page when client match is clicked', async () => {
    render(<GlobalSearch routePrefix="admin" onNavigate={onNavigate} />);
    const input = screen.getByRole('textbox', { name: /global search/i });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'John' } });

    await waitFor(() => {
      expect(screen.getByText('1042 · John Doe')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('1042 · John Doe'));
    expect(onNavigate).toHaveBeenCalledWith('/admin/clients/client-1');
  });

  it('matches Note by title or content and navigates to the associated client', async () => {
    render(<GlobalSearch routePrefix="admin" onNavigate={onNavigate} />);
    const input = screen.getByRole('textbox', { name: /global search/i });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Intake' } });

    await waitFor(() => {
      expect(screen.getByText('Intake discussion · John Doe')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Intake discussion · John Doe'));
    expect(onNavigate).toHaveBeenCalledWith('/admin/clients/client-1');
  });
});
