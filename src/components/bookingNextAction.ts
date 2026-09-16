import { BookingFlowItem } from '../types';
import { isAccomplishedStatus, isSatisfiedStatus } from './bookingStatusSelectors';
import type { BookingDetailTab } from './BookingDetailShell';

export interface ResolvedSummaryRequirement {
  itemId: string;
  key: string;
  state: string;
  reviewRequired: boolean;
  requiredFromClient: boolean;
}
export interface BookingReadinessSource {
  bookingId: string;
  loading: boolean;
  error: string;
  items: BookingFlowItem[];
  requirements: ResolvedSummaryRequirement[];
}
export interface BookingNextAction {
  id: string;
  title: string;
  reason: string;
  owner: string;
  dueDate?: Date | string | null;
  blocking: boolean;
  waiting: boolean;
  tab: BookingDetailTab;
  actionLabel: string;
}

export function bookingNextActions(source: BookingReadinessSource, now = new Date()) {
  const requirements = new Map(source.requirements.map(item => [item.itemId, item]));
  const open: BookingNextAction[] = [];
  let completed = 0;
  for (const item of source.items) {
    if (['cancelled', 'not_applicable'].includes(String(item.status))) continue;
    const requirement = requirements.get(item._id || '') || source.requirements.find(row => row.key === item.key);
    const satisfied = item.status !== 'blocked' && (item.status === 'waived' || (requirement
      ? ['approved', 'caution'].includes(requirement.state) || (requirement.state === 'received' && !requirement.reviewRequired)
      : item.metadata?.reviewRequired && ['received', 'sent_for_review', 'in_review'].includes(item.status)
        ? false
        : item.category === 'message' || /_(sent|requested)$/.test(item.key) ? isAccomplishedStatus(item.status) : isSatisfiedStatus(item.status)));
    if (satisfied) { completed += 1; continue; }
    const reviewWaiting = requirement?.state === 'pending_review' || (requirement?.state === 'received' && requirement.reviewRequired) || ['sent_for_review', 'in_review'].includes(item.status);
    const waiting = reviewWaiting || Boolean(item.automationPaused) || item.status === 'scheduled';
    const reason = item.automationPaused ? item.automationPauseReason || 'Automation paused; review this step.'
      : reviewWaiting ? 'Waiting for review.'
      : requirement?.state === 'expired' ? 'The linked document has expired.'
      : ['declined', 'needs_resubmission'].includes(requirement?.state || '') || ['rejected', 'needs_resubmission'].includes(item.status) ? item.reviewNotes || 'Changes or a replacement submission are required.'
      : item.status === 'blocked' ? item.notes || item.description || 'This step is marked blocked.'
      : item.status === 'scheduled' ? 'Waiting for the scheduled action.'
      : requirement?.state === 'missing' ? 'Required information has not been received.'
      : item.description || (item.isBlocking ? 'This required step is not complete.' : 'This step is not complete.');
    const tab: BookingDetailTab = item.category === 'payment' ? 'payments' : reviewWaiting && item.category === 'medical' ? 'medical' : requirement ? 'requirements' : 'workflow';
    const owner = item.assignedTo || (reviewWaiting ? 'Review team' : requirement?.requiredFromClient ? 'Client' : 'Unassigned');
    open.push({ id: item._id || item.key, title: item.title || item.key, reason, owner, dueDate: item.dueDate, blocking: item.isBlocking === true || item.status === 'blocked', waiting, tab, actionLabel: tab === 'payments' ? 'Open payments' : tab === 'medical' ? 'Open medical review' : tab === 'requirements' ? 'Open requirements' : 'Open booking step' });
  }
  const due = (item: BookingNextAction) => {
    const value = item.dueDate ? new Date(item.dueDate).getTime() : NaN;
    return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
  };
  open.sort((a, b) => Number(a.waiting) - Number(b.waiting) || Number(b.blocking) - Number(a.blocking) || due(a) - due(b));
  const blockers = open.filter(item => item.blocking);
  const status = source.loading || source.error || !source.items.length ? 'unknown' : blockers.length ? 'blocked' : open.length ? open.every(item => item.waiting) ? 'waiting' : 'attention' : 'ready';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return { status, completed, total: completed + open.length, blockers, next: open.find(item => !item.waiting) || open[0], waiting: open.filter(item => item.waiting).length, overdue: (item: BookingNextAction) => due(item) < today };
}
