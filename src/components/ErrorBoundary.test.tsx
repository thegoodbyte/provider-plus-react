import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb(): React.ReactElement {
  throw new Error('boom');
}

it('renders children normally when nothing throws', () => {
  render(<ErrorBoundary title="Something went wrong" message="Reload to try again."><p>All good</p></ErrorBoundary>);
  expect(screen.getByText('All good')).toBeInTheDocument();
});

// PPVC-829: this is the shared boundary used both per-route (RouteContentBoundary)
// and at the top of the whole app shell (App.tsx), so a crash anywhere --
// including in persistent shell elements like EnvironmentBanner that sit
// outside any route -- shows a recoverable error instead of a blank page.
it('PPVC-829: catches a render error and offers a reload instead of a blank page', () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    render(<ErrorBoundary title="Something went wrong" message="An unexpected error occurred."><Bomb /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('alert')).toHaveTextContent('An unexpected error occurred.');
    const reload = jest.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, reload } });
    fireEvent.click(screen.getByRole('button', { name: 'Reload page' }));
    expect(reload).toHaveBeenCalled();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  } finally { errorLog.mockRestore(); }
});
