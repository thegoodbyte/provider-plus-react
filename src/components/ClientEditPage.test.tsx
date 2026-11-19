import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ClientEditPage from './ClientEditPage';
import { clientsApi, referralsApi, languagesApi } from '../services/api';

jest.mock('../services/api', () => ({
  clientsApi: { getOne: jest.fn(), getProfilePictureBlob: jest.fn(), update: jest.fn(), uploadProfilePicture: jest.fn(), search: jest.fn() },
  referralsApi: { getAll: jest.fn() },
  languagesApi: { getActive: jest.fn() },
}));

const client = {
  _id: 'c1', display_id: 1120, firstName: 'Ada', lastName: 'Fixture', status: 'active', workflowStatus: 'screened_accepted',
  email: 'ada@example.test', phone: '+420777123456', country: 'Czech Republic',
};

// PPVC-1003: the edit form's sections now sit on the shared Card surface and its
// plain text fields use AppleInput, instead of a bespoke bordered section + raw <input>.
describe('ClientEditPage (PPVC-1003)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (clientsApi.getOne as jest.Mock).mockResolvedValue({ data: client });
    (clientsApi.getProfilePictureBlob as jest.Mock).mockResolvedValue({ data: new Blob() });
    (clientsApi.update as jest.Mock).mockResolvedValue({ data: client });
    (referralsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (languagesApi.getActive as jest.Mock).mockResolvedValue({ data: [{ code: 'EN', name: 'English' }] });
  });

  const renderPage = () => render(
    <MemoryRouter initialEntries={['/admin/clients/c1/edit']}>
      <Routes><Route path="/admin/clients/:clientId/edit" element={<ClientEditPage />} /></Routes>
    </MemoryRouter>,
  );

  it('renders each form section inside the shared Card surface', async () => {
    const { container } = renderPage();
    await screen.findByText('Basic Information');
    expect(container.querySelectorAll('.border-apple-gray-200.shadow-apple-sm').length).toBeGreaterThanOrEqual(5);
  });

  it('edits the first name via the shared AppleInput and saves it', async () => {
    renderPage();
    const firstName = await screen.findByLabelText(/^First Name/);
    fireEvent.change(firstName, { target: { value: 'Beatrice' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));
    await waitFor(() => expect(clientsApi.update).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ firstName: 'Beatrice' }),
      expect.anything(),
    ));
  });
});
