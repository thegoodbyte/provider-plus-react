import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuditLogsPage from './AuditLogsPage';
import { auditLogsApi } from '../services/api';
import { usersApi } from '../services/usersApi';

jest.mock('../services/api', () => ({
  auditLogsApi: { getAll: jest.fn() },
}));

jest.mock('../services/usersApi', () => ({
  usersApi: { getAll: jest.fn() },
}));

const mock = (fn: unknown) => fn as jest.Mock;

const logs = [
  { _id: 'l1', actorEmail: 'admin@example.test', actorRole: 'admin', action: 'update', entityType: 'client', entityDisplayId: '1120', summary: 'Updated client record', createdAt: '2026-10-01T00:00:00Z' },
];

const users = [
  { _id: 'u1', email: 'kasia@example.test', firstName: 'Kasia', lastName: 'Nowak', role: 'admin', isActive: true },
  { _id: 'u2', email: 'noname@example.test', role: 'user', isActive: true },
];

// PPVC-1009: this page previously used a raw bg-white table/filter-bar pattern.
describe('AuditLogsPage (PPVC-1009)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock(auditLogsApi.getAll).mockResolvedValue({ data: { items: logs, total: 1 } });
    mock(usersApi.getAll).mockResolvedValue({ data: users });
  });

  it('renders the audit log table inside the shared Card surface', async () => {
    const { container } = render(<AuditLogsPage />);
    await screen.findByText('Updated client record');
    expect(container.querySelectorAll('.border-apple-gray-200.shadow-apple-sm').length).toBeGreaterThan(0);
  });

  it('clears filters on demand', async () => {
    render(<AuditLogsPage />);
    await screen.findByText('Updated client record');
    fireEvent.change(screen.getByPlaceholderText('Keyword'), { target: { value: 'foo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(screen.getByPlaceholderText('Keyword')).toHaveValue(''));
  });

  it('shows an empty state when there are no logs', async () => {
    mock(auditLogsApi.getAll).mockResolvedValue({ data: { items: [], total: 0 } });
    render(<AuditLogsPage />);
    expect(await screen.findByText('No audit logs found.')).toBeInTheDocument();
  });

  // PPVC-1053: actor filter is a user picker populated from GET /users, not free text.
  it('populates the actor dropdown with user display names, defaulting to "All users"', async () => {
    render(<AuditLogsPage />);
    await screen.findByText('Updated client record');

    await screen.findByRole('option', { name: 'Kasia Nowak' });
    expect(usersApi.getAll).toHaveBeenCalled();

    const dropdown = screen.getByDisplayValue('All users') as HTMLSelectElement;
    expect(dropdown.value).toBe('');
    expect(screen.getByRole('option', { name: 'Kasia Nowak' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'noname@example.test' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All users' })).toBeInTheDocument();
  });

  it('refetches audit logs with actorUserId when a user is selected', async () => {
    render(<AuditLogsPage />);
    await screen.findByText('Updated client record');
    await screen.findByRole('option', { name: 'Kasia Nowak' });

    const dropdown = screen.getByDisplayValue('All users') as HTMLSelectElement;
    fireEvent.change(dropdown, { target: { value: 'u1' } });

    await waitFor(() => {
      const lastCall = mock(auditLogsApi.getAll).mock.calls.at(-1)?.[0];
      expect(lastCall).toMatchObject({ actorUserId: 'u1' });
    });
  });

  it('resets the actor dropdown to "All users" on Clear', async () => {
    render(<AuditLogsPage />);
    await screen.findByText('Updated client record');
    await screen.findByRole('option', { name: 'Kasia Nowak' });

    const dropdown = screen.getByDisplayValue('All users') as HTMLSelectElement;
    fireEvent.change(dropdown, { target: { value: 'u1' } });
    await waitFor(() => expect(dropdown.value).toBe('u1'));

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(dropdown.value).toBe(''));
  });
});
