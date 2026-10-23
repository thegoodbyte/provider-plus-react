import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UnifiedClientManager from './UnifiedClientManager';
import { clientsApi, bookingsApi, retreatsApi, referralsApi, languagesApi } from '../services/api';

jest.mock('../services/api', () => ({
  clientsApi: { getAll: jest.fn(), update: jest.fn(), quickAdd: jest.fn() },
  bookingsApi: { getAll: jest.fn() }, retreatsApi: { getAll: jest.fn() }, referralsApi: { getAll: jest.fn() },
  languagesApi: { getActive: jest.fn() },
}));
const client = { _id: 'c1', firstName: 'Sample', lastName: 'Guest', email: 'original@example.invalid', phone: '+420777123456', status: 'active' };
beforeEach(() => {
  (clientsApi.getAll as jest.Mock).mockResolvedValue({ data: [client] });
  for (const api of [bookingsApi, retreatsApi, referralsApi]) (api.getAll as jest.Mock).mockResolvedValue({ data: [] });
  (languagesApi.getActive as jest.Mock).mockResolvedValue({ data: [
    { _id: '1', code: 'en', name: 'English', active: true, sortOrder: 10 },
    { _id: '2', code: 'cz', name: 'Czech', active: true, sortOrder: 20 },
    { _id: '3', code: 'pl', name: 'Polish', active: true, sortOrder: 30 },
  ] });
});
async function openEditor() {
  render(<MemoryRouter><UnifiedClientManager /></MemoryRouter>);
  fireEvent.click(await screen.findByTitle('Edit'));
  const dialog = screen.getByRole('dialog');
  // Lets the language selector's own async load (languagesApi.getActive)
  // settle inside an act() boundary before the test fires further events --
  // otherwise its state update lands outside any act() call and React logs
  // a spurious "not wrapped in act" warning that unrelated tests then catch.
  await act(async () => { await Promise.resolve(); });
  return dialog;
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

// Default sort is createdAt descending, so the initial page holds the
// newest 100 clients (Guest050-Guest149) and withholds the oldest 50
// (Guest000-Guest049) behind "Show more".
const manyClients = Array.from({ length: 150 }, (_, index) => ({
  _id: `client-${index}`,
  firstName: 'Test',
  lastName: `Guest${String(index).padStart(3, '0')}`,
  email: `guest${index}@example.invalid`,
  phone: '+420777123456',
  status: 'active',
  createdAt: new Date(2026, 0, index + 1).toISOString(),
}));
const nameCell = (idPattern: RegExp) => (content: string, el: Element | null) =>
  !!el?.classList.contains('truncate') && idPattern.test(content);
it('renders only a bounded page of clients and reveals more on demand', async () => {
  (clientsApi.getAll as jest.Mock).mockResolvedValue({ data: manyClients });
  render(<MemoryRouter><UnifiedClientManager /></MemoryRouter>);
  await screen.findByText(nameCell(/Guest149/));
  expect(screen.getAllByText(nameCell(/Guest\d{3}/))).toHaveLength(100);
  expect(screen.queryByText(nameCell(/Guest000/))).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Show more \(50 remaining\)/ }));
  expect(await screen.findByText(nameCell(/Guest000/))).toBeInTheDocument();
  expect(screen.getAllByText(nameCell(/Guest\d{3}/))).toHaveLength(150);
  expect(screen.queryByRole('button', { name: /Show more/ })).not.toBeInTheDocument();
});
it('resets the visible page when the search filter narrows the list', async () => {
  (clientsApi.getAll as jest.Mock).mockResolvedValue({ data: manyClients });
  render(<MemoryRouter><UnifiedClientManager /></MemoryRouter>);
  await screen.findByText(nameCell(/Guest149/));
  fireEvent.click(screen.getByRole('button', { name: /Show more/ }));
  await screen.findByText(nameCell(/Guest000/));
  fireEvent.change(screen.getByLabelText('Search clients'), { target: { value: 'Guest012' } });
  expect(await screen.findByText(nameCell(/Guest012/))).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Show more/ })).not.toBeInTheDocument();
});
