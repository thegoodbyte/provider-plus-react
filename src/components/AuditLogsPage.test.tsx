import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AuditLogsPage from './AuditLogsPage';
import { auditLogsApi } from '../services/api';

jest.mock('../services/api', () => ({
  auditLogsApi: { getAll: jest.fn() },
}));

const mock = (fn: unknown) => fn as jest.Mock;

const logs = [
  { _id: 'l1', actorEmail: 'admin@example.test', actorRole: 'admin', action: 'update', entityType: 'client', entityDisplayId: '1120', summary: 'Updated client record', createdAt: '2026-10-01T00:00:00Z' },
];

// PPVC-1009: this page previously used a raw bg-white table/filter-bar pattern.
describe('AuditLogsPage (PPVC-1009)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock(auditLogsApi.getAll).mockResolvedValue({ data: { items: logs, total: 1 } });
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
});
