import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DevelopmentRefreshPanel from './DevelopmentRefreshPanel';
import { developmentRefreshApi } from '../services/api';
jest.mock('../services/api', () => ({ developmentRefreshApi: { status: jest.fn(), start: jest.fn() } }));
const api = developmentRefreshApi as jest.Mocked<typeof developmentRefreshApi>;
beforeEach(() => { jest.clearAllMocks(); });
test('production capability hides all refresh controls', async () => {
  api.status.mockResolvedValue({ data: { enabled: false } } as any);
  render(<DevelopmentRefreshPanel />);
  await waitFor(() => expect(api.status).toHaveBeenCalled());
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
test('requires exact replace confirmation and shows running state without submitting twice', async () => {
  api.status.mockResolvedValue({ data: { enabled: true, target: 'dev' } } as any);
  api.start.mockResolvedValue({ data: { enabled: true, target: 'dev', job: { id: '1', status: 'running', phase: 'exporting' } } } as any);
  render(<DevelopmentRefreshPanel />);
  fireEvent.click(await screen.findByRole('button', { name: 'Refresh from production' }));
  const submit = screen.getByRole('button', { name: 'Replace development data' });
  expect(submit).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Type replace/), { target: { value: 'Replace' } });
  expect(submit).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Type replace/), { target: { value: 'replace' } });
  fireEvent.click(submit);
  await waitFor(() => expect(api.start).toHaveBeenCalledWith('replace'));
  expect(await screen.findByRole('button', { name: 'Refresh in progress…' })).toBeDisabled();
  expect(api.start).toHaveBeenCalledTimes(1);
});
test('shows actionable relationship-validation failure', async () => {
  api.status.mockResolvedValue({ data: { enabled: true, job: { id: '1', status: 'failed', phase: 'validating', code: 'ORPHANED_REFERENCE' } } } as any);
  render(<DevelopmentRefreshPanel />);
  expect(await screen.findByText(/refer to missing records/)).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('was not replaced');
});
