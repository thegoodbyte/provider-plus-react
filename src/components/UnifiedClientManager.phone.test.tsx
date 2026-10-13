import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UnifiedClientManager from './UnifiedClientManager';
import { clientsApi, bookingsApi, retreatsApi, referralsApi } from '../services/api';

jest.mock('../services/api', () => ({
  clientsApi: { getAll: jest.fn() },
  bookingsApi: { getAll: jest.fn().mockResolvedValue({ data: [] }) },
  retreatsApi: { getAll: jest.fn().mockResolvedValue({ data: [] }) },
  referralsApi: { getAll: jest.fn().mockResolvedValue({ data: [] }) },
}));
jest.mock('./useClientProfilePictureUrl', () => ({ useClientProfilePictureUrl: () => null }));

it('finds legacy WhatsApp phones and separate country codes in the Clients page', async () => {
  for (const api of [bookingsApi, retreatsApi, referralsApi]) (api.getAll as jest.Mock).mockResolvedValue({ data: [] });
  (clientsApi.getAll as jest.Mock).mockResolvedValue({ data: [
    { _id: 'one', firstName: 'Legacy', lastName: 'Contact', phone: '\u202A+48\u00A0665 587 456\u202C', display_id: 1232 },
    { _id: 'two', firstName: 'Separate', lastName: 'Contact', phoneCountryCode: '+420', phone: '777 123 456' },
    { _id: 'three', firstName: 'Other', lastName: 'Person', phone: '+1 555 555 5555' },
  ] });
  render(<MemoryRouter><UnifiedClientManager /></MemoryRouter>);
  await screen.findByText('Legacy Contact');
  const search = screen.getByPlaceholderText('Search clients, email, phone, or ID…');
  for (const value of ['665587456', '+48 (665) 587-456', '0048 665 587 456']) {
    fireEvent.change(search, { target: { value } });
    await waitFor(() => expect(screen.queryByText('Other Person')).not.toBeInTheDocument());
    expect(screen.getByText('Legacy Contact')).toBeInTheDocument();
  }
  fireEvent.change(search, { target: { value: '+420777123456' } });
  await waitFor(() => expect(screen.queryByText('Legacy Contact')).not.toBeInTheDocument());
  expect(screen.getByText('Separate Contact')).toBeInTheDocument();
});
