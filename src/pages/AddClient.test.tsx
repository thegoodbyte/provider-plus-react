import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AddClient from './AddClient';
import { clientsApi, referralsApi, languagesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

jest.mock('../services/api', () => ({
  clientsApi: { create: jest.fn(), getNextDisplayId: jest.fn(), getAll: jest.fn() },
  referralsApi: { getAll: jest.fn() },
  languagesApi: { getActive: jest.fn() },
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockedClientsApi = clientsApi as jest.Mocked<typeof clientsApi>;
const mockedReferralsApi = referralsApi as jest.Mocked<typeof referralsApi>;
const mockedLanguagesApi = languagesApi as jest.Mocked<typeof languagesApi>;
const mockedUseAuth = useAuth as jest.Mock;

const renderPage = () => render(<MemoryRouter><AddClient /></MemoryRouter>);

describe('AddClient phone -> country/language autofill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedClientsApi.getAll.mockResolvedValue({ data: [] } as any);
    mockedClientsApi.getNextDisplayId.mockResolvedValue({ data: 1001 } as any);
    mockedReferralsApi.getAll.mockResolvedValue({ data: [] } as any);
    mockedLanguagesApi.getActive.mockResolvedValue({ data: [
      { _id: '1', code: 'en', name: 'English', active: true, sortOrder: 10 },
      { _id: '2', code: 'cz', name: 'Czech', active: true, sortOrder: 20 },
      { _id: '3', code: 'pl', name: 'Polish', active: true, sortOrder: 30 },
    ] } as any);
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

  it('loads the next display_id from clientsApi.getNextDisplayId on mount', async () => {
    mockedClientsApi.getNextDisplayId.mockResolvedValue({ data: 1015 } as any);
    renderPage();

    const displayIdInput = await screen.findByLabelText('Client ID');
    expect(displayIdInput).toHaveValue(1015);
  });

  it('allows the user to overwrite the suggested display_id with a lower number and submits it', async () => {
    mockedClientsApi.getNextDisplayId.mockResolvedValue({ data: 1050 } as any);
    mockedClientsApi.create.mockResolvedValue({ data: { _id: 'new-client' } } as any);
    renderPage();

    const displayIdInput = await screen.findByLabelText('Client ID');
    expect(displayIdInput).toHaveValue(1050);

    // User overwrites with a lower number (1012)
    fireEvent.change(displayIdInput, { target: { value: '1012' } });
    expect(displayIdInput).toHaveValue(1012);

    fireEvent.change(screen.getByPlaceholderText('Enter first name'), { target: { value: 'John' } });
    fireEvent.change(screen.getByPlaceholderText('Enter last name'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByPlaceholderText('Enter full number with country code'), { target: { value: '+420777123456' } });

    fireEvent.click(screen.getAllByRole('button', { name: 'Save Client' })[0]);

    expect(mockedClientsApi.create).toHaveBeenCalledWith(expect.objectContaining({
      display_id: 1012,
      firstName: 'John',
      lastName: 'Doe',
    }));
  });
});
