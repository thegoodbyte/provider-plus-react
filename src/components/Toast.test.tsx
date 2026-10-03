import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Toast from './Toast';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('renders nothing when there is no toast', () => {
  const { container } = render(<Toast toast={null} onDismiss={jest.fn()} />);
  expect(container).toBeEmptyDOMElement();
});

test('renders an error toast in red with the exact message, as an alert', () => {
  render(<Toast toast={{ type: 'error', text: 'Email jantaborski57@gmail.com is already registered.' }} onDismiss={jest.fn()} />);
  const alertEl = screen.getByRole('alert');
  expect(alertEl).toHaveTextContent('Email jantaborski57@gmail.com is already registered.');
  expect(alertEl).toHaveClass('bg-red-50', 'border-red-200', 'text-red-800');
});

test('renders a success toast in green, as a status', () => {
  render(<Toast toast={{ type: 'success', text: 'Client updated successfully.' }} onDismiss={jest.fn()} />);
  const statusEl = screen.getByRole('status');
  expect(statusEl).toHaveTextContent('Client updated successfully.');
  expect(statusEl).toHaveClass('bg-green-50', 'border-green-200', 'text-green-800');
});

test('the dismiss button calls onDismiss', () => {
  const onDismiss = jest.fn();
  render(<Toast toast={{ type: 'error', text: 'Something went wrong.' }} onDismiss={onDismiss} />);
  fireEvent.click(screen.getByLabelText('Dismiss'));
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

test('auto-dismisses after the configured duration', () => {
  const onDismiss = jest.fn();
  render(<Toast toast={{ type: 'success', text: 'Saved.' }} onDismiss={onDismiss} durationMs={3000} />);
  expect(onDismiss).not.toHaveBeenCalled();
  jest.advanceTimersByTime(2999);
  expect(onDismiss).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(onDismiss).toHaveBeenCalledTimes(1);
});
