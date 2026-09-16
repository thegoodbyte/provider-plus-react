import React, { useEffect, useMemo, useState, useRef } from 'react';
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
  bookingFlowApi,
  clientRequirementsApi,
  medicalArtifactsApi,
  medicalReviewRequestsApi,
  paymentsApi,
  retreatsApi,
} from '../services/api';
import {
  ClientRequirement,
  Payment,
  Retreat,
  MedicalArtifact,
  MedicalReviewRequest,
} from '../types';
import { formatCalendarDate, parseCalendarDate } from '../utils/dateFormat';
import './WorkflowDashboard.css';
import type { WorkflowSummaryRow, WorkflowMedicalRequirement } from '../types/workflowSummary';

const inlineErrors = { suppressGlobalError: true };

const DEFAULT_MESSAGE_TEMPLATE = [
  { key: 'medications-reminder', label: 'Medication reminder', offsetDays: 30 },
  { key: 'what-to-bring', label: 'What to bring message', offsetDays: 7 },
  { key: 'no-coffee', label: 'No coffee message', offsetDays: 7 },
  { key: 'arrival-check', label: 'Arrival check-in', offsetDays: 1 },
];

type DetailTab = 'overview' | 'requirements' | 'medical' | 'payments' | 'messages';

interface WorkflowBookingRow extends WorkflowSummaryRow {
  retreatName: string;
  retreatStartDate?: string;
  retreatEndDate?: string;
}
type BookingMedicalReviewRequirement = WorkflowMedicalRequirement;

interface WorkflowInboxItem {
  id: string;
  clientName: string;
  clientDisplayId?: number;
  title: string;
  detail: string;
  state: 'ready' | 'attention' | 'blocked' | 'unknown';
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
  return formatCalendarDate(value);
};

const formatRelativeDate = (date?: string | Date) => {
  if (!date) return '—';
  const d = parseCalendarDate(date);
  if (!d) return '—';
  const diffDays = Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0) return `In ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
};

const artifactDate = (artifact: MedicalArtifact) =>
  new Date(artifact.receivedAt || artifact.createdAt || 0).getTime();

const reviewDate = (review: MedicalReviewRequest) =>
  new Date(review.reviewedAt || review.requestedAt || review.createdAt || 0).getTime();

const getLatestReview = (reviews: MedicalReviewRequest[] = []) =>
  [...reviews].sort((a, b) => reviewDate(b) - reviewDate(a))[0];

const getReviewState = (artifact?: MedicalArtifact, review?: MedicalReviewRequest): BookingMedicalReviewRequirement['state'] => {
  if (!artifact || !(artifact.files || []).length) return 'missing';
  if (!review) return 'needs_review';
  if (review.status === 'approved' || review.status === 'completed' || review.reviewDecision === 'OK') return 'approved';
  if (review.status === 'caution' || review.reviewDecision === 'caution') return 'caution';
  if (review.status === 'rejected' || review.status === 'needs_resubmission' || review.reviewDecision === 'NOT OK') return 'rejected';
  return 'pending';
};

const getMedicalRequirementLabel = (state: BookingMedicalReviewRequirement['state']) => {
  switch (state) {
    case 'unavailable':
      return 'Unable to load';
    case 'missing':
      return 'Missing file';
    case 'needs_review':
      return 'Needs MRR';
    case 'pending':
      return 'Review pending';
    case 'approved':
      return 'Approved';
    case 'caution':
      return 'Caution';
    case 'rejected':
      return 'Rejected';
    default:
      return state;
  }
};

const getMedicalRequirementPill = (state: BookingMedicalReviewRequirement['state']): 'ready' | 'attention' | 'blocked' | 'unknown' => {
  if (state === 'unavailable') return 'unknown';
  if (state === 'approved') return 'ready';
  if (state === 'caution' || state === 'pending' || state === 'needs_review') return 'attention';
  return 'blocked';
};

const WorkflowDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { bookingId } = useParams();
  const routePrefix = location.pathname.startsWith('/medical/') ? '/medical' : '/admin';

  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const requestVersion = useRef(0);
  const [workflowRows, setWorkflowRows] = useState<WorkflowBookingRow[]>([]);
  const [selectedRetreatId, setSelectedRetreatId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'ready' | 'attention' | 'blocked' | 'unknown'>('all');
  const [detailTab, setDetailTab] = useState<{ bookingId?: string; tab: DetailTab }>({ bookingId, tab: 'overview' });
  const activeTab = detailTab.bookingId === bookingId ? detailTab.tab : 'overview';
  const setActiveTab = (tab: DetailTab) => setDetailTab({ bookingId, tab });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadRetreatWorkflow('');
    return () => { requestVersion.current += 1; };
    // The initial load selects a retreat; requestVersion rejects stale responses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBookingMedicalRequirements = async (bookingIdValue?: string): Promise<BookingMedicalReviewRequirement[]> => {
    if (!bookingIdValue) {
      return [
        { type: 'ekg', label: 'EKG', state: 'unavailable' },
        { type: 'liver_panel', label: 'Liver Panel', state: 'unavailable' },
      ];
    }

    try {
      const artifactsResponse = await medicalArtifactsApi.getAll({ bookingId: bookingIdValue }, inlineErrors);
      const artifacts: MedicalArtifact[] = artifactsResponse.data || [];
      const sections: Array<{ type: 'ekg' | 'liver_panel'; label: string }> = [
        { type: 'ekg', label: 'EKG' },
        { type: 'liver_panel', label: 'Liver Panel' },
      ];

      return Promise.all(sections.map(async (section) => {
        const artifact = artifacts
          .filter((item) => item.artifactType === section.type && item.status !== 'voided')
          .sort((a, b) => artifactDate(b) - artifactDate(a))[0];

        if (!artifact?._id) {
          return { ...section, state: 'missing' as const };
        }

        const reviewsResponse = await medicalReviewRequestsApi.getByArtifact(artifact._id, inlineErrors).catch(() => null);
        if (!reviewsResponse) return { ...section, artifact, state: 'unavailable' as const };
        const review = getLatestReview(reviewsResponse.data || []);
        return {
          ...section,
          artifact,
          review,
          state: getReviewState(artifact, review),
        };
      }));
    } catch (error) {
      console.error('Error loading booking medical review requirements:', error);
      return [
        { type: 'ekg', label: 'EKG', state: 'unavailable' },
        { type: 'liver_panel', label: 'Liver Panel', state: 'unavailable' },
      ];
    }
  };

  const loadRetreatWorkflow = async (requestedRetreatId: string) => {
    const version = ++requestVersion.current;
    const errors: string[] = [];
    const capture = async <T,>(label: string, request: Promise<{ data: T }>): Promise<{ data: T } | null> => {
      try { return await request; } catch { errors.push(label); return null; }
    };
    setIsLoading(true);
    setLoadErrors([]);
    setWorkflowRows([]);
    try {
      const retreatsResponse = await capture('Retreats', retreatsApi.getAll(inlineErrors));
      if (version !== requestVersion.current) return;
      const retreatList = (retreatsResponse?.data || []) as Retreat[];
      setRetreats(retreatList);
      const retreatId = requestedRetreatId || (retreatList.find(item => item.status === 'upcoming' || item.status === 'active') || retreatList[0])?._id;
      if (!retreatId) return;
      if (!requestedRetreatId) setSelectedRetreatId(retreatId);
      const response = await capture('Workflow data', bookingFlowApi.getRetreatWorkflowSummary(retreatId, inlineErrors));
      if (!response || version !== requestVersion.current) return;
      errors.push(...response.data.unavailable);
      const retreat = retreatList.find(item => item._id === retreatId);
      const workflow = response.data.rows.map(row => ({
        ...row,
        ...(!retreatsResponse ? { unavailable: [...row.unavailable, 'Retreats'], readinessState: 'unknown' as const, nextAction: 'Retry unavailable data' } : {}),
        retreatName: retreat?.name || 'Unknown Retreat',
        retreatStartDate: retreat?.startDate ? String(retreat.startDate) : undefined,
        retreatEndDate: retreat?.endDate ? String(retreat.endDate) : undefined,
      }));

      if (version === requestVersion.current) setWorkflowRows(workflow);
    } catch (error) {
      console.error('Error loading retreat workflow:', error);
      errors.push('Workflow data');
    } finally {
      if (version === requestVersion.current) { setLoadErrors(errors); setIsLoading(false); }
    }
  };

  const selectedBooking = useMemo(
    () => workflowRows.find((row) => row._id === bookingId) || workflowRows[0] || null,
    [workflowRows, bookingId],
  );

  const [detailRecords, setDetailRecords] = useState<{ bookingId?: string; tab?: DetailTab; requirements: ClientRequirement[]; payments: Payment[]; medicalRequirements?: WorkflowMedicalRequirement[]; error: boolean }>({ requirements: [], payments: [], error: false });
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRetry, setDetailRetry] = useState(0);
  useEffect(() => {
    let current = true;
    const tab = activeTab;
    if (!selectedBooking || !['requirements', 'payments', 'medical'].includes(tab)) { setDetailLoading(false); return; }
    const clientId = getId(selectedBooking.clientId);
    const retreatId = getId(selectedBooking.retreatId);
    setDetailLoading(true);
    setDetailRecords({ bookingId: selectedBooking._id, tab, requirements: [], payments: [], error: false });
    const load = async () => {
      try {
        if (!clientId || !retreatId) throw new Error('Missing booking context');
        const result = tab === 'requirements'
          ? { requirements: (await clientRequirementsApi.getByClientAndRetreat(clientId, retreatId, inlineErrors)).data || [] }
          : tab === 'payments'
            ? { payments: (await paymentsApi.getByClientAndRetreat(clientId, retreatId, inlineErrors)).data || [] }
            : { medicalRequirements: await loadBookingMedicalRequirements(selectedBooking._id) };
        if (current) setDetailRecords({ bookingId: selectedBooking._id, tab, requirements: [], payments: [], error: Boolean(result.medicalRequirements?.some(item => item.state === 'unavailable')), ...result });
      } catch {
        if (current) setDetailRecords({ bookingId: selectedBooking._id, tab, requirements: [], payments: [], error: true });
      } finally { if (current) setDetailLoading(false); }
    };
    void load();
    return () => { current = false; };
    // Only the selected booking/tab fetches details; discard requests from previous selections.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBooking, activeTab, detailRetry]);

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

  const recordsMatch = detailRecords.bookingId === selectedBooking?._id && detailRecords.tab === activeTab;
  const detailPending = ['requirements', 'payments', 'medical'].includes(activeTab) && (detailLoading || !recordsMatch);
  const detailError = recordsMatch && detailRecords.error;
  const detail = useMemo(() => selectedBooking ? {
    ...selectedBooking,
    requirements: recordsMatch ? detailRecords.requirements : [],
    payments: recordsMatch ? detailRecords.payments : [],
    medicalRequirements: recordsMatch && detailRecords.medicalRequirements ? detailRecords.medicalRequirements : selectedBooking.medicalRequirements,
    unavailable: [...selectedBooking.unavailable, ...(detailError ? [activeTab === 'requirements' ? 'Requirements' : activeTab === 'payments' ? 'Payments' : 'Medical documents / reviews'] : [])],
  } : null, [selectedBooking, recordsMatch, detailRecords, detailError, activeTab]);
  const incomplete = loadErrors.length > 0 || workflowRows.some(row => row.unavailable.length > 0);
  const remindersUnavailable = loadErrors.includes('Reminders') || loadErrors.includes('Workflow data');

  const selectedRetreat = retreats.find((retreat) => retreat._id === selectedRetreatId);

  const scheduleMessages = useMemo(() => {
    if (!detail?.retreatStartDate || detail.unavailable.includes('Reminders')) return [];
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
        notes: matchedReminder?.description || '',
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
              aria-label="Retreat"
              value={selectedRetreatId}
              onChange={(e) => { setSelectedRetreatId(e.target.value); loadRetreatWorkflow(e.target.value); }}
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
              disabled={isLoading}
              onClick={() => loadRetreatWorkflow(selectedRetreatId)}
            >
              <Icon icon={RefreshCw} className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {incomplete && <div role="alert" className="workflow-load-warning">
          Unable to load all workflow data{loadErrors.length ? `: ${loadErrors.join(', ')}` : ''}. Readiness and counts are incomplete.
          <button type="button" className="workflow-button secondary" disabled={isLoading} onClick={() => loadRetreatWorkflow(selectedRetreatId)}>Retry unavailable data</button>
        </div>}
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
            <button className={`workflow-tab ${activeFilter === 'unknown' ? 'active' : ''}`} onClick={() => setActiveFilter('unknown')}>Unknown</button>
          </div>
          <div className="workflow-toolbar-right">
            <span className="workflow-booking-sub">
              {selectedRetreat ? `${selectedRetreat.name} • ${formatDate(selectedRetreat.startDate)}` : 'No retreat selected'}
            </span>
          </div>
        </div>

        {!loadErrors.includes('Bookings') && !loadErrors.includes('Workflow data') && !(loadErrors.includes('Retreats') && !workflowRows.length) && <><div className="workflow-stat-grid">
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
            <div className="workflow-stat-value">{remindersUnavailable ? '—' : summary.reminders}</div>
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
                <div className="workflow-empty">{incomplete ? 'Task list incomplete. Retry unavailable data.' : 'No open tasks for this retreat.'}</div>
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
              <span>{remindersUnavailable ? 'Unknown' : `${messageQueue.length} queued`}</span>
            </div>
            <div className="workflow-message-list">
              {messageQueue.length === 0 ? (
                <div className="workflow-empty">{remindersUnavailable ? 'Unable to load reminders.' : 'No reminders queued for this retreat.'}</div>
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
                <div className="workflow-empty">{loadErrors.length ? 'Unable to confirm bookings.' : 'No bookings found for this retreat.'}</div>
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
                      <div className={`workflow-pill ${row.unavailable.some(label => /Medical|documents/.test(label)) ? 'unknown' : row.medicalRequirements.every((item) => item.state === 'approved') ? 'ready' : row.medicalRequirements.some((item) => item.state === 'missing' || item.state === 'rejected') ? 'blocked' : 'attention'}`}>
                        {row.unavailable.some(label => /Medical|documents/.test(label)) ? 'Unable to load' : row.medicalRequirements.every((item) => item.state === 'approved') ? 'Approved' : 'Incomplete'}
                      </div>
                    </div>
                    <div>
                      <div className="workflow-booking-sub">Payments</div>
                      <div className={`workflow-pill ${row.unavailable.includes('Payments') ? 'unknown' : row.depositPaid ? 'ready' : 'blocked'}`}>
                        {row.unavailable.includes('Payments') ? 'Unable to load' : row.depositPaid ? 'Deposit paid' : 'Deposit due'}
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

                {detail.unavailable.length > 0 && <p role="status" className="workflow-load-warning">Unable to load: {detail.unavailable.join(', ')}. Readiness unknown.</p>}
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
                      {!detail.unavailable.length && <><div className="workflow-progress">
                        <div
                          className="workflow-progress-bar"
                          style={{
                            width: `${Math.min(100, Math.max(0, detail.readinessScore * 25))}%`,
                            background: detail.readinessState === 'ready' ? '#22c55e' : detail.readinessState === 'blocked' ? '#ef4444' : '#f59e0b',
                          }}
                        />
                      </div>
                      <p className="workflow-booking-sub">{detail.readinessScore}/4 checkpoints complete</p></>}
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
                      <p>{detail.missingItems.length ? detail.missingItems.join(', ') : detail.unavailable.length ? 'Unable to confirm missing items' : 'No missing items'}</p>
                    </div>
                  </div>
                )}

                {detailPending && <p role="status">Loading {activeTab}…</p>}
                {detailError && !detailPending && <button className="workflow-button secondary" onClick={() => setDetailRetry(value => value + 1)}>Retry details</button>}
                {activeTab === 'requirements' && !detailPending && (
                  <div className="workflow-card">
                    <div className="workflow-section-header">
                      <h3>Requirements</h3>
                      <span>{detail.unavailable.includes('Requirements') ? 'Unknown' : `${detail.requirements.length} records`}</span>
                    </div>
                    {detail.unavailable.includes('Requirements') ? <div className="workflow-empty">Unable to load requirements.</div> : detail.requirements.length === 0 ? (
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
                                <td>{item.requirement?.name || (typeof item.requirementId === 'object' ? (item.requirementId as any)?.name : item.requirementId)}</td>
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

                {activeTab === 'medical' && !detailPending && (
                  <div className="workflow-card">
                    <div className="workflow-section-header">
                      <h3>Medical</h3>
                      <span>{detail.unavailable.some(label => /Medical|documents/.test(label)) ? 'Unable to load' : detail.medicalRequirements.every((item) => item.state === 'approved') ? 'Ready' : 'Action required'}</span>
                    </div>
                    <div className="workflow-detail-grid">
                      {detail.medicalRequirements.map((requirement) => (
                        <div className="workflow-detail-item workflow-medical-requirement" key={requirement.type}>
                          <div className="workflow-medical-requirement-head">
                            <h4>{requirement.label}</h4>
                            <span className={`workflow-pill ${getMedicalRequirementPill(requirement.state)}`}>
                              {getMedicalRequirementLabel(requirement.state)}
                            </span>
                          </div>
                          {requirement.state !== 'unavailable' && <><p>Artifact: {requirement.artifact?.display_id ? `#${requirement.artifact.display_id}` : 'No artifact linked'}</p>
                          <p>Received: {formatDate(requirement.artifact?.receivedAt || requirement.artifact?.createdAt)}</p>
                          <p>Files: {(requirement.artifact?.files || []).map((file) => file.fileName).filter(Boolean).join(', ') || 'No files'}</p>
                          <p>Review: {requirement.review?.display_id ? `#${requirement.review.display_id} ${requirement.review.status}` : 'No medical review request'}</p></>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'payments' && !detailPending && (
                  <div className="workflow-card">
                    <div className="workflow-section-header">
                      <h3>Payments</h3>
                      <span>{detail.unavailable.includes('Payments') ? 'Unknown' : `${detail.payments.length} records`}</span>
                    </div>
                    {detail.unavailable.includes('Payments') ? <div className="workflow-empty">Unable to load payments.</div> : detail.payments.length === 0 ? (
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
                      <span>{detail.unavailable.includes('Reminders') ? 'Unknown' : `${detail.reminders.length} reminders`}</span>
                    </div>
                    <div className="workflow-message-list">
                      {detail.unavailable.includes('Reminders') ? <div className="workflow-empty">Unable to load reminders.</div> : detail.reminders.length === 0 && scheduleMessages.length === 0 ? (
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
        </div></>}
      </div>
    </div>
  );
};

export default WorkflowDashboard;
