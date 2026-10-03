import { act, renderHook } from '@testing-library/react';
import { useToast } from './useToast';

test('starts with no toast', () => {
  const { result } = renderHook(() => useToast());
  expect(result.current.toast).toBeNull();
});

test('showError sets an error toast with the given text', () => {
  const { result } = renderHook(() => useToast());
  act(() => result.current.showError('Email jantaborski57@gmail.com is already registered.'));
  expect(result.current.toast).toEqual({ type: 'error', text: 'Email jantaborski57@gmail.com is already registered.' });
});

test('showSuccess sets a success toast with the given text', () => {
  const { result } = renderHook(() => useToast());
  act(() => result.current.showSuccess('Client updated successfully.'));
  expect(result.current.toast).toEqual({ type: 'success', text: 'Client updated successfully.' });
});

test('a later call replaces the current toast', () => {
  const { result } = renderHook(() => useToast());
  act(() => result.current.showSuccess('Saved.'));
  act(() => result.current.showError('Actually, it failed.'));
  expect(result.current.toast).toEqual({ type: 'error', text: 'Actually, it failed.' });
});

test('dismiss clears the toast', () => {
  const { result } = renderHook(() => useToast());
  act(() => result.current.showError('Oops.'));
  act(() => result.current.dismiss());
  expect(result.current.toast).toBeNull();
});
