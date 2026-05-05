import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaymentsPage from './PaymentsPage';
import * as api from '../services/api';

// Mock the API module
jest.mock('../services/api');

describe('PaymentsPage', () => {
  const mockPayments = [
    {
      _id: '1',
      clientId: 'client1',
      retreatId: 'retreat1',
      amount: 1000,
      currency: 'EUR' as const,
      status: 'completed' as const,
      paymentMethod: 'bank_transfer' as const,
      paymentType: 'regular_payment' as const,
      paymentDate: new Date('2024-01-01'),
      isRefundable: false,
    },
    {
      _id: '2',
      clientId: 'client2',
      retreatId: 'retreat2',
      amount: 500,
      currency: 'USD' as const,
      status: 'pending' as const,
      paymentMethod: 'card' as const,
      paymentType: 'deposit_refundable' as const,
      paymentDate: new Date('2024-01-02'),
      isRefundable: true,
    },
  ];

  const mockClients = [
    { _id: 'client1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
    { _id: 'client2', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
  ];

  const mockRetreats = [
    { _id: 'retreat1', name: 'Summer Retreat', startDate: new Date('2024-06-01') },
    { _id: 'retreat2', name: 'Winter Retreat', startDate: new Date('2024-12-01') },
  ];

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup default mock implementations
    (api.paymentsApi.getAll as jest.Mock).mockResolvedValue({ data: mockPayments });
    (api.clientsApi.getAll as jest.Mock).mockResolvedValue({ data: mockClients });
    (api.retreatsApi.getAll as jest.Mock).mockResolvedValue({ data: mockRetreats });
  });

  test('renders payments page with heading', async () => {
    render(<PaymentsPage />);

    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('Loading payments...')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText('Loading payments...')).not.toBeInTheDocument();
    });
  });

  test('loads and displays payments', async () => {
    render(<PaymentsPage />);

    await waitFor(() => {
      // Check if payment data is displayed
      expect(screen.getByText('1,000.00')).toBeInTheDocument(); // Amount formatted
      expect(screen.getByText('500.00')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
      expect(screen.getByText('pending')).toBeInTheDocument();
    });

    // Verify API calls
    expect(api.paymentsApi.getAll).toHaveBeenCalledTimes(1);
    expect(api.clientsApi.getAll).toHaveBeenCalledTimes(1);
    expect(api.retreatsApi.getAll).toHaveBeenCalledTimes(1);
  });

  test('opens add payment modal when Add Payment button is clicked', async () => {
    render(<PaymentsPage />);

    await waitFor(() => {
      expect(screen.queryByText('Loading payments...')).not.toBeInTheDocument();
    });

    const addButton = screen.getByRole('button', { name: /add payment/i });
    fireEvent.click(addButton);

    // Modal should be visible
    expect(screen.getByText('Add New Payment')).toBeInTheDocument();
    expect(screen.getByLabelText(/client/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/retreat/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
  });

  test('closes modal when cancel button is clicked', async () => {
    render(<PaymentsPage />);

    await waitFor(() => {
      expect(screen.queryByText('Loading payments...')).not.toBeInTheDocument();
    });

    // Open modal
    const addButton = screen.getByRole('button', { name: /add payment/i });
    fireEvent.click(addButton);

    expect(screen.getByText('Add New Payment')).toBeInTheDocument();

    // Close modal
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    // Modal should be closed
    expect(screen.queryByText('Add New Payment')).not.toBeInTheDocument();
  });

  test('submits new payment form', async () => {
    (api.paymentsApi.create as jest.Mock).mockResolvedValue({ data: { ...mockPayments[0], _id: '3' } });

    render(<PaymentsPage />);

    await waitFor(() => {
      expect(screen.queryByText('Loading payments...')).not.toBeInTheDocument();
    });

    // Open modal
    const addButton = screen.getByRole('button', { name: /add payment/i });
    fireEvent.click(addButton);

    // Fill form
    const clientSelect = screen.getByLabelText(/client/i);
    const retreatSelect = screen.getByLabelText(/retreat/i);
    const amountInput = screen.getByLabelText(/amount/i);

    await userEvent.selectOptions(clientSelect, 'client1');
    await userEvent.selectOptions(retreatSelect, 'retreat1');
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, '1500');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /add payment$/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(api.paymentsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client1',
          retreatId: 'retreat1',
          amount: 1500,
        })
      );
    });
  });

  test('deletes payment when delete button is clicked', async () => {
    window.confirm = jest.fn(() => true);
    (api.paymentsApi.delete as jest.Mock).mockResolvedValue({ data: {} });

    render(<PaymentsPage />);

    await waitFor(() => {
      expect(screen.queryByText('Loading payments...')).not.toBeInTheDocument();
    });

    // Find and click delete button
    const deleteButtons = screen.getAllByTitle('Delete');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this payment?');
      expect(api.paymentsApi.delete).toHaveBeenCalledWith('1');
    });
  });

  test('displays payment statistics', async () => {
    render(<PaymentsPage />);

    await waitFor(() => {
      expect(screen.queryByText('Loading payments...')).not.toBeInTheDocument();
    });

    // Check statistics display
    expect(screen.getByText(/showing 2 payments/i)).toBeInTheDocument();
    expect(screen.getByText(/total: 1 completed/i)).toBeInTheDocument();
    expect(screen.getByText(/pending: 1/i)).toBeInTheDocument();
  });

  test('handles API errors gracefully', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    (api.paymentsApi.getAll as jest.Mock).mockRejectedValue(new Error('API Error'));

    render(<PaymentsPage />);

    await waitFor(() => {
      expect(screen.queryByText('Loading payments...')).not.toBeInTheDocument();
    });

    expect(consoleError).toHaveBeenCalledWith('Error fetching payments:', expect.any(Error));

    consoleError.mockRestore();
  });
});