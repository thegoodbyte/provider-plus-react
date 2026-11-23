import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PaymentRequestShare from './PaymentRequestShare';
import { communicationsApi } from '../services/api';
jest.mock('../services/api', () => ({ communicationsApi: { getTemplates: jest.fn(), createTemplate: jest.fn(), updateTemplate: jest.fn() } }));
const request = { _id: 'req', publicHash: 'private', status: 'pending', invoiceNumber: 1465, clientId: { firstName: 'Ewa', language: 'pl' } };
beforeEach(() => { jest.clearAllMocks(); (communicationsApi.getTemplates as jest.Mock).mockResolvedValue({ data: [] }); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn().mockResolvedValue(undefined) } }); });
it('copies localized message and link independently without saving or sending', async () => {
    render(<PaymentRequestShare request={request} initiallyOpen/>);
    const preview = await screen.findByLabelText('Payment message preview');
    expect((preview as HTMLTextAreaElement).value).toContain('Dzień dobry Ewa');
    fireEvent.click(screen.getByRole('button', { name: 'Copy message', exact: true }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith((preview as HTMLTextAreaElement).value));
    fireEvent.click(screen.getByRole('button', { name: 'Copy link only' }));
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith('https://ibogaspirit.pl/clients/payment/request/private?lang=pl');
    expect(communicationsApi.createTemplate).not.toHaveBeenCalled();
    expect(communicationsApi.updateTemplate).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Payment message language'), { target: { value: 'cz' } });
    expect(screen.getByLabelText('Private payment link')).toHaveValue('https://ibogaspirit.cz/clients/payment/request/private?lang=cz');
});
it('edits only the selected stored language and keeps unsaved edits on failure', async () => {
    (communicationsApi.getTemplates as jest.Mock).mockResolvedValue({ data: [{ _id: 'pl', templateKey: 'payment_request_share', language: 'pl', bodyText: 'Polski {{paymentUrl}}', active: true }] });
    (communicationsApi.updateTemplate as jest.Mock).mockRejectedValue(new Error('Temporary save failure'));
    render(<PaymentRequestShare request={request} initiallyOpen/>);
    await screen.findByLabelText('Payment message preview');
    fireEvent.click(screen.getByRole('button', { name: 'Configure PL message' }));
    fireEvent.change(screen.getByLabelText('Payment message template'), { target: { value: 'Changed {{paymentUrl}}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save message' }));
    await screen.findByText('Could not save the message. Your edits are retained.');
    expect(screen.getByLabelText('Payment message template')).toHaveValue('Changed {{paymentUrl}}');
    expect(screen.getByRole('button', { name: 'Copy message', exact: true })).toBeDisabled();
    expect(communicationsApi.updateTemplate).toHaveBeenCalledWith('pl', expect.objectContaining({ language: 'pl', bodyText: 'Changed {{paymentUrl}}' }));
});
it('does not silently replace configured messages when loading fails, but retains link-only copy', async () => {
    (communicationsApi.getTemplates as jest.Mock).mockRejectedValue(new Error('Load failed'));
    render(<PaymentRequestShare request={request} initiallyOpen/>);
    await screen.findByText('Could not load payment messages. Retry before copying a message.');
    expect(screen.queryByRole('button', { name: 'Copy message', exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy link only' })).toBeEnabled();
});
it('keeps revoked links out of the panel', () => {
    render(<PaymentRequestShare request={{ ...request, publicLinkRevokedAt: 'now' }} initiallyOpen/>);
    expect(screen.queryByRole('button', { name: 'Copy link only' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('inactive or unavailable');
});
it('retains selectable preview text when clipboard fails', async () => {
    (navigator.clipboard.writeText as jest.Mock).mockRejectedValue(new Error('Denied'));
    render(<PaymentRequestShare request={request} initiallyOpen/>);
    await screen.findByLabelText('Payment message preview');
    fireEvent.click(screen.getByRole('button', { name: 'Copy message', exact: true }));
    await screen.findByText('Clipboard unavailable. Select and copy the text below.');
    expect((screen.getByLabelText('Payment message preview') as HTMLTextAreaElement).value).toContain('https://ibogaspirit.pl/');
});
