import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock3, FileText, RefreshCw, UserCheck, XCircle } from 'lucide-react';
import { medicalReviewRequestsApi } from '../services/api';
import { MedicalReviewRequest } from '../types';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import './MedicalAdvisorDashboard.css';

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

const getReviewType = (request: MedicalReviewRequest) => {
  const type = request.requestType || request.documentType || request.artifactSnapshot?.documentType || 'medical review';
  return String(type).replace(/_/g, ' ');
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

const getStatusClass = (status: string) => {
  if (approvedStatuses.has(status)) return 'medical-status approved';
  if (rejectedStatuses.has(status)) return 'medical-status rejected';
  if (needsAttentionStatuses.has(status)) return 'medical-status attention';
  return 'medical-status open';
};

const getStatusIcon = (status: string) => {
  if (approvedStatuses.has(status)) return <CheckCircle2 size={18} />;
  if (rejectedStatuses.has(status)) return <XCircle size={18} />;
  if (needsAttentionStatuses.has(status)) return <AlertCircle size={18} />;
  return <Clock3 size={18} />;
};

const MedicalAdvisorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMedicalAdvisor = user?.role === 'medical_advisor';
  const [requests, setRequests] = useState<MedicalReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReviewFilter>('open');
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

  return (
    <div className="medical-dashboard">
      <div className="medical-dashboard-header">
        <div>
          <h1>{isMedicalAdvisor ? 'Medical Review Queue' : 'Medical Dashboard'}</h1>
          <p>
            {isMedicalAdvisor
              ? 'Reviews assigned to you, sorted by urgency.'
              : 'Operational view of medical reviews, advisor progress, and review outcomes.'}
          </p>
        </div>
        <button type="button" onClick={loadData} className="medical-refresh-button">
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="medical-stat-grid">
        <button type="button" className="medical-stat-card" onClick={() => setFilter('open')}>
          <span className="medical-stat-value">{stats.open}</span>
          <span className="medical-stat-label">Open</span>
        </button>
        <button type="button" className="medical-stat-card urgent" onClick={() => setFilter('open')}>
          <span className="medical-stat-value">{stats.overdue}</span>
          <span className="medical-stat-label">Overdue</span>
        </button>
        <button type="button" className="medical-stat-card attention" onClick={() => setFilter('needs_resubmission')}>
          <span className="medical-stat-value">{stats.attention}</span>
          <span className="medical-stat-label">Needs Info / Caution</span>
        </button>
        <button type="button" className="medical-stat-card approved" onClick={() => setFilter('approved')}>
          <span className="medical-stat-value">{stats.approved}</span>
          <span className="medical-stat-label">Approved</span>
        </button>
        <button type="button" className="medical-stat-card rejected" onClick={() => setFilter('rejected')}>
          <span className="medical-stat-value">{stats.rejected}</span>
          <span className="medical-stat-label">Denied</span>
        </button>
      </div>

      <div className="medical-dashboard-controls">
        <div className="medical-filter-tabs">
          {(['open', 'all', 'pending', 'in_review', 'needs_resubmission', 'caution', 'approved', 'rejected', 'completed'] as ReviewFilter[]).map((status) => (
            <button
              key={status}
              type="button"
              className={filter === status ? 'active' : ''}
              onClick={() => setFilter(status)}
            >
              {status.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <label className="medical-sort-control">
          <span>Sort</span>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
            <option value="urgency">Urgency</option>
            <option value="requested">Newest requested</option>
            <option value="due">Due date</option>
          </select>
        </label>
      </div>

      <div className="medical-review-list">
        {visibleRequests.length === 0 ? (
          <div className="medical-empty-state">
            <FileText size={28} />
            <p>No medical review requests match this view.</p>
          </div>
        ) : (
          visibleRequests.map((request) => {
            const urgency = getUrgency(request);
            const requestedDays = daysSince(getRequestedDate(request));
            return (
              <button
                type="button"
                key={request._id || `${getObjectId(request.clientId)}:${request.display_id}`}
                className={`medical-review-card urgency-${urgency}`}
                onClick={() => openRequest(request)}
              >
                <span className="medical-review-icon">
                  <FileText size={22} />
                </span>
                <span className="medical-review-main">
                  <span className="medical-review-title">
                    <strong>#{request.display_id || request._id?.slice(-6)}</strong>
                    <span>{getClientName(request)}</span>
                  </span>
                  <span className="medical-review-meta">
                    <span>{getReviewType(request)}</span>
                    <span>{getRetreatName(request)}</span>
                    {!isMedicalAdvisor && (
                      <span className="medical-assignee">
                        <UserCheck size={13} />
                        {getAssignedName(request)}
                      </span>
                    )}
                  </span>
                  <span className="medical-review-dates">
                    <span>Requested {requestedDays === 0 ? 'today' : `${requestedDays}d ago`}</span>
                    <span>Due {formatDate(getDueDate(request))}</span>
                    {request.reviewedAt && <span>Reviewed {formatDate(request.reviewedAt)}</span>}
                  </span>
                </span>
                <span className="medical-review-side">
                  <span className={getStatusClass(request.status)}>
                    {getStatusIcon(request.status)}
                    {request.status.replace(/_/g, ' ')}
                  </span>
                  {urgency === 'urgent' && <span className="medical-urgency-pill">Urgent</span>}
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
