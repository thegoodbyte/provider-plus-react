import React, { useState, useEffect } from 'react';
import { Task, TaskFilters, taskService } from '../../services/taskService';
import { TaskList } from '../../components/Tasks/TaskList';
import { TaskForm } from '../../components/Tasks/TaskForm';
import { TaskFiltersPanel } from '../../components/Tasks/TaskFiltersPanel';
import './Tasks.css';

export const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filters, setFilters] = useState<TaskFilters>({
    sortBy: 'dueDate',
    sortOrder: 'asc'
  });

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const tasksData = await taskService.getTasks(filters);
      setTasks(tasksData);
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
    setShowForm(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
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
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingTask(null);
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

  const getTaskStats = () => {
    const stats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue: tasks.filter(t => t.dueDate && taskService.isOverdue(t.dueDate, t.status)).length,
      urgent: tasks.filter(t => t.urgency === 'urgent').length,
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
          <button
            className="btn btn-primary"
            onClick={handleCreateTask}
          >
            Create Task
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)} className="error-close">×</button>
        </div>
      )}

      <TaskFiltersPanel
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      <div className="tasks-main-content">
        <TaskList
          tasks={tasks}
          onEditTask={handleEditTask}
          onDeleteTask={handleDeleteTask}
          onCompleteTask={handleCompleteTask}
        />
      </div>

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

      {showForm && (
        <TaskForm
          task={editingTask}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
        />
      )}
    </div>
  );
};