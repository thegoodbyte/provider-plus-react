import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PaymentRequestEditorPage from './PaymentRequestEditorPage';
import {
  bookingsApi, ceremoniesApi, clientsApi, paymentRequestsApi, paymentRequestTypesApi,
  paymentsApi, retreatsApi, revolutPaymentLinksApi,
} from '../services/api';

jest.mock('../services/api', () => ({
  paymentRequestsApi: {
    getOne: jest.fn(), create: jest.fn(), update: jest.fn(), link: jest.fn(),
    getNextDisplayIdFresh: jest.fn(), getAllFresh: jest.fn(),
  },
  paymentsApi: { getReceipt: jest.fn(), getByClient: jest.fn(), convertToUsd: jest.fn() },
  clientsApi: { getAll: jest.fn() },
  retreatsApi: { getAll: jest.fn() },
  paymentRequestTypesApi: { getAll: jest.fn() },
  bookingsApi: { getByClient: jest.fn() },
  ceremoniesApi: { getByRetreat: jest.fn() },
  revolutPaymentLinksApi: { list: jest.fn() },
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
const retreat1 = { _id: 'retreat-1', name: 'JNO-01', ceremonyCount: 2, startDate: '2026-12-15' };
const requestTypeCatalog = [
  { _id: 't1', key: 'deposit', label: 'Deposit', active: true, sortOrder: 10, system: true },
  { _id: 't2', key: 'balance', label: 'Balance', active: true, sortOrder: 20, system: true },
];

const renderNew = () => render(
  <MemoryRouter initialEntries={['/admin/payment-requests/new']}>
    <Routes>
      <Route path="/admin/payment-requests/new" element={<PaymentRequestEditorPage />} />
      <Route path="/admin/payment-requests" element={<div>Payment requests list</div>} />
    </Routes>
  </MemoryRouter>,
);

describe('PaymentRequestEditorPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (clientsApi.getAll as jest.Mock).mockResolvedValue({ data: [client1] });
    (retreatsApi.getAll as jest.Mock).mockResolvedValue({ data: [retreat1] });
    (paymentRequestTypesApi.getAll as jest.Mock).mockResolvedValue({ data: requestTypeCatalog });
    (paymentRequestsApi.getNextDisplayIdFresh as jest.Mock).mockResolvedValue({ data: 2001 });
    (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({ data: [] });
    (bookingsApi.getByClient as jest.Mock).mockResolvedValue({ data: [] });
    (paymentsApi.getByClient as jest.Mock).mockResolvedValue({ data: [] });
    (paymentsApi.convertToUsd as jest.Mock).mockResolvedValue({ data: { usd_amount: 100 } });
    (ceremoniesApi.getByRetreat as jest.Mock).mockResolvedValue({ data: [] });
    (revolutPaymentLinksApi.list as jest.Mock).mockResolvedValue({ data: [] });
  });

  it('creates the deposit, then the final balance request, then links them together', async () => {
    const deposit = {
      _id: 'deposit-1', invoiceNumber: '2001', clientId: 'client-1', retreatId: 'retreat-1',
      bookingType: 'full_retreat', paymentDate: '2026-01-01', paymentType: 'Other',
    };
    const finalRequest = { _id: 'final-1' };
    (paymentRequestsApi.create as jest.Mock)
      .mockResolvedValueOnce({ data: deposit })
      .mockResolvedValueOnce({ data: finalRequest });
    (paymentRequestsApi.link as jest.Mock).mockResolvedValue({ data: {} });

    renderNew();
    await screen.findByLabelText('Client');

    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'client-1' } });
    fireEvent.change(screen.getByLabelText('Retreat'), { target: { value: 'retreat-1' } });
    fireEvent.change(screen.getByLabelText('Full Booking Price *'), { target: { value: '1000' } });
    await waitFor(() => expect(screen.getByLabelText('Requested Amount *')).toHaveValue(400));
    fireEvent.click(screen.getByLabelText('Also create the final payment request'));
    await screen.findByText(/600/);

    fireEvent.click(screen.getByText('Create Request'));

    await waitFor(() => expect(paymentRequestsApi.create).toHaveBeenCalledTimes(2));
    expect(paymentRequestsApi.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      requestType: 'balance',
      requestedAmount: 600,
      fullPrice: 1000,
      dueDate: '2026-11-15',
      clientId: 'client-1',
      retreatId: 'retreat-1',
    }));
    await waitFor(() => expect(paymentRequestsApi.link).toHaveBeenCalledWith('deposit-1', 'final-1'));
    await screen.findByText('Payment requests list');
  });

  it('creates only the deposit, and never links, when the checkbox is left unchecked', async () => {
    (paymentRequestsApi.create as jest.Mock).mockResolvedValue({ data: { _id: 'deposit-1' } });

    renderNew();
    await screen.findByLabelText('Client');

    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'client-1' } });
    fireEvent.change(screen.getByLabelText('Retreat'), { target: { value: 'retreat-1' } });
    fireEvent.change(screen.getByLabelText('Full Booking Price *'), { target: { value: '1000' } });
    fireEvent.click(screen.getByText('Create Request'));

    await waitFor(() => expect(paymentRequestsApi.create).toHaveBeenCalledTimes(1));
    expect(paymentRequestsApi.link).not.toHaveBeenCalled();
    await screen.findByText('Payment requests list');
  });
});
