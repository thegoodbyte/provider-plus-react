import React, { useState, useEffect } from 'react';
import { BookingFlowItem } from '../../types';
import { bookingFlowApi } from '../../services/api';
import { Task, TaskFilters, isSystemGeneratedTask, taskService } from '../../services/taskService';
import { TaskList } from '../../components/Tasks/TaskList';
import { TaskForm } from '../../components/Tasks/TaskForm';
import { TaskFiltersPanel } from '../../components/Tasks/TaskFiltersPanel';
import TasksCalendarView from '../../components/Tasks/TasksCalendarView';
import { SprintBoard } from '../../components/Tasks/SprintBoard';
import RemindersPage from '../../components/RemindersPage';
import './Tasks.css';

export const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [deadlines, setDeadlines] = useState<BookingFlowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'board' | 'calendar'>('list');
  const [activeTab, setActiveTab] = useState<'mine' | 'system' | 'reminders'>('mine');
  const [filters, setFilters] = useState<TaskFilters>({
    sortBy: 'dueDate',
    sortOrder: 'asc'
  });

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const [tasksData, deadlinesResponse] = await Promise.all([
        taskService.getTasks(filters),
        bookingFlowApi.getItems({}).catch(() => ({ data: [] as BookingFlowItem[] })),
      ]);
      setTasks(tasksData);
      setDeadlines(deadlinesResponse.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [filters]);

  const handleCreateTask = () => {
    setEditingTask(null);
    setFormError(null);
    setShowForm(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setFormError(null);
    setShowForm(true);
  };

  const handleFormSubmit = async (taskData: any) => {
    try {
      if (editingTask) {
        await taskService.updateTask(editingTask.id, taskData);
      } else {
        await taskService.createTask(taskData);
      }
      setShowForm(false);
      setEditingTask(null);
      setFormError(null);
      await loadTasks();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save task';
      setFormError(message);
      setError(message);
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingTask(null);
    setFormError(null);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      await taskService.deleteTask(taskId);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await taskService.completeTask(taskId);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task');
    }
  };

  const handleFiltersChange = (newFilters: TaskFilters) => {
    setFilters(newFilters);
  };

  const myTasks = tasks.filter((task) => !isSystemGeneratedTask(task));
  const systemTasks = tasks.filter(isSystemGeneratedTask);
  const visibleTasks = activeTab === 'system' ? systemTasks : myTasks;

  const getTaskStats = () => {
    const stats = {
      total: visibleTasks.length,
      pending: visibleTasks.filter(t => t.status === 'pending').length,
      inProgress: visibleTasks.filter(t => t.status === 'in_progress').length,
      completed: visibleTasks.filter(t => t.status === 'completed').length,
      overdue: visibleTasks.filter(t => t.dueDate && taskService.isOverdue(t.dueDate, t.status)).length,
      urgent: visibleTasks.filter(t => t.urgency === 'urgent').length,
    };
    return stats;
  };

  const stats = getTaskStats();

  if (loading) {
    return (
      <div className="tasks-page">
        <div className="loading">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="tasks-page">
      <div className="tasks-header">
        <div className="header-content">
          <h1>Tasks</h1>
          <div className="task-header-actions">
            {activeTab !== 'reminders' && <div className="tasks-view-toggle" aria-label="Task view">
              <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>List</button>
              {activeTab === 'mine' && <button type="button" className={viewMode === 'board' ? 'active' : ''} onClick={() => setViewMode('board')}>Sprints</button>}
              <button type="button" className={viewMode === 'calendar' ? 'active' : ''} onClick={() => setViewMode('calendar')}>Calendar</button>
            </div>}
            {activeTab === 'mine' && (
            <button
              className="btn btn-primary"
              onClick={handleCreateTask}
            >
              Create Task
            </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)} className="error-close">×</button>
        </div>
      )}

      <div className="tasks-source-tabs" role="tablist" aria-label="Task source">
        <button type="button" role="tab" aria-selected={activeTab === 'mine'} className={activeTab === 'mine' ? 'active' : ''} onClick={() => setActiveTab('mine')}>
          My Tasks <span>{myTasks.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'system'} className={activeTab === 'system' ? 'active' : ''} onClick={() => { setActiveTab('system'); if (viewMode === 'board') setViewMode('list'); }}>
          System Tasks <span>{systemTasks.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'reminders'} className={activeTab === 'reminders' ? 'active' : ''} onClick={() => setActiveTab('reminders')}>
          Reminders
        </button>
      </div>

      {activeTab === 'mine' && <div className="tasks-source-help">Tasks created by you or your team. Assign them, prioritize them, and complete them manually.</div>}
      {activeTab === 'system' && <div className="tasks-source-help system">Generated from booking steps and automation. Resolve the linked source; the task will update automatically.</div>}
      {activeTab === 'reminders' && <div className="tasks-source-help reminder">Reminders notify you at a chosen time. Use a task when work must be completed; use a reminder when you only need a timed prompt.</div>}

      {activeTab !== 'reminders' && <TaskFiltersPanel
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />}

      <div className="tasks-main-content">
        {activeTab === 'reminders' ? (
          <RemindersPage />
        ) : viewMode === 'list' ? (
          <TaskList
            tasks={visibleTasks}
            onEditTask={handleEditTask}
            onDeleteTask={handleDeleteTask}
            onCompleteTask={handleCompleteTask}
            systemManaged={activeTab === 'system'}
          />
        ) : viewMode === 'board' ? (
          <SprintBoard tasks={visibleTasks} onChanged={loadTasks} onEdit={handleEditTask} />
        ) : (
          <TasksCalendarView tasks={visibleTasks} deadlines={activeTab === 'system' ? deadlines : []} />
        )}
      </div>

      {activeTab !== 'reminders' && (
      <div className="task-stats-footer">
        <div className="stat-item">
          <span className="stat-label">Total</span>
          <span className="stat-value">{stats.total}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Pending</span>
          <span className="stat-value pending">{stats.pending}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">In Progress</span>
          <span className="stat-value in-progress">{stats.inProgress}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Completed</span>
          <span className="stat-value completed">{stats.completed}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Overdue</span>
          <span className="stat-value overdue">{stats.overdue}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Urgent</span>
          <span className="stat-value urgent">{stats.urgent}</span>
        </div>
      </div>
      )}

      {showForm && (
        <TaskForm
          task={editingTask}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          error={formError}
        />
      )}
    </div>
  );
};
