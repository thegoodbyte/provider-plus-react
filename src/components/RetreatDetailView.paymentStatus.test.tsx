import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RetreatDetailView from './RetreatDetailView';
import { retreatsApi, bookingsApi, retreatExpensesApi, paymentsApi, bookingFlowApi, communicationsApi } from '../services/api';

jest.mock('../services/authService', () => ({ authService: { getUser: () => ({ role: 'admin' }) } }));
jest.mock('../services/api', () => ({
  retreatsApi: { getOne: jest.fn(async () => ({ data: { _id: 'r1', name: 'Fixture retreat', code: 'FIXTURE', currency: 'EUR' } })), getAll: jest.fn(async () => ({ data: [] })) },
  bookingsApi: { getByRetreatWithDetails: jest.fn() },
  retreatExpensesApi: { getRetreatSummary: jest.fn(async () => ({ data: { totalExpenses: 0, categories: [] } })) },
  paymentsApi: { getByBooking: jest.fn(async () => ({ data: [] })) },
  clientsApi: {},
  bookingFlowApi: { getTemplates: jest.fn(async () => ({ data: [] })) },
  communicationsApi: { getTemplates: jest.fn(async () => ({ data: [] })), getAssets: jest.fn(async () => ({ data: [] })), previewEmail: jest.fn(), translateRetreatMessage: jest.fn(), sendRetreatEmail: jest.fn() },
}));
jest.mock('./retreatUsdTotals', () => ({ quoteBookingUsd: async () => 0, retreatExpectedUsd: () => 0 }));
jest.mock('./ExpensesTab', () => () => null);
jest.mock('./PaymentsTab', () => () => null);
jest.mock('./ClientDetailView', () => () => null);
jest.mock('./CeremoniesGrid', () => () => null);
jest.mock('./SearchableClientSelector', () => () => null);
jest.mock('./RetreatTrackingGrid', () => () => null);
jest.mock('./FoodMatrixGrid', () => () => null);
jest.mock('./RetreatAiSummaryTab', () => () => null);
jest.mock('./DrugScreeningTab', () => () => null);
jest.mock('./BookingStepsMatrix', () => () => null);
jest.mock('./RetreatReserveListPanel', () => () => null);
jest.mock('./RoomAllocationBoard', () => () => null);
jest.mock('./Tasks/TasksWidget', () => ({ TasksWidget: () => null }));

(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
Object.defineProperty(window, 'matchMedia', { writable: true, value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });

const baseClient = { _id: 'b1', clientId: { _id: 'c1', firstName: 'Alex', lastName: 'Fixture', email: 'alex@example.test' }, status: 'confirmed', currency: 'EUR' };

// This suite's jest config sets resetMocks: true, which wipes any
// implementation set inside the jest.mock(...) factory before every test --
// every mock used here must be re-armed per test, not just declared once.
beforeEach(() => {
  (retreatsApi.getOne as jest.Mock).mockResolvedValue({ data: { _id: 'r1', name: 'Fixture retreat', code: 'FIXTURE', currency: 'EUR' } });
  (retreatsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
  (retreatExpensesApi.getRetreatSummary as jest.Mock).mockResolvedValue({ data: { totalExpenses: 0, categories: [] } });
  (paymentsApi.getByBooking as jest.Mock).mockResolvedValue({ data: [] });
  (bookingFlowApi.getTemplates as jest.Mock).mockResolvedValue({ data: [] });
  (communicationsApi.getTemplates as jest.Mock).mockResolvedValue({ data: [] });
  (communicationsApi.getAssets as jest.Mock).mockResolvedValue({ data: [] });
});

// amountPaid is derived by RetreatDetailView from actual completed Payment
// records (paymentsApi.getByBooking), not from a raw amountPaid field on the
// booking -- so "how much was paid" is expressed as a payment, not a prop.
const renderWithBooking = async (bookingOverrides: Record<string, any>, amountPaid = 0) => {
  (bookingsApi.getByRetreatWithDetails as jest.Mock).mockResolvedValue({ data: [{ ...baseClient, ...bookingOverrides }] });
  if (amountPaid > 0) {
    (paymentsApi.getByBooking as jest.Mock).mockResolvedValue({
      data: [{ _id: 'p1', clientId: 'c1', retreatId: 'r1', amount: amountPaid, currency: 'EUR', status: 'completed', paymentMethod: 'bank_transfer', paymentType: 'regular_payment', paymentDate: '2026-08-08' }],
    });
  }
  render(<MemoryRouter><RetreatDetailView retreatId="r1" onBack={jest.fn()} /></MemoryRouter>);
  return screen.findByText('Alex Fixture');
};

// PPVC-933: `legacy_cached` only means this booking hasn't gotten the newer
// server-computed ledger summary yet -- the Payment Status column must still
// show the real computed balance/overpayment for it, not a vague
// "Reconciliation required" label that hides the number entirely.
describe('Payment Status column (PPVC-933)', () => {
  it('shows the real outstanding balance for a legacy_cached partially paid booking', async () => {
    await renderWithBooking({ totalAmount: 5000 }, 3000);
    expect(await screen.findByText('Balance 2000.00 EUR')).toBeInTheDocument();
    expect(screen.queryByText('Reconciliation required')).not.toBeInTheDocument();
  });

  it('shows the real overpayment amount for a legacy_cached overpaid booking', async () => {
    await renderWithBooking({ totalAmount: 5000 }, 5500);
    expect(await screen.findByText('Overpaid 500.00 EUR')).toBeInTheDocument();
    expect(screen.queryByText('Reconciliation required')).not.toBeInTheDocument();
  });

  it('shows "Paid in full" for a legacy_cached fully paid booking', async () => {
    await renderWithBooking({ totalAmount: 5000 }, 5000);
    expect(await screen.findByText('Paid in full')).toBeInTheDocument();
    expect(screen.queryByText('Reconciliation required')).not.toBeInTheDocument();
  });

  it('shows a balance (not "Reconciliation required") for an unpaid booking', async () => {
    await renderWithBooking({ totalAmount: 5000 });
    expect(await screen.findByText('Balance 5000.00 EUR')).toBeInTheDocument();
    expect(screen.queryByText('Reconciliation required')).not.toBeInTheDocument();
  });
});
