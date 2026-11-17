import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UserManagement from './UserManagement';
import { usersApi } from '../services/usersApi';

jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin', _id: 'admin' }, startUserImpersonation: jest.fn() }) }));
jest.mock('../services/usersApi', () => ({ usersApi: { getAll: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), resetPassword: jest.fn() } }));

// PPVC-1036: the owner's partner this ticket is for is role: admin, same as the owner, so the
// "Navigation view" toggle must stay editable even when the target user's role select is disabled.
beforeEach(() => {
  (usersApi.getAll as jest.Mock).mockResolvedValue({
    data: [
      { _id: 'u1', email: 'partner@example.invalid', firstName: 'Partner', lastName: 'Admin', isActive: true, role: 'admin', navPreference: 'full' },
    ],
  });
  (usersApi.update as jest.Mock).mockResolvedValue({ data: {} });
});

it('lets an admin set another admin user to "Simple" view, and calls the update endpoint with the correct payload shape', async () => {
  render(<UserManagement />);
  await screen.findByText('partner@example.invalid');

  fireEvent.click(screen.getByLabelText('Edit user'));

  const roleSelect = screen.getByDisplayValue('Administrator') as HTMLSelectElement;
  expect(roleSelect).toBeDisabled(); // unrelated existing behavior for admin role -- unchanged by this ticket

  const navPreferenceSelect = screen.getByLabelText('Navigation view') as HTMLSelectElement;
  expect(navPreferenceSelect).not.toBeDisabled();
  expect(navPreferenceSelect.value).toBe('full');

  fireEvent.change(navPreferenceSelect, { target: { value: 'simple' } });
  fireEvent.click(screen.getByRole('button', { name: 'Update User' }));

  await waitFor(() => expect(usersApi.update).toHaveBeenCalled());
  expect(usersApi.update).toHaveBeenCalledWith(
    'u1',
    expect.objectContaining({ navPreference: 'simple' })
  );
});

it('defaults the toggle to "Full" when editing a user with no navPreference set yet', async () => {
  (usersApi.getAll as jest.Mock).mockResolvedValue({
    data: [
      { _id: 'u2', email: 'legacy@example.invalid', firstName: 'Legacy', lastName: 'User', isActive: true, role: 'user' },
    ],
  });
  render(<UserManagement />);
  await screen.findByText('legacy@example.invalid');

  fireEvent.click(screen.getByLabelText('Edit user'));

  const navPreferenceSelect = screen.getByLabelText('Navigation view') as HTMLSelectElement;
  expect(navPreferenceSelect.value).toBe('full');
});
