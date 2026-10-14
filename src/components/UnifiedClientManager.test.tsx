import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UnifiedClientManager from './UnifiedClientManager';
import { clientsApi, bookingsApi, retreatsApi, referralsApi } from '../services/api';

jest.mock('../services/api', () => ({
  clientsApi: { getAll: jest.fn(), update: jest.fn(), quickAdd: jest.fn() },
  bookingsApi: { getAll: jest.fn() }, retreatsApi: { getAll: jest.fn() }, referralsApi: { getAll: jest.fn() },
}));
const client = { _id: 'c1', firstName: 'Sample', lastName: 'Guest', email: 'original@example.invalid', phone: '+420777123456', status: 'active' };
beforeEach(() => {
  (clientsApi.getAll as jest.Mock).mockResolvedValue({ data: [client] });
  for (const api of [bookingsApi, retreatsApi, referralsApi]) (api.getAll as jest.Mock).mockResolvedValue({ data: [] });
});
async function openEditor() {
  render(<MemoryRouter><UnifiedClientManager /></MemoryRouter>);
  fireEvent.click(await screen.findByTitle('Edit'));
  return screen.getByRole('dialog');
}
it('shows a styled duplicate toast within the editor, retains edits and allows correction', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
  (clientsApi.update as jest.Mock).mockRejectedValueOnce({ response: { status: 400, data: { message: 'Email taken@example.invalid is already registered. Please use a different email address.' } } }).mockResolvedValueOnce({ data: client });
  const dialog = await openEditor();
  fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'taken@example.invalid' } });
  fireEvent.change(within(dialog).getByLabelText(/First Name/), { target: { value: 'Edited' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Update Client' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Duplicate email');
  expect(within(dialog).getByRole('alert')).toHaveClass('bg-red-50');
  expect(within(dialog).getByLabelText('Email')).toHaveValue('taken@example.invalid');
  expect(within(dialog).getByLabelText(/First Name/)).toHaveValue('Edited');
  expect(clientsApi.update).toHaveBeenCalledWith('c1', expect.objectContaining({ email: 'taken@example.invalid' }), { suppressGlobalError: true });
  expect(consoleError).not.toHaveBeenCalled(); expect(alert).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByLabelText('Dismiss'));
  fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'unique@example.invalid' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Update Client' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await screen.findByRole('status')).toHaveTextContent('Client updated successfully.');
  expect(clientsApi.update).toHaveBeenLastCalledWith('c1', expect.objectContaining({ email: 'unique@example.invalid', firstName: 'Edited' }), { suppressGlobalError: true });
  consoleError.mockRestore(); alert.mockRestore();
});
it('keeps unrelated error feedback and form values available for retry', async () => {
  (clientsApi.update as jest.Mock).mockRejectedValue({ response: { status: 503, data: { message: 'Temporarily unavailable. Please retry.' } } });
  const dialog = await openEditor();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Update Client' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Failed to save client. The service is temporarily unavailable.');
  expect(within(dialog).getByLabelText('Email')).toHaveValue(client.email);
});
it('successfully saves an unchanged email', async () => {
  (clientsApi.update as jest.Mock).mockResolvedValue({ data: client });
  const dialog = await openEditor();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Update Client' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Client updated successfully.');
  expect(clientsApi.update).toHaveBeenCalledWith('c1', expect.objectContaining({ email: client.email }), { suppressGlobalError: true });
});
