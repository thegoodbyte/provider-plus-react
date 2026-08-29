import { authFetch } from './authService';
import { taskService } from './taskService';

jest.mock('./authService', () => ({ authFetch: jest.fn() }));
jest.mock('../config/api.config', () => ({ API_BASE_URL: 'https://api.example.com' }));

const fetchMock = authFetch as jest.Mock;
const response = (body: any = {}, ok = true, status = 200, statusText = 'OK') => ({
  ok, status, statusText, json: jest.fn().mockResolvedValue(body),
}) as any;

describe('taskService', () => {
  beforeEach(() => { jest.clearAllMocks(); fetchMock.mockResolvedValue(response({ id: 'task-1' })); });

  it('creates, reads, updates, completes and deletes tasks', async () => {
    const task: any = { name: 'Upload EKG', description: 'Tonight', type: 'client', urgency: 'high' };
    await expect(taskService.createTask(task)).resolves.toEqual({ id: 'task-1' });
    expect(fetchMock).toHaveBeenLastCalledWith('https://api.example.com/tasks', expect.objectContaining({ method: 'POST', body: JSON.stringify(task) }));
    await taskService.getTask('task-1');
    expect(fetchMock).toHaveBeenLastCalledWith('https://api.example.com/tasks/task-1');
    await taskService.updateTask('task-1', { status: 'in_progress' });
    expect(fetchMock).toHaveBeenLastCalledWith('https://api.example.com/tasks/task-1', expect.objectContaining({ method: 'PATCH' }));
    await taskService.completeTask('task-1');
    expect(fetchMock).toHaveBeenLastCalledWith('https://api.example.com/tasks/task-1/complete', { method: 'PATCH' });
    await expect(taskService.deleteTask('task-1')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenLastCalledWith('https://api.example.com/tasks/task-1', { method: 'DELETE' });
  });

  it('serializes all defined filters and omits nullish values', async () => {
    fetchMock.mockResolvedValue(response([]));
    await taskService.getTasks({ type: 'client', overdue: false, sortOrder: 'desc', clientId: undefined, sourceId: null as any });
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/tasks?type=client&overdue=false&sortOrder=desc');
    await taskService.getTasks();
    expect(fetchMock).toHaveBeenLastCalledWith('https://api.example.com/tasks');
  });

  it('manages named sprints and scoped task collections', async () => {
    fetchMock.mockResolvedValue(response([]));
    await taskService.getSprints();
    expect(fetchMock).toHaveBeenLastCalledWith('https://api.example.com/tasks/sprints');
    fetchMock.mockResolvedValue(response({ id: 'sprint', name: 'August' }));
    await taskService.createSprint('August');
    expect(fetchMock).toHaveBeenLastCalledWith('https://api.example.com/tasks/sprints', expect.objectContaining({ method: 'POST', body: '{"name":"August"}' }));
    fetchMock.mockResolvedValue(response([]));
    await taskService.getTasksByClient('client');
    expect(fetchMock).toHaveBeenLastCalledWith('https://api.example.com/tasks/client/client');
    await taskService.getTasksByRetreat('retreat');
    expect(fetchMock).toHaveBeenLastCalledWith('https://api.example.com/tasks/retreat/retreat');
    await taskService.seedRetreatDayPlan('retreat');
    expect(fetchMock).toHaveBeenLastCalledWith('https://api.example.com/tasks/retreat/retreat/day-plan/seed', { method: 'POST' });
    await taskService.getStatistics();
    expect(fetchMock).toHaveBeenLastCalledWith('https://api.example.com/tasks/statistics');
  });

  it.each([
    ['create', () => taskService.createTask({ name: 'x', description: 'x', type: 'generic', urgency: 'low' })],
    ['fetch', () => taskService.getTasks()],
    ['fetch task', () => taskService.getTask('one')],
    ['fetch sprints', () => taskService.getSprints()],
    ['create sprint', () => taskService.createSprint('one')],
    ['fetch client tasks', () => taskService.getTasksByClient('one')],
    ['fetch retreat tasks', () => taskService.getTasksByRetreat('one')],
    ['add 8-day retreat plan', () => taskService.seedRetreatDayPlan('one')],
    ['update task', () => taskService.updateTask('one', {})],
    ['complete task', () => taskService.completeTask('one')],
    ['delete task', () => taskService.deleteTask('one')],
    ['fetch task statistics', () => taskService.getStatistics()],
  ])('reports API messages when it cannot %s', async (_name, invoke) => {
    fetchMock.mockResolvedValue(response({ message: ['invalid', 'missing'] }, false, 400, 'Bad Request'));
    await expect(invoke()).rejects.toThrow(/invalid, missing/);
  });

  it('falls back to HTTP status when an error response has no usable JSON', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, statusText: 'Unavailable', json: jest.fn().mockRejectedValue(new Error('bad json')) });
    await expect(taskService.getTasks()).rejects.toThrow('Failed to fetch tasks: 503 Unavailable');
    fetchMock.mockResolvedValue(response({}, false, 404, 'Not Found'));
    await expect(taskService.getTask('missing')).rejects.toThrow('Failed to fetch task: 404 Not Found');
  });

  it('maps urgency and status values to stable colors', () => {
    expect(['urgent', 'high', 'medium', 'low', 'unknown'].map((value) => taskService.getUrgencyColor(value))).toEqual(['#dc2626', '#ea580c', '#d97706', '#16a34a', '#6b7280']);
    expect(['completed', 'in_progress', 'cancelled', 'pending', 'unknown'].map((value) => taskService.getStatusColor(value))).toEqual(['#16a34a', '#374151', '#dc2626', '#6b7280', '#6b7280']);
  });

  it('formats overdue, current, near and distant due dates', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-29T12:00:00Z'));
    expect(taskService.formatDueDate('2026-08-27T12:00:00Z')).toBe('Overdue by 2 day(s)');
    expect(taskService.formatDueDate('2026-08-29T12:00:00Z')).toBe('Due today');
    expect(taskService.formatDueDate('2026-08-30T12:00:00Z')).toBe('Due tomorrow');
    expect(taskService.formatDueDate('2026-09-03T12:00:00Z')).toBe('Due in 5 day(s)');
    expect(taskService.formatDueDate('2026-09-20T12:00:00Z')).toBe(new Date('2026-09-20T12:00:00Z').toLocaleDateString());
    expect(taskService.isOverdue('2026-08-28T12:00:00Z', 'pending')).toBe(true);
    expect(taskService.isOverdue('2026-08-28T12:00:00Z', 'completed')).toBe(false);
    jest.useRealTimers();
  });
});
