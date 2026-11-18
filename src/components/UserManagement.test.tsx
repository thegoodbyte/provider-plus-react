import React from 'react';
import { render, screen } from '@testing-library/react';
import UserManagement from './UserManagement';
import { usersApi } from '../services/usersApi';

jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin', _id: 'admin' }, startUserImpersonation: jest.fn() }) }));
jest.mock('../services/usersApi', () => ({ usersApi: { getAll: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), resetPassword: jest.fn() } }));

// PPVC-1009: this page previously used raw bg-white rounded-lg shadow-sm cards and a
// plain table for the users list, with hand-rolled status/role pills.
describe('UserManagement (PPVC-1009)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usersApi.getAll as jest.Mock).mockResolvedValue({
      data: [{ _id: 'u1', email: 'anna@example.test', firstName: 'Anna', lastName: 'Test', isActive: true, role: 'admin' }],
    });
  });

  it('renders the stat tiles and users table inside the shared Card surface, with Badge status/role pills', async () => {
    const { container } = render(<UserManagement />);
    await screen.findByText('anna@example.test');
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Administrator').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.border-apple-gray-200.shadow-apple-sm').length).toBeGreaterThan(0);
  });
});
