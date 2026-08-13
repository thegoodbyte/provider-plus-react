import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import EmailHistoryPanel from './EmailHistoryPanel';
import { communicationsApi } from '../services/api';

jest.mock('../services/api', () => ({ communicationsApi: { getSentEmails: jest.fn(), getInboundEmails: jest.fn() } }));
jest.mock('../services/taskService', () => ({ taskService: { createTask: jest.fn() } }));
jest.mock('./EmailComposeModal', () => () => null);

const sent = communicationsApi.getSentEmails as jest.Mock;
const inbound = communicationsApi.getInboundEmails as jest.Mock;

describe('EmailHistoryPanel email preview', () => {
  beforeEach(() => {
    sent.mockResolvedValue({ data: [{ _id: 'sent-1', subject: 'Welcome', bodyText: 'Welcome text', bodyHtml: '<h1>Welcome Ada</h1>', to: ['ada@test.com'], fromEmail: 'team@test.com', status: 'sent', sentAt: '2026-08-13T10:00:00Z', attachments: [{ fileName: 'booking.pdf', size: 2048 }] }] });
    inbound.mockResolvedValue({ data: [{ _id: 'in-1', gmailMessageId: 'gmail-1', threadId: 'thread-1', subject: 'Question', bodyText: 'Can you help?', fromEmail: 'ada@test.com', to: ['team@test.com'], status: 'received', receivedAt: '2026-08-13T11:00:00Z' }] });
  });

  it('opens sent and received messages in an overlay and closes with Escape', async () => {
    render(<EmailHistoryPanel bookingId="booking-1" clientId="client-1" />);
    await waitFor(() => expect(screen.getByText('Welcome')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'View email' }));
    expect(screen.getByRole('dialog', { name: 'Email: Welcome' })).toBeInTheDocument();
    expect(screen.getByTitle('Email message body')).toHaveAttribute('srcdoc', '<h1>Welcome Ada</h1>');
    expect(screen.getByText('booking.pdf')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Question'));
    expect(screen.getByRole('dialog', { name: 'Email: Question' })).toBeInTheDocument();
    expect(within(screen.getByRole('dialog', { name: 'Email: Question' })).getByText('Can you help?')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close email preview'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
