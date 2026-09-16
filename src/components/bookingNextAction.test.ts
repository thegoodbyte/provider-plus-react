import { bookingNextActions, BookingReadinessSource } from './bookingNextAction';
import { BookingFlowItem } from '../types';
const step = (values: Partial<BookingFlowItem> = {}): BookingFlowItem => ({ _id: 'one', key: 'contract_received', title: 'Signed contract', bookingId: 'b', clientId: 'c', retreatId: 'r', category: 'contract', offsetDays: 0, status: 'pending', ...values });
const source = (items: BookingFlowItem[], overrides: Partial<BookingReadinessSource> = {}): BookingReadinessSource => ({ bookingId: 'b', loading: false, error: '', items, requirements: [], ...overrides });

test('one configured blocker blocks readiness and carries its reason, assignee and deadline', () => {
  const result = bookingNextActions(source([step({ isBlocking: true, assignedTo: 'Anna', dueDate: '2020-01-01', description: 'The signed agreement is required.' })]));
  expect(result.status).toBe('blocked');
  expect(result.next).toMatchObject({ title: 'Signed contract', owner: 'Anna', reason: 'The signed agreement is required.', tab: 'workflow' });
  expect(result.overdue(result.next!)).toBe(true);
});
test('prioritizes actionable blockers, then deadlines, while keeping waiting blockers visible', () => {
  const result = bookingNextActions(source([
    step({ _id: 'review', category: 'medical', status: 'in_review', isBlocking: true }),
    step({ _id: 'later', dueDate: '2030-02-01', isBlocking: true }),
    step({ _id: 'earlier', category: 'payment', dueDate: '2030-01-01', isBlocking: true }),
  ]));
  expect(result.next).toMatchObject({ id: 'earlier', tab: 'payments' });
  expect(result.blockers).toHaveLength(3);
  expect(result.waiting).toBe(1);
});
test('resolved review state overrides a received item and distinguishes waiting from client work', () => {
  const result = bookingNextActions(source([step({ status: 'received', category: 'medical', isBlocking: true })], { requirements: [{ itemId: 'one', key: 'contract_received', state: 'pending_review', reviewRequired: true, requiredFromClient: true }] }));
  expect(result.next).toMatchObject({ waiting: true, owner: 'Review team', tab: 'medical', reason: 'Waiting for review.' });
  expect(result.status).toBe('blocked');
});
test.each(['missing', 'expired', 'declined', 'needs_resubmission'])('resolved %s evidence is not treated as complete', state => {
  const result = bookingNextActions(source([step({ status: 'received' })], { requirements: [{ itemId: 'one', key: 'contract_received', state, reviewRequired: true, requiredFromClient: true }] }));
  expect(result.completed).toBe(0);
  expect(result.next).toMatchObject({ owner: 'Client', tab: 'requirements', waiting: false });
});
test('waived steps, approved documents and sent notifications count as complete', () => {
  const result = bookingNextActions(source([step({ status: 'waived' }), step({ _id: 'two', status: 'approved' }), step({ _id: 'three', key: 'address_sent', category: 'message', status: 'sent' })]));
  expect(result).toMatchObject({ status: 'ready', completed: 3, next: undefined });
});
test.each([{ loading: true }, { error: 'Offline' }, { items: [] }])('unavailable or absent data never confirms readiness: %j', overrides => {
  expect(bookingNextActions(source([step({ status: 'completed' })], overrides)).status).toBe('unknown');
});
test('nonblocking work needs attention and paused automation waits', () => {
  expect(bookingNextActions(source([step()])).status).toBe('attention');
  expect(bookingNextActions(source([step({ automationPaused: true, automationPauseReason: 'Awaiting client reply' })])).next).toMatchObject({ waiting: true, reason: 'Awaiting client reply' });
});

test('an explicitly blocked step stays visible even with approved evidence', () => {
  const result = bookingNextActions(source([step({ status: 'blocked', notes: 'Confirm the exception with staff' })], { requirements: [{ itemId: 'one', key: 'contract_received', state: 'approved', reviewRequired: true, requiredFromClient: true }] }));
  expect(result.status).toBe('blocked');
  expect(result.next?.reason).toBe('Confirm the exception with staff');
});
