import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock3, Filter, RefreshCw, Search } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import { bookingFlowApi, retreatsApi } from '../services/api';
import { Retreat } from '../types';
import { Task, taskService } from '../services/taskService';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => <IconComponent className={className} />;

const formatDate = (value?: string | Date | null) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

const formatRelativeDate = (value?: string | Date | null) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const diffDays = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays > 1) return `In ${diffDays} days`;
  if (diffDays === -1) return 'Yesterday';
  return `${Math.abs(diffDays)} days ago`;
};

const FlowTaskInboxPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = location.pathname.startsWith('/medical/') ? '/medical' : '/admin';

  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedRetreatId, setSelectedRetreatId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'open' | 'completed' | 'all'>('open');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string>('');

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedRetreatId) {
      loadTasks(selectedRetreatId);
    }
  }, [selectedRetreatId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [retreatsResponse] = await Promise.all([
        retreatsApi.getAll(),
      ]);
      const retreatList = retreatsResponse.data || [];
      setRetreats(retreatList);
      const fallback = retreatList.find((retreat: Retreat) => retreat.status === 'upcoming' || retreat.status === 'active') || retreatList[0];
      setSelectedRetreatId(fallback?._id || '');
    } catch (error) {
      console.error('Error loading flow task inbox:', error);
      setRetreats([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async (retreatId: string) => {
    try {
      setLoading(true);
      const response = await taskService.getTasks({
        retreatId,
        sourceType: 'booking-flow',
        sortBy: 'dueDate',
        sortOrder: 'asc',
      });
      setTasks(response || []);
    } catch (error) {
      console.error('Error loading flow tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const selectedRetreat = useMemo(() => retreats.find((retreat) => retreat._id === selectedRetreatId), [retreats, selectedRetreatId]);

  const filteredTasks = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'open' && task.status !== 'completed') ||
        (statusFilter === 'completed' && task.status === 'completed');
      const bookingFlowItem = typeof task.bookingFlowItemId === 'object' ? task.bookingFlowItemId : null;
      const clientName = bookingFlowItem?.clientId && typeof bookingFlowItem.clientId === 'object'
        ? `${bookingFlowItem.clientId.firstName || ''} ${bookingFlowItem.clientId.lastName || ''}`.trim()
        : '';
      const retreatName = bookingFlowItem?.retreatId && typeof bookingFlowItem.retreatId === 'object'
        ? bookingFlowItem.retreatId.name || ''
        : '';
      const matchesSearch =
        !search ||
        task.name.toLowerCase().includes(search) ||
        task.description.toLowerCase().includes(search) ||
        clientName.toLowerCase().includes(search) ||
        retreatName.toLowerCase().includes(search) ||
        String(task.sourceId || '').toLowerCase().includes(search) ||
        String(task.reminderKind || '').toLowerCase().includes(search);
      return matchesStatus && matchesSearch;
    });
  }, [tasks, searchTerm, statusFilter]);

  const stats = useMemo(() => ({
    total: tasks.length,
    open: tasks.filter((task) => task.status !== 'completed').length,
    completed: tasks.filter((task) => task.status === 'completed').length,
    overdue: tasks.filter((task) => task.dueDate && taskService.isOverdue(task.dueDate, task.status)).length,
  }), [tasks]);

  const handleRefresh = async () => {
    if (!selectedRetreatId) return;
    await loadTasks(selectedRetreatId);
  };

  const completeTask = async (task: Task) => {
    if (!task.id) return;
    try {
      setSavingId(task.id);
      await taskService.completeTask(task.id);
      const flowItemId = typeof task.bookingFlowItemId === 'object' ? task.bookingFlowItemId._id : task.bookingFlowItemId;
      if (flowItemId) {
        await bookingFlowApi.completeItem(flowItemId);
      }
      await loadTasks(selectedRetreatId);
    } finally {
      setSavingId('');
    }
  };

  const openFlow = (task: Task) => {
    const flowItem = typeof task.bookingFlowItemId === 'object' ? task.bookingFlowItemId : null;
    const bookingId = flowItem?.bookingId && typeof flowItem.bookingId === 'object' ? flowItem.bookingId._id : null;
    if (bookingId) {
      navigate(`${routePrefix}/booking-flow/${bookingId}`);
    }
  };

  if (loading && tasks.length === 0) {
    return <LoadingSpinner message="Loading flow task inbox..." />;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Flow Task Inbox</h1>
          <p className="text-sm text-gray-600">Generated tasks from retreat flow steps. Complete them as forms and approvals arrive.</p>
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Icon icon={RefreshCw} className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Total</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">{stats.total}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Open</div>
          <div className="mt-1 text-2xl font-semibold text-amber-700">{stats.open}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Completed</div>
          <div className="mt-1 text-2xl font-semibold text-green-700">{stats.completed}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500">Overdue</div>
          <div className="mt-1 text-2xl font-semibold text-red-700">{stats.overdue}</div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-[260px] flex-1">
          <select
            value={selectedRetreatId}
            onChange={(e) => setSelectedRetreatId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select retreat</option>
            {retreats.map((retreat) => (
              <option key={retreat._id} value={retreat._id}>
                {retreat.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[240px] flex-1">
          <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2">
            <Icon icon={Search} className="h-4 w-4 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tasks, client, retreat..."
              className="w-full border-0 p-0 text-sm outline-none"
            />
          </div>
        </div>
        <div className="inline-flex rounded-md border border-gray-300 bg-white p-1">
          {(['open', 'completed', 'all'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`rounded-md px-3 py-1.5 text-sm capitalize ${statusFilter === value ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="text-sm font-semibold text-gray-900">
            {selectedRetreat ? `${selectedRetreat.name} flow tasks` : 'Flow tasks'}
          </div>
          <div className="text-xs text-gray-500">
            {filteredTasks.length} visible
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No generated flow tasks found for this retreat.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredTasks.map((task) => {
              const flowItem = typeof task.bookingFlowItemId === 'object' ? task.bookingFlowItemId : null;
              const clientName = flowItem?.clientId && typeof flowItem.clientId === 'object'
                ? `${flowItem.clientId.firstName || ''} ${flowItem.clientId.lastName || ''}`.trim()
                : 'Unknown client';
              const retreatName = flowItem?.retreatId && typeof flowItem.retreatId === 'object'
                ? flowItem.retreatId.name || 'Unknown retreat'
                : selectedRetreat?.name || 'Unknown retreat';
              const bookingId = flowItem?.bookingId && typeof flowItem.bookingId === 'object' ? flowItem.bookingId._id : null;

              return (
                <div key={task.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-gray-900">{task.name}</div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${task.status === 'completed' ? 'bg-green-100 text-green-700' : taskService.isOverdue(task.dueDate || '', task.status) ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {task.status}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-600">{task.description}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {clientName} • {retreatName} • {task.reminderKind || task.sourceId || 'booking flow'}
                    </div>
                  </div>

                  <div className="text-sm text-gray-700">
                    <div className="font-medium text-gray-900">{formatDate(task.dueDate)}</div>
                    <div className="text-xs text-gray-500">
                      {task.dueDate ? formatRelativeDate(task.dueDate) : 'No due date'}
                    </div>
                  </div>

                  <div className="text-sm text-gray-700">
                    <div className="font-medium text-gray-900">{task.assignedTo || 'Unassigned'}</div>
                    <div className="text-xs text-gray-500">
                      {flowItem?._id ? `Flow item ${flowItem._id}` : 'No flow item linked'}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    {bookingId && (
                      <button
                        onClick={() => navigate(`${routePrefix}/booking-flow/${bookingId}`)}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Open Flow
                      </button>
                    )}
                    {task.status !== 'completed' && (
                      <button
                        disabled={savingId === task.id}
                        onClick={() => completeTask(task)}
                        className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        <Icon icon={CheckCircle2} className="h-4 w-4" />
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FlowTaskInboxPage;
