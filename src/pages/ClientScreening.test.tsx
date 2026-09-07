import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ClientScreening from './ClientScreening';
import { clientsApi, referralsApi, screeningApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

jest.mock('../services/api', () => ({
  clientsApi: { getOne: jest.fn(), downloadScreeningPdf: jest.fn() },
  referralsApi: { getAll: jest.fn() },
  screeningApi: { create: jest.fn(), uploadHandwriting: jest.fn() },
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockedClientsApi = clientsApi as jest.Mocked<typeof clientsApi>;
const mockedReferralsApi = referralsApi as jest.Mocked<typeof referralsApi>;
const mockedScreeningApi = screeningApi as jest.Mocked<typeof screeningApi>;
const mockedUseAuth = useAuth as jest.Mock;

const client = {
  _id: 'client-1', firstName: 'Eva', lastName: 'Novak', display_id: 501, phone: '+420777123456',
  email: 'eva@example.com', screeningData: {},
};

const renderPage = () => render(
  <MemoryRouter initialEntries={['/admin/clients/client-1/screening']}>
    <Routes>
      <Route path="/admin/clients/:clientId/screening" element={<ClientScreening />} />
    </Routes>
  </MemoryRouter>,
);

describe('ClientScreening referral capture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedClientsApi.getOne.mockResolvedValue({ data: client } as any);
    mockedReferralsApi.getAll.mockResolvedValue({
      data: [
        { _id: 'friend', name: 'Friend', isActive: true },
        { _id: 'r1', name: 'Instagram', isActive: true },
      ],
    } as any);
    mockedScreeningApi.create.mockResolvedValue({ data: {} } as any);
    mockedUseAuth.mockReturnValue({ user: { role: 'admin' } });
  });

  it('uses the shared ClientReferralFields component (searchable referral + friend capture) instead of a plain select', async () => {
    renderPage();
    await screen.findByText('Referral');
    expect(screen.getByText('Referral')).toBeInTheDocument();
  });

  it('captures a free-typed friend name and saves it alongside the referral', async () => {
    renderPage();
    await screen.findByText('Referral');

    fireEvent.change(screen.getByDisplayValue('No referral selected'), { target: { value: 'friend' } });
    fireEvent.click(screen.getByLabelText('Someone else'));
    fireEvent.change(screen.getByPlaceholderText('Enter their name'), { target: { value: 'Arek' } });

    fireEvent.click(screen.getAllByRole('button', { name: 'Save Screening' })[0]);

    await waitFor(() => expect(mockedScreeningApi.create).toHaveBeenCalledWith(expect.objectContaining({
      referralId: 'friend', referralPersonType: 'someone_else', referralPersonName: 'Arek',
    })));
  });
});
