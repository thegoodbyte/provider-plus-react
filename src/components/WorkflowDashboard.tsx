import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Clock3,
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import CurrencyDisplay from './CurrencyDisplay';
import {
  bookingsApi,
  clientMedicalApi,
  clientRequirementsApi,
  paymentsApi,
  remindersApi,
  retreatsApi,
  requirementsApi,
} from '../services/api';
import {
  ClientMedical,
  ClientRequirement,
  Payment,
  Reminder,
  Requirement,
  Retreat,
  RetreatClient,
  Client,
} from '../types';
import './WorkflowDashboard.css';

const DEFAULT_MESSAGE_TEMPLATE = [
  { key: 'medications-reminder', label: 'Medication reminder', offsetDays: 30 },
  { key: 'what-to-bring', label: 'What to bring message', offsetDays: 7 },
  { key: 'no-coffee', label: 'No coffee message', offsetDays: 7 },
  { key: 'arrival-check', label: 'Arrival check-in', offsetDays: 1 },
];

type DetailTab = 'overview' | 'requirements' | 'medical' | 'payments' | 'messages';

interface WorkflowBookingRow extends RetreatClient {
  clientName: string;
  clientEmail: string;
  clientDisplayId?: number;
  retreatName: string;
  retreatStartDate?: string;
  retreatEndDate?: string;
  requirements: ClientRequirement[];
  payments: Payment[];
  medical: ClientMedical | null;
  reminders: Reminder[];
  readinessScore: number;
  readinessState: 'ready' | 'attention' | 'blocked';
  nextAction: string;
  missingItems: string[];
}

interface WorkflowInboxItem {
  id: string;
  clientName: string;
  clientDisplayId?: number;
  title: string;
  detail: string;
  state: 'ready' | 'attention' | 'blocked';
  dueText: string;
}

interface WorkflowQueueItem {
  id: string;
  clientName: string;
  title: string;
  status: string;
  dueText: string;
}

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const getId = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return value._id;
  return undefined;
};

const formatDate = (value?: string | Date) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
};

const formatRelativeDate = (date?: string | Date) => {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const diffDays = Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0) return `In ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
};

const WorkflowDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { bookingId } = useParams();
  const routePrefix = location.pathname.startsWith('/medical/') ? '/medical' : '/admin';

  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [workflowRows, setWorkflowRows] = useState<WorkflowBookingRow[]>([]);
  const [selectedRetreatId, setSelectedRetreatId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'ready' | 'attention' | 'blocked'>('all');
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedRetreatId) {
      loadRetreatWorkflow(selectedRetreatId);
    }
  }, [selectedRetreatId]);

  useEffect(() => {
    if (workflowRows.length > 0 && bookingId) {
      const selected = workflowRows.find((row) => row._id === bookingId);
      if (selected) {
        setActiveTab('overview');
      }
    }
  }, [bookingId, workflowRows]);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const [retreatsResponse, requirementsResponse] = await Promise.all([
        retreatsApi.getAll(),
        requirementsApi.getAll(),
      ]);

      const retreatList = retreatsResponse.data || [];
      const requirementList = requirementsResponse.data || [];
      setRetreats(retreatList);
      setRequirements(requirementList);

      const fallbackRetreat = retreatList.find((retreat: Retreat) => retreat.status === 'upcoming' || retreat.status === 'active') || retreatList[0];
      if (fallbackRetreat?._id) {
        setSelectedRetreatId(fallbackRetreat._id);
      }
    } catch (error) {
      console.error('Error loading workflow data:', error);
      setRetreats([]);
      setRequirements([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRetreatWorkflow = async (retreatId: string) => {
    try {
      setIsLoading(true);
      const [bookingsResponse, remindersResponse] = await Promise.all([
        bookingsApi.getByRetreatWithDetails(retreatId),
        remindersApi.getByRetreat(retreatId).catch(() => ({ data: [] })),
      ]);

      const bookings = bookingsResponse.data || [];
      const retreat = retreats.find((item) => item._id === retreatId);
      const retreatReminders = remindersResponse.data || [];

      const workflow = await Promise.all(
        bookings.map(async (booking: RetreatClient) => {
          const client = booking.clientId as Client | string;
          const bookingClientId =
            getId(client) ||
            (typeof booking.clientId === 'string'
              ? booking.clientId
              : booking.clientId && typeof booking.clientId === 'object'
                ? (booking.clientId as Client)._id || ''
                : '');
          const retreatIdValue =
            getId(booking.retreatId) ||
            (typeof booking.retreatId === 'string'
              ? booking.retreatId
              : booking.retreatId && typeof booking.retreatId === 'object'
                ? (booking.retreatId as Retreat)._id || retreatId
                : retreatId);
          const clientInfo = typeof client === 'object' ? client : undefined;

          const [requirementsResponse, paymentsResponse, medicalResponse] = await Promise.all([
            clientRequirementsApi.getByClientAndRetreat(bookingClientId, retreatIdValue).catch(() => ({ data: [] })),
            paymentsApi.getByClientAndRetreat(bookingClientId, retreatIdValue).catch(() => ({ data: [] })),
            clientMedicalApi.getByClientAndRetreat(bookingClientId, retreatIdValue).catch(() => ({ data: null })),
          ]);

          const bookingRequirements: ClientRequirement[] = requirementsResponse.data || [];
          const bookingPayments: Payment[] = paymentsResponse.data || [];
          const medical: ClientMedical | null = medicalResponse.data || null;
          const clientReminders: Reminder[] = retreatReminders.filter((reminder: Reminder) => reminder.clientId === bookingClientId);

          const requirementTotal = Math.max(requirements.filter((req) => req.isActive !== false).length, bookingRequirements.length);
          const requirementApproved = bookingRequirements.filter((req) => req.status === 'approved').length;
          const medicalComplete = Boolean(
            medical?.ekgStatus === 'approved' &&
            medical?.liverPanelStatus === 'approved'
          );
          const depositPaid = bookingPayments.some((payment) => payment.status === 'completed' && (payment.isDeposit || payment.paymentType?.includes('deposit')));
          const docsComplete = requirementTotal > 0 ? requirementApproved >= requirementTotal : bookingRequirements.length === 0;
          const remindersDue = clientReminders.filter((reminder) => reminder.status !== 'completed' && reminder.status !== 'dismissed').length;

          const missingItems: string[] = [];
          if (!medical?.ekgStatus || medical.ekgStatus !== 'approved') missingItems.push('EKG approval');
          if (!medical?.liverPanelStatus || medical.liverPanelStatus !== 'approved') missingItems.push('Liver approval');
          if (!depositPaid) missingItems.push('Deposit payment');
          if (!docsComplete) missingItems.push('Requirements');
          if (remindersDue > 0) missingItems.push(`${remindersDue} reminder${remindersDue === 1 ? '' : 's'} due`);

          const readinessScore = [
            medicalComplete,
            depositPaid,
            docsComplete,
            remindersDue === 0 || clientReminders.length === 0,
          ].filter(Boolean).length;

          let readinessState: 'ready' | 'attention' | 'blocked' = 'ready';
          if (missingItems.length >= 4) readinessState = 'blocked';
          else if (missingItems.length > 0) readinessState = 'attention';

          const nextAction =
            !medical?.ekgStatus || medical.ekgStatus !== 'approved'
              ? 'Approve EKG'
              : !medical?.liverPanelStatus || medical.liverPanelStatus !== 'approved'
                ? 'Approve liver panel'
                : !depositPaid
                  ? 'Collect deposit'
                  : !docsComplete
                    ? 'Review outstanding requirements'
                    : remindersDue > 0
                      ? 'Clear reminder queue'
                      : 'Ready for retreat';

          return {
            ...booking,
            clientName: clientInfo ? `${clientInfo.firstName || ''} ${clientInfo.lastName || ''}`.trim() || 'Unknown Client' : 'Unknown Client',
            clientEmail: clientInfo?.email || '',
            clientDisplayId: clientInfo?.display_id,
            retreatName: retreat?.name || 'Unknown Retreat',
            retreatStartDate: retreat?.startDate ? String(retreat.startDate) : undefined,
            retreatEndDate: retreat?.endDate ? String(retreat.endDate) : undefined,
            requirements: bookingRequirements,
            payments: bookingPayments,
            medical,
            reminders: clientReminders,
            readinessScore,
            readinessState,
            nextAction,
            missingItems,
          } as WorkflowBookingRow;
        })
      );

      setWorkflowRows(workflow);
    } catch (error) {
      console.error('Error loading retreat workflow:', error);
      setWorkflowRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedBooking = useMemo(
    () => workflowRows.find((row) => row._id === bookingId) || workflowRows[0] || null,
    [workflowRows, bookingId],
  );

  const filteredRows = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();
    return workflowRows.filter((row) => {
      const matchesFilter =
        activeFilter === 'all' ||
        row.readinessState === activeFilter;
      const matchesSearch =
        !searchLower ||
        row.clientName.toLowerCase().includes(searchLower) ||
        row.clientEmail.toLowerCase().includes(searchLower) ||
        row.retreatName.toLowerCase().includes(searchLower) ||
        String(row.clientDisplayId || '').includes(searchLower) ||
        String(row.bookingNumber || '').includes(searchLower);
      return matchesFilter && matchesSearch;
    });
  }, [workflowRows, activeFilter, searchTerm]);

  const summary = useMemo(() => {
    const total = workflowRows.length;
    return {
      total,
      ready: workflowRows.filter((row) => row.readinessState === 'ready').length,
      attention: workflowRows.filter((row) => row.readinessState === 'attention').length,
      blocked: workflowRows.filter((row) => row.readinessState === 'blocked').length,
      reminders: workflowRows.reduce((count, row) => count + row.reminders.length, 0),
    };
  }, [workflowRows]);

  const taskInbox = useMemo<WorkflowInboxItem[]>(() => {
    return workflowRows.flatMap((row) => {
      const items: WorkflowInboxItem[] = [];

      if (row.missingItems.length > 0) {
        items.push({
          id: `${row._id}-readiness`,
          clientName: row.clientName,
          clientDisplayId: row.clientDisplayId,
          title: row.nextAction,
          detail: row.missingItems.join(', '),
          state: row.readinessState,
          dueText: row.retreatStartDate ? formatRelativeDate(row.retreatStartDate) : 'No retreat date',
        });
      }

      row.reminders
        .filter((reminder) => reminder.status !== 'completed' && reminder.status !== 'dismissed')
        .slice(0, 2)
        .forEach((reminder) => {
          items.push({
            id: reminder._id || `${row._id}-${reminder.title}`,
            clientName: row.clientName,
            clientDisplayId: row.clientDisplayId,
            title: reminder.title,
            detail: reminder.description,
            state: reminder.status === 'overdue' ? 'blocked' : 'attention',
            dueText: formatDate(reminder.dueDate),
          });
        });

      return items;
    }).slice(0, 8);
  }, [workflowRows]);

  const messageQueue = useMemo<WorkflowQueueItem[]>(() => {
    return workflowRows
      .flatMap((row) =>
        row.reminders.map((reminder) => ({
          id: reminder._id || `${row._id}-${reminder.title}`,
          clientName: row.clientName,
          title: reminder.title,
          status: reminder.status || 'pending',
          dueText: formatDate(reminder.dueDate),
        }))
      )
      .sort((a, b) => a.dueText.localeCompare(b.dueText))
      .slice(0, 8);
  }, [workflowRows]);

  const detail = selectedBooking;

  const selectedRetreat = retreats.find((retreat) => retreat._id === selectedRetreatId);

  const scheduleMessages = useMemo(() => {
    if (!detail?.retreatStartDate) return [];
    const retreatStart = new Date(detail.retreatStartDate);
    if (Number.isNaN(retreatStart.getTime())) return [];

    return DEFAULT_MESSAGE_TEMPLATE.map((item) => {
      const dueDate = new Date(retreatStart);
      dueDate.setDate(dueDate.getDate() - item.offsetDays);
      const matchedReminder = detail.reminders.find((reminder) =>
        reminder.title.toLowerCase().includes(item.key.replace(/-/g, ' ')) ||
        reminder.title.toLowerCase().includes(item.label.toLowerCase().split(' ')[0])
      );
      return {
        ...item,
        dueDate,
        status: matchedReminder?.status || (dueDate.getTime() < Date.now() ? 'due' : 'pending'),
        title: matchedReminder?.title || item.label,
        notes: matchedReminder?.description || matchedReminder?.notes || '',
      };
    });
  }, [detail]);

  const goToBooking = (id?: string) => {
    if (!id) return;
    navigate(`${routePrefix}/workflow/bookings/${id}`);
  };

  if (isLoading && workflowRows.length === 0) {
    return <LoadingSpinner message="Loading workflow dashboard..." />;
  }

  return (
    <div className="workflow-dashboard">
      <div className="workflow-shell">
        <div className="workflow-header">
          <div>
            <h1>Workflow Dashboard</h1>
            <p>Retreat readiness, task queue, medical approvals, payments, and outbound messages in one place.</p>
          </div>
          <div className="workflow-header-actions">
            <select
              className="workflow-select"
              value={selectedRetreatId}
              onChange={(e) => setSelectedRetreatId(e.target.value)}
            >
              <option value="">Select retreat</option>
              {retreats.map((retreat) => (
                <option key={retreat._id} value={retreat._id}>
                  {retreat.name} {retreat.startDate ? `• ${formatDate(retreat.startDate)}` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="workflow-button secondary"
              onClick={() => selectedRetreatId && loadRetreatWorkflow(selectedRetreatId)}
            >
              <Icon icon={RefreshCw} className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="workflow-toolbar">
          <div className="workflow-toolbar-left">
            <input
              className="workflow-filter"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search client, retreat, booking..."
            />
            <button className={`workflow-tab ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')}>
              All
            </button>
            <button className={`workflow-tab ${activeFilter === 'ready' ? 'active' : ''}`} onClick={() => setActiveFilter('ready')}>
              Ready
            </button>
            <button className={`workflow-tab ${activeFilter === 'attention' ? 'active' : ''}`} onClick={() => setActiveFilter('attention')}>
              Attention
            </button>
            <button className={`workflow-tab ${activeFilter === 'blocked' ? 'active' : ''}`} onClick={() => setActiveFilter('blocked')}>
              Blocked
            </button>
          </div>
          <div className="workflow-toolbar-right">
            <span className="workflow-booking-sub">
              {selectedRetreat ? `${selectedRetreat.name} • ${formatDate(selectedRetreat.startDate)}` : 'No retreat selected'}
            </span>
          </div>
        </div>

        <div className="workflow-stat-grid">
          <div className="workflow-stat">
            <span className="workflow-stat-label">Bookings</span>
            <div className="workflow-stat-value">{summary.total}</div>
            <div className="workflow-stat-hint">In the selected retreat</div>
          </div>
          <div className="workflow-stat">
            <span className="workflow-stat-label">Ready</span>
            <div className="workflow-stat-value">{summary.ready}</div>
            <div className="workflow-stat-hint">Fully cleared</div>
          </div>
          <div className="workflow-stat">
            <span className="workflow-stat-label">Attention</span>
            <div className="workflow-stat-value">{summary.attention}</div>
            <div className="workflow-stat-hint">Needs follow-up</div>
          </div>
          <div className="workflow-stat">
            <span className="workflow-stat-label">Queue</span>
            <div className="workflow-stat-value">{summary.reminders}</div>
            <div className="workflow-stat-hint">Open reminders</div>
          </div>
        </div>

        <div className="workflow-queue-grid">
          <div className="workflow-card">
            <div className="workflow-section-header">
              <h3>Task inbox</h3>
              <span>{taskInbox.length} open</span>
            </div>
            <div className="workflow-task-list">
              {taskInbox.length === 0 ? (
                <div className="workflow-empty">No open tasks for this retreat.</div>
              ) : (
                taskInbox.map((task) => (
                  <div key={task.id} className="workflow-task">
                    <div className="workflow-task-main">
                      <div className="workflow-task-title">
                        {task.clientDisplayId ? `#${task.clientDisplayId} ` : ''}
                        {task.clientName}
                      </div>
                      <div className="workflow-task-meta">{task.title}</div>
                      <div className="workflow-task-meta">{task.detail || 'No additional detail'}</div>
                    </div>
                    <div className="workflow-task-right">
                      <div className={`workflow-pill ${task.state}`}>{task.state}</div>
                      <div className="workflow-task-meta">{task.dueText}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="workflow-card">
            <div className="workflow-section-header">
              <h3>Message queue</h3>
              <span>{messageQueue.length} queued</span>
            </div>
            <div className="workflow-message-list">
              {messageQueue.length === 0 ? (
                <div className="workflow-empty">No reminders queued for this retreat.</div>
              ) : (
                messageQueue.map((message) => (
                  <div key={message.id} className="workflow-message">
                    <div className="workflow-message-main">
                      <div className="workflow-message-title">{message.title}</div>
                      <div className="workflow-message-meta">{message.clientName}</div>
                    </div>
                    <div className="workflow-message-right">
                      <div className="workflow-booking-sub">{message.dueText}</div>
                      <div className="workflow-booking-sub">{message.status}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="workflow-grid">
          <div className="workflow-list">
            <div className="workflow-list-header">
              <h2>Bookings</h2>
              <span>{filteredRows.length} shown</span>
            </div>

            <div className="workflow-booking-list">
              {filteredRows.length === 0 ? (
                <div className="workflow-empty">No bookings found for this retreat.</div>
              ) : (
                filteredRows.map((row) => (
                  <div
                    key={row._id}
                    className={`workflow-booking-row ${row._id === detail?._id ? 'active' : ''}`}
                    onClick={() => goToBooking(row._id)}
                  >
                    <div className="workflow-booking-number">
                      #{row.clientDisplayId || row.bookingNumber || '—'}
                    </div>
                    <div className="workflow-booking-client">
                      <strong>{row.clientName}</strong>
                      <span>{row.clientEmail || 'No email'}</span>
                    </div>
                    <div>
                      <div className={`workflow-pill ${row.readinessState}`}>
                        {row.readinessState === 'ready' ? <CheckCircle2 className="w-3.5 h-3.5" /> : row.readinessState === 'blocked' ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock3 className="w-3.5 h-3.5" />}
                        {row.readinessState}
                      </div>
                      <div className="workflow-booking-sub">{row.nextAction}</div>
                    </div>
                    <div>
                      <div className="workflow-booking-sub">Medical</div>
                      <div className={`workflow-pill ${row.medical?.ekgStatus === 'approved' && row.medical?.liverPanelStatus === 'approved' ? 'ready' : 'attention'}`}>
                        {row.medical?.ekgStatus === 'approved' && row.medical?.liverPanelStatus === 'approved' ? 'Approved' : 'Incomplete'}
                      </div>
                    </div>
                    <div>
                      <div className="workflow-booking-sub">Payments</div>
                      <div className={`workflow-pill ${row.payments.some((payment) => payment.status === 'completed' && (payment.isDeposit || payment.paymentType?.includes('deposit'))) ? 'ready' : 'blocked'}`}>
                        {row.payments.some((payment) => payment.status === 'completed' && (payment.isDeposit || payment.paymentType?.includes('deposit'))) ? 'Deposit paid' : 'Deposit due'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="workflow-detail">
            {detail ? (
              <>
                <div className="workflow-detail-header">
                  <div>
                    <h2>{detail.clientName}</h2>
                    <span>#{detail.clientDisplayId || detail.bookingNumber || '—'} • {detail.retreatName}</span>
                  </div>
                  <div className={`workflow-pill ${detail.readinessState}`}>
                    {detail.readinessState === 'ready' ? <ShieldCheck className="w-3.5 h-3.5" /> : detail.readinessState === 'blocked' ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock3 className="w-3.5 h-3.5" />}
                    {detail.readinessState}
                  </div>
                </div>

                <div className="workflow-tabs">
                  {(['overview', 'requirements', 'medical', 'payments', 'messages'] as DetailTab[]).map((tab) => (
                    <button
                      key={tab}
                      className={`workflow-tab ${activeTab === tab ? 'active' : ''}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {activeTab === 'overview' && (
                  <div className="workflow-detail-grid">
                    <div className="workflow-detail-item">
                      <h4>Readiness</h4>
                      <p>{detail.nextAction}</p>
                      <div className="workflow-progress">
                        <div
                          className="workflow-progress-bar"
                          style={{
                            width: `${Math.min(100, Math.max(0, detail.readinessScore * 25))}%`,
                            background: detail.readinessState === 'ready' ? '#22c55e' : detail.readinessState === 'blocked' ? '#ef4444' : '#f59e0b',
                          }}
                        />
                      </div>
                      <p className="workflow-booking-sub">{detail.readinessScore}/4 checkpoints complete</p>
                    </div>
                    <div className="workflow-detail-item">
                      <h4>Retreat Dates</h4>
                      <p>Start: {formatDate(detail.retreatStartDate)}</p>
                      <p>End: {formatDate(detail.retreatEndDate)}</p>
                      <p>Relative: {formatRelativeDate(detail.retreatStartDate)}</p>
                    </div>
                    <div className="workflow-detail-item">
                      <h4>Client</h4>
                      <p>{detail.clientName}</p>
                      <p>{detail.clientEmail || 'No email on file'}</p>
                    </div>
                    <div className="workflow-detail-item">
                      <h4>Missing items</h4>
                      <p>{detail.missingItems.length ? detail.missingItems.join(', ') : 'No missing items'}</p>
                    </div>
                  </div>
                )}

                {activeTab === 'requirements' && (
                  <div className="workflow-card">
                    <div className="workflow-section-header">
                      <h3>Requirements</h3>
                      <span>{detail.requirements.length} records</span>
                    </div>
                    {detail.requirements.length === 0 ? (
                      <div className="workflow-empty">No client requirements initialized.</div>
                    ) : (
                      <div className="workflow-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Requirement</th>
                              <th>Status</th>
                              <th>Due</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.requirements.map((item) => (
                              <tr key={item._id}>
                                <td>{item.requirement?.name || requirements.find((req) => req._id === item.requirementId)?.name || item.requirementId}</td>
                                <td>{item.status || 'pending'}</td>
                                <td>{formatDate(item.dueDate)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'medical' && (
                  <div className="workflow-card">
                    <div className="workflow-section-header">
                      <h3>Medical</h3>
                      <span>{detail.medical ? 'Record found' : 'No medical record'}</span>
                    </div>
                    {!detail.medical ? (
                      <div className="workflow-empty">No EKG or liver panel record exists yet.</div>
                    ) : (
                      <div className="workflow-detail-grid">
                        <div className="workflow-detail-item">
                          <h4>EKG</h4>
                          <p>Status: {detail.medical.ekgStatus || 'pending'}</p>
                          <p>Received: {formatDate(detail.medical.ekgReceivedDate)}</p>
                          <p>File: {detail.medical.ekgFileName || 'No files'}</p>
                        </div>
                        <div className="workflow-detail-item">
                          <h4>Liver Panel</h4>
                          <p>Status: {detail.medical.liverPanelStatus || 'pending'}</p>
                          <p>Received: {formatDate(detail.medical.liverPanelReceivedDate)}</p>
                          <p>File: {detail.medical.liverPanelFileName || 'No files'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'payments' && (
                  <div className="workflow-card">
                    <div className="workflow-section-header">
                      <h3>Payments</h3>
                      <span>{detail.payments.length} records</span>
                    </div>
                    {detail.payments.length === 0 ? (
                      <div className="workflow-empty">No payments recorded for this booking.</div>
                    ) : (
                      <div className="workflow-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Amount</th>
                              <th>Method</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.payments.map((payment) => (
                              <tr key={payment._id}>
                                <td>{formatDate(payment.paymentDate)}</td>
                                <td><CurrencyDisplay amount={payment.amount} currency={payment.currency} /></td>
                                <td>{payment.paymentMethod.replace(/_/g, ' ')}</td>
                                <td>{payment.status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'messages' && (
                  <div className="workflow-card">
                    <div className="workflow-section-header">
                      <h3>Message Queue</h3>
                      <span>{detail.reminders.length} reminders</span>
                    </div>
                    <div className="workflow-message-list">
                      {detail.reminders.length === 0 && scheduleMessages.length === 0 ? (
                        <div className="workflow-empty">No reminders or scheduled messages yet.</div>
                      ) : (
                        <>
                          {detail.reminders.map((reminder) => (
                            <div key={reminder._id} className="workflow-message">
                              <div className="workflow-message-main">
                                <div className="workflow-message-title">{reminder.title}</div>
                                <div className="workflow-message-meta">{reminder.description}</div>
                              </div>
                              <div className="workflow-message-right">
                                <div className="workflow-booking-sub">{formatDate(reminder.dueDate)}</div>
                                <div className="workflow-booking-sub">{reminder.status || 'pending'}</div>
                              </div>
                            </div>
                          ))}
                          {scheduleMessages.map((item) => (
                            <div key={item.key} className="workflow-message">
                              <div className="workflow-message-main">
                                <div className="workflow-message-title">{item.title}</div>
                                <div className="workflow-message-meta">{item.notes || 'Scheduled based on retreat start date'}</div>
                              </div>
                              <div className="workflow-message-right">
                                <div className="workflow-booking-sub">{formatDate(item.dueDate)}</div>
                                <div className="workflow-booking-sub">{item.status}</div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="workflow-card">
                <div className="workflow-empty">Select a booking to see detail tabs.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowDashboard;
