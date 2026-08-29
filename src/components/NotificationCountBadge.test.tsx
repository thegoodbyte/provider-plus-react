import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { api } from '../services/api';
import NotificationCountBadge, { useNotificationCount } from './NotificationCountBadge';

jest.mock('../services/api', () => ({ api: { get: jest.fn() } }));
const get = api.get as jest.Mock;

describe('NotificationCountBadge', () => {
  beforeEach(() => { jest.clearAllMocks(); get.mockResolvedValue({ data: { count: 137 } }); });

  it('shows the actual count and hides zero', () => {
    const { rerender } = render(<NotificationCountBadge count={137} />);
    expect(screen.getByLabelText('137 unread notifications')).toHaveTextContent('137');
    rerender(<NotificationCountBadge count={0} />);
    expect(screen.queryByText('137')).not.toBeInTheDocument();
  });

  it('loads unread count by client and refreshes on the notification event', async () => {
    const { result, unmount } = renderHook(() => useNotificationCount({ clientId: 'c1' }));
    await waitFor(() => expect(result.current).toBe(137));
    expect(get).toHaveBeenCalledWith('/submission-notifications/unread-count', { params: { clientId: 'c1', bookingId: undefined } });
    get.mockResolvedValueOnce({ data: { count: 201 } });
    act(() => window.dispatchEvent(new Event('notifications-updated')));
    await waitFor(() => expect(result.current).toBe(201));
    unmount();
    act(() => window.dispatchEvent(new Event('notifications-updated')));
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('supports booking scope, missing counts, errors and an empty scope', async () => {
    get.mockResolvedValueOnce({ data: {} });
    const first = renderHook(() => useNotificationCount({ bookingId: 'b1' }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    expect(first.result.current).toBe(0);
    first.unmount();

    get.mockRejectedValueOnce(new Error('offline'));
    const second = renderHook(() => useNotificationCount({ clientId: 'c2' }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(second.result.current).toBe(0);
    second.unmount();

    const third = renderHook(() => useNotificationCount({}));
    await act(async () => undefined);
    expect(third.result.current).toBe(0);
    expect(get).toHaveBeenCalledTimes(2);
    third.unmount();
  });
});
