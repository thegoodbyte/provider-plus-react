import React, { useState } from 'react';
import { Task, taskService } from '../../services/taskService';
import './TaskList.css';

interface TaskListProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onEditTask,
  onDeleteTask,
  onCompleteTask,
}) => {
  const [sortField, setSortField] = useState<string>('dueDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: string) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    let aVal: any = a[sortField as keyof Task];
    let bVal: any = b[sortField as keyof Task];

    // Handle special cases
    if (sortField === 'dueDate') {
      aVal = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      bVal = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    } else if (sortField === 'urgency') {
      const urgencyOrder = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
      aVal = urgencyOrder[a.urgency as keyof typeof urgencyOrder] || 0;
      bVal = urgencyOrder[b.urgency as keyof typeof urgencyOrder] || 0;
    } else if (sortField === 'clientName') {
      aVal = a.clientId && typeof a.clientId === 'object' ?
        `${(a.clientId as any).firstName} ${(a.clientId as any).lastName}` : '';
      bVal = b.clientId && typeof b.clientId === 'object' ?
        `${(b.clientId as any).firstName} ${(b.clientId as any).lastName}` : '';
    } else if (sortField === 'retreatName') {
      aVal = a.retreatId && typeof a.retreatId === 'object' ? (a.retreatId as any).name : '';
      bVal = b.retreatId && typeof b.retreatId === 'object' ? (b.retreatId as any).name : '';
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const getSortIcon = (field: string) => {
    if (field !== sortField) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getUrgencyBadge = (urgency: string) => {
    const color = taskService.getUrgencyColor(urgency);
    return (
      <span
        className={`urgency-badge urgency-${urgency}`}
        style={{ backgroundColor: color }}
      >
        {urgency.toUpperCase()}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const color = taskService.getStatusColor(status);
    return (
      <span
        className={`status-badge status-${status.replace('_', '-')}`}
        style={{ backgroundColor: color }}
      >
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  if (tasks.length === 0) {
    return (
      <div className="task-list-empty">
        <p>No tasks found. Create your first task to get started!</p>
      </div>
    );
  }

  return (
    <div className="task-list">
      <div className="task-grid">
        <div className="task-grid-header">
          <div
            className="header-cell sortable"
            onClick={() => handleSort('name')}
          >
            Task Name {getSortIcon('name')}
          </div>
          <div
            className="header-cell sortable"
            onClick={() => handleSort('type')}
          >
            Type {getSortIcon('type')}
          </div>
          <div
            className="header-cell sortable"
            onClick={() => handleSort('urgency')}
          >
            Urgency {getSortIcon('urgency')}
          </div>
          <div
            className="header-cell sortable"
            onClick={() => handleSort('status')}
          >
            Status {getSortIcon('status')}
          </div>
          <div
            className="header-cell sortable"
            onClick={() => handleSort('dueDate')}
          >
            Due Date {getSortIcon('dueDate')}
          </div>
          <div
            className="header-cell sortable"
            onClick={() => handleSort('clientName')}
          >
            Client {getSortIcon('clientName')}
          </div>
          <div
            className="header-cell sortable"
            onClick={() => handleSort('retreatName')}
          >
            Retreat {getSortIcon('retreatName')}
          </div>
          <div className="header-cell">Actions</div>
        </div>

        {sortedTasks.map((task) => (
          <div
            key={task.id}
            className={`task-row ${task.status} ${
              task.dueDate && taskService.isOverdue(task.dueDate, task.status) ? 'overdue' : ''
            }`}
          >
            <div className="task-cell task-name">
              <div className="task-title">{task.name}</div>
              {task.description && (
                <div className="task-description">{task.description}</div>
              )}
              {task.tags.length > 0 && (
                <div className="task-tags">
                  {task.tags.map((tag) => (
                    <span key={`${task.id}-tag-${tag}`} className="tag">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="task-cell">
              <span className={`type-badge type-${task.type}`}>
                {task.type.toUpperCase()}
              </span>
            </div>

            <div className="task-cell">
              {getUrgencyBadge(task.urgency)}
            </div>

            <div className="task-cell">
              {getStatusBadge(task.status)}
            </div>

            <div className="task-cell due-date">
              {task.dueDate ? (
                <div>
                  <div className="due-date-text">
                    {formatDate(task.dueDate)}
                  </div>
                  <div className="due-date-relative">
                    {taskService.formatDueDate(task.dueDate)}
                  </div>
                </div>
              ) : (
                <span className="no-due-date">No due date</span>
              )}
            </div>

            <div className="task-cell">
              {task.clientId && typeof task.clientId === 'object' ? (
                <div className="client-info">
                  <div className="client-name">
                    {(task.clientId as any).firstName} {(task.clientId as any).lastName}
                  </div>
                  <div className="client-email">{(task.clientId as any).email}</div>
                </div>
              ) : (
                <span className="no-client">-</span>
              )}
            </div>

            <div className="task-cell">
              {task.retreatId && typeof task.retreatId === 'object' ? (
                <div className="retreat-info">
                  <div className="retreat-name">{(task.retreatId as any).name}</div>
                  <div className="retreat-code">{(task.retreatId as any).code}</div>
                </div>
              ) : (
                <span className="no-retreat">-</span>
              )}
            </div>

            <div className="task-cell actions">
              <div className="action-buttons">
                {task.status !== 'completed' && (
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => onCompleteTask(task.id)}
                    title="Mark as complete"
                  >
                    ✓
                  </button>
                )}
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => onEditTask(task)}
                  title="Edit task"
                >
                  ✎
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => onDeleteTask(task.id)}
                  title="Delete task"
                >
                  ✗
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};