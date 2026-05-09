import React, { useState, useEffect } from 'react';
import { Task, CreateTaskDto, taskService } from '../../services/taskService';
import { TaskList } from './TaskList';
import { TaskForm } from './TaskForm';

interface TasksWidgetProps {
  retreatId?: string;
  clientId?: string;
  title?: string;
  showCreateButton?: boolean;
  maxItems?: number;
}

export const TasksWidget: React.FC<TasksWidgetProps> = ({
  retreatId,
  clientId,
  title,
  showCreateButton = true,
  maxItems
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: any = {};
      if (retreatId) {
        filters.retreatId = retreatId;
      }
      if (clientId) {
        filters.clientId = clientId;
      }

      const tasksData = await taskService.getTasks(filters);
      const limitedTasks = maxItems ? tasksData.slice(0, maxItems) : tasksData;
      setTasks(limitedTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [retreatId, clientId, maxItems]);

  const handleCreateTask = () => {
    setEditingTask(null);
    setShowForm(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setShowForm(true);
  };

  const handleFormSubmit = async (taskData: CreateTaskDto) => {
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

  const getWidgetTitle = () => {
    if (title) return title;
    if (retreatId) return 'Retreat Tasks';
    if (clientId) return 'Client Tasks';
    return 'Tasks';
  };

  const getTaskType = (): 'client' | 'retreat' | 'generic' => {
    if (retreatId) return 'retreat';
    if (clientId) return 'client';
    return 'generic';
  };

  if (loading) {
    return (
      <div className="tasks-widget">
        <div className="loading">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="tasks-widget">
      <div className="widget-header">
        <h3>{getWidgetTitle()} ({tasks.length})</h3>
        {showCreateButton && (
          <button
            className="btn btn-primary btn-sm"
            onClick={handleCreateTask}
            title="Create new task"
          >
            ➕ Add Task
          </button>
        )}
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)} className="error-close">×</button>
        </div>
      )}

      <div className="widget-content">
        {tasks.length === 0 ? (
          <div className="no-tasks">
            <p>No tasks found.</p>
            {showCreateButton && (
              <button
                className="btn btn-primary"
                onClick={handleCreateTask}
              >
                Create First Task
              </button>
            )}
          </div>
        ) : (
          <TaskList
            tasks={tasks}
            onEditTask={handleEditTask}
            onDeleteTask={handleDeleteTask}
            onCompleteTask={handleCompleteTask}
          />
        )}
      </div>

      {showForm && (
        <TaskForm
          task={editingTask}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          clientId={clientId}
          retreatId={retreatId}
        />
      )}
    </div>
  );
};