import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FileUploadsPage from './FileUploadsPage';
import { fileUploadsApi, configSummaryApi, storageSettingsApi } from '../services/api';

jest.mock('../services/api', () => ({
  fileUploadsApi: { getAll: jest.fn(), getViewBlob: jest.fn() },
  configSummaryApi: { get: jest.fn() },
  storageSettingsApi: { getS3ReadOverride: jest.fn(), updateS3ReadOverride: jest.fn() },
}));

const mock = (fn: unknown) => fn as jest.Mock;

const files = [
  { _id: 'f1', originalFileName: 'passport.pdf', storedFileName: 'stored-passport.pdf', mimeType: 'application/pdf', documentKind: 'client_medical', fileSize: 2048, uploadedAt: '2026-10-01T00:00:00Z', filePath: '/uploads/passport.pdf' },
];

// PPVC-1008: this page previously used a raw bg-white table/panel pattern with
// no shared kit usage.
describe('FileUploadsPage (PPVC-1008)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock(fileUploadsApi.getAll).mockResolvedValue({ data: files });
    mock(configSummaryApi.get).mockResolvedValue({ data: null });
    mock(storageSettingsApi.getS3ReadOverride).mockResolvedValue({ data: null });
  });

  it('renders the file table inside the shared Card surface', async () => {
    const { container } = render(<FileUploadsPage />);
    await screen.findByText('passport.pdf');
    expect(container.querySelectorAll('.border-apple-gray-200.shadow-apple-sm').length).toBeGreaterThan(0);
  });

  it('refreshes the file list on demand', async () => {
    render(<FileUploadsPage />);
    await screen.findByText('passport.pdf');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(fileUploadsApi.getAll).toHaveBeenCalledTimes(2));
  });

  it('shows an empty state when there are no files', async () => {
    mock(fileUploadsApi.getAll).mockResolvedValue({ data: [] });
    render(<FileUploadsPage />);
    expect(await screen.findByText('No file uploads found.')).toBeInTheDocument();
  });
});
