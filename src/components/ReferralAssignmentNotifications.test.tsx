import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReferralAssignmentNotifications from './ReferralAssignmentNotifications';
import ReferralNotificationSettingsPage from './ReferralNotificationSettingsPage';
import { referralsApi } from '../services/api';

jest.mock('../services/api', () => ({ referralsApi: { getAssignmentNotifications: jest.fn(), retryAssignmentNotification: jest.fn(), update: jest.fn(), getNotificationSettings: jest.fn() } }));
const event = { id: 'e1', clientId: 'c1', firstName: 'Jane', lastName: 'Guest', status: 'blocked', detail: 'Missing recipient.', createdAt: '2026-10-14T10:00:00Z', attempts: 1 };
beforeEach(() => {
  (referralsApi.getNotificationSettings as jest.Mock).mockResolvedValue({ data: {assignmentNotificationsEnabled:true} });
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
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not retry this notification.');
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
  render(<MemoryRouter><ReferralNotificationSettingsPage partners={[{ _id: 'r1', name: 'Alchemia', referralCode: 'AD' }]} onPartnerSaved={jest.fn().mockResolvedValue(undefined)} /></MemoryRouter>);
  await screen.findByLabelText('Notify Alchemia on assignment');
  fireEvent.click(screen.getByLabelText('Notify Alchemia on assignment'));
  await waitFor(()=>expect(referralsApi.update).toHaveBeenCalledWith('r1', {assignmentNotificationsEnabled:true}));
  fireEvent.change(screen.getByLabelText('Notification language for Alchemia'), { target: { value: 'pl' } });
  await waitFor(() => expect(referralsApi.update).toHaveBeenCalledWith('r1', expect.objectContaining({ assignmentNotificationLanguage: 'pl' })));
});
// PPVC-827: the four lifecycle kinds beyond assignment, each with its own
// global switch and per-partner override column, same model as assignment.
it.each([
  ['invoice sent', 'invoiceSentNotificationsEnabled'],
  ['invoice paid', 'invoicePaidNotificationsEnabled'],
  ['booking issued', 'bookingIssuedNotificationsEnabled'],
  ['retreat completed', 'retreatCompletedNotificationsEnabled'],
])('saves the %s per-partner override', async (columnLabel, flag) => {
  (referralsApi.update as jest.Mock).mockResolvedValue({ data: {} });
  render(<MemoryRouter><ReferralNotificationSettingsPage partners={[{ _id: 'r1', name: 'Alchemia', referralCode: 'AD' }]} onPartnerSaved={jest.fn().mockResolvedValue(undefined)} /></MemoryRouter>);
  const checkbox = await screen.findByLabelText(`Notify Alchemia on ${columnLabel}`);
  fireEvent.click(checkbox);
  await waitFor(() => expect(referralsApi.update).toHaveBeenCalledWith('r1', { [flag]: true }));
});
it.each([
  ['Send invoice-sent notification emails', 'invoiceSentNotificationsEnabled'],
  ['Send invoice-paid notification emails', 'invoicePaidNotificationsEnabled'],
  ['Send booking-issued notification emails', 'bookingIssuedNotificationsEnabled'],
  ['Send retreat-completed notification emails', 'retreatCompletedNotificationsEnabled'],
])('saves the %s global switch', async (globalLabel, flag) => {
  (referralsApi as any).updateNotificationSettings = jest.fn().mockResolvedValue({ data: { [flag]: true } });
  render(<MemoryRouter><ReferralNotificationSettingsPage partners={[]} onPartnerSaved={jest.fn().mockResolvedValue(undefined)} /></MemoryRouter>);
  const labelText = await screen.findByText(globalLabel);
  const checkbox = within(labelText.closest('label') as HTMLElement).getByRole('checkbox');
  fireEvent.click(checkbox);
  await waitFor(() => expect(referralsApi.updateNotificationSettings).toHaveBeenCalledWith({ [flag]: true }));
});
