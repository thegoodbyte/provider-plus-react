import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UserManagement from './UserManagement';
import { usersApi } from '../services/usersApi';
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin', _id: 'admin' }, startUserImpersonation: jest.fn() }) }));
jest.mock('../services/usersApi', () => ({ usersApi: { getAll: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), resetPassword: jest.fn() } }));
beforeEach(() => { (usersApi.getAll as jest.Mock).mockResolvedValue({ data: [{ _id: 'u1', email: 'existing@example.invalid', firstName: 'Example', lastName: 'User', isActive: true, role: 'user' }] }); });
it('replaces the blocking error modal with a toast and retains the create editor', async () => {
  (usersApi.create as jest.Mock).mockRejectedValue({ response: { status: 400, data: { message: 'Email taken@example.invalid is already registered.' } } });
  render(<UserManagement />); await screen.findByText('existing@example.invalid');
  fireEvent.click(screen.getByRole('button', { name: /Add User/ }));
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'taken@example.invalid' } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'Safe!Password126' } });
  fireEvent.change(screen.getByLabelText(/^Confirm Password/), { target: { value: 'Safe!Password126' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create User' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Duplicate email');
  expect(screen.queryByRole('heading', { name: 'Notification' })).not.toBeInTheDocument();
  expect(screen.getByLabelText(/^Email/)).toHaveValue('taken@example.invalid');
});
it('shows password reset as success', async () => {
  (usersApi.resetPassword as jest.Mock).mockResolvedValue({});
  render(<UserManagement />); await screen.findByText('existing@example.invalid');
  fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
  fireEvent.change(screen.getByLabelText(/^New Password/), { target: { value: 'Safe!Password126' } });
  fireEvent.change(screen.getByLabelText(/^Confirm New Password/), { target: { value: 'Safe!Password126' } });
  fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }));
  await waitFor(() => expect(usersApi.resetPassword).toHaveBeenCalled());
  expect(await screen.findByRole('status')).toHaveTextContent('Password reset successfully.');
});
