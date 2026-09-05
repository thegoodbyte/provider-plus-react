import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PaymentRequestForm from './PaymentRequestForm';
import {
  bookingsApi, ceremoniesApi, clientsApi, paymentRequestsApi, paymentRequestTypesApi, paymentsApi, retreatsApi, revolutPaymentLinksApi,
} from '../services/api';

jest.mock('../services/api', () => ({
  clientsApi: { getAll: jest.fn() },
  retreatsApi: { getAll: jest.fn() },
  paymentRequestTypesApi: { getAll: jest.fn() },
  paymentRequestsApi: { getNextDisplayIdFresh: jest.fn(), getAllFresh: jest.fn() },
  bookingsApi: { getByClient: jest.fn() },
  paymentsApi: { getByClient: jest.fn(), convertToUsd: jest.fn(), convert: jest.fn() },
  ceremoniesApi: { getByRetreat: jest.fn() },
  revolutPaymentLinksApi: { list: jest.fn().mockResolvedValue({ data: [] }) },
}));

jest.mock('./SearchableClientSelect', () => (props: any) => (
  <select aria-label="Client" value={props.selectedClientId || ''} onChange={(event) => props.onClientSelect(event.target.value)}>
    <option value="">Select client</option>
    {props.clients.map((client: any) => <option key={client._id} value={client._id}>{client.firstName} {client.lastName}</option>)}
  </select>
));
jest.mock('./SearchableRetreatSelect', () => (props: any) => (
  <select aria-label="Retreat" value={props.selectedRetreatId || ''} onChange={(event) => props.onRetreatSelect(event.target.value)}>
    <option value="">Select retreat</option>
    {props.retreats.map((retreat: any) => <option key={retreat._id} value={retreat._id}>{retreat.name}</option>)}
  </select>
));

const client1 = { _id: 'client-1', firstName: 'Alice', lastName: 'A', display_id: 1, email: 'alice@example.com' };
const retreat1 = { _id: 'retreat-1', name: 'JNO-01', ceremonyCount: 2 };
const requestTypeCatalog = [
  { _id: 't1', key: 'deposit', label: 'Deposit', active: true, sortOrder: 10, system: true },
  { _id: 't2', key: 'balance', label: 'Balance', active: true, sortOrder: 20, system: true },
  { _id: 't3', key: 'payment', label: 'Payment', active: true, sortOrder: 30, system: true },
];

const setUp = (overrides: Partial<Record<string, any>> = {}) => {
  (clientsApi.getAll as jest.Mock).mockResolvedValue({ data: overrides.clients ?? [client1] });
  (retreatsApi.getAll as jest.Mock).mockResolvedValue({ data: overrides.retreats ?? [retreat1] });
  (paymentRequestTypesApi.getAll as jest.Mock).mockResolvedValue({ data: overrides.requestTypes ?? requestTypeCatalog });
  (paymentRequestsApi.getNextDisplayIdFresh as jest.Mock).mockResolvedValue({ data: overrides.nextDisplayId ?? 2001 });
  (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({ data: overrides.existingRequests ?? [] });
  (bookingsApi.getByClient as jest.Mock).mockResolvedValue({ data: overrides.bookings ?? [] });
  (paymentsApi.getByClient as jest.Mock).mockResolvedValue({ data: overrides.payments ?? [] });
  (paymentsApi.convertToUsd as jest.Mock).mockResolvedValue({ data: { usd_amount: 100 } });
  (ceremoniesApi.getByRetreat as jest.Mock).mockResolvedValue({ data: overrides.ceremonies ?? [] });
  (revolutPaymentLinksApi.list as jest.Mock).mockResolvedValue({ data: [] });
};

const originalAlert = window.alert;

describe('PaymentRequestForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.alert = jest.fn();
    setUp();
  });
  afterAll(() => { window.alert = originalAlert; });

  const view = (props: Partial<React.ComponentProps<typeof PaymentRequestForm>> = {}) => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const onCancel = jest.fn();
    render(<PaymentRequestForm onSave={onSave} onCancel={onCancel} {...props} />);
    return { onSave, onCancel };
  };

  it('loads the next display ID and seeds the invoice number for a new request', async () => {
    view();
    await waitFor(() => expect(screen.getByLabelText('Invoice Number')).toHaveValue('2001'));
  });

  it('does not fetch a next display ID when editing an existing request', async () => {
    view({ isEdit: true, paymentRequest: { _id: 'pr-1', display_id: 500, invoiceNumber: '500' } });
    await screen.findByLabelText('Client');
    expect(paymentRequestsApi.getNextDisplayIdFresh).not.toHaveBeenCalled();
  });

  it('renders Request Type options from the configurable catalog', async () => {
    view();
    await screen.findByLabelText('Client');
    expect(screen.getByRole('option', { name: 'Deposit' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Balance' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Payment' })).toBeInTheDocument();
  });

  describe('active booking defaults (PPVC-567)', () => {
    const booking = { _id: 'booking-1', retreatId: 'retreat-1', totalAmount: 5000, amountPaid: 1500, currency: 'PLN', status: 'confirmed', checkInDate: '2026-06-01', bookingType: 'full_retreat' };

    it('preselects the retreat, switches to balance, and prefills the full price and remaining balance', async () => {
      setUp({ bookings: [booking] });
      view();

      fireEvent.change(await screen.findByLabelText('Client'), { target: { value: 'client-1' } });

      await waitFor(() => expect(screen.getByLabelText('Retreat')).toHaveValue('retreat-1'));
      const select = screen.getByDisplayValue('Balance') as HTMLSelectElement;
      expect(select.value).toBe('balance');
      expect(screen.getByLabelText('Requested Amount *')).toHaveValue(3500);
      expect(screen.getByText(/5,000 PLN/)).toBeInTheDocument();
    });

    it('defaults the currency to the last completed payment on that booking, not the booking currency', async () => {
      setUp({
        bookings: [booking],
        payments: [{ bookingId: 'booking-1', status: 'completed', currency: 'EUR', paymentDate: '2026-05-01' }],
      });
      view();

      fireEvent.change(await screen.findByLabelText('Client'), { target: { value: 'client-1' } });

      await waitFor(() => expect(screen.getByLabelText('Currency *')).toHaveValue('EUR'));
    });

    it('shows a message and leaves the form untouched when the client has no active booking', async () => {
      setUp({ bookings: [] });
      view();

      fireEvent.change(await screen.findByLabelText('Client'), { target: { value: 'client-1' } });

      expect(await screen.findByText('No active booking found for this client.')).toBeInTheDocument();
      expect(screen.getByLabelText('Retreat')).toHaveValue('');
    });
  });

  it('auto-calculates the requested amount as 40% of the full price for a deposit', async () => {
    view();
    await screen.findByLabelText('Client');

    fireEvent.change(screen.getByLabelText('Full Booking Price *'), { target: { value: '1000' } });

    await waitFor(() => expect(screen.getByLabelText('Requested Amount *')).toHaveValue(400));
  });

  it('blocks saving when another payment request already uses the same invoice number', async () => {
    setUp({ existingRequests: [{ _id: 'other', invoiceNumber: '2001' }] });
    const { onSave } = view();
    await screen.findByLabelText('Client');

    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'client-1' } });
    fireEvent.change(screen.getByLabelText('Retreat'), { target: { value: 'retreat-1' } });
    fireEvent.change(screen.getByLabelText('Full Booking Price *'), { target: { value: '1000' } });
    fireEvent.click(screen.getByText('Create Request'));

    expect(await screen.findByText(/Invoice number 2001 already exists/)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('alerts and refuses to save when required fields are missing', async () => {
    view();
    await screen.findByLabelText('Client');

    fireEvent.click(screen.getByText('Create Request'));

    expect(window.alert).toHaveBeenCalledWith('Please fill in all required fields');
  });

  it('blocks saving when the itemized total has a row missing a description or amount', async () => {
    const { onSave } = view();
    await screen.findByLabelText('Client');

    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'client-1' } });
    fireEvent.change(screen.getByLabelText('Retreat'), { target: { value: 'retreat-1' } });
    fireEvent.change(screen.getByLabelText('Full Booking Price *'), { target: { value: '1000' } });
    fireEvent.click(screen.getByLabelText('Itemize this payment request'));
    fireEvent.click(screen.getByText('Create Request'));

    expect(await screen.findByText(/Every itemized row needs a description/)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves a non-itemized request with the expected payload', async () => {
    const { onSave } = view();
    await screen.findByLabelText('Client');

    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'client-1' } });
    fireEvent.change(screen.getByLabelText('Retreat'), { target: { value: 'retreat-1' } });
    fireEvent.change(screen.getByLabelText('Full Booking Price *'), { target: { value: '1000' } });
    fireEvent.click(screen.getByText('Create Request'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 'client-1',
      retreatId: 'retreat-1',
      requestType: 'deposit',
      requestedAmount: 400,
      fullPriceQuote: 1000,
      invoiceNumber: '2001',
    })));
  });
});
