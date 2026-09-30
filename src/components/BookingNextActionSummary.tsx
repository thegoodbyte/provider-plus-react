import React from 'react';
import { FiActivity, FiArrowRight, FiCheckCircle, FiClock, FiUser } from 'react-icons/fi';
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
  const action = (item: BookingNextAction) => <button type="button" className="edit-btn booking-next-action-button" aria-label={`${item.actionLabel}: ${item.title}`} onClick={() => onOpen(item.tab, item.id)}>{item.actionLabel}<FiArrowRight aria-hidden="true" /><span className="sr-only">: {item.title}</span></button>;
  const ownerIcon = (owner: string) => owner.toLowerCase().includes('client') ? <FiUser aria-hidden="true" /> : owner.toLowerCase().includes('review') || owner.toLowerCase().includes('medical') ? <FiActivity aria-hidden="true" /> : <FiClock aria-hidden="true" />;
  const waitingItems = summary?.open.filter(item => item.waiting) || [];
  const waitingOnClient = waitingItems.filter(item => item.owner.toLowerCase().includes('client'));
  const waitingOnMedical = waitingItems.filter(item => item.owner.toLowerCase().includes('review') || item.owner.toLowerCase().includes('medical'));
  const waitingOther = waitingItems.filter(item => !waitingOnClient.includes(item) && !waitingOnMedical.includes(item));
  const waitingSection = (title: string, items: BookingNextAction[]) => items.length ? <section className="booking-next-action-waiting-group"><h4>{ownerIcon(items[0].owner)}{title}<span>{items.length}</span></h4><ul>{items.slice(0, 3).map(item => <li key={item.id}><div><strong>{item.title}</strong><small>{item.reason}{item.dueDate ? ` · Due ${formatCalendarDate(item.dueDate)}` : ''}</small></div>{action(item)}</li>)}</ul>{items.length > 3 && <small className="booking-next-action-more">+ {items.length - 3} more waiting steps</small>}</section> : null;
  return <section className={`booking-next-action is-${state}`} aria-label="Next step from me" aria-busy={loading && !inactive}>
    <div className="booking-next-action-heading"><div className="booking-next-action-title"><h2>Next step from me</h2><p>What needs attention in this booking right now</p></div><strong role="status">{labels[state]}</strong><button type="button" className="edit-btn" onClick={onRetry} disabled={loading}>Refresh summary</button></div>
    {inactive ? <p>No preparation action is suggested for this closed booking.</p> : loading ? <p>Loading readiness…</p> : current?.error ? <div role="alert"><p>Unable to load readiness. Existing booking controls are still available.</p><button type="button" className="edit-btn" onClick={onRetry}>Retry readiness</button></div> : !current?.items.length ? <p>No booking steps are available to confirm readiness.</p> : summary && <>
      <p className="booking-next-action-progress">{summary.completed} of {summary.total} steps complete · {summary.blockers.length} blockers · {summary.waiting} waiting</p>
      {summary.next && !summary.next.waiting ? <div className="booking-next-action-main"><div className="booking-next-action-main-icon"><FiCheckCircle aria-hidden="true" /></div><div><small>Next action</small><h3>{summary.next.title}</h3><p>{summary.next.reason}</p><p>Owner: <strong>{summary.next.owner}</strong> · {summary.next.dueDate && !Number.isNaN(new Date(summary.next.dueDate).getTime()) ? `${summary.overdue(summary.next) ? 'Overdue · ' : ''}Due ${formatCalendarDate(summary.next.dueDate)}` : 'No deadline set'}</p></div>{action(summary.next)}</div> : summary.next?.waiting ? <div className="booking-next-action-main is-waiting"><div className="booking-next-action-main-icon"><FiClock aria-hidden="true" /></div><div><small>No action from you right now</small><h3>Waiting on {summary.next.owner}</h3><p>{summary.next.reason}</p></div></div> : <p className="booking-next-action-complete"><FiCheckCircle aria-hidden="true" />All configured booking steps are complete.</p>}
      {waitingItems.length > 0 && <div className="booking-next-action-waiting"><h3><FiClock aria-hidden="true" /> Waiting for others</h3>{waitingSection('Waiting on client', waitingOnClient)}{waitingSection('Waiting on medical team', waitingOnMedical)}{waitingSection('Other scheduled work', waitingOther)}</div>}
      {summary.blockers.length > 0 && <details className="booking-next-action-blockers"><summary>View {summary.blockers.length} blocking {summary.blockers.length === 1 ? 'step' : 'steps'}</summary><ul>{summary.blockers.map(item => <li key={item.id}><div><strong>{item.title}</strong><p>{item.reason}</p><small>{item.waiting ? 'Waiting · ' : ''}{item.owner}{item.dueDate ? ` · Due ${formatCalendarDate(item.dueDate)}` : ''}</small></div>{action(item)}</li>)}</ul></details>}
    </>}
  </section>;
}
