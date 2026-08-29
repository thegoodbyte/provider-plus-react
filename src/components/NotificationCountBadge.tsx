import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

export const useNotificationCount = (scope: { clientId?: string; bookingId?: string }) => {
  const [count, setCount] = useState(0);
  const { clientId, bookingId } = scope;
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!clientId && !bookingId) return;
      try {
        const response = await api.get('/submission-notifications/unread-count', { params: { clientId, bookingId } });
        if (active) setCount(Number(response.data?.count || 0));
      } catch { if (active) setCount(0); }
    };
    load();
    window.addEventListener('notifications-updated', load);
    return () => { active = false; window.removeEventListener('notifications-updated', load); };
  }, [clientId, bookingId]);
  return count;
};

const NotificationCountBadge: React.FC<{ count: number }> = ({ count }) => count > 0 ? (
  <span aria-label={`${count} unread notifications`} className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{count}</span>
) : null;

export default NotificationCountBadge;
