import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RetreatStaffAssignmentsPage from './RetreatStaffAssignmentsPage';
import { contactBookApi, retreatsApi } from '../services/api';
jest.mock('../services/api', () => ({ retreatsApi: { getOne: jest.fn(), update: jest.fn() }, contactBookApi: { getAll: jest.fn() } }));
const retreat = { _id: 'r1', code: 'R1', startDate: '2027-01-01', endDate: '2027-01-08', retreatStaff: [{ role: 'helper', contactId: 'p1', name: 'First' }, { role: 'second_helper', contactId: 'p2', name: 'Second' }] };
function open(query = '?add=helper') {
  (retreatsApi.getOne as jest.Mock).mockResolvedValue({ data: retreat });
  (contactBookApi.getAll as jest.Mock).mockResolvedValue({ data: [{ _id: 'p3', name: 'Third', role: 'helper' }] });
  render(<MemoryRouter initialEntries={['/admin/retreats/r1/helpers' + query]}><Routes><Route path="/admin/retreats/:retreatId/helpers" element={<RetreatStaffAssignmentsPage />} /></Routes></MemoryRouter>);
}
it('creates exactly one third-helper draft and prevents saving an empty assignment', async () => {
  open();
  await screen.findByRole('heading', { name: 'Cooks and helpers' });
  expect(screen.getAllByRole('combobox', { name: 'Staff role' })).toHaveLength(3);
  expect(screen.getAllByRole('combobox', { name: 'Staff role' })[2]).toHaveValue('third_helper');
  expect(screen.getAllByLabelText('From date')[2]).toHaveValue('2027-01-01');
  fireEvent.click(screen.getByRole('button', { name: 'Save team' }));
  await screen.findByText('Select a directory person for each assignment, or remove the empty row.');
  expect(retreatsApi.update).not.toHaveBeenCalled();
});
it('preserves existing assignments and retains the new selected helper after save failure', async () => {
  open();
  await screen.findByRole('heading', { name: 'Cooks and helpers' });
  fireEvent.change(screen.getAllByRole('combobox', { name: 'Directory person' })[2], { target: { value: 'p3' } });
  (retreatsApi.update as jest.Mock).mockRejectedValue({ response: { data: { message: 'Save failed' } } });
  fireEvent.click(screen.getByRole('button', { name: 'Save team' }));
  await screen.findByText('Save failed');
  const payload = (retreatsApi.update as jest.Mock).mock.calls[0][1];
  expect(payload.retreatStaff).toHaveLength(3);
  expect(payload.retreatStaff[0]).toMatchObject(retreat.retreatStaff[0]);
  expect(payload.retreatStaff[2]).toMatchObject({ role: 'third_helper', contactId: 'p3', name: 'Third', startDate: '2027-01-01', endDate: '2027-01-08' });
  expect(screen.getAllByRole('combobox', { name: 'Directory person' })[2]).toHaveValue('p3');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save team' })).toBeEnabled());
});
it('Manage team opens existing rows without automatically adding a draft', async () => {
  open('');
  await screen.findByRole('heading', { name: 'Cooks and helpers' });
  expect(screen.getAllByRole('combobox', { name: 'Staff role' })).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Add person' }));
  expect(screen.getAllByRole('combobox', { name: 'Staff role' })[2]).toHaveValue('third_helper');
});
