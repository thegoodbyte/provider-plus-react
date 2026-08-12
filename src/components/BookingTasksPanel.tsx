import React, { useCallback, useEffect, useState } from 'react';
import { CreateTaskDto, Task, taskService } from '../services/taskService';
import { TaskList } from './Tasks/TaskList';
import { TaskForm } from './Tasks/TaskForm';

export const taskError = (cause: any, fallback: string) => cause?.message || fallback;
export interface BookingTasksPanelProps { bookingId: string; clientId?: string; retreatId?: string; bookingLabel: string; active: boolean; }
const BookingTasksPanel: React.FC<BookingTasksPanelProps> = ({ bookingId, clientId, retreatId, bookingLabel, active }) => {
  const [tasks, setTasks] = useState<Task[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<Task | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setTasks(await taskService.getTasks({ bookingId, sortBy: 'dueDate', sortOrder: 'asc' })); } catch (cause) { setError(taskError(cause, 'Unable to load booking tasks.')); } finally { setLoading(false); } }, [bookingId]);
  useEffect(() => { if (active) load(); }, [active, load]);
  const openCreate = () => { setEditing(null); setError(null); setShowForm(true); }; const openEdit = (task: Task) => { setEditing(task); setError(null); setShowForm(true); };
  const submit = async (data: CreateTaskDto) => { try { setError(null); if (editing) await taskService.updateTask(editing.id, data); else await taskService.createTask({ ...data, bookingId }); setShowForm(false); setEditing(null); await load(); } catch (cause) { setError(taskError(cause, 'Unable to save task.')); } };
  const remove = async (id: string) => { if (!window.confirm('Delete this task?')) return; try { setError(null); await taskService.deleteTask(id); await load(); } catch (cause) { setError(taskError(cause, 'Unable to delete task.')); } };
  const complete = async (id: string) => { try { setError(null); await taskService.completeTask(id); await load(); } catch (cause) { setError(taskError(cause, 'Unable to complete task.')); } };
  return <><section className="detail-section"><div className="section-header"><h3>Booking Tasks</h3><button type="button" onClick={openCreate}>Add Task</button></div>{error && <div role="alert">{error}</div>}{loading ? <p>Loading tasks...</p> : <TaskList tasks={tasks} onEditTask={openEdit} onDeleteTask={remove} onCompleteTask={complete} />}</section>{showForm && <TaskForm task={editing} clientId={clientId} retreatId={retreatId} bookingId={bookingId} bookingLabel={bookingLabel} onSubmit={submit} onCancel={() => { setShowForm(false); setEditing(null); }} error={error} />}</>;
};
export default BookingTasksPanel;
