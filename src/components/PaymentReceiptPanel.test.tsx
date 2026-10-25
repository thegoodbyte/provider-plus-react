import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PaymentReceiptPanel from './PaymentReceiptPanel';
import { paymentsApi } from '../services/api';
jest.mock('../services/api', () => ({ paymentsApi: { getReceipt: jest.fn(), downloadReceiptPdf: jest.fn(), regenerateReceiptPdf: jest.fn(), sendReceipt: jest.fn() } }));
const payment: any = { _id: 'allocation-a', receiptId: 'receipt', status: 'completed', amount: 100, currency: 'EUR' };
const receipt: any = { _id: 'receipt', display_id: 927, status: 'received', allocationCount: 2, allocations: [{ _id: 'allocation-a', clientId: { email: 'a@example.invalid' } }, { _id: 'allocation-b', clientId: { email: 'b@example.invalid' } }], deliveryHistory: [{ channel: 'email', status: 'sent', allocationId: 'allocation-b', to: 'b@example.invalid', at: '2026-10-25' }] };
beforeEach(() => {
 jest.clearAllMocks(); (paymentsApi.getReceipt as jest.Mock).mockResolvedValue({ data: receipt });
 (paymentsApi.downloadReceiptPdf as jest.Mock).mockResolvedValue({ data: new Blob(['pdf'], { type: 'application/pdf' }) });
 (paymentsApi.regenerateReceiptPdf as jest.Mock).mockResolvedValue({ data: {} });
 (paymentsApi.sendReceipt as jest.Mock).mockResolvedValue({ data: { to: 'a@example.invalid' } });
 URL.createObjectURL = jest.fn().mockReturnValue('blob:receipt'); URL.revokeObjectURL = jest.fn();
});
it('does not confuse a sibling allocation email with this client and previews before confirming send', async () => {
 render(<PaymentReceiptPanel payment={payment} />);
 expect(await screen.findByText('Not emailed to this client yet')).toBeInTheDocument();
 expect(screen.queryByText('b@example.invalid')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button', { name: 'Email receipt to client' }));
 expect(await screen.findByRole('region', { name: 'Confirm receipt email' })).toHaveTextContent('a@example.invalid');
 expect(paymentsApi.sendReceipt).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button', { name: 'Send receipt email' }));
 await waitFor(() => expect(paymentsApi.sendReceipt).toHaveBeenCalledWith('receipt', { allocationId: 'allocation-a', attachPdf: true }));
 expect(paymentsApi.downloadReceiptPdf).toHaveBeenCalledWith('receipt', 'allocation-a');
});
it('refreshes regenerated preview, revokes blobs, and never sends during preview/regeneration', async () => {
 const { unmount } = render(<PaymentReceiptPanel payment={payment} />); await screen.findByText('Not emailed to this client yet');
 fireEvent.click(screen.getByRole('button', { name: 'Preview PDF' })); await screen.findByTitle('Receipt PDF preview');
 await waitFor(() => expect(screen.getByRole('button', { name: 'Regenerate PDF' })).toBeEnabled());
 fireEvent.click(screen.getByRole('button', { name: 'Regenerate PDF' })); await screen.findByText(/preview now shows the new version/);
 expect(paymentsApi.regenerateReceiptPdf).toHaveBeenCalledWith('receipt', 'allocation-a'); expect(paymentsApi.sendReceipt).not.toHaveBeenCalled();
 expect(URL.revokeObjectURL).toHaveBeenCalled(); unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
});
it('shows send failure without claiming the client was emailed', async () => {
 (paymentsApi.sendReceipt as jest.Mock).mockRejectedValue(new Error('delivery failed'));
 render(<PaymentReceiptPanel payment={payment} />); await screen.findByText('Not emailed to this client yet');
 fireEvent.click(screen.getByRole('button', { name: 'Email receipt to client' })); await screen.findByRole('region', { name: 'Confirm receipt email' });
 fireEvent.click(screen.getByRole('button', { name: 'Send receipt email' })); expect(await screen.findByRole('alert')).toBeInTheDocument();
 expect(screen.getByText('Not emailed to this client yet')).toBeInTheDocument();
});
it('explains legacy receipts and blocks actions for an unrelated allocation', async () => {
 const { rerender } = render(<PaymentReceiptPanel payment={{ ...payment, receiptId: undefined }} />);
 expect(screen.getByText(/historical payment has no linked receipt/)).toBeInTheDocument();
 rerender(<PaymentReceiptPanel payment={{ ...payment, _id: 'unrelated' }} />);
 expect(await screen.findByRole('alert')).toHaveTextContent('not an allocation'); expect(screen.queryByRole('button', { name: 'Preview PDF' })).not.toBeInTheDocument();
});
it('does not treat WhatsApp or failed email as successful email delivery', async () => {
 (paymentsApi.getReceipt as jest.Mock).mockResolvedValue({data:{...receipt,deliveryHistory:[{channel:'email',status:'failed',allocationId:payment._id,to:'a@example.invalid',at:'2026-10-25'},{channel:'whatsapp',status:'sent',allocationId:payment._id,to:'phone',at:'2026-10-25'}]}});
 render(<PaymentReceiptPanel payment={payment}/>);expect(await screen.findByText('Not emailed to this client yet')).toBeInTheDocument();expect(screen.getByText(/WhatsApp \(manually recorded\)/)).toBeInTheDocument();
});
it('does not misreport a successful send when only refreshing history fails', async () => {
 render(<PaymentReceiptPanel payment={payment}/>);await screen.findByText('Not emailed to this client yet');
 fireEvent.click(screen.getByRole('button',{name:'Email receipt to client'}));await screen.findByRole('region',{name:'Confirm receipt email'});
 (paymentsApi.getReceipt as jest.Mock).mockRejectedValueOnce(new Error('refresh unavailable'));
 fireEvent.click(screen.getByRole('button',{name:'Send receipt email'}));expect(await screen.findByRole('alert')).toHaveTextContent('Email submitted, but delivery history could not refresh');expect(paymentsApi.sendReceipt).toHaveBeenCalledTimes(1);
});
