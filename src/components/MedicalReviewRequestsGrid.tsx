import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiChevronDown, FiChevronRight, FiCopy, FiEye, FiEdit2, FiFolder, FiLink, FiPlus, FiRefreshCw, FiTrash2, FiX } from 'react-icons/fi';
import LoadingSpinner from './LoadingSpinner';
import MedicalReviewTypeBadge from './MedicalReviewTypeBadge';
import { medicalReviewRequestsApi, medicalTrackingApi, clientsApi, retreatsApi } from '../services/api';
import { MedicalItem, MedicalReviewGroup, MedicalReviewRequest, Client, Retreat } from '../types';
import { useAuth } from '../context/AuthContext';
import { usersApi, User } from '../services/usersApi';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => <IconComponent className={className} />;

interface EnrichedReviewRequest extends MedicalReviewRequest {
  clientName?: string;
  retreatName?: string;
  trackingFileName?: string;
}

const getRetreatCode = (retreat?: Retreat) => {
  if (!retreat) return 'Unknown Retreat';
  return retreat.retreatCode || retreat.code || retreat.name || 'Unknown Retreat';
};

const getAssignee = (request: MedicalReviewRequest) => {
  const assignedUser = typeof request.assignedToUserId === 'object' && request.assignedToUserId
    ? request.assignedToUserId
    : null;
  const name = assignedUser
    ? [assignedUser.firstName, assignedUser.lastName].filter(Boolean).join(' ') || assignedUser.email
    : request.assignedTo || request.medicalReviewerName || '';
  const email = assignedUser?.email || request.assignedToEmail || '';

  return {
    name: name || 'Unassigned',
    email,
  };
};

const getAssigneeId = (request: MedicalReviewRequest) => {
  if (!request.assignedToUserId) return '';
  if (typeof request.assignedToUserId === 'string') return request.assignedToUserId;
  return request.assignedToUserId._id || request.assignedToUserId.id || '';
};

const getRequestId = (request: MedicalReviewRequest) => request._id || '';

const getRequestRetreatId = (request: MedicalReviewRequest) => (
  typeof request.retreatId === 'string' ? request.retreatId : request.retreatId?._id
);

const getCompactDisplayName = (name?: string) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Unknown client';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
};

const statusClass: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  caution: 'bg-amber-100 text-amber-800',
  needs_resubmission: 'bg-orange-100 text-orange-800',
  completed: 'bg-gray-100 text-gray-800',
};

const MedicalReviewRequestsGrid: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const basePath = location.pathname.startsWith('/medical') ? '/medical/review-requests' : '/admin/medical-review-requests';
  const canManageRequests = user?.role === 'admin' || user?.role === 'medical_staff';
  const [requests, setRequests] = useState<EnrichedReviewRequest[]>([]);
  const [groups, setGroups] = useState<MedicalReviewGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | MedicalReviewRequest['status']>('all');
  const [filterAdvisorId, setFilterAdvisorId] = useState('all');
  const [advisors, setAdvisors] = useState<User[]>([]);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupReviewerUserId, setGroupReviewerUserId] = useState('');
  const [groupType, setGroupType] = useState<'retreat' | 'ceremony' | 'custom'>('retreat');
  const [groupCeremonyNumber, setGroupCeremonyNumber] = useState('');
  const [selectedGroupRequestIds, setSelectedGroupRequestIds] = useState<string[]>([]);
  const [createdGroupUrl, setCreatedGroupUrl] = useState('');
  const [groupError, setGroupError] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [requestsResponse, trackingResponse, clientsResponse, retreatsResponse, groupsResponse] = await Promise.all([
        medicalReviewRequestsApi.getAll(),
        medicalTrackingApi.getAll(),
        clientsApi.getAll(),
        retreatsApi.getAll(),
        medicalReviewRequestsApi.getGroups().catch(() => ({ data: [] })),
      ]);

      const trackingMapValue = (trackingResponse.data || []).reduce((acc: Record<string, MedicalItem>, item: MedicalItem) => {
        if (item._id) acc[item._id] = item;
        return acc;
      }, {});

      const clientMapValue = (clientsResponse.data || []).reduce((acc: Record<string, Client>, client: Client) => {
        if (client._id) acc[client._id] = client;
        return acc;
      }, {});

      const retreatMapValue = (retreatsResponse.data || []).reduce((acc: Record<string, Retreat>, retreat: Retreat) => {
        if (retreat._id) acc[retreat._id] = retreat;
        return acc;
      }, {});

      const enriched = (requestsResponse.data || []).map((request: MedicalReviewRequest) => {
        const clientId = typeof request.clientId === 'string' ? request.clientId : request.clientId?._id;
        const retreatId = typeof request.retreatId === 'string' ? request.retreatId : request.retreatId?._id;
        const trackingId = typeof request.medicalTrackingId === 'string' ? request.medicalTrackingId : request.medicalTrackingId?._id;
        const client = clientId ? clientMapValue[clientId] : undefined;
        const retreat = retreatId ? retreatMapValue[retreatId] : undefined;
        const tracking = trackingId ? trackingMapValue[trackingId] : undefined;
        return {
          ...request,
          clientName: client ? `${client.firstName} ${client.lastName}` : 'Unknown Client',
          retreatName: getRetreatCode(retreat),
          trackingFileName: tracking?.ekgFileName || tracking?.liverPanelFileName || undefined,
        };
      });

      setRequests(enriched);
      setGroups((groupsResponse.data || []).map((group: MedicalReviewGroup) => ({
        ...group,
        requests: group.requests || [],
      })));
    } catch (error) {
      console.error('Error loading medical review requests:', error);
      setRequests([]);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!canManageRequests) return;
    usersApi.getAll()
      .then((response) => {
        const activeAdvisors = (response.data || []).filter((advisor) => advisor.role === 'medical_advisor' && advisor.isActive !== false);
        setAdvisors(activeAdvisors);
      })
      .catch(() => setAdvisors([]));
  }, [canManageRequests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      if (filterStatus !== 'all' && request.status !== filterStatus) return false;
      if (filterAdvisorId !== 'all' && getAssigneeId(request) !== filterAdvisorId) return false;
      return true;
    });
  }, [requests, filterAdvisorId, filterStatus]);

  const requestById = useMemo(() => new Map(filteredRequests.map((request) => [getRequestId(request), request])), [filteredRequests]);
  const groupedRequestIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of groups) {
      for (const requestId of group.reviewRequestIds || []) {
        if (requestId) ids.add(requestId);
      }
    }
    return ids;
  }, [groups]);
  const requestGroupMap = useMemo(() => {
    const map = new Map<string, MedicalReviewGroup>();
    for (const group of groups) {
      for (const requestId of group.reviewRequestIds || []) {
        if (requestId && !map.has(requestId)) {
          map.set(requestId, group);
        }
      }
    }
    return map;
  }, [groups]);
  const groupedRows = useMemo(() => {
    const rows: Array<{ kind: 'group'; group: MedicalReviewGroup; requests: EnrichedReviewRequest[] } | { kind: 'request'; request: EnrichedReviewRequest }> = [];
    const seen = new Set<string>();

    for (const group of groups) {
      const groupRequests = (group.reviewRequestIds || [])
        .map((requestId) => requestById.get(requestId))
        .filter((request): request is EnrichedReviewRequest => Boolean(request));

      if (!groupRequests.length) continue;

      rows.push({ kind: 'group', group, requests: groupRequests });
      groupRequests.forEach((request) => {
        const requestId = getRequestId(request);
        if (requestId) seen.add(requestId);
        rows.push({ kind: 'request', request });
      });
    }

    filteredRequests.forEach((request) => {
      const requestId = getRequestId(request);
      if (requestId && !seen.has(requestId) && !groupedRequestIds.has(requestId)) {
        rows.push({ kind: 'request', request });
      }
    });

    return rows;
  }, [filteredRequests, groups, groupedRequestIds, requestById]);
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);

  useEffect(() => {
      setExpandedGroupIds((current) => {
      const groupIds = groups.map((group) => group._id).filter((id): id is string => Boolean(id));
      if (!groupIds.length) return current;
      const next = new Set(current);
      groupIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  }, [groups]);

  const openGroupPacket = (groupId?: string) => {
    if (!groupId) return;
    navigate(location.pathname.startsWith('/medical') ? `/medical/review-groups/${groupId}` : `/admin/medical-review-groups/${groupId}`);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this review request?')) return;
    await medicalReviewRequestsApi.delete(id);
    await loadData();
  };

  const openGroupModal = () => {
    const visibleIds = filteredRequests.map(getRequestId).filter(Boolean);
    setSelectedGroupRequestIds(visibleIds);
    setGroupReviewerUserId(advisors[0]?._id || '');
    setGroupTitle('');
      setGroupType('retreat');
      setGroupCeremonyNumber('');
      setCreatedGroupUrl('');
      setGroupError('');
    setGroupModalOpen(true);
  };

  const selectedGroupRequests = useMemo(
    () => requests.filter((request) => selectedGroupRequestIds.includes(getRequestId(request))),
    [requests, selectedGroupRequestIds]
  );

  const renderRequestActions = (request: EnrichedReviewRequest) => (
    <div className="flex items-center gap-2">
      <button
        onClick={() => navigate(`${basePath}/${request._id}`)}
        className="icon-action-btn icon-action-btn-view"
        title="View"
      >
        <Icon icon={FiEye} />
      </button>
      {canManageRequests && (
        <button
          onClick={() => navigate(`${basePath}/${request._id}/edit`)}
          className="icon-action-btn icon-action-btn-edit"
          title="Edit"
        >
          <Icon icon={FiEdit2} />
        </button>
      )}
    </div>
  );

  const inferredRetreatId = useMemo(() => {
    const retreatIds = Array.from(new Set(selectedGroupRequests.map(getRequestRetreatId).filter(Boolean)));
    return retreatIds.length === 1 ? retreatIds[0] : undefined;
  }, [selectedGroupRequests]);

  const toggleGroupRequest = (id: string) => {
    setSelectedGroupRequestIds((current) => (
      current.includes(id)
        ? current.filter((existingId) => existingId !== id)
        : [...current, id]
    ));
  };

  const createGroup = async () => {
    setGroupError('');
    setCreatedGroupUrl('');
    if (!groupReviewerUserId) {
      setGroupError('Select a medical advisor.');
      return;
    }
    if (!selectedGroupRequestIds.length) {
      setGroupError('Select at least one request.');
      return;
    }
    try {
      setCreatingGroup(true);
      const response = await medicalReviewRequestsApi.createGroup({
        title: groupTitle.trim() || undefined,
        groupType,
        retreatId: inferredRetreatId,
        ceremonyNumber: groupType === 'ceremony' && groupCeremonyNumber ? Number(groupCeremonyNumber) : undefined,
        reviewRequestIds: selectedGroupRequestIds,
        reviewerUserId: groupReviewerUserId,
      });
      setCreatedGroupUrl(response.data.url || '');
    } catch (requestError: any) {
      setGroupError(requestError?.response?.data?.message || requestError?.message || 'Unable to create grouped review link.');
    } finally {
      setCreatingGroup(false);
    }
  };

  const copyGroupUrl = async () => {
    if (!createdGroupUrl) return;
    try {
      await navigator.clipboard.writeText(createdGroupUrl);
    } catch (error) {
      window.prompt('Copy grouped review link', createdGroupUrl);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading medical review requests..." />;
  }

  return (
    <div className="p-6 h-full">
      <div className="mb-6 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-gray-900">Medical Review Requests</h1>
          <p className="text-sm text-gray-600">Queue and audit trail for EKG and liver panel review rounds.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="inline-flex w-auto shrink-0 items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Icon icon={FiRefreshCw} className="h-4 w-4" />
            Refresh
          </button>
          {canManageRequests && (
            <>
              <button
                onClick={openGroupModal}
                className="inline-flex w-auto shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
              >
                <Icon icon={FiLink} className="h-4 w-4" />
                Group Link
              </button>
              <button
                onClick={() => navigate(`${basePath}/new`)}
                className="inline-flex w-auto shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                <Icon icon={FiPlus} className="h-4 w-4" />
                Add New Request
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center justify-end gap-2">
        <label htmlFor="review-status-filter" className="text-sm font-medium text-gray-700">Status</label>
        <select
          id="review-status-filter"
          value={filterStatus}
          onChange={(event) => setFilterStatus(event.target.value as typeof filterStatus)}
          className="w-full max-w-xs rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {(['all', 'pending', 'in_review', 'approved', 'rejected', 'caution', 'needs_resubmission', 'completed'] as const).map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        {canManageRequests && (
          <>
            <label htmlFor="review-advisor-filter" className="text-sm font-medium text-gray-700">Advisor</label>
            <select
              id="review-advisor-filter"
              value={filterAdvisorId}
              onChange={(event) => setFilterAdvisorId(event.target.value)}
              className="w-full max-w-xs rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All advisors</option>
              <option value="">Unassigned</option>
              {advisors.map((advisor) => (
                <option key={advisor._id} value={advisor._id}>
                  {[advisor.firstName, advisor.lastName].filter(Boolean).join(' ') || advisor.email}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      <div className="space-y-3 md:hidden">
        {filteredRequests.map((request) => {
          const group = request._id ? requestGroupMap.get(request._id) : undefined;
          const isGrouped = Boolean(group);
          return (
            <div key={`mobile-${request._id}`} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => navigate(`${basePath}/${request._id}`)}
                    className="text-left text-lg font-semibold text-blue-700 hover:underline"
                  >
                    #{request.display_id || '—'}
                  </button>
                  <div className="mt-1 text-sm font-medium text-gray-900">{getCompactDisplayName(request.clientName)}</div>
                  <div className="text-xs text-gray-500">{request.retreatName}</div>
                  {isGrouped && group?._id && (
                    <button
                      type="button"
                      onClick={() => openGroupPacket(group._id)}
                      className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700"
                    >
                      <Icon icon={FiFolder} className="h-3.5 w-3.5" />
                      Packet: {group.title}
                    </button>
                  )}
                </div>
                <div className="shrink-0">{renderRequestActions(request)}</div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <MedicalReviewTypeBadge requestType={request.requestType} />
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusClass[request.status] || 'bg-gray-100 text-gray-700'}`}>
                  {request.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Request #</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Retreat</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Attempt</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Assignee</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {groupedRows.map((row) => {
                if (row.kind === 'group') {
                  const groupId = row.group._id || row.group.title;
                  const expanded = expandedGroupIds.includes(groupId);
                  return (
                    <React.Fragment key={`group-${groupId}`}>
                      <tr className="bg-slate-50">
                        <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setExpandedGroupIds((current) => (
                                current.includes(groupId)
                                  ? current.filter((id) => id !== groupId)
                                  : [...current, groupId]
                              ))}
                              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100"
                              title={expanded ? 'Collapse group' : 'Expand group'}
                            >
                              <Icon icon={expanded ? FiChevronDown : FiChevronRight} className="h-4 w-4" />
                            </button>
                            <Icon icon={FiFolder} className="h-4 w-4 text-blue-600" />
                            <span>{row.group.title}</span>
                          </div>
                          <div className="mt-1 text-xs font-normal text-slate-500">
                            {row.group.retreatName || 'No retreat'}{row.group.ceremonyNumber ? ` • Ceremony #${row.group.ceremonyNumber}` : ''} • {row.requests.length} requests
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700" colSpan={8}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">Grouped packet</span>
                            {row.group.reviewerName && <span className="text-xs text-slate-500">Advisor: {row.group.reviewerName}</span>}
                            {row.group.url && (
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(row.group.url || '').catch(() => window.prompt('Copy link', row.group.url || ''))}
                                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                              >
                                <Icon icon={FiCopy} className="h-3.5 w-3.5" />
                                Copy link
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => navigate(location.pathname.startsWith('/medical') ? `/medical/review-groups/${row.group._id}` : `/admin/medical-review-groups/${row.group._id}`)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Open packet
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded && row.requests.map((request) => (
                        <tr key={request._id} className="bg-white hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-semibold text-blue-600">
                            <div className="flex items-center gap-2 pl-6">
                              <span className="text-slate-400">↳</span>
                              #{request.display_id || '—'}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {request.clientName}
                            <div className="text-xs text-gray-500">#{request.clientDisplayId || '—'}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{request.retreatName}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <MedicalReviewTypeBadge requestType={request.requestType} />
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{request.attemptNumber || 1}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="font-medium">{getAssignee(request).name}</div>
                            {getAssignee(request).email && <div className="text-xs text-gray-500">{getAssignee(request).email}</div>}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusClass[request.status] || 'bg-gray-100 text-gray-700'}`}>
                              {request.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{request.source || 'Provider Plus CRM'}</td>
                          <td className="px-6 py-4 text-sm font-medium">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => navigate(`${basePath}/${request._id}`)}
                                className="icon-action-btn icon-action-btn-view"
                                title="View"
                              >
                                <Icon icon={FiEye} />
                              </button>
                              {canManageRequests && (
                                <button
                                  onClick={() => navigate(`${basePath}/${request._id}/edit`)}
                                  className="icon-action-btn icon-action-btn-edit"
                                  title="Edit"
                                >
                                  <Icon icon={FiEdit2} />
                                </button>
                              )}
                              {canManageRequests && (
                                <button
                                  onClick={() => handleDelete(request._id!)}
                                  className="icon-action-btn icon-action-btn-danger"
                                  title="Delete"
                                >
                                  <Icon icon={FiTrash2} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                }
                const request = row.request;
                return (
                  <tr key={request._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-semibold text-blue-600">#{request.display_id || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {request.clientName}
                    <div className="text-xs text-gray-500">#{request.clientDisplayId || '—'}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{request.retreatName}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <MedicalReviewTypeBadge requestType={request.requestType} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{request.attemptNumber || 1}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="font-medium">{getAssignee(request).name}</div>
                    {getAssignee(request).email && <div className="text-xs text-gray-500">{getAssignee(request).email}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusClass[request.status] || 'bg-gray-100 text-gray-700'}`}>
                      {request.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{request.source || 'Provider Plus CRM'}</td>
                  <td className="px-6 py-4 text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`${basePath}/${request._id}`)}
                        className="icon-action-btn icon-action-btn-view"
                        title="View"
                      >
                        <Icon icon={FiEye} />
                      </button>
                      {canManageRequests && (
                        <button
                          onClick={() => navigate(`${basePath}/${request._id}/edit`)}
                          className="icon-action-btn icon-action-btn-edit"
                          title="Edit"
                        >
                          <Icon icon={FiEdit2} />
                        </button>
                      )}
                      {canManageRequests && (
                        <button
                          onClick={() => handleDelete(request._id!)}
                          className="icon-action-btn icon-action-btn-danger"
                          title="Delete"
                        >
                          <Icon icon={FiTrash2} />
                        </button>
                      )}
                    </div>
                  </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {groupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Create Grouped Review Link</h2>
                <p className="mt-1 text-sm text-gray-600">Send one packet link while keeping each medical review request separate.</p>
              </div>
              <button
                type="button"
                onClick={() => setGroupModalOpen(false)}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                title="Close"
              >
                <Icon icon={FiX} className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(90vh-150px)] overflow-y-auto px-5 py-4">
              {groupError && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{groupError}</div>
              )}
              {createdGroupUrl && (
                <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3">
                  <div className="text-sm font-semibold text-green-800">Grouped review link created</div>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={createdGroupUrl}
                      readOnly
                      className="min-w-0 flex-1 rounded-md border border-green-200 bg-white px-3 py-2 text-sm text-gray-800"
                    />
                    <button
                      type="button"
                      onClick={copyGroupUrl}
                      className="inline-flex items-center gap-2 rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800"
                    >
                      <Icon icon={FiCopy} className="h-4 w-4" />
                      Copy
                    </button>
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Title</span>
                  <input
                    value={groupTitle}
                    onChange={(event) => setGroupTitle(event.target.value)}
                    placeholder="JNO medical review packet"
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Medical advisor</span>
                  <select
                    value={groupReviewerUserId}
                    onChange={(event) => setGroupReviewerUserId(event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Select advisor</option>
                    {advisors.map((advisor) => (
                      <option key={advisor._id} value={advisor._id}>
                        {[advisor.firstName, advisor.lastName].filter(Boolean).join(' ') || advisor.email}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Group type</span>
                  <select
                    value={groupType}
                    onChange={(event) => setGroupType(event.target.value as typeof groupType)}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="retreat">Retreat</option>
                    <option value="ceremony">Ceremony</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                {groupType === 'ceremony' && (
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Ceremony #</span>
                    <input
                      type="number"
                      min="1"
                      value={groupCeremonyNumber}
                      onChange={(event) => setGroupCeremonyNumber(event.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                )}
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-800">Requests in packet ({selectedGroupRequestIds.length})</div>
                  <div className="flex gap-2 text-xs">
                    <button type="button" onClick={() => setSelectedGroupRequestIds(filteredRequests.map(getRequestId).filter(Boolean))} className="text-blue-700 hover:underline">Select visible</button>
                    <button type="button" onClick={() => setSelectedGroupRequestIds([])} className="text-gray-600 hover:underline">Clear</button>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-md border border-gray-200">
                  {filteredRequests.map((request) => {
                    const id = getRequestId(request);
                    return (
                      <label key={id} className="flex cursor-pointer items-start gap-3 border-b border-gray-100 px-3 py-3 last:border-b-0 hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={selectedGroupRequestIds.includes(id)}
                          onChange={() => toggleGroupRequest(id)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
                        />
                        <span className="min-w-0 text-sm">
                          <span className="font-semibold text-gray-900">#{request.display_id || '-'}</span>
                          <span className="ml-2 text-gray-900">{request.clientName}</span>
                          <span className="ml-2 text-gray-500">{request.retreatName}</span>
                          <span className="ml-2 inline-flex align-middle">
                            <MedicalReviewTypeBadge requestType={request.requestType} />
                          </span>
                        </span>
                      </label>
                    );
                  })}
                  {!filteredRequests.length && (
                    <div className="px-3 py-6 text-center text-sm text-gray-500">No requests match the current filter.</div>
                  )}
                </div>
                {!inferredRetreatId && selectedGroupRequestIds.length > 0 && groupType !== 'custom' && (
                  <div className="mt-2 text-xs text-amber-700">Selected requests span multiple retreats, so this packet will not be attached to one retreat.</div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setGroupModalOpen(false)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createGroup}
                disabled={creatingGroup}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingGroup ? 'Creating...' : 'Create Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalReviewRequestsGrid;
