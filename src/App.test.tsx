import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./components/AppleLayout', () => () => <div>Application</div>);
jest.mock('./utils/nativeDialogReplacement', () => ({ installNativeDialogReplacement: jest.fn() }));

test('renders the login screen for a signed-out user', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /Provider Plus Login/i })).toBeInTheDocument();
});
