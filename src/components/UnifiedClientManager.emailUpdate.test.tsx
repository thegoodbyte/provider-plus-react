import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UnifiedClientManager from './UnifiedClientManager';
import { clientsApi, bookingsApi, retreatsApi, referralsApi, languagesApi } from '../services/api';

// PPVC-1075: "updating client email address is not taking effect." This is a
// permanent regression test for the specific theory investigated on that
// ticket -- that a `useEffect` syncing local form state from `selectedClient`
// (or re-triggered by an unrelated background refetch, e.g. another client's
// workflow-status action firing `fetchClients()` while the edit dialog is
// still open) could clobber a typed-but-not-yet-submitted email back to the
// client's old value before the user hits Save.
jest.mock('../services/api', () => ({
  clientsApi: { getAll: jest.fn(), update: jest.fn(), quickAdd: jest.fn(), updateWorkflowStatus: jest.fn() },
  bookingsApi: { getAll: jest.fn() }, retreatsApi: { getAll: jest.fn() }, referralsApi: { getAll: jest.fn() },
  languagesApi: { getActive: jest.fn() },
}));

const editedClient = { _id: 'c1', firstName: 'Sample', lastName: 'Guest', email: 'old@example.invalid', phone: '+420777123456', status: 'active', workflowStatus: 'active' };
const otherClient = { _id: 'c2', firstName: 'Other', lastName: 'Lead', email: 'other@example.invalid', phone: '+420777000000', status: 'active', workflowStatus: 'entered' };

beforeEach(() => {
  jest.clearAllMocks();
  (clientsApi.getAll as jest.Mock).mockResolvedValue({ data: [editedClient, otherClient] });
  for (const api of [bookingsApi, retreatsApi, referralsApi]) (api.getAll as jest.Mock).mockResolvedValue({ data: [] });
  (languagesApi.getActive as jest.Mock).mockResolvedValue({ data: [
    { _id: '1', code: 'en', name: 'English', active: true, sortOrder: 10 },
  ] });
  (clientsApi.updateWorkflowStatus as jest.Mock).mockResolvedValue({ data: otherClient });
});

it('keeps a typed email change intact through a background refetch while the dialog stays open, and saves the new value', async () => {
  render(<MemoryRouter><UnifiedClientManager /></MemoryRouter>);

  // Open the edit dialog for the first client.
  const editButtons = await screen.findAllByTitle('Edit');
  fireEvent.click(editButtons[0]);
  const dialog = screen.getByRole('dialog');
  await act(async () => { await Promise.resolve(); });

  // Type a new email but don't submit yet.
  fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'new@example.invalid' } });
  expect(within(dialog).getByLabelText('Email')).toHaveValue('new@example.invalid');

  // Simulate a background refetch happening while the dialog is still open --
  // e.g. another admin action (here, a workflow-status change on a different
  // client row) triggers `fetchClients()`, which replaces the `clients` array
  // and re-renders the whole page, including the still-open dialog.
  (clientsApi.getAll as jest.Mock).mockResolvedValueOnce({ data: [editedClient, { ...otherClient, workflowStatus: 'screening_scheduled' }] });
  fireEvent.click(screen.getAllByTitle('Start Screening')[0]);
  await waitFor(() => expect(clientsApi.updateWorkflowStatus).toHaveBeenCalled());
  await act(async () => { await Promise.resolve(); });

  // The typed-but-unsaved email must survive the unrelated re-render.
  expect(within(dialog).getByLabelText('Email')).toHaveValue('new@example.invalid');

  // Now submit, and confirm the NEW email (not the stale original) is sent.
  (clientsApi.update as jest.Mock).mockResolvedValue({ data: { ...editedClient, email: 'new@example.invalid' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Update Client' }));
  await waitFor(() => expect(clientsApi.update).toHaveBeenCalled());
  expect(clientsApi.update).toHaveBeenCalledWith('c1', expect.objectContaining({ email: 'new@example.invalid' }), { suppressGlobalError: true });
});
