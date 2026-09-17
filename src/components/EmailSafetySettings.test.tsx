import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EmailSafetySettings from './EmailSafetySettings';
import { emailSafetyApi } from '../services/api';
import { authService } from '../services/authService';
jest.mock('../services/api', () => ({ emailSafetyApi: { get: jest.fn(), save: jest.fn() } }));
jest.mock('../services/authService', () => ({ authService: { getUser: jest.fn() } }));
beforeEach(() => {
  jest.clearAllMocks();
  (authService.getUser as jest.Mock).mockReturnValue({ role: 'admin' });
  (emailSafetyApi.get as jest.Mock).mockResolvedValue({ data: { enabled: true, recipient: 'info@ibogaspirit.cz' } });
  (emailSafetyApi.save as jest.Mock).mockImplementation(async data => { (emailSafetyApi.get as jest.Mock).mockResolvedValue({ data }); return { data }; });
});
it('loads the global safety setting and saves a configurable inbox without any unrelated settings', async () => {
  render(<EmailSafetySettings />);
  expect(await screen.findByText(/Email safety ON/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Safety inbox'), { target: { value: 'test@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save email safety' }));
  await waitFor(() => expect(emailSafetyApi.save).toHaveBeenCalledWith({ enabled: true, recipient: 'test@example.com' }));
  expect(await screen.findByText(/Email safety ON — all mail goes only to test@example.com/)).toBeInTheDocument();
});
it('makes switching to real recipients explicit and saves it to the same setting', async () => {
  render(<EmailSafetySettings />);
  await screen.findByText(/Email safety ON/);
  fireEvent.click(screen.getByLabelText('Email safety switch — redirect all outgoing emails'));
  expect(screen.getByText(/Saving with the switch off allows normal emails/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save email safety' }));
  await waitFor(() => expect(emailSafetyApi.save).toHaveBeenCalledWith({ enabled: false, recipient: 'info@ibogaspirit.cz' }));
});
it('never reports that safety is off when the setting failed to load', async () => {
  (emailSafetyApi.get as jest.Mock).mockRejectedValue(new Error('offline'));
  render(<EmailSafetySettings />);
  expect(await screen.findByRole('alert')).toHaveTextContent('status unavailable');
  expect(screen.getByRole('button', { name: 'Save email safety' })).toBeDisabled();
  expect(screen.queryByText(/Email safety OFF/)).not.toBeInTheDocument();
});
it('shows the saved global state without edit controls to non-admins', async () => {
  (authService.getUser as jest.Mock).mockReturnValue({ role: 'medical_staff' });
  render(<EmailSafetySettings />);
  await screen.findByText(/Email safety ON/);
  expect(screen.queryByRole('button', { name: 'Save email safety' })).not.toBeInTheDocument();
});
