import React, { useCallback, useEffect, useState } from 'react';
import { integrationCalendarApi } from '../services/integrationCalendarApi';

export default function IntegrationSupportRequests({
  retreatId,
  onSchedule,
  disabled,
}: {
  retreatId?: string;
  onSchedule: (request: any) => void;
  disabled?: boolean;
}) {
  const [requests, setRequests] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setError('');
    try {
      const r = await integrationCalendarApi.supportRequests(retreatId);
      setRequests(r.data);
    } catch {
      setError('Unable to load support requests.');
    }
  }, [retreatId]);
  useEffect(() => {
    load();
  }, [load]);
  const update = async (id: string, status: string) => {
    setBusy(true);
    setError('');
    try {
      await integrationCalendarApi.updateSupportRequest(id, status);
      await load();
    } catch {
      setError('Unable to update this support request. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <aside
      className="integration-support-requests"
      aria-label="Client support requests"
    >
      <h3>Client support requests</h3>
      <p>
        Arrange an individual call with the client, then schedule it in the
        calendar. Mark the request contacted or close it when handled.
      </p>
      {error && (
        <p role="alert">
          {error} <button onClick={load}>Retry</button>
        </p>
      )}
      {!error && !requests.length && <p>No open support requests.</p>}
      {requests.map((r) => (
        <article key={r._id}>
          <div>
            <strong>
              {[r.clientId?.firstName, r.clientId?.lastName]
                .filter(Boolean)
                .join(' ') ||
                r.clientId?.email ||
                'Client'}
            </strong>
            <span>
              {r.retreatId?.name ||
                r.retreatId?.retreatCode ||
                r.retreatId?.code}{' '}
              · {r.status} ·{' '}
              {new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Europe/Prague',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }).format(new Date(r.createdAt))}
            </span>
            {r.clientId?.email && (
              <a href={`mailto:${r.clientId.email}`}>{r.clientId.email}</a>
            )}
          </div>
          {r.message && <p style={{ whiteSpace: 'pre-wrap' }}>{r.message}</p>}
          <div className="integration-support-actions">
            <button
              type="button"
              disabled={busy || disabled}
              onClick={() => onSchedule(r)}
            >
              Schedule individual call
            </button>
            {r.status === 'requested' && (
              <button
                type="button"
                disabled={busy || disabled}
                onClick={() => update(r._id, 'contacted')}
              >
                Mark contacted
              </button>
            )}
            <button
              type="button"
              disabled={busy || disabled}
              onClick={() => update(r._id, 'closed')}
            >
              Close request
            </button>
          </div>
        </article>
      ))}
    </aside>
  );
}
