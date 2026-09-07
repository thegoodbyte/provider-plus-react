import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AddClient from './AddClient';
import { clientsApi, referralsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

jest.mock('../services/api', () => ({
  clientsApi: { create: jest.fn(), getNextDisplayId: jest.fn(), getAll: jest.fn() },
  referralsApi: { getAll: jest.fn() },
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockedClientsApi = clientsApi as jest.Mocked<typeof clientsApi>;
const mockedReferralsApi = referralsApi as jest.Mocked<typeof referralsApi>;
const mockedUseAuth = useAuth as jest.Mock;

const renderPage = () => render(<MemoryRouter><AddClient /></MemoryRouter>);

describe('AddClient phone -> country/language autofill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedClientsApi.getAll.mockResolvedValue({ data: [] } as any);
    mockedReferralsApi.getAll.mockResolvedValue({ data: [] } as any);
    mockedUseAuth.mockReturnValue({ user: { role: 'admin' } });
  });

  it('auto-fills Country and Language when a recognized phone country code is entered', async () => {
    renderPage();

    const phoneInput = screen.getByPlaceholderText('Enter full number with country code');
    fireEvent.change(phoneInput, { target: { value: '+48123456789' } });

    expect(await screen.findByText('Poland')).toBeInTheDocument();
    expect(screen.getByText('Polish')).toBeInTheDocument();
  });

  it('does not fight a subsequent manual Country selection after autofill', async () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('Enter full number with country code'), { target: { value: '+48123456789' } });
    expect(await screen.findByText('Poland')).toBeInTheDocument();

    // Manually override the country to Germany.
    const countryButtons = screen.getAllByRole('button', { name: /Poland|Select country/i });
    fireEvent.click(countryButtons[0]);
    fireEvent.change(screen.getByPlaceholderText('Search countries...'), { target: { value: 'Germany' } });
    fireEvent.click(screen.getByRole('button', { name: /Germany/i }));
    expect(await screen.findByText('Germany')).toBeInTheDocument();

    // Continuing to type the same Polish number should not clobber the manual override.
    fireEvent.change(screen.getByPlaceholderText('Enter full number with country code'), { target: { value: '+48123456780' } });
    expect(screen.getByText('Germany')).toBeInTheDocument();
  });
});
