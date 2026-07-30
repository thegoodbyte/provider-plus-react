import { isSystemGeneratedTask, Task } from './taskService';

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  name: 'Follow up',
  description: '',
  type: 'generic',
  urgency: 'medium',
  status: 'pending',
  tags: [],
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
  ...overrides,
});

describe('isSystemGeneratedTask', () => {
  it('keeps ordinary and manually-created email follow-up tasks in My Tasks', () => {
    expect(isSystemGeneratedTask(task())).toBe(false);
    expect(isSystemGeneratedTask(task({ sourceType: 'manual_email_followup', sourceId: 'email-1' }))).toBe(false);
  });

  it('recognizes booking-flow and automation tasks as system generated', () => {
    expect(isSystemGeneratedTask(task({ sourceType: 'booking-flow' }))).toBe(true);
    expect(isSystemGeneratedTask(task({ bookingFlowItemId: 'flow-1' }))).toBe(true);
    expect(isSystemGeneratedTask(task({ tags: ['automated-reminder'] }))).toBe(true);
  });
});
