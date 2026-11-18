import { NAVIGATION } from '../navigation/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock3, FileText, RefreshCw, UserCheck, XCircle } from 'lucide-react';
import { medicalReviewRequestsApi } from '../services/api';
import { MedicalReviewRequest } from '../types';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import MedicalReviewTypeBadge from './MedicalReviewTypeBadge';
import AppleButton from './AppleButton';
import { Card, Badge, EmptyState } from './ui';
import type { BadgeTone } from './ui';

type ReviewFilter = 'open' | 'all' | 'pending' | 'in_review' | 'needs_resubmission' | 'approved' | 'rejected' | 'caution' | 'completed';

const openStatuses = new Set(['assigned', 'pending', 'in_progress', 'in_review', 'needs_resubmission', 'caution']);
const approvedStatuses = new Set(['approved', 'completed']);
const rejectedStatuses = new Set(['rejected']);
const needsAttentionStatuses = new Set(['needs_resubmission', 'caution']);

const getObjectId = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

const getPersonName = (value: any, fallback = 'Unassigned') => {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  const name = [value.firstName || value.fname, value.lastName || value.lname].filter(Boolean).join(' ');
  return name || value.email || fallback;
};

const getClientName = (request: MedicalReviewRequest) => {
  const artifactName = request.artifactSnapshot?.clientName;
  if (artifactName) return artifactName;
  return getPersonName(request.clientId, 'Unknown Client');
};

const getRetreatName = (request: MedicalReviewRequest) => {
  const snapshotRetreat = request.artifactSnapshot?.retreatName;
  if (snapshotRetreat) return snapshotRetreat;
  const retreat = request.retreatId as any;
  if (!retreat) return 'No retreat';
  if (typeof retreat === 'string') return `Retreat ${retreat.slice(-6)}`;
  return retreat.retreatCode || retreat.code || retreat.name || retreat.location_town || 'Retreat';
};

const getAssignedName = (request: MedicalReviewRequest) => {
  return getPersonName(request.assignedToUserId || request.medicalReviewerId || request.assignedTo, 'Unassigned');
};

const getRequestedDate = (request: MedicalReviewRequest) => {
  return request.requestedAt || request.assignedDate || request.createdAt || request.artifactSnapshot?.uploadDate;
};

const getDueDate = (request: MedicalReviewRequest) => request.dueDate || request.accessTokenExpiresAt;

const toDate = (value?: Date | string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value?: Date | string | null) => {
  const date = toDate(value);
  return date ? date.toLocaleDateString() : '-';
};

const daysSince = (value?: Date | string | null) => {
  const date = toDate(value);
  if (!date) return 0;
  return Math.floor((Date.now() - date.getTime()) / 86400000);
};

const isOverdue = (request: MedicalReviewRequest) => {
  const dueDate = toDate(getDueDate(request));
  return Boolean(dueDate && dueDate.getTime() < Date.now() && openStatuses.has(request.status));
};

const getUrgency = (request: MedicalReviewRequest): 'urgent' | 'high' | 'normal' => {
  if (request.priority === 'urgent' || isOverdue(request)) return 'urgent';
  if (request.priority === 'high' || daysSince(getRequestedDate(request)) >= 3) return 'high';
  return 'normal';
};

const getStatusTone = (status: string): BadgeTone => {
  if (approvedStatuses.has(status)) return 'success';
  if (rejectedStatuses.has(status)) return 'critical';
  if (needsAttentionStatuses.has(status)) return 'warning';
  return 'info';
};

const getStatusIcon = (status: string) => {
  if (approvedStatuses.has(status)) return <CheckCircle2 size={14} />;
  if (rejectedStatuses.has(status)) return <XCircle size={14} />;
  if (needsAttentionStatuses.has(status)) return <AlertCircle size={14} />;
  return <Clock3 size={14} />;
};

const reviewFilters: ReviewFilter[] = ['pending', 'open', 'all', 'in_review', 'needs_resubmission', 'caution', 'approved', 'rejected', 'completed'];

const urgencyBorderClass: Record<'urgent' | 'high' | 'normal', string> = {
  urgent: 'border-l-4 border-l-apple-red',
  high: 'border-l-4 border-l-apple-orange',
  normal: 'border-l-4 border-l-apple-gray-300',
};

const statTileBorderClass: Record<'open' | 'urgent' | 'attention' | 'approved' | 'rejected', string> = {
  open: 'border-l-4 border-l-apple-gray-400',
  urgent: 'border-l-4 border-l-apple-red',
  attention: 'border-l-4 border-l-apple-orange',
  approved: 'border-l-4 border-l-apple-green',
  rejected: 'border-l-4 border-l-red-800',
};

const MedicalAdvisorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMedicalAdvisor = user?.role === 'medical_advisor';
  const [requests, setRequests] = useState<MedicalReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReviewFilter>('pending');
  const [sortBy, setSortBy] = useState<'urgency' | 'requested' | 'due'>('urgency');

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await medicalReviewRequestsApi.getQueue();
      setRequests(response.data || []);
    } catch (error) {
      console.error('Error loading medical review queue:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setFilter(isMedicalAdvisor ? 'pending' : 'open');
  }, [isMedicalAdvisor]);

  const stats = useMemo(() => {
    const open = requests.filter((request) => openStatuses.has(request.status)).length;
    const overdue = requests.filter(isOverdue).length;
    const attention = requests.filter((request) => needsAttentionStatuses.has(request.status)).length;
    const approved = requests.filter((request) => approvedStatuses.has(request.status)).length;
    const rejected = requests.filter((request) => rejectedStatuses.has(request.status)).length;
    return { open, overdue, attention, approved, rejected, total: requests.length };
  }, [requests]);

  const visibleRequests = useMemo(() => {
    const filtered = requests.filter((request) => {
      if (filter === 'all') return true;
      if (filter === 'open') return openStatuses.has(request.status);
      return request.status === filter;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'requested') return (toDate(getRequestedDate(b))?.getTime() || 0) - (toDate(getRequestedDate(a))?.getTime() || 0);
      if (sortBy === 'due') return (toDate(getDueDate(a))?.getTime() || Number.MAX_SAFE_INTEGER) - (toDate(getDueDate(b))?.getTime() || Number.MAX_SAFE_INTEGER);
      const urgencyOrder = { urgent: 0, high: 1, normal: 2 };
      return urgencyOrder[getUrgency(a)] - urgencyOrder[getUrgency(b)] || daysSince(getRequestedDate(b)) - daysSince(getRequestedDate(a));
    });
  }, [filter, requests, sortBy]);

  const openRequest = (request: MedicalReviewRequest) => {
    if (!request._id) return;
    const basePath = isMedicalAdvisor ? '/medical/review-requests' : '/admin/medical-review-requests';
    navigate(`${basePath}/${request._id}`);
  };

  if (loading) {
    return <LoadingSpinner message="Loading medical review queue..." />;
  }

  const selectClasses = 'rounded-apple border border-apple-gray-200 bg-white px-3 py-2 text-sm text-apple-gray-900 focus:outline-none focus:ring-2 focus:ring-apple-blue/20 focus:border-apple-blue';

  return (
    <div className="min-h-full bg-apple-gray-50 p-6">
      <Card className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-apple-gray-900">{NAVIGATION['medical-dashboard'].label}</h1>
            <p className="mt-1 text-sm text-apple-gray-500">
              {isMedicalAdvisor
                ? 'Reviews assigned to you. Pending items first.'
                : 'Operational view of medical reviews, advisor progress, and review outcomes.'}
            </p>
          </div>
          <AppleButton variant="secondary" onClick={loadData}>
            <RefreshCw size={16} />
            Refresh
          </AppleButton>
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <button type="button" className={`rounded-apple-lg border border-apple-gray-200 bg-apple-surface p-3.5 text-left shadow-apple-sm hover:border-apple-gray-300 ${statTileBorderClass.open}`} onClick={() => setFilter('open')}>
          <span className="block text-[28px] font-extrabold leading-none text-apple-gray-900">{stats.open}</span>
          <span className="mt-2 block text-xs font-bold uppercase text-apple-gray-500">Open</span>
        </button>
        <button type="button" className={`rounded-apple-lg border border-apple-gray-200 bg-apple-surface p-3.5 text-left shadow-apple-sm hover:border-apple-gray-300 ${statTileBorderClass.urgent}`} onClick={() => setFilter('open')}>
          <span className="block text-[28px] font-extrabold leading-none text-apple-gray-900">{stats.overdue}</span>
          <span className="mt-2 block text-xs font-bold uppercase text-apple-gray-500">Overdue</span>
        </button>
        <button type="button" className={`rounded-apple-lg border border-apple-gray-200 bg-apple-surface p-3.5 text-left shadow-apple-sm hover:border-apple-gray-300 ${statTileBorderClass.attention}`} onClick={() => setFilter('needs_resubmission')}>
          <span className="block text-[28px] font-extrabold leading-none text-apple-gray-900">{stats.attention}</span>
          <span className="mt-2 block text-xs font-bold uppercase text-apple-gray-500">Need more info / Caution</span>
        </button>
        <button type="button" className={`rounded-apple-lg border border-apple-gray-200 bg-apple-surface p-3.5 text-left shadow-apple-sm hover:border-apple-gray-300 ${statTileBorderClass.approved}`} onClick={() => setFilter('approved')}>
          <span className="block text-[28px] font-extrabold leading-none text-apple-gray-900">{stats.approved}</span>
          <span className="mt-2 block text-xs font-bold uppercase text-apple-gray-500">Approved / OK</span>
        </button>
        <button type="button" className={`rounded-apple-lg border border-apple-gray-200 bg-apple-surface p-3.5 text-left shadow-apple-sm hover:border-apple-gray-300 ${statTileBorderClass.rejected}`} onClick={() => setFilter('rejected')}>
          <span className="block text-[28px] font-extrabold leading-none text-apple-gray-900">{stats.rejected}</span>
          <span className="mt-2 block text-xs font-bold uppercase text-apple-gray-500">Declined / Not OK</span>
        </button>
      </div>

      <Card className="mb-3" padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="hidden flex-wrap gap-2 md:flex">
            {reviewFilters.map((status) => (
              <AppleButton
                key={status}
                size="sm"
                variant={filter === status ? 'primary' : 'secondary'}
                className="capitalize"
                onClick={() => setFilter(status)}
              >
                {status.replace(/_/g, ' ')}
              </AppleButton>
            ))}
          </div>
          <label className="flex flex-col gap-1.5 text-xs font-bold text-apple-gray-600 md:hidden">
            <span>View</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value as ReviewFilter)} className={selectClasses}>
              {reviewFilters.map((status) => (
                <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-bold text-apple-gray-600">
            <span>Sort</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className={selectClasses}>
              <option value="urgency">Urgency</option>
              <option value="requested">Newest requested</option>
              <option value="due">Due date</option>
            </select>
          </label>
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        {visibleRequests.length === 0 ? (
          <Card>
            <EmptyState
              icon={<FileText size={28} />}
              title={isMedicalAdvisor && filter === 'pending'
                ? `You are all caught up ${user?.firstName || ''}`.trim()
                : 'No medical review requests match this view.'}
            />
          </Card>
        ) : (
          visibleRequests.map((request) => {
            const urgency = getUrgency(request);
            const requestedDays = daysSince(getRequestedDate(request));
            return (
              <button
                type="button"
                key={request._id || `${getObjectId(request.clientId)}:${request.display_id}`}
                className={`grid w-full grid-cols-[36px_minmax(0,1fr)] items-center gap-3.5 rounded-apple-lg border border-apple-gray-200 bg-apple-surface p-3.5 text-left shadow-apple-sm hover:border-apple-gray-300 hover:bg-apple-gray-50/40 sm:grid-cols-[44px_minmax(0,1fr)_auto] ${urgencyBorderClass[urgency]}`}
                onClick={() => openRequest(request)}
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-apple bg-indigo-50 text-indigo-800">
                  <FileText size={22} />
                </span>
                <span className="flex min-w-0 flex-col gap-1.5">
                  <span className="flex min-w-0 items-center gap-2.5 text-base text-apple-gray-900">
                    <strong className="truncate font-bold">#{request.display_id || request._id?.slice(-6)}</strong>
                    <span className="truncate font-bold">{getClientName(request)}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2.5 text-xs font-semibold capitalize text-apple-gray-500">
                    <MedicalReviewTypeBadge requestType={request.requestType || request.documentType || request.artifactSnapshot?.documentType} />
                    <span>{getRetreatName(request)}</span>
                    {!isMedicalAdvisor && (
                      <span className="inline-flex items-center gap-1">
                        <UserCheck size={13} />
                        {getAssignedName(request)}
                      </span>
                    )}
                  </span>
                  <span className="flex flex-wrap gap-2.5 text-xs font-semibold capitalize text-apple-gray-500">
                    <span>Requested {requestedDays === 0 ? 'today' : `${requestedDays}d ago`}</span>
                    <span>Due {formatDate(getDueDate(request))}</span>
                    {request.reviewedAt && <span>Reviewed {formatDate(request.reviewedAt)}</span>}
                  </span>
                </span>
                <span className="col-span-full flex items-center justify-between gap-1.5 sm:col-span-1 sm:flex-col sm:items-end">
                  <Badge tone={getStatusTone(request.status)} className="capitalize">
                    {getStatusIcon(request.status)}
                    {request.status.replace(/_/g, ' ')}
                  </Badge>
                  {urgency === 'urgent' && <Badge tone="critical">Urgent</Badge>}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MedicalAdvisorDashboard;
