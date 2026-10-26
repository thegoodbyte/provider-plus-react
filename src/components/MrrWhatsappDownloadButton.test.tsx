import React from 'react';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import MrrWhatsappDownloadButton from './MrrWhatsappDownloadButton';
import { medicalReviewRequestsApi } from '../services/api';
let mockRole = 'admin';
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: mockRole } }) }));
jest.mock('../services/api', () => ({ medicalReviewRequestsApi: { downloadForWhatsapp: jest.fn() } }));
const originalLocation = window.location;
let assign: jest.Mock;
beforeEach(() => {
  mockRole = 'admin'; assign = jest.fn();
  Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, assign } });
});
afterEach(() => { Object.defineProperty(window, 'location', { configurable: true, value: originalLocation }); });
const mount = (onError = jest.fn()) => render(<MrrWhatsappDownloadButton requestId="mrr" requestNumber={1423} onError={onError} />);
it.each(['admin', 'medical_staff'])('downloads the selected request for %s', async role => {
  mockRole = role;
  (medicalReviewRequestsApi.downloadForWhatsapp as jest.Mock).mockResolvedValue({ data: { url: 'https://storage.example.invalid/archive.zip' } });
  mount(); fireEvent.click(screen.getByRole('button', { name: 'Download MRR #1423 for WhatsApp' }));
  await waitFor(() => expect(assign).toHaveBeenCalledWith('https://storage.example.invalid/archive.zip'));
  expect(medicalReviewRequestsApi.downloadForWhatsapp).toHaveBeenCalledWith('mrr');
});
it.each(['medical_advisor', 'user', 'helper'])('hides the action for %s', role => {
  mockRole = role; mount(); expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('keeps a failed preparation retryable without navigating', async () => {
  const onError = jest.fn();
  (medicalReviewRequestsApi.downloadForWhatsapp as jest.Mock).mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValueOnce({ data: { url: 'https://storage.example.invalid/retry.zip' } });
  mount(onError); const button = screen.getByRole('button'); fireEvent.click(button);
  await waitFor(() => expect(onError).toHaveBeenCalled()); expect(assign).not.toHaveBeenCalled();
  expect(button).toBeEnabled(); fireEvent.click(button);
  await waitFor(() => expect(assign).toHaveBeenCalledWith('https://storage.example.invalid/retry.zip'));
});
it('disables duplicate clicks while the archive is being prepared', async () => {
  let resolve!: (value: any) => void;
  (medicalReviewRequestsApi.downloadForWhatsapp as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
  mount(); const button = screen.getByRole('button'); fireEvent.click(button); fireEvent.click(button);
  expect(button).toBeDisabled(); expect(medicalReviewRequestsApi.downloadForWhatsapp).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ data: { url: 'https://storage.example.invalid/archive.zip' } }));
  expect(button).toBeEnabled();
});
