import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReferralAssignmentNotifications from './ReferralAssignmentNotifications';
import ReferralEditorPage from './ReferralEditorPage';
import { referralsApi } from '../services/api';

jest.mock('../services/api', () => ({ referralsApi: { getAssignmentNotifications: jest.fn(), retryAssignmentNotification: jest.fn(), update: jest.fn() } }));
const event = { id: 'e1', clientId: 'c1', firstName: 'Jane', lastName: 'Guest', status: 'blocked', detail: 'Missing recipient.', createdAt: '2026-10-14T10:00:00Z', attempts: 1 };
beforeEach(() => {
  (referralsApi.getAssignmentNotifications as jest.Mock).mockResolvedValue({ data: [event] });
});
it('shows auditable delivery state and retries a safe failure', async () => {
  (referralsApi.retryAssignmentNotification as jest.Mock).mockResolvedValue({ data: [{ ...event, status: 'sent', provider: 'development_capture', detail: 'Delivery accepted.' }] });
  render(<ReferralAssignmentNotifications referralId="r1" />);
  expect(await screen.findByText('Missing recipient.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry notification for Jane Guest' }));
  await waitFor(() => expect(referralsApi.retryAssignmentNotification).toHaveBeenCalledWith('r1', 'c1', 'e1'));
  expect(await screen.findByText(/Captured in development/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Retry notification/ })).not.toBeInTheDocument();
});
it('retains history when retry fails', async () => {
  (referralsApi.retryAssignmentNotification as jest.Mock).mockRejectedValue(new Error('Retry unavailable'));
  render(<ReferralAssignmentNotifications referralId="r1" />);
  fireEvent.click(await screen.findByRole('button', { name: /Retry notification/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Retry unavailable');
  expect(screen.getByText('Jane Guest')).toBeInTheDocument();
});
it.each(['sent', 'sending', 'uncertain', 'superseded'])('never offers automatic retry for %s', async status => {
  (referralsApi.getAssignmentNotifications as jest.Mock).mockResolvedValue({ data: [{ ...event, status }] });
  render(<ReferralAssignmentNotifications referralId="r1" />);
  await screen.findByText('Jane Guest');
  expect(screen.queryByRole('button', { name: /Retry notification/ })).not.toBeInTheDocument();
});
it('saves opt-in activation and language alongside partner settings', async () => {
  (referralsApi.update as jest.Mock).mockResolvedValue({ data: {} });
  render(<MemoryRouter><ReferralEditorPage referral={{ _id: 'r1', name: 'Alchemia', referralCode: 'AD' }} base="/admin/referrals" onSaved={jest.fn().mockResolvedValue(undefined)} /></MemoryRouter>);
  fireEvent.click(screen.getByLabelText('Notify this partner when a client is assigned'));
  fireEvent.change(screen.getByLabelText('Notification language'), { target: { value: 'pl' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(referralsApi.update).toHaveBeenCalledWith('r1', expect.objectContaining({ assignmentNotificationsEnabled: true, assignmentNotificationLanguage: 'pl' })));
});
