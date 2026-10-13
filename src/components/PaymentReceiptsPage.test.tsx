import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PaymentReceiptsPage from './PaymentReceiptsPage';
import { paymentsApi } from '../services/api';
jest.mock('./CurrencyDisplay', () => ({ __esModule: true, default: ({ amount, currency }: any) => <span>{amount} {currency}</span> }));
jest.mock('../services/api', () => ({ paymentsApi: { getReceipts: jest.fn(), getReceipt: jest.fn(), regenerateReceiptPdf: jest.fn(), recordReceiptWhatsApp: jest.fn(), sendReceipt: jest.fn(), downloadReceiptPdf: jest.fn() } }));
const client = { firstName: 'Test', lastName: 'Client', phoneCountryCode: '+420', phone: '777123456', email: 'client@example.invalid' };
const receipt = { _id: 'r1', display_id: 1200, status: 'received', totalAmount: 200, allocatedAmount: 200, allocationCount: 1, currency: 'EUR', paymentMethod: 'revolut', receivedDate: '2026-10-13', allocations: [{ _id: 'p1', amount: 200, currency: 'EUR', clientId: client }] };
beforeEach(() => {
  jest.clearAllMocks(); jest.spyOn(window, 'confirm').mockReturnValue(true);
  (paymentsApi.getReceipts as jest.Mock).mockResolvedValue({ data: [receipt] });
  (paymentsApi.getReceipt as jest.Mock).mockResolvedValue({ data: receipt });
});
const open = async () => { render(<MemoryRouter><PaymentReceiptsPage /></MemoryRouter>); fireEvent.click(await screen.findByTitle('View receipt')); await screen.findByText('Receipt #1200'); };
it('regenerates the selected recipient PDF and refreshes metadata', async () => {
  await open(); fireEvent.click(screen.getByRole('button', { name: 'Regenerate PDF' }));
  await waitFor(() => expect(paymentsApi.regenerateReceiptPdf).toHaveBeenCalledWith('r1', 'p1'));
  expect(await screen.findByText('Receipt PDF regenerated.')).toBeInTheDocument();
});
it('records WhatsApp only after explicit manual-send confirmation', async () => {
  await open(); (window.confirm as jest.Mock).mockReturnValueOnce(false);
  fireEvent.click(screen.getByRole('button', { name: 'Mark WhatsApp sent' }));
  expect(paymentsApi.recordReceiptWhatsApp).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Mark WhatsApp sent' }));
  await waitFor(() => expect(paymentsApi.recordReceiptWhatsApp).toHaveBeenCalledWith('r1', 'p1'));
});
it('disables email for clients without email while retaining WhatsApp', async () => {
  (paymentsApi.getReceipt as jest.Mock).mockResolvedValue({ data: { ...receipt, allocations: [{ ...receipt.allocations[0], clientId: { ...client, email: '' } }] } });
  await open(); expect(screen.getByRole('button', { name: 'Email receipt' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Mark WhatsApp sent' })).not.toBeDisabled();
});
it('shows delivery history and a retry control after automatic PDF failure', async () => {
  (paymentsApi.getReceipt as jest.Mock).mockResolvedValue({ data: { ...receipt, pdfGenerationFailed: true, deliveryHistory: [{ channel: 'whatsapp', status: 'manually_confirmed', at: '2026-10-13', to: '+420777123456', actor: 'staff@example.invalid' }] } });
  await open(); expect(screen.getByText(/Automatic PDF generation failed/)).toBeInTheDocument(); expect(screen.getByText(/WhatsApp \(manually confirmed\)/)).toBeInTheDocument();
});
it('reports regeneration errors without recording a send', async () => {
  (paymentsApi.regenerateReceiptPdf as jest.Mock).mockRejectedValue({ response: { data: { message: 'PDF generation unavailable' } } });
  await open(); fireEvent.click(screen.getByRole('button', { name: 'Regenerate PDF' }));
  expect(await screen.findByText('PDF generation unavailable')).toBeInTheDocument(); expect(paymentsApi.recordReceiptWhatsApp).not.toHaveBeenCalled();
});
