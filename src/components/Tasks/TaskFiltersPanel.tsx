import React from 'react';
import { TaskFilters } from '../../services/taskService';
import './TaskFiltersPanel.css';

interface TaskFiltersPanelProps {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
}

export const TaskFiltersPanel: React.FC<TaskFiltersPanelProps> = ({
  filters,
  onFiltersChange,
}) => {
  const handleFilterChange = (key: keyof TaskFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      sortBy: 'dueDate',
      sortOrder: 'asc'
    });
  };

  const setTodayFilter = () => {
    const today = new Date().toISOString().split('T')[0];
    onFiltersChange({
      ...filters,
      dueDateFrom: today,
      dueDateTo: today,
    });
  };

  return (
    <div className="task-filters-panel-horizontal">
      <div className="filters-row">
        <div className="filter-item">
          <label htmlFor="type-filter">Type</label>
          <select
            id="type-filter"
            value={filters.type || ''}
            onChange={(e) => handleFilterChange('type', e.target.value)}
          >
            <option value="">All Types</option>
            <option value="generic">Generic</option>
            <option value="client">Client Related</option>
            <option value="retreat">Retreat Related</option>
          </select>
        </div>

        <div className="filter-item">
          <label htmlFor="status-filter">Status</label>
          <select
            id="status-filter"
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="filter-item">
          <label htmlFor="urgency-filter">Urgency</label>
          <select
            id="urgency-filter"
            value={filters.urgency || ''}
            onChange={(e) => handleFilterChange('urgency', e.target.value)}
          >
            <option value="">All Urgencies</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="filter-item date-filter-group">
          <label>Due Date</label>
          <div className="date-inputs">
            <input
              type="date"
              id="due-from"
              value={filters.dueDateFrom || ''}
              onChange={(e) => handleFilterChange('dueDateFrom', e.target.value)}
              placeholder="From"
            />
            <span className="date-separator">to</span>
            <input
              type="date"
              id="due-to"
              value={filters.dueDateTo || ''}
              onChange={(e) => handleFilterChange('dueDateTo', e.target.value)}
              placeholder="To"
            />
            <button
              type="button"
              className="btn btn-sm btn-today"
              onClick={setTodayFilter}
              title="Filter today's tasks"
            >
              Today
            </button>
          </div>
        </div>

        <div className="filter-item">
          <label htmlFor="sort-by">Sort</label>
          <div className="sort-controls">
            <select
              id="sort-by"
              value={filters.sortBy || 'dueDate'}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            >
              <option value="dueDate">Due Date</option>
              <option value="name">Task Name</option>
              <option value="type">Type</option>
              <option value="urgency">Urgency</option>
              <option value="status">Status</option>
              <option value="createdAt">Created</option>
            </select>
            <select
              id="sort-order"
              value={filters.sortOrder || 'asc'}
              onChange={(e) => handleFilterChange('sortOrder', e.target.value as 'asc' | 'desc')}
              className="sort-order"
            >
              <option value="asc">↑</option>
              <option value="desc">↓</option>
            </select>
          </div>
        </div>

        <div className="filter-item checkbox-item">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={filters.overdue || false}
              onChange={(e) => handleFilterChange('overdue', e.target.checked)}
            />
            <span>Overdue only</span>
          </label>
        </div>

        <div className="filter-actions">
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={clearFilters}
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
};