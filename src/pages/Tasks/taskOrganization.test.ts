import { Task } from '../../services/taskService';
import { focusGroups, taskBelongsToTab } from './taskOrganization';

const task = (values: Partial<Task>): Task => ({ id:'1', name:'Task', description:'', type:'generic', urgency:'medium', status:'pending', tags:[], createdAt:'2026-08-01', updatedAt:'2026-08-01', ...values });

describe('task organization', () => {
  const now = new Date('2026-08-06T12:00:00');
  it('separates retreat, client, generic, and system work', () => {
    expect(taskBelongsToTab(task({ type:'retreat' }), 'retreats', now)).toBe(true);
    expect(taskBelongsToTab(task({ type:'client' }), 'clients', now)).toBe(true);
    expect(taskBelongsToTab(task({ type:'generic' }), 'other', now)).toBe(true);
    expect(taskBelongsToTab(task({ sourceType:'booking-flow' }), 'system', now)).toBe(true);
  });
  it('keeps completed tasks out of active tabs', () => {
    const completed = task({ status:'completed', type:'client' });
    expect(taskBelongsToTab(completed, 'clients', now)).toBe(false);
    expect(taskBelongsToTab(completed, 'done', now)).toBe(true);
  });
  it('groups focus work into overdue, today, and priority', () => {
    const groups = focusGroups([task({ id:'old', dueDate:'2026-08-05' }), task({ id:'today', dueDate:'2026-08-06' }), task({ id:'high', urgency:'high' })], now);
    expect(groups.map((group) => group.key)).toEqual(['overdue','today','priority']);
  });
});
