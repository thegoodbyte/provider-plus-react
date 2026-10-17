import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import InvoiceVisitHistory from './InvoiceVisitHistory';
import InvoiceVisitSettings from './InvoiceVisitSettings';
import { api } from '../services/api';
jest.mock('../services/api', () => ({ api: { get: jest.fn(), put: jest.fn() } }));
it('shows visit metadata and notification status without treating it as identity proof', async () => {
 (api.get as jest.Mock).mockResolvedValue({ data: { items: [{ _id: 'v1', createdAt: '2026-10-17T12:00:00Z', ip: '192.0.2.1', os: 'Windows', browser: 'Chrome', notificationStatus: 'queued', userAgent: 'Synthetic UA' }], total: 1, pageSize: 25 } });
 render(<InvoiceVisitHistory requestId="r1" />); expect(await screen.findByText(/IP: 192.0.2.1/)).toBeInTheDocument(); expect(screen.getByText(/Notification: queued/)).toBeInTheDocument();
});
it('shows an empty history', async () => {
 (api.get as jest.Mock).mockResolvedValue({ data: { items: [], total: 0, pageSize: 25 } }); render(<InvoiceVisitHistory requestId="r1" />); expect(await screen.findByText('No visits recorded yet.')).toBeInTheDocument();
});
it('recovers from a failed history load', async () => {
 (api.get as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data: { items: [], total: 0, pageSize: 25 } }); render(<InvoiceVisitHistory requestId="r1" />); await screen.findByRole('alert'); fireEvent.click(screen.getByRole('button', {name:'Refresh visits'})); expect(await screen.findByText('No visits recorded yet.')).toBeInTheDocument();
});
it('saves a configurable recipient and enable switch', async () => {
 (api.get as jest.Mock).mockResolvedValue({ data: { enabled: false, recipient: '' } }); (api.put as jest.Mock).mockResolvedValue({ data: { enabled:true, recipient:'ops@example.invalid' } });
 render(<InvoiceVisitSettings />); await waitFor(() => expect(screen.getByLabelText('Invoice visit recipient email')).toBeEnabled());
 fireEvent.change(screen.getByLabelText('Invoice visit recipient email'), { target: { value: 'ops@example.invalid' } }); fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', {name:'Save invoice visit settings'}));
 expect(await screen.findByText('Invoice visit settings saved.')).toBeInTheDocument(); expect(api.put).toHaveBeenCalledWith('/invoice-visits/settings', {enabled:true,recipient:'ops@example.invalid'}, expect.anything());
});
it('retains editable values after a save failure', async () => {
 (api.get as jest.Mock).mockResolvedValue({ data: {enabled:false,recipient:'ops@example.invalid'} }); (api.put as jest.Mock).mockRejectedValue(new Error('offline'));
 render(<InvoiceVisitSettings />); await waitFor(() => expect(screen.getByRole('button', {name:'Save invoice visit settings'})).toBeEnabled()); fireEvent.click(screen.getByRole('button', {name:'Save invoice visit settings'})); await screen.findByRole('alert'); expect(screen.getByLabelText('Invoice visit recipient email')).toBeEnabled(); expect(screen.getByLabelText('Invoice visit recipient email')).toHaveValue('ops@example.invalid');
});
