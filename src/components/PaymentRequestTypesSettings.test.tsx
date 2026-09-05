import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PaymentRequestTypesSettings from './PaymentRequestTypesSettings';
import { paymentRequestTypesApi } from '../services/api';

jest.mock('../services/api', () => ({
  paymentRequestTypesApi: { getAll: jest.fn(), create: jest.fn(), update: jest.fn() },
}));

const baseTypes = [
  { _id: '1', key: 'deposit', label: 'Deposit', active: true, sortOrder: 10, system: true },
  { _id: '2', key: 'balance', label: 'Balance', active: true, sortOrder: 20, system: true },
];

describe('PaymentRequestTypesSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (paymentRequestTypesApi.getAll as jest.Mock).mockResolvedValue({ data: baseTypes });
  });

  it('lists the configured types', async () => {
    render(<PaymentRequestTypesSettings />);
    expect(await screen.findByText('deposit')).toBeInTheDocument();
    expect(screen.getByText('balance')).toBeInTheDocument();
  });

  it('saves an edited label and sort order for an existing type', async () => {
    render(<PaymentRequestTypesSettings />);
    await screen.findByText('deposit');

    fireEvent.change(screen.getByLabelText('Label for deposit'), { target: { value: 'Deposit (upfront)' } });
    fireEvent.change(screen.getByLabelText('Sort order for deposit'), { target: { value: '5' } });
    fireEvent.click(screen.getAllByText('Save')[0]);

    await waitFor(() => expect(paymentRequestTypesApi.update).toHaveBeenCalledWith('deposit', { label: 'Deposit (upfront)', active: true, sortOrder: 5 }));
  });

  it('adds a new payment request type', async () => {
    (paymentRequestTypesApi.create as jest.Mock).mockResolvedValue({ data: { _id: '3', key: 'installment', label: 'Installment', active: true, sortOrder: 120, system: false } });
    render(<PaymentRequestTypesSettings />);
    await screen.findByText('deposit');

    fireEvent.change(screen.getByPlaceholderText('immutable_id'), { target: { value: 'installment' } });
    fireEvent.change(screen.getByPlaceholderText('Display label'), { target: { value: 'Installment' } });
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => expect(paymentRequestTypesApi.create).toHaveBeenCalledWith({ key: 'installment', label: 'Installment', sortOrder: 120 }));
  });

  it('shows an error message when saving fails', async () => {
    (paymentRequestTypesApi.update as jest.Mock).mockRejectedValue({ response: { data: { message: 'Payment request type label is required.' } } });
    render(<PaymentRequestTypesSettings />);
    await screen.findByText('deposit');

    fireEvent.click(screen.getAllByText('Save')[0]);

    expect(await screen.findByText('Payment request type label is required.')).toBeInTheDocument();
  });
});
