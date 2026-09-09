import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';
import { preloaderService } from './services/preloader';

jest.mock('./components/AppleLayout', () => () => <div>Application</div>);
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
