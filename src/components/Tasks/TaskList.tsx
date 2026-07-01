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
    } else if (sortField === 'bookingNumber') {
      aVal = getBookingSortValue(a.bookingId);
      bVal = getBookingSortValue(b.bookingId);
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

  const getClientDisplayName = (client: any) => {
    const firstName = client?.firstName || client?.fname || '';
    const lastName = client?.lastName || client?.lname || '';
    return `${firstName} ${lastName}`.trim() || 'Client';
  };

  const getClientNumber = (client: any) => {
    const displayId = client?.display_id || client?.displayId || client?.clientNumber;
    return displayId ? `#${displayId}` : 'No client #';
  };

  function getBookingSortValue(booking: Task['bookingId']) {
    if (!booking) return '';
    if (typeof booking === 'string') return booking;
    return booking.bookingNumber || booking.bookingHash || booking._id || booking.id || '';
  }

  const getBookingNumber = (booking: Task['bookingId']) => {
    if (!booking) return '-';
    if (typeof booking === 'string') return `#${booking.slice(-6)}`;
    const value = booking.bookingNumber || booking.bookingHash || booking._id || booking.id;
    return value ? `#${value}` : '-';
  };

  const getUrgencyBadge = (urgency: string) => {
    return (
      <span className={`urgency-badge urgency-${urgency}`}>
        {urgency.toUpperCase()}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    return (
      <span className={`status-badge status-${status.replace('_', '-')}`}>
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
            onClick={() => handleSort('bookingNumber')}
          >
            Booking {getSortIcon('bookingNumber')}
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
              <span className="task-cell-label">Task</span>
              <div className="task-title">{task.name}</div>
            </div>

            <div className="task-cell">
              <span className="task-cell-label">Type</span>
              <span className={`type-badge type-${task.type}`}>
                {task.type.toUpperCase()}
              </span>
            </div>

            <div className="task-cell">
              <span className="task-cell-label">Urgency</span>
              {getUrgencyBadge(task.urgency)}
            </div>

            <div className="task-cell">
              <span className="task-cell-label">Status</span>
              {getStatusBadge(task.status)}
            </div>

            <div className="task-cell due-date">
              <span className="task-cell-label">Due</span>
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
              <span className="task-cell-label">Booking</span>
              {task.bookingId ? (
                <div className="booking-info">
                  <div className="booking-number">{getBookingNumber(task.bookingId)}</div>
                </div>
              ) : (
                <span className="no-booking">-</span>
              )}
            </div>

            <div className="task-cell">
              <span className="task-cell-label">Client</span>
              {task.clientId && typeof task.clientId === 'object' ? (
                <div className="client-info">
                  <div className="client-name">
                    {getClientDisplayName(task.clientId)}
                  </div>
                  <div className="client-number">{getClientNumber(task.clientId)}</div>
                </div>
              ) : (
                <span className="no-client">-</span>
              )}
            </div>

            <div className="task-cell">
              <span className="task-cell-label">Retreat</span>
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
              <span className="task-cell-label">Actions</span>
              <div className="action-buttons">
                {task.status !== 'completed' && (
                  <button
                    className="task-action-btn task-action-complete"
                    onClick={() => onCompleteTask(task.id)}
                    title="Mark as complete"
                    aria-label="Mark task as complete"
                  >
                    ✓
                  </button>
                )}
                <button
                  className="task-action-btn task-action-edit"
                  onClick={() => onEditTask(task)}
                  title="Edit task"
                  aria-label="Edit task"
                >
                  ✎
                </button>
                <button
                  className="task-action-btn task-action-delete"
                  onClick={() => onDeleteTask(task.id)}
                  title="Delete task"
                  aria-label="Delete task"
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
