import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MissingItemsReminderSettings from './MissingItemsReminderSettings';
import { missingItemsReminderApi } from '../services/api';
import { authService } from '../services/authService';

jest.mock('../services/api', () => ({ missingItemsReminderApi: { get: jest.fn(), save: jest.fn(), preview: jest.fn() } }));
jest.mock('../services/authService', () => ({ authService: { getUser: jest.fn() } }));

const settings = { enabled: false, hour: 8, timezone: 'Europe/Prague', lastRun: null };

beforeEach(() => {
  jest.clearAllMocks();
  (authService.getUser as jest.Mock).mockReturnValue({ role: 'admin' });
  (missingItemsReminderApi.get as jest.Mock).mockResolvedValue({ data: settings });
  (missingItemsReminderApi.save as jest.Mock).mockImplementation(async (body) => ({ data: { ...body, lastRun: null } }));
  (missingItemsReminderApi.preview as jest.Mock).mockResolvedValue({ data: { eligibleBookings: 3, wouldSend: 2, bookings: [{ bookingId: 'booking-1', missingCount: 2 }, { bookingId: 'booking-2', missingCount: 1 }] } });
});

test('saves enabled, hour and timezone; preview is read-only', async () => {
  render(<MissingItemsReminderSettings />);
  fireEvent.click(await screen.findByLabelText('Enable daily missing-items reminder'));
  fireEvent.change(screen.getByLabelText('Send at hour (0–23)'), { target: { value: '7' } });
  fireEvent.change(screen.getByLabelText('Timezone'), { target: { value: 'America/New_York' } });
  fireEvent.click(screen.getByText('Save reminder settings'));
  await screen.findByText('Missing-items reminder settings saved.');
  expect(missingItemsReminderApi.save).toHaveBeenCalledWith({ enabled: true, hour: 7, timezone: 'America/New_York' });

  fireEvent.click(screen.getByText("Preview today's run"));
  await screen.findByText(/2 would receive a reminder today/);
  expect(screen.getByText(/Booking booking-1 · 2 items missing/)).toBeInTheDocument();
  expect(missingItemsReminderApi.preview).toHaveBeenCalledTimes(1);
  expect(missingItemsReminderApi.save).toHaveBeenCalledTimes(1);
});

test('does not load settings for non-admin', () => {
  (authService.getUser as jest.Mock).mockReturnValue({ role: 'helper' });
  render(<MissingItemsReminderSettings />);
  expect(screen.getByText('Only administrators can configure this reminder.')).toBeInTheDocument();
  expect(missingItemsReminderApi.get).not.toHaveBeenCalled();
});

test('save failure remains visible without claiming success', async () => {
  (missingItemsReminderApi.save as jest.Mock).mockRejectedValue({ response: { data: { message: 'Choose an hour between 0 and 23' } } });
  render(<MissingItemsReminderSettings />);
  fireEvent.click(await screen.findByText('Save reminder settings'));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Choose an hour between 0 and 23'));
  expect(screen.queryByText('Missing-items reminder settings saved.')).not.toBeInTheDocument();
});
