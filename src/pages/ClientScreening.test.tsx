jest.mock('../services/roomInventoryApi', () => ({ roomInventoryApi: { options: async () => ({data:[]}), preference: async () => ({data:{key:''}}) } }));
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

  it.each(['direct', 'self_identified', 'na'] as const)('saves and restores the %s attribution when screening is reopened', async (attribution) => {
    const firstRender = renderPage();
    await screen.findByDisplayValue('Eva');
    fireEvent.change(screen.getByLabelText('Attribution type'), { target: { value: attribution } });
    expect(screen.getByLabelText('Attribution type')).toHaveValue(attribution);
    fireEvent.click(screen.getAllByRole('button', { name: 'Save Screening' })[0]);
    await waitFor(() => expect(mockedScreeningApi.create).toHaveBeenCalledWith(expect.objectContaining({ referralAttributionType: attribution })));

    const saved = mockedScreeningApi.create.mock.calls[0][0];
    firstRender.unmount();
    mockedClientsApi.getOne.mockResolvedValue({ data: { ...client, screeningData: saved } } as any);
    renderPage();
    await screen.findByDisplayValue('Eva');
    expect(screen.getByLabelText('Attribution type')).toHaveValue(attribution);
  });

  it('loads attribution from the client profile when screening has no saved value', async () => {
    mockedClientsApi.getOne.mockResolvedValue({ data: { ...client, referralAttributionType: 'self_identified' } } as any);
    renderPage();
    await screen.findByDisplayValue('Eva');
    expect(screen.getByLabelText('Attribution type')).toHaveValue('self_identified');
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
  it('loads location and exact birth date, accepts year correction, and saves optional date parts', async () => {
    mockedClientsApi.getOne.mockResolvedValue({ data: { ...client, city: 'Prague', country: 'Czechia', dateOfBirth: '1990-06-15', screeningData: { year_of_birth: 1990 } } } as any);
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Town / City')).toHaveValue('Prague'));
    expect(screen.getByLabelText('Birth Month (optional)')).toHaveValue(6);
    expect(screen.getByLabelText('Birth Day (optional)')).toHaveValue(15);
    fireEvent.change(screen.getByLabelText('Year of Birth'), { target: { value: '1992' } });
    fireEvent.change(screen.getByLabelText('Town / City'), { target: { value: 'Brno' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save Screening' })[0]);
    await waitFor(() => expect(mockedScreeningApi.create).toHaveBeenCalledWith(expect.objectContaining({ city: 'Brno', country: 'Czechia', year_of_birth: 1992, month_of_birth: 6, day_of_birth: 15 })));
  });

  it('autofills year from age, allows correction and keeps unknown date parts empty', async () => {
    mockedClientsApi.getOne.mockResolvedValue({ data: { ...client, dateOfBirth: '1991-01-01', screeningData: { year_of_birth: 1991 } } } as any);
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Year of Birth')).toHaveValue(1991));
    expect(screen.getByLabelText('Birth Month (optional)')).toHaveValue(null);
    fireEvent.change(screen.getByLabelText('Age'), { target: { value: '40' } });
    expect(screen.getByLabelText('Year of Birth')).toHaveValue(new Date().getFullYear() - 40);
    fireEvent.change(screen.getByLabelText('Year of Birth'), { target: { value: '1985' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save Screening' })[0]);
    await waitFor(() => expect(mockedScreeningApi.create).toHaveBeenCalledWith(expect.objectContaining({ year_of_birth: 1985, month_of_birth: null, day_of_birth: null })));
  });

  it('blocks saving an impossible date and shows the reason', async () => {
    renderPage();
    await screen.findByText('Referral');
    fireEvent.change(screen.getByLabelText('Year of Birth'), { target: { value: '1991' } });
    fireEvent.change(screen.getByLabelText('Birth Month (optional)'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Birth Day (optional)'), { target: { value: '29' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save Screening' })[0]);
    await screen.findByText('Enter a valid date of birth.');
    expect(mockedScreeningApi.create).not.toHaveBeenCalled();
  });

});
