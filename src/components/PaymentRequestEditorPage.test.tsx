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
    getNextDisplayIdFresh: jest.fn(), getAllFresh: jest.fn(), cancel: jest.fn(),
    getIdentityChange: jest.fn().mockResolvedValue({ data: null }),
  },
  auditLogsApi: { getAll: jest.fn().mockResolvedValue({ data: { items: [] } }) },
  paymentsApi: { getPlanSettings: jest.fn().mockResolvedValue({ data: { depositPercentage: 40, balanceDueDaysBeforeRetreat: 30 } }), getReceipt: jest.fn(), getByClient: jest.fn(), convertToUsd: jest.fn() },
  clientsApi: { getAll: jest.fn() },
  retreatsApi: { getAll: jest.fn() },
  paymentRequestTypesApi: { getAll: jest.fn() },
  bookingsApi: { getAllFresh: jest.fn().mockResolvedValue({ data: [] }), getByClient: jest.fn() },
  ceremoniesApi: { getByRetreat: jest.fn() },
  revolutPaymentLinksApi: { list: jest.fn() },
}));

jest.mock('../services/roomInventoryApi', () => ({
  roomInventoryApi: {
    options: () => Promise.resolve({ data: [] }),
    preference: () => Promise.resolve({ data: null }),
    paymentAccommodation: () => Promise.resolve({ data: null }),
  },
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
    (paymentsApi.getPlanSettings as jest.Mock).mockResolvedValue({ data: { depositPercentage: 40, balanceDueDaysBeforeRetreat: 30 } });
    (clientsApi.getAll as jest.Mock).mockResolvedValue({ data: [client1] });
    (retreatsApi.getAll as jest.Mock).mockResolvedValue({ data: [retreat1] });
    (paymentRequestTypesApi.getAll as jest.Mock).mockResolvedValue({ data: requestTypeCatalog });
    (paymentRequestsApi.getNextDisplayIdFresh as jest.Mock).mockResolvedValue({ data: 2001 });
    (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({ data: [] });
    (bookingsApi.getAllFresh as jest.Mock).mockResolvedValue({ data: [] });
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
    fireEvent.change(screen.getByLabelText('Base Booking Price *'), { target: { value: '1000' } });
    await waitFor(() => expect(screen.getByLabelText('Requested Amount *')).toHaveValue(400));
    fireEvent.click(screen.getByLabelText('Also create the final payment request'));
    expect((await screen.findAllByText(/600/)).length).toBeGreaterThan(0);

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
    fireEvent.change(screen.getByLabelText('Base Booking Price *'), { target: { value: '1000' } });
    fireEvent.click(screen.getByText('Create Request'));

    await waitFor(() => expect(paymentRequestsApi.create).toHaveBeenCalledTimes(1));
    expect(paymentRequestsApi.link).not.toHaveBeenCalled();
    await screen.findByText('Payment requests list');
  });

  it('allows staff to cancel an invoice (storno) with a reason in view mode', async () => {
    const existing = {
      _id: 'req-1', invoiceNumber: 'INV-1086', status: 'pending',
      requestedAmount: 905, currency: 'EUR', clientId: client1, retreatId: retreat1,
    };
    (paymentRequestsApi.getOne as jest.Mock).mockResolvedValue({ data: existing });
    (paymentRequestsApi.cancel as jest.Mock).mockResolvedValue({
      data: { ...existing, status: 'cancelled', cancellationReason: 'Client did not pay', cancelledAt: '2026-10-14' },
    });

    render(
      <MemoryRouter initialEntries={['/admin/payment-requests/req-1']}>
        <Routes>
          <Route path="/admin/payment-requests/:id" element={<PaymentRequestEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Invoice INV-1086' })).toBeInTheDocument();
    const stornoButton = screen.getByRole('button', { name: 'Cancel Invoice (Storno)' });
    fireEvent.click(stornoButton);

    expect(screen.getByRole('heading', { name: 'Cancel Invoice (Storno)' })).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to cancel Invoice #INV-1086\?/)).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: 'Confirm Cancellation' });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(paymentRequestsApi.cancel).toHaveBeenCalledWith('req-1', 'Client did not pay'));
    expect(await screen.findByText('Cancelled (Storno)')).toBeInTheDocument();
    expect(screen.getByText('Reason: Client did not pay')).toBeInTheDocument();
  });

  it('displays cancellation details when viewing an already cancelled invoice', async () => {
    const cancelled = {
      _id: 'req-2', invoiceNumber: 'INV-1087', status: 'cancelled',
      cancellationReason: 'Booking cancelled by guest', cancelledBy: 'admin@example.com',
      requestedAmount: 500, currency: 'EUR', clientId: client1, retreatId: retreat1,
    };
    (paymentRequestsApi.getOne as jest.Mock).mockResolvedValue({ data: cancelled });

    render(
      <MemoryRouter initialEntries={['/admin/payment-requests/req-2']}>
        <Routes>
          <Route path="/admin/payment-requests/:id" element={<PaymentRequestEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Cancelled (Storno)')).toBeInTheDocument();
    expect(screen.getByText('Reason: Booking cancelled by guest')).toBeInTheDocument();
    expect(screen.getByText(/by admin@example.com/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel Invoice (Storno)' })).not.toBeInTheDocument();
  });
});
