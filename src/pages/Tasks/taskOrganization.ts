import { isSystemGeneratedTask, Task, taskService } from '../../services/taskService';

export type TaskTab = 'focus' | 'retreats' | 'clients' | 'other' | 'system' | 'done' | 'reminders';

export const isFinishedTask = (task: Task) => task.status === 'completed' || task.status === 'cancelled';
export const isActiveTask = (task: Task) => !isFinishedTask(task);

export const taskBelongsToTab = (task: Task, tab: TaskTab, now = new Date()): boolean => {
  if (tab === 'reminders') return false;
  if (tab === 'done') return isFinishedTask(task);
  if (!isActiveTask(task)) return false;
  const system = isSystemGeneratedTask(task);
  if (tab === 'system') return system;
  if (system) return false;
  if (tab === 'retreats') return task.type === 'retreat';
  if (tab === 'clients') return task.type === 'client';
  if (tab === 'other') return task.type === 'generic';
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
  const dueSoon = Boolean(task.dueDate && new Date(task.dueDate).getTime() <= endOfToday.getTime());
  return task.status === 'in_progress' || task.urgency === 'urgent' || task.urgency === 'high' || dueSoon;
};

export const focusGroups = (tasks: Task[], now = new Date()) => {
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
  const overdue = tasks.filter((task) => task.dueDate && taskService.isOverdue(task.dueDate, task.status));
  const today = tasks.filter((task) => task.dueDate && new Date(task.dueDate).getTime() >= startOfToday.getTime() && new Date(task.dueDate).getTime() <= endOfToday.getTime());
  const priority = tasks.filter((task) => !overdue.includes(task) && !today.includes(task));
  return [
    { key: 'overdue', title: 'Overdue — handle first', tasks: overdue },
    { key: 'today', title: 'Due today', tasks: today },
    { key: 'priority', title: 'In progress or high priority', tasks: priority },
  ].filter((group) => group.tasks.length);
};
