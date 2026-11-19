import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import RetreatsGrid from './RetreatsGrid';
import { retreatsApi, housesApi, bookingsApi, bookingFlowApi, referralsApi } from '../services/api';

jest.mock('../services/api', () => ({
  retreatsApi: {
    getAll: jest.fn(),
    delete: jest.fn(),
  },
  housesApi: {
    getAll: jest.fn(),
  },
  bookingsApi: {
    getAll: jest.fn(),
  },
  referralsApi: {
    getAll: jest.fn(),
  },
  bookingFlowApi: {
    getLibraryTemplates: jest.fn(),
    getMatrix: jest.fn(),
  },
}));

describe('RetreatsGrid header', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (retreatsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (housesApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (bookingsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (referralsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (bookingFlowApi.getLibraryTemplates as jest.Mock).mockResolvedValue({ data: [] });
    (bookingFlowApi.getMatrix as jest.Mock).mockResolvedValue({ data: { items: [], templates: [] } });
  });

  const renderGrid = () => render(
    <BrowserRouter>
      <RetreatsGrid />
    </BrowserRouter>
  );

  it('renders title and subtitle', async () => {
    renderGrid();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Retreats' })).toBeInTheDocument();
    });
    const heading = screen.getByRole('heading', { name: 'Retreats' }).closest('.retreat-register-heading') as HTMLElement;
    expect(heading).not.toBeNull();
    expect(heading).toHaveTextContent(/upcoming/);
    expect(heading).toHaveTextContent(/places still open/);
  });

  it('renders all 5 view-mode tabs and wires up the view-mode buttons', async () => {
    renderGrid();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Retreat List' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Retreat List' })).toHaveClass('is-active');
    expect(screen.getByRole('button', { name: 'Holistic View' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Referrals View' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Holistic View' }));
    expect(screen.getByRole('button', { name: 'Holistic View' })).toHaveClass('is-active');

    fireEvent.click(screen.getByRole('button', { name: 'Requirements' }));
    expect(screen.getByRole('button', { name: 'Requirements' })).toHaveClass('is-active');

    fireEvent.click(screen.getByRole('button', { name: 'Referrals View' }));
    expect(screen.getByRole('button', { name: 'Referrals View' })).toHaveClass('is-active');

    fireEvent.click(screen.getByRole('button', { name: 'Retreat List' }));
    expect(screen.getByRole('button', { name: 'Retreat List' })).toHaveClass('is-active');
  });

  it('renders Step Deadlines as a link to the booking-step-deadlines route', async () => {
    renderGrid();
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Step Deadlines' })).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'Step Deadlines' })).toHaveAttribute('href', '/admin/booking-step-deadlines');
  });

  it('shows search input and status select only when viewMode is "list"', async () => {
    renderGrid();
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Find retreat or code')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Filter retreats by status')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Holistic View' }));
    expect(screen.queryByPlaceholderText('Find retreat or code')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Filter retreats by status')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Requirements' }));
    expect(screen.queryByPlaceholderText('Find retreat or code')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Referrals View' }));
    expect(screen.queryByPlaceholderText('Find retreat or code')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retreat List' }));
    expect(screen.getByPlaceholderText('Find retreat or code')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter retreats by status')).toBeInTheDocument();
  });

  it('typing in search and changing the status select updates their values', async () => {
    renderGrid();
    const search = await screen.findByPlaceholderText('Find retreat or code');
    fireEvent.change(search, { target: { value: 'BEN-08' } });
    expect(search).toHaveValue('BEN-08');

    const statusSelect = screen.getByLabelText('Filter retreats by status') as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: 'full' } });
    expect(statusSelect).toHaveValue('full');
  });

  it('refresh button is icon-only with an accessible name, and calls fetchRetreats (retreatsApi.getAll) when clicked', async () => {
    renderGrid();
    await waitFor(() => {
      expect(retreatsApi.getAll).toHaveBeenCalledTimes(1);
    });

    const refreshButton = await screen.findByRole('button', { name: 'Refresh' });
    expect(refreshButton).toHaveAccessibleName('Refresh');
    expect(refreshButton.textContent).toBe('');

    fireEvent.click(refreshButton);
    await waitFor(() => {
      expect(retreatsApi.getAll).toHaveBeenCalledTimes(2);
    });
  });

  it('Add retreat button opens the add-retreat modal', async () => {
    renderGrid();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add retreat/i })).toBeInTheDocument();
    });

    expect(screen.queryByRole('heading', { name: 'Add New Retreat' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Add retreat/i }));

    expect(screen.getByRole('heading', { name: 'Add New Retreat' })).toBeInTheDocument();
  });
});
