import React from 'react';
import { BookingReadinessSource, bookingNextActions, BookingNextAction } from './bookingNextAction';
import { formatCalendarDate } from '../utils/dateFormat';
import type { BookingDetailTab } from './BookingDetailShell';

interface Props {
  bookingId: string;
  bookingStatus?: string;
  source: BookingReadinessSource | null;
  onRetry: () => void;
  onOpen: (tab: BookingDetailTab, itemId: string) => void;
}
export default function BookingNextActionSummary({ bookingId, bookingStatus, source, onRetry, onOpen }: Props) {
  const current = source?.bookingId === bookingId ? source : null;
  const loading = !current || current.loading;
  const summary = current ? bookingNextActions(current) : null;
  const inactive = ['cancelled', 'completed', 'checked_out'].includes(bookingStatus || '');
  const state = inactive ? 'inactive' : summary?.status || 'unknown';
  const labels: Record<string, string> = { inactive: 'Booking closed', unknown: 'Readiness unknown', blocked: 'Blocked', waiting: 'Waiting', attention: 'Needs attention', ready: 'Ready' };
  const action = (item: BookingNextAction) => <button type="button" className="edit-btn" aria-label={`${item.actionLabel}: ${item.title}`} onClick={() => onOpen(item.tab, item.id)}>{item.actionLabel}<span className="sr-only">: {item.title}</span></button>;
  return <section className={`booking-next-action is-${state}`} aria-label="Booking readiness and next action" aria-busy={loading && !inactive}>
    <div className="booking-next-action-heading"><h2>Readiness &amp; next action</h2><strong role="status">{labels[state]}</strong><button type="button" className="edit-btn" onClick={onRetry} disabled={loading}>Refresh summary</button></div>
    {inactive ? <p>No preparation action is suggested for this closed booking.</p> : loading ? <p>Loading readiness…</p> : current?.error ? <div role="alert"><p>Unable to load readiness. Existing booking controls are still available.</p><button type="button" className="edit-btn" onClick={onRetry}>Retry readiness</button></div> : !current?.items.length ? <p>No booking steps are available to confirm readiness.</p> : summary && <>
      <p className="booking-next-action-progress">{summary.completed} of {summary.total} steps complete · {summary.blockers.length} blockers · {summary.waiting} waiting</p>
      {summary.next ? <div className="booking-next-action-main"><div><small>{summary.next.waiting ? 'Waiting on' : 'Next action'}</small><h3>{summary.next.title}</h3><p>{summary.next.reason}</p><p>Owner: <strong>{summary.next.owner}</strong> · {summary.next.dueDate && !Number.isNaN(new Date(summary.next.dueDate).getTime()) ? `${summary.overdue(summary.next) ? 'Overdue · ' : ''}Due ${formatCalendarDate(summary.next.dueDate)}` : 'No deadline set'}</p></div>{action(summary.next)}</div> : <p>All configured booking steps are complete.</p>}
      {summary.blockers.length > 0 && <details className="booking-next-action-blockers"><summary>View {summary.blockers.length} blocking {summary.blockers.length === 1 ? 'step' : 'steps'}</summary><ul>{summary.blockers.map(item => <li key={item.id}><div><strong>{item.title}</strong><p>{item.reason}</p><small>{item.waiting ? 'Waiting · ' : ''}{item.owner}{item.dueDate ? ` · Due ${formatCalendarDate(item.dueDate)}` : ''}</small></div>{action(item)}</li>)}</ul></details>}
    </>}
  </section>;
}
