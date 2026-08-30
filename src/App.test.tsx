import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';
import { preloaderService } from './services/preloader';

jest.mock('./components/AppleLayout', () => () => <div>Application</div>);
jest.mock('./components/MedicalReviewGroupAccessPage', () => () => <div>Group access exchange</div>);
jest.mock('./utils/nativeDialogReplacement', () => ({ installNativeDialogReplacement: jest.fn() }));
jest.mock('./services/preloader', () => ({ preloaderService: { preloadEssentialData: jest.fn().mockResolvedValue(undefined) } }));

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, '', '/');
  (preloaderService.preloadEssentialData as jest.Mock).mockResolvedValue(undefined);
});

test('renders the login screen for a signed-out user', async () => {
  render(<App />);
  expect(await screen.findByRole('heading', { name: /Provider Plus Login/i })).toBeInTheDocument();
});

test('opens a grouped review exchange outside the admin layout even when already signed in', async () => {
  localStorage.setItem('token', 'admin-token');
  localStorage.setItem('user', JSON.stringify({ email: 'admin@example.com', role: 'admin' }));
  localStorage.setItem('providerPlusAppMode:v1', JSON.stringify({ mode: 'shopping' }));
  window.history.pushState({}, '', '/medical-review-group-access/group-token');
  render(<App />);
  expect(await screen.findByText('Group access exchange')).toBeInTheDocument();
  expect(screen.queryByText('Application')).not.toBeInTheDocument();
});
