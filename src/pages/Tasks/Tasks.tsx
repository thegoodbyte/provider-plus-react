import { Link, useLocation } from 'react-router-dom';
import ClientSupportInbox from '../../components/Tasks/ClientSupportInbox';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BookingFlowItem } from '../../types';
import { bookingFlowApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Task, TaskFilters, taskService } from '../../services/taskService';
import { TaskList } from '../../components/Tasks/TaskList';
import { TaskForm } from '../../components/Tasks/TaskForm';
import { TaskFiltersPanel } from '../../components/Tasks/TaskFiltersPanel';
import TasksCalendarView from '../../components/Tasks/TasksCalendarView';
import { SprintBoard } from '../../components/Tasks/SprintBoard';
import AppleButton from '../../components/AppleButton';
import { Card } from '../../components/ui';
import './Tasks.css';

const TaskWorkspaceTabs = ({support}:{support:boolean}) => {
  const {user}=useAuth();const location=useLocation();
  const prefix=['admin','user','staff','medical'].includes(location.pathname.split('/')[1])?'/'+location.pathname.split('/')[1]:'/admin';
  return <nav className="task-workspace-tabs" aria-label="Task workspaces"><Link aria-current={!support?'page':undefined} to={prefix+'/tasks'}>Operational tasks</Link>{['admin','user'].includes(user?.role||'')&&<Link aria-current={support?'page':undefined} to={prefix+'/tasks?support=all'}>IbogaReady tasks</Link>}</nav>;
};
export const Tasks: React.FC = () => {
  const { user } = useAuth();
  const supportLocation = useLocation();
  const isSupport = new URLSearchParams(supportLocation.search).has('support');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [deadlines, setDeadlines] = useState<BookingFlowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'board' | 'calendar'>('list');
  const [activeContext, setActiveContext] = useState<'client' | 'booking' | 'retreat' | 'generic'>('client');
  const [originFilter, setOriginFilter] = useState<'all' | 'custom' | 'system' | 'client'>('all');
  // PPVC-1047: who the list is scoped to, separate from the origin filter
  // above (provenance) -- this is about assignment. Admins need oversight
  // across everyone's tasks, so they default to "All"; every other staff
  // role (helper/facilitator/user, e.g. Kasia on customer care) defaults to
  // "Mine" since that's the view they actually need day to day.
  const [scopeFilter, setScopeFilter] = useState<'mine' | 'all'>(() => (user?.role === 'admin' ? 'all' : 'mine'));
  const [categoryFilter, setCategoryFilter] = useState<'all' | Task['category']>('all');
  const [newTaskContext, setNewTaskContext] = useState<'client' | 'booking' | 'retreat' | 'generic'>('client');
  const [newTaskSprint, setNewTaskSprint] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilters>({
    sortBy: 'dueDate',
    sortOrder: 'asc'
  });

  const requestVersion = useRef(0);
  const loadTasks = async () => {
    const version = ++requestVersion.current;
    try {
      setLoading(true);
      setError(null);
      // PPVC-1047: "Mine" sends mine=true to the server (resolved from the
      // caller's own JWT there, not a client-known user id); "All" omits it
      // entirely, which is the existing unfiltered-list behavior unchanged.
      const [tasksData, deadlinesResponse] = await Promise.all([
        taskService.getTasks({ ...filters, mine: scopeFilter === 'mine' ? true : undefined }),
        bookingFlowApi.getItems({}).catch(() => ({ data: [] as BookingFlowItem[] })),
      ]);
      if (version !== requestVersion.current) return;
      setTasks(tasksData.filter(task => task.sourceType !== 'client_support'));
      setDeadlines(deadlinesResponse.data || []);
    } catch (err) {
      if (version === requestVersion.current) setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSupport) void loadTasks();
    return () => { requestVersion.current += 1; };
  }, [filters, isSupport, scopeFilter]);

  const handleCreateTask = (context = activeContext, sprint: string | null = null) => {
    setEditingTask(null);
    setNewTaskContext(context);
    setNewTaskSprint(sprint);
    setFormError(null);
    setShowForm(true);
  };

  const isSystemTask = (task: Task) => Boolean(task.sourceType || task.sourceId || task.bookingFlowItemId);
  const taskContext = (task: Task): 'client' | 'booking' | 'retreat' | 'generic' => {
    if (task.bookingId || task.type === 'booking') return 'booking';
    if (task.type === 'client' || task.clientId) return 'client';
    if (task.type === 'retreat' || task.retreatId) return 'retreat';
    return 'generic';
  };

  const originTasks = useMemo(() => tasks.filter(task => {
    if (originFilter === 'client') return ['client_support','client_portal_request'].includes(task.sourceType || '');
    if (['client_support','client_portal_request'].includes(task.sourceType || '') && originFilter !== 'all') return false;
    if (originFilter === 'system') return isSystemTask(task);
    if (originFilter === 'custom') return !isSystemTask(task);
    return true;
  }), [tasks, originFilter]);

  const categoryTasks = useMemo(() => originTasks.filter(task => categoryFilter === 'all' || (task.category || 'operations') === categoryFilter), [originTasks, categoryFilter]);
  const visibleTasks = useMemo(
    () => categoryTasks.filter(task => taskContext(task) === activeContext),
    [categoryTasks, activeContext],
  );

  const contexts = [
    { id: 'client' as const, label: 'Clients', singular: 'Client', hint: 'People-specific follow-ups' },
    { id: 'booking' as const, label: 'Bookings', singular: 'Booking', hint: 'One booking or stay' },
    { id: 'retreat' as const, label: 'Retreats', singular: 'Retreat', hint: 'Whole-retreat operations' },
    { id: 'generic' as const, label: 'Generic', singular: 'Generic', hint: 'Everything else' },
  ];

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
        const tags = [...(taskData.tags || []).filter((tag: string) => !tag.startsWith('sprint:'))];
        if (newTaskSprint && newTaskSprint !== 'Backlog') tags.push(`sprint:${newTaskSprint}`);
        await taskService.createTask({ ...taskData, tags });
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

  if (isSupport) return <><TaskWorkspaceTabs support/><ClientSupportInbox /></>;

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
          <div><TaskWorkspaceTabs support={false}/><h1>Tasks</h1><p className="tasks-subtitle">One clear place for what needs your attention.</p></div>
          <div className="task-header-actions">
            <div className="tasks-view-toggle" aria-label="Task view">
              <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>List</button>
              <button type="button" className={viewMode === 'board' ? 'active' : ''} onClick={() => setViewMode('board')}>Sprints</button>
              <button type="button" className={viewMode === 'calendar' ? 'active' : ''} onClick={() => setViewMode('calendar')}>Calendar</button>
            </div>
            <AppleButton onClick={() => handleCreateTask()}>
              + {contexts.find(context => context.id === activeContext)?.singular || 'Custom'} task
            </AppleButton>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button type="button" onClick={() => void loadTasks()}>Retry loading tasks</button>
          <button onClick={() => setError(null)} className="error-close">×</button>
        </div>
      )}

      {viewMode !== 'board' && <nav className="task-context-tabs" aria-label="Task context">
        {contexts.map(context => {
          const count = originTasks.filter(task => taskContext(task) === context.id && task.status !== 'completed' && task.status !== 'cancelled').length;
          return <button key={context.id} type="button" className={activeContext === context.id ? 'active' : ''} onClick={() => setActiveContext(context.id)}>
            <span>{context.label}<em>{count}</em></span><small>{context.hint}</small>
          </button>;
        })}
      </nav>}

      <div className="task-origin-bar">
        <div className="task-scope-filter" aria-label="Task scope">
          <strong>View</strong>
          {(['mine', 'all'] as const).map(scope => <button key={scope} type="button" className={scopeFilter === scope ? 'active' : ''} onClick={() => setScopeFilter(scope)}>{scope === 'mine' ? 'My tasks' : 'All tasks'}</button>)}
        </div>
        <div><strong>Show</strong>{(['all', 'client', 'custom', 'system'] as const).map(origin => <button key={origin} type="button" className={originFilter === origin ? 'active' : ''} onClick={() => setOriginFilter(origin)}>{origin === 'all' ? 'All' : origin === 'client' ? 'Client requests' : origin === 'custom' ? 'Custom — created by me' : 'System generated'}</button>)}</div>
        <div className="task-category-filter" aria-label="Task category"><strong>Category</strong>{(['all', 'medical', 'documents', 'financial', 'communication', 'operations'] as const).map(category => <button key={category} type="button" className={categoryFilter === category ? 'active' : ''} onClick={() => setCategoryFilter(category)}>{category === 'all' ? 'All' : category[0].toUpperCase() + category.slice(1)}</button>)}</div>
        <details><summary>Advanced filters</summary><TaskFiltersPanel filters={filters} onFiltersChange={handleFiltersChange} /></details>
      </div>

      <div className="tasks-main-content">
        {viewMode === 'list' ? (
          <TaskList
            workspacePath={supportLocation.pathname}
            tasks={visibleTasks}
            onEditTask={handleEditTask}
            onDeleteTask={handleDeleteTask}
            onCompleteTask={handleCompleteTask}
          />
        ) : viewMode === 'board' ? (
          <SprintBoard tasks={categoryTasks} onChanged={loadTasks} onEdit={handleEditTask} onCreate={handleCreateTask} />
        ) : (
          <TasksCalendarView tasks={visibleTasks} deadlines={deadlines} />
        )}
      </div>

      {viewMode !== 'board' && <details className="task-counts"><summary>Task counts for this view</summary><div className="task-stats-footer">
        <Card padding="sm" className="stat-item">
          <span className="stat-label">Total</span>
          <span className="stat-value">{stats.total}</span>
        </Card>
        <Card padding="sm" className="stat-item">
          <span className="stat-label">Pending</span>
          <span className="stat-value pending">{stats.pending}</span>
        </Card>
        <Card padding="sm" className="stat-item">
          <span className="stat-label">In Progress</span>
          <span className="stat-value in-progress">{stats.inProgress}</span>
        </Card>
        <Card padding="sm" className="stat-item">
          <span className="stat-label">Completed</span>
          <span className="stat-value completed">{stats.completed}</span>
        </Card>
        <Card padding="sm" className="stat-item">
          <span className="stat-label">Overdue</span>
          <span className="stat-value overdue">{stats.overdue}</span>
        </Card>
        <Card padding="sm" className="stat-item">
          <span className="stat-label">Urgent</span>
          <span className="stat-value urgent">{stats.urgent}</span>
        </Card>
      </div></details>}

      {showForm && (
        <TaskForm
          task={editingTask}
          initialType={newTaskContext}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          error={formError}
        />
      )}
    </div>
  );
};
