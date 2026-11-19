import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DataBackupPage from './DataBackupPage';
import { backupsApi } from '../services/api';

jest.mock('../services/api', () => ({
  backupsApi: { listS3Files: jest.fn(), getLogs: jest.fn() },
}));
jest.mock('./DevelopmentRefreshPanel', () => () => null);

const mock = (fn: unknown) => fn as jest.Mock;

const s3Files = [{ key: 'backups/provider-plus/production/2026-10-01.json.gz', size: 204800, lastModified: '2026-10-01T00:00:00Z' }];
const logs = [{ _id: 'l1', createdAt: '2026-10-01T00:00:00Z', action: 'export', status: 'success', actorEmail: 'admin@example.test', storage: 's3', bucket: 'provider-plus', key: 'backups/2026-10-01.json.gz' }];

// PPVC-1009: this page previously used 7 raw bg-white card sections and two raw tables.
describe('DataBackupPage (PPVC-1009)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock(backupsApi.listS3Files).mockResolvedValue({ data: { items: s3Files } });
    mock(backupsApi.getLogs).mockResolvedValue({ data: logs });
  });

  it('renders the S3 files and backup log tables inside the shared Card surface', async () => {
    const { container } = render(<DataBackupPage />);
    await screen.findByText('backups/provider-plus/production/2026-10-01.json.gz');
    expect(screen.getByText('export')).toBeInTheDocument();
    expect(container.querySelectorAll('.border-apple-gray-200.shadow-apple-sm').length).toBeGreaterThanOrEqual(7);
  });

  it('refreshes the S3 file list on demand', async () => {
    render(<DataBackupPage />);
    await screen.findByText('backups/provider-plus/production/2026-10-01.json.gz');
    fireEvent.click(screen.getAllByRole('button', { name: /Refresh$/ })[0]);
    await waitFor(() => expect(backupsApi.listS3Files).toHaveBeenCalledTimes(2));
  });

  it('shows empty states when there are no S3 files or logs', async () => {
    mock(backupsApi.listS3Files).mockResolvedValue({ data: { items: [] } });
    mock(backupsApi.getLogs).mockResolvedValue({ data: [] });
    render(<DataBackupPage />);
    expect(await screen.findByText('No S3 backup files found.')).toBeInTheDocument();
    expect(await screen.findByText('No backup log entries yet.')).toBeInTheDocument();
  });
});
