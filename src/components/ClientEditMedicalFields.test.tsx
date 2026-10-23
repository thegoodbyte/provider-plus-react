import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ClientEditPage from './ClientEditPage';
import ClientEditModal from './ClientEditModal';
import { clientsApi, referralsApi, languagesApi } from '../services/api';

jest.mock('../services/api', () => ({ clientsApi: { getOne: jest.fn(), update: jest.fn() }, referralsApi: { getAll: jest.fn() }, languagesApi: { getActive: jest.fn() } }));
const client = { _id: '507f1f77bcf86cd799439011', firstName: 'Test', lastName: 'Client', phone: '+48123456789', country: 'PL', language: 'EN', currentMedications: 'Test medication', allergies: 'Test allergy', specialRequests: 'Test request' };

describe.each(['page', 'modal'])('client edit %s medical fields', (variant) => {
  beforeEach(() => {
    jest.clearAllMocks();
    (clientsApi.getOne as jest.Mock).mockResolvedValue({ data: client });
    (clientsApi.update as jest.Mock).mockResolvedValue({ data: client });
    (languagesApi.getActive as jest.Mock).mockResolvedValue({ data: [
      { _id: '1', code: 'en', name: 'English', active: true, sortOrder: 10 },
      { _id: '2', code: 'cz', name: 'Czech', active: true, sortOrder: 20 },
      { _id: '3', code: 'pl', name: 'Polish', active: true, sortOrder: 30 },
    ] });
    (referralsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
  });
  const open = async () => {
    render(<MemoryRouter initialEntries={['/clients/' + client._id + '/edit']}>
      {variant === 'modal' ? <ClientEditModal client={client as any} onClose={jest.fn()} onSave={jest.fn()} /> : <Routes><Route path="/clients/:clientId/edit" element={<ClientEditPage />} /><Route path="/admin/clients/:clientId" element={<div>Saved client</div>} /></Routes>}
    </MemoryRouter>);
    await screen.findByDisplayValue('Test medication');
  };
  it('loads and saves canonical medication data with allergies and requests', async () => {
    await open();
    fireEvent.change(screen.getByLabelText(/Current Medications/), { target: { value: 'Updated medication' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));
    await waitFor(() => expect(clientsApi.update).toHaveBeenCalled());
    const payload = (clientsApi.update as jest.Mock).mock.calls[0][1];
    expect(payload).toMatchObject({ currentMedications: 'Updated medication', allergies: 'Test allergy', specialRequests: 'Test request' });
    expect(payload).not.toHaveProperty('medications');
  });
  it('sends explicit empty values when optional fields are cleared', async () => {
    await open();
    for (const label of [/Current Medications/, /Allergies/, /Special Requests/]) fireEvent.change(screen.getByLabelText(label), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));
    await waitFor(() => expect(clientsApi.update).toHaveBeenCalled());
    expect((clientsApi.update as jest.Mock).mock.calls[0][1]).toMatchObject({ currentMedications: '', allergies: '', specialRequests: '' });
  });
});

 it('saves a change to Self when a client already has allergies', async () => {
  const selfId = '507f1f77bcf86cd799439022';
  jest.clearAllMocks();
  (clientsApi.getOne as jest.Mock).mockResolvedValue({ data: { ...client, display_id: 1201 } });
  (clientsApi.update as jest.Mock).mockResolvedValue({ data: client });
  (referralsApi.getAll as jest.Mock).mockResolvedValue({ data: [{ _id: selfId, name: 'Self', isActive: true }] });
  (languagesApi.getActive as jest.Mock).mockResolvedValue({ data: [
    { _id: '1', code: 'en', name: 'English', active: true, sortOrder: 10 },
  ] });
  render(<MemoryRouter initialEntries={['/clients/' + client._id + '/edit']}><Routes>
    <Route path="/clients/:clientId/edit" element={<ClientEditPage />} />
    <Route path="/admin/clients/:clientId" element={<div>Saved client</div>} />
  </Routes></MemoryRouter>);
  const option = await screen.findByRole('option', { name: 'Self' });
  fireEvent.change(option.closest('select')!, { target: { value: selfId } });
  fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));
  await waitFor(() => expect(clientsApi.update).toHaveBeenCalledWith(client._id, expect.objectContaining({ display_id: 1201, referralId: selfId, source: 'Self', allergies: 'Test allergy' }), { suppressGlobalError: true }));
  expect(await screen.findByText('Saved client')).toBeInTheDocument();
 });

it.each(['page', 'modal'])('keeps a duplicate-email rejection local in the %s editor', async variant => {
  (clientsApi.getOne as jest.Mock).mockResolvedValue({ data: { ...client, email: 'original@example.invalid' } });
  (referralsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
  (languagesApi.getActive as jest.Mock).mockResolvedValue({ data: [
    { _id: '1', code: 'en', name: 'English', active: true, sortOrder: 10 },
  ] });
  (clientsApi.update as jest.Mock).mockRejectedValue({ response: { status: 400, data: { message: 'Email taken@example.invalid is already registered.' } } });
  render(<MemoryRouter initialEntries={['/clients/' + client._id + '/edit']}>
    {variant === 'modal' ? <ClientEditModal client={{ ...client, email: 'original@example.invalid' } as any} onClose={jest.fn()} onSave={jest.fn()} /> : <Routes><Route path="/clients/:clientId/edit" element={<ClientEditPage />} /></Routes>}
  </MemoryRouter>);
  const email = await screen.findByLabelText(/^Email/);
  fireEvent.change(email, { target: { value: 'taken@example.invalid' } });
  fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Duplicate email');
  expect(email).toHaveValue('taken@example.invalid');
});
