import { classifyAttention, isCompleteStatus, isPastRetreat, sortAttentionItems } from './NeedsAttentionPage.helpers';

describe('Needs Attention helpers', () => {
  it('excludes terminal statuses', () => {
    expect(isCompleteStatus('completed')).toBe(true);
    expect(isCompleteStatus('paid')).toBe(true);
    expect(isCompleteStatus('pending')).toBe(false);
  });

  it('classifies overdue dates and blocked states', () => {
    const now = new Date('2026-07-18T12:00:00Z');
    expect(classifyAttention('pending', '2026-07-17T12:00:00Z', now)).toBe('overdue');
    expect(classifyAttention('rejected', undefined, now)).toBe('blocked');
    expect(classifyAttention('caution', undefined, now)).toBe('problem');
  });

  it('orders severity first and due date second', () => {
    const base: any = { category: 'Booking step', detail: '', retreat: '', client: '', href: '/' };
    const sorted = sortAttentionItems([
      { ...base, id: 'soon', title: 'Soon', severity: 'due_soon', dueDate: '2026-07-19' },
      { ...base, id: 'late', title: 'Late', severity: 'overdue', dueDate: '2026-07-10' },
      { ...base, id: 'blocked', title: 'Blocked', severity: 'blocked' },
    ]);
    expect(sorted.map((item) => item.id)).toEqual(['late', 'blocked', 'soon']);
  });

  it('identifies retreats that ended before today', () => {
    const now = new Date('2026-07-18T12:00:00Z');
    expect(isPastRetreat('2026-07-17', now)).toBe(true);
    expect(isPastRetreat('2026-07-18', now)).toBe(false);
    expect(isPastRetreat(undefined, now)).toBe(false);
  });
});
