import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiChevronDown, FiChevronRight, FiCopy, FiEye, FiEdit2, FiFolder, FiLink, FiLock, FiMenu, FiPlus, FiRefreshCw, FiSearch, FiSend, FiTrash2, FiUnlock, FiX, FiZap } from 'react-icons/fi';
import LoadingSpinner from './LoadingSpinner';
import MedicalReviewTypeBadge from './MedicalReviewTypeBadge';
import { medicalReviewRequestsApi, medicalTrackingApi, clientsApi, retreatsApi } from '../services/api';
import { MedicalItem, MedicalReviewGroup, MedicalReviewRequest, Client, Retreat } from '../types';
import { useAuth } from '../context/AuthContext';
import { usersApi, User } from '../services/usersApi';
import { MedicalReviewTypeFilter, getReviewRequestFilterText, matchesReviewRequestFilters } from './MedicalReviewRequestsGrid.helpers';
import ResponsiveModal from './ResponsiveModal';

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

const toDateInputValue = (value?: string | Date) => {
  if (!value) return '';
  if (typeof value === 'string') {
    const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateOnly) return dateOnly[1];
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const getRetreatEndDate = (retreat?: Retreat) => toDateInputValue(retreat?.endDate || retreat?.dates?.endDate);

const parseLocalPacketDate = (value?: string | Date) => {
  const dateOnly = toDateInputValue(value);
  if (!dateOnly) return undefined;
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatPacketEndDate = (value?: string | Date) => {
  const date = parseLocalPacketDate(value);
  return date ? `Ends ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : 'No end date';
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

const getGroupRetreatId = (group: MedicalReviewGroup) => (
  typeof group.retreatId === 'string' ? group.retreatId : group.retreatId?._id
);

type ConfirmAction =
  | { kind: 'delete-group'; groupId: string; title: string; message: string }
  | { kind: 'remove-request'; groupId: string; requestId: string; title: string; message: string };

const getClientGridLabel = (request: EnrichedReviewRequest) => (
  `${request.clientDisplayId ? `#${request.clientDisplayId} ` : ''}${request.clientName || 'Unknown client'}`
);

const statusClass: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  caution: 'bg-amber-100 text-amber-800',
  needs_resubmission: 'bg-orange-100 text-orange-800',
  completed: 'bg-gray-100 text-gray-800',
};

const normalizeReviewStatus = (value?: string) => String(value || '').trim().toLowerCase();
const isPendingReview = (request: MedicalReviewRequest) => normalizeReviewStatus(request.status) === 'pending';

const MedicalReviewRequestsGrid: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const basePath = location.pathname.startsWith('/medical') ? '/medical/review-requests' : '/admin/medical-review-requests';
  const canManageRequests = user?.role === 'admin' || user?.role === 'medical_staff';
  const canDeleteRequests = user?.role === 'admin';
  const [requests, setRequests] = useState<EnrichedReviewRequest[]>([]);
  const [groups, setGroups] = useState<MedicalReviewGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<MedicalReviewTypeFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | MedicalReviewRequest['status']>('all');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [filterAdvisorId, setFilterAdvisorId] = useState('all');
  const [activeView, setActiveView] = useState<'grouped' | 'all'>('grouped');
  const [advisors, setAdvisors] = useState<User[]>([]);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupReviewerUserId, setGroupReviewerUserId] = useState('');
  const [groupType, setGroupType] = useState<'retreat' | 'ceremony' | 'custom'>('retreat');
  const [groupCeremonyNumber, setGroupCeremonyNumber] = useState('');
  const [groupRetreatId, setGroupRetreatId] = useState('');
  const [groupEndDate, setGroupEndDate] = useState('');
  const [selectedGroupRequestIds, setSelectedGroupRequestIds] = useState<string[]>([]);
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  const [createdGroupUrl, setCreatedGroupUrl] = useState('');
  const [groupError, setGroupError] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState('');
  const [editingGroupTitle, setEditingGroupTitle] = useState('');
  const [editingGroupEndDate, setEditingGroupEndDate] = useState('');
  const [editingGroupType, setEditingGroupType] = useState<'retreat' | 'ceremony' | 'custom'>('retreat');
  const [editingGroupRetreatId, setEditingGroupRetreatId] = useState('');
  const [editingGroupCeremonyNumber, setEditingGroupCeremonyNumber] = useState('');
  const [editingGroupReviewerUserId, setEditingGroupReviewerUserId] = useState('');
  const [editingGroupRequestIds, setEditingGroupRequestIds] = useState<string[]>([]);
  const [editingGroupSearch, setEditingGroupSearch] = useState('');
  const [editingGroupSaving, setEditingGroupSaving] = useState(false);
  const [packetAddGroupId, setPacketAddGroupId] = useState('');
  const [packetAddModalOpen, setPacketAddModalOpen] = useState(false);
  const [packetAddSearchTerm, setPacketAddSearchTerm] = useState('');
  const [packetAddSelectedIds, setPacketAddSelectedIds] = useState<string[]>([]);
  const [packetAddSaving, setPacketAddSaving] = useState(false);
  const [retreatOptions, setRetreatOptions] = useState<Retreat[]>([]);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmSaving, setConfirmSaving] = useState(false);
  const [draggedGroupId, setDraggedGroupId] = useState('');
  const [draggedOverGroupId, setDraggedOverGroupId] = useState('');
  const [groupReorderSaving, setGroupReorderSaving] = useState(false);
  const [groupOrderUnlocked, setGroupOrderUnlocked] = useState(false);
  const [packetAssignmentUnlocked, setPacketAssignmentUnlocked] = useState(false);
  const [draggedRequestId, setDraggedRequestId] = useState('');
  const [draggedRequestSourceGroupId, setDraggedRequestSourceGroupId] = useState('');
  const [draggedOverPacketId, setDraggedOverPacketId] = useState('');
  const [packetMoveSaving, setPacketMoveSaving] = useState(false);
  const [packetMoveMessage, setPacketMoveMessage] = useState('');
  const [autoAssignSaving, setAutoAssignSaving] = useState(false);
  const [autoAssignMessage, setAutoAssignMessage] = useState('');

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
          clientDisplayId: request.clientDisplayId || client?.display_id,
          retreatName: getRetreatCode(retreat),
          trackingFileName: tracking?.ekgFileName || tracking?.liverPanelFileName || undefined,
        };
      });

      setRequests(enriched);
      setRetreatOptions(retreatsResponse.data || []);
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
    const filtered = requests.filter((request) => {
      if (!matchesReviewRequestFilters(request, { searchTerm, typeFilter, dateFrom, dateTo })) return false;
      if (filterStatus !== 'all' && normalizeReviewStatus(request.status) !== filterStatus) return false;
      if (pendingOnly && !isPendingReview(request)) return false;
      if (filterAdvisorId !== 'all' && getAssigneeId(request) !== filterAdvisorId) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      const date = (request: MedicalReviewRequest) => new Date(request.requestedAt || request.createdAt || request.assignedDate || 0).getTime() || 0;
      return (isPendingReview(b) ? 0 : 1) - (isPendingReview(a) ? 0 : 1)
        || date(b) - date(a)
        || Number(b.display_id || 0) - Number(a.display_id || 0);
    });
  }, [dateFrom, dateTo, filterAdvisorId, filterStatus, pendingOnly, requests, searchTerm, typeFilter]);

  const groupedRequestIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of groups) {
      for (const requestId of group.reviewRequestIds || []) {
        if (requestId) ids.add(requestId);
      }
    }
    return ids;
  }, [groups]);

  const requestById = useMemo(() => new Map(filteredRequests.map((request) => [getRequestId(request), request])), [filteredRequests]);

  const visibleGroups = useMemo(() => {
    return groups
      .map((group) => {
        const requestsForGroup = (group.reviewRequestIds || [])
          .map((requestId) => requestById.get(requestId))
          .filter((request): request is EnrichedReviewRequest => Boolean(request));
        return {
          ...group,
          requests: requestsForGroup,
        };
      })
      .filter((group) => Boolean(group._id));
  }, [groups, requestById]);

  const isPastPacket = useCallback((group: MedicalReviewGroup) => {
    const end = parseLocalPacketDate(group.endDate);
    if (!end) return false;
    end.setHours(23, 59, 59, 999);
    return end.getTime() < Date.now();
  }, []);
  const activeGroups = useMemo(() => visibleGroups.filter((group) => !isPastPacket(group)), [isPastPacket, visibleGroups]);
  const pastGroups = useMemo(() => visibleGroups.filter(isPastPacket), [isPastPacket, visibleGroups]);
  const lifecycleGroups = useMemo(() => [...activeGroups, ...pastGroups], [activeGroups, pastGroups]);

  const applyOrderedGroupIds = useCallback((orderedGroupIds: string[]) => {
    const groupById = new Map(groups.map((group) => [group._id || '', group]));
    const ordered = orderedGroupIds
      .map((groupId, index) => {
        const group = groupById.get(groupId);
        return group ? { ...group, sortOrder: (index + 1) * 10 } : null;
      })
      .filter(Boolean) as MedicalReviewGroup[];
    const remaining = groups
      .filter((group) => !orderedGroupIds.includes(group._id || ''))
      .map((group, index) => ({ ...group, sortOrder: ordered.length + (index + 1) * 10 }));
    setGroups([...ordered, ...remaining]);
  }, [groups]);

  const reorderGroups = useCallback(async (sourceGroupId: string, targetGroupId: string) => {
    if (!sourceGroupId || sourceGroupId === targetGroupId) return;
    const currentIds = groups.map((group) => group._id).filter((id): id is string => Boolean(id));
    const fromIndex = currentIds.indexOf(sourceGroupId);
    const toIndex = currentIds.indexOf(targetGroupId);
    if (fromIndex < 0 || toIndex < 0) return;
    const nextIds = [...currentIds];
    const [moved] = nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, moved);

    try {
      setGroupReorderSaving(true);
      applyOrderedGroupIds(nextIds);
      const response = await medicalReviewRequestsApi.reorderGroups(nextIds);
      setGroups((response.data || []).map((group: MedicalReviewGroup, index: number) => ({
        ...group,
        sortOrder: typeof group.sortOrder === 'number' ? group.sortOrder : (index + 1) * 10,
        requests: group.requests || [],
      })));
    } catch (error) {
      console.error('Unable to reorder packets:', error);
      await loadData();
    } finally {
      setDraggedGroupId('');
      setDraggedOverGroupId('');
      setGroupReorderSaving(false);
    }
  }, [applyOrderedGroupIds, groups, loadData]);

  const packetAddCandidates = useMemo(() => {
    const groupedIds = new Set<string>();
    for (const group of groups) {
      for (const requestId of group.reviewRequestIds || []) {
        if (requestId) groupedIds.add(requestId);
      }
    }
    const search = packetAddSearchTerm.trim().toLowerCase();
    return requests
      .filter((request) => {
        const requestId = getRequestId(request);
        return requestId ? !groupedIds.has(requestId) : false;
      })
      .filter((request) => {
        if (!search) return true;
        return getReviewRequestFilterText(request).includes(search);
      });
  }, [groups, packetAddSearchTerm, requests]);

  const ungroupedRequests = useMemo(
    () => filteredRequests.filter((request) => {
      const requestId = getRequestId(request);
      return requestId ? !groupedRequestIds.has(requestId) : true;
    }),
    [filteredRequests, groupedRequestIds]
  );
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
  const [packetSearchTerms, setPacketSearchTerms] = useState<Record<string, string>>({});

  useEffect(() => {
    setExpandedGroupIds((current) => {
      const groupIds = new Set(groups.map((group) => group._id).filter((id): id is string => Boolean(id)));
      return current.filter((id) => groupIds.has(id));
    });
  }, [groups]);

  const copyText = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      window.prompt('Copy link', value);
    }
  };

  const handleGroupDragStart = (groupId: string) => {
    setDraggedGroupId(groupId);
  };

  const handleGroupDragEnd = () => {
    setDraggedGroupId('');
    setDraggedOverGroupId('');
  };

  const handleRequestDragEnd = () => {
    setDraggedRequestId('');
    setDraggedRequestSourceGroupId('');
    setDraggedOverPacketId('');
  };

  const moveRequestToPacket = async (requestId: string, sourceGroupId: string, targetGroupId: string) => {
    if (!requestId || !targetGroupId || sourceGroupId === targetGroupId || packetMoveSaving) {
      handleRequestDragEnd();
      return;
    }
    const request = requests.find((item) => getRequestId(item) === requestId);
    const target = groups.find((item) => item._id === targetGroupId);
    try {
      setPacketMoveSaving(true);
      setPacketMoveMessage('');
      await medicalReviewRequestsApi.addRequestsToGroup(targetGroupId, [requestId]);
      await loadData();
      setPacketMoveMessage(`MRR #${request?.display_id || requestId.slice(-6)} moved to ${target?.title || 'packet'}. Change logged.`);
    } catch (requestError: any) {
      setPacketMoveMessage(requestError?.response?.data?.message || 'Unable to move the MRR. No local change was kept.');
    } finally {
      setPacketMoveSaving(false);
      handleRequestDragEnd();
    }
  };

  const autoAssignRequestsToPackets = async () => {
    const ungrouped = requests.filter((request) => {
      const requestId = getRequestId(request);
      return requestId && !groupedRequestIds.has(requestId);
    });
    const assignments = new Map<string, string[]>();
    let skipped = 0;

    for (const request of ungrouped) {
      const requestId = getRequestId(request);
      const retreatId = getRequestRetreatId(request);
      if (!requestId || !retreatId) {
        skipped += 1;
        continue;
      }

      const retreatGroups = groups.filter((group) => getGroupRetreatId(group) === retreatId && group._id && !group.revokedAt);
      const ceremonyNumber = request.ceremonyNumber;
      const exactCeremonyGroups = typeof ceremonyNumber === 'number'
        ? retreatGroups.filter((group) => group.ceremonyNumber === ceremonyNumber)
        : [];
      const retreatOnlyGroups = retreatGroups.filter((group) => group.groupType === 'retreat' && group.ceremonyNumber == null);
      const matches = exactCeremonyGroups.length ? exactCeremonyGroups : retreatOnlyGroups;

      if (matches.length !== 1 || !matches[0]._id) {
        skipped += 1;
        continue;
      }
      assignments.set(matches[0]._id, [...(assignments.get(matches[0]._id) || []), requestId]);
    }

    const assignedCount = Array.from(assignments.values()).reduce((total, ids) => total + ids.length, 0);
    if (!assignedCount) {
      setAutoAssignMessage(skipped
        ? `No MRRs were assigned. ${skipped} had no single matching retreat packet.`
        : 'All eligible MRRs are already in packets.');
      return;
    }

    try {
      setAutoAssignSaving(true);
      setAutoAssignMessage('');
      await Promise.all(Array.from(assignments.entries()).map(([groupId, reviewRequestIds]) => (
        medicalReviewRequestsApi.addRequestsToGroup(groupId, reviewRequestIds)
      )));
      await loadData();
      setAutoAssignMessage(`${assignedCount} MRR${assignedCount === 1 ? '' : 's'} added to ${assignments.size} retreat packet${assignments.size === 1 ? '' : 's'}${skipped ? `; ${skipped} skipped because no single packet matched.` : '.'}`);
    } catch (requestError: any) {
      setAutoAssignMessage(requestError?.response?.data?.message || 'Unable to auto-assign MRRs.');
    } finally {
      setAutoAssignSaving(false);
    }
  };

  const openWhatsAppShare = (url?: string, label?: string) => {
    if (!url) return;
    const text = encodeURIComponent(`${label || 'Medical review packet'}: ${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this review request?')) return;
    await medicalReviewRequestsApi.delete(id);
    await loadData();
  };

  const runConfirmAction = async () => {
    if (!confirmAction) return;
    try {
      setConfirmSaving(true);
      if (confirmAction.kind === 'delete-group') {
        await medicalReviewRequestsApi.deleteGroup(confirmAction.groupId);
        setGroups((current) => current.filter((item) => item._id !== confirmAction.groupId));
      } else if (confirmAction.kind === 'remove-request') {
        await medicalReviewRequestsApi.updateGroup(confirmAction.groupId, { removeReviewRequestIds: [confirmAction.requestId] });
        setGroups((current) => current.map((group) => (
          group._id === confirmAction.groupId
            ? {
                ...group,
                reviewRequestIds: (group.reviewRequestIds || []).filter((requestId) => requestId !== confirmAction.requestId),
              }
            : group
        )));
      }
    } catch (requestError: any) {
      setGroupError(requestError?.response?.data?.message || 'Unable to complete the action.');
    } finally {
      setConfirmAction(null);
      setConfirmSaving(false);
    }
  };

  const openGroupModal = () => {
    setSelectedGroupRequestIds([]);
    setGroupReviewerUserId(advisors[0]?._id || '');
    setGroupTitle('');
    setGroupType('retreat');
    setGroupCeremonyNumber('');
    setGroupRetreatId('');
    setGroupEndDate('');
    setGroupSearchTerm('');
    setCreatedGroupUrl('');
    setGroupError('');
    setGroupModalOpen(true);
  };

  const openEditGroupModal = (group: MedicalReviewGroup) => {
    setEditingGroupId(group._id || '');
    setEditingGroupTitle(group.title || '');
    setEditingGroupEndDate(toDateInputValue(group.endDate));
    setEditingGroupType((group.groupType as 'retreat' | 'ceremony' | 'custom') || 'retreat');
    setEditingGroupRetreatId(getGroupRetreatId(group) || '');
    setEditingGroupCeremonyNumber(group.ceremonyNumber ? String(group.ceremonyNumber) : '');
    setEditingGroupReviewerUserId(typeof group.reviewerUserId === 'string' ? group.reviewerUserId : group.reviewerUserId?._id || '');
    setEditingGroupRequestIds([...(group.reviewRequestIds || [])]);
    setEditingGroupSearch('');
    setGroupError('');
  };

  const openAddToPacketModal = (group: MedicalReviewGroup) => {
    setPacketAddGroupId(group._id || '');
    setPacketAddModalOpen(true);
    setPacketAddSearchTerm('');
    setPacketAddSelectedIds([]);
    setGroupError('');
  };

  const closeAddToPacketModal = () => {
    setPacketAddModalOpen(false);
    setPacketAddGroupId('');
    setPacketAddSearchTerm('');
    setPacketAddSelectedIds([]);
  };

  const saveEditedGroup = async () => {
    if (!editingGroupId) return;
    const title = editingGroupTitle.trim();
    if (!title) {
      setGroupError('Packet title is required.');
      return;
    }
    if (!editingGroupEndDate) {
      setGroupError('Packet end date is required.');
      return;
    }
    try {
      setEditingGroupSaving(true);
      if (editingGroupType !== 'custom' && !editingGroupRetreatId) {
        setGroupError('Select the retreat this packet belongs to.');
        return;
      }
      if (!editingGroupReviewerUserId) {
        setGroupError('Select a medical advisor.');
        return;
      }
      await medicalReviewRequestsApi.updateGroup(editingGroupId, {
        title,
        groupType: editingGroupType,
        retreatId: editingGroupRetreatId,
        ceremonyNumber: editingGroupType === 'ceremony' && editingGroupCeremonyNumber ? Number(editingGroupCeremonyNumber) : undefined,
        endDate: editingGroupEndDate || null,
        reviewerUserId: editingGroupReviewerUserId,
        replaceReviewRequestIds: editingGroupRequestIds,
      });
      setGroups((current) => current.map((group) => (
        group._id === editingGroupId ? {
          ...group, title, groupType: editingGroupType, retreatId: editingGroupRetreatId,
          ceremonyNumber: editingGroupType === 'ceremony' && editingGroupCeremonyNumber ? Number(editingGroupCeremonyNumber) : undefined,
          endDate: editingGroupEndDate || undefined, reviewerUserId: editingGroupReviewerUserId,
          reviewRequestIds: editingGroupRequestIds,
        } : group
      )));
      setEditingGroupId('');
    } catch (requestError: any) {
      setGroupError(requestError?.response?.data?.message || 'Unable to rename the packet.');
    } finally {
      setEditingGroupSaving(false);
    }
  };

  const deleteGroup = async (group: MedicalReviewGroup) => {
    if (!group._id) return;
    setConfirmAction({
      kind: 'delete-group',
      groupId: group._id,
      title: `Delete packet "${group.title}"?`,
      message: 'The MRRs will remain in the system.',
    });
  };

  const addRequestsToPacket = async () => {
    if (!packetAddGroupId || !packetAddSelectedIds.length) return;
    try {
      setPacketAddSaving(true);
      await medicalReviewRequestsApi.addRequestsToGroup(packetAddGroupId, packetAddSelectedIds);
      await loadData();
      closeAddToPacketModal();
    } catch (requestError: any) {
      setGroupError(requestError?.response?.data?.message || requestError?.message || 'Unable to add requests to the packet.');
    } finally {
      setPacketAddSaving(false);
    }
  };

  const removeRequestFromPacket = async (group: MedicalReviewGroup, requestId: string) => {
    if (!group._id || !requestId) return;
    setConfirmAction({
      kind: 'remove-request',
      groupId: group._id,
      requestId,
      title: 'Remove MRR from packet?',
      message: 'The request will stay in the system. Only this packet will be updated.',
    });
  };

  const selectedGroupRequests = useMemo(
    () => requests.filter((request) => selectedGroupRequestIds.includes(getRequestId(request))),
    [requests, selectedGroupRequestIds]
  );
  const editingGroupCandidates = useMemo(() => {
    const search = editingGroupSearch.trim().toLowerCase();
    return requests.filter((request) => {
      const requestId = getRequestId(request);
      const isCurrent = editingGroupRequestIds.includes(requestId);
      const isUngrouped = !groupedRequestIds.has(requestId);
      if (!isCurrent && !isUngrouped) return false;
      if (editingGroupRetreatId && getRequestRetreatId(request) !== editingGroupRetreatId) return false;
      return !search || getReviewRequestFilterText(request).includes(search);
    });
  }, [editingGroupRequestIds, editingGroupRetreatId, editingGroupSearch, groupedRequestIds, requests]);

  const inferredRetreatId = useMemo(() => {
    const retreatIds = Array.from(new Set(selectedGroupRequests.map(getRequestRetreatId).filter(Boolean)));
    return retreatIds.length === 1 ? retreatIds[0] : undefined;
  }, [selectedGroupRequests]);

  useEffect(() => {
    if (groupType !== 'custom' && inferredRetreatId && !groupRetreatId) {
      setGroupRetreatId(inferredRetreatId);
    }
  }, [groupType, inferredRetreatId, groupRetreatId]);

  useEffect(() => {
    if (groupType === 'custom' || groupEndDate) return;
    const retreatId = groupRetreatId || inferredRetreatId;
    const retreat = retreatOptions.find((option) => option._id === retreatId);
    const retreatEndDate = getRetreatEndDate(retreat);
    if (retreatEndDate) setGroupEndDate(retreatEndDate);
  }, [groupEndDate, groupRetreatId, groupType, inferredRetreatId, retreatOptions]);

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
    if (!groupEndDate) {
      setGroupError('Packet end date is required.');
      return;
    }
    try {
      setCreatingGroup(true);
      const response = await medicalReviewRequestsApi.createGroup({
        title: groupTitle.trim() || undefined,
        groupType,
        retreatId: groupType !== 'custom' ? groupRetreatId || inferredRetreatId : undefined,
        ceremonyNumber: groupType === 'ceremony' && groupCeremonyNumber ? Number(groupCeremonyNumber) : undefined,
        endDate: groupEndDate || undefined,
        reviewRequestIds: selectedGroupRequestIds,
        reviewerUserId: groupReviewerUserId,
      });
      setCreatedGroupUrl(response.data.url || '');
      if (response.data?._id) {
        setGroupModalOpen(false);
        navigate(`${location.pathname.startsWith('/medical') ? '/medical/review-groups' : '/admin/medical-review-groups'}/${response.data._id}`);
      }
    } catch (requestError: any) {
      setGroupError(requestError?.response?.data?.message || requestError?.message || 'Unable to create grouped review link.');
    } finally {
      setCreatingGroup(false);
    }
  };

  const groupModalRequests = useMemo(() => {
    const search = groupSearchTerm.trim().toLowerCase();
    const source = requests.filter((request) => !groupedRequestIds.has(getRequestId(request)));
    if (!search) return source;
    return source.filter((request) => getReviewRequestFilterText(request).includes(search));
  }, [groupSearchTerm, groupedRequestIds, requests]);

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
    <div className="h-full overflow-x-hidden p-6">
      <div className="mb-6 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-gray-900">Medical Review Requests</h1>
          <p className="text-sm text-gray-600">Queue and audit trail for EKG and liver panel review rounds.</p>
          <div className="mt-3 inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setActiveView('grouped')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${activeView === 'grouped' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              Grouped
            </button>
            <button
              type="button"
              onClick={() => setActiveView('all')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${activeView === 'all' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              All
            </button>
          </div>
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
                Create Group
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
        <div className="grid w-full flex-1 gap-2 lg:grid-cols-[minmax(280px,1fr)_160px_170px_170px]">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search client, retreat, request #, type, notes..."
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as MedicalReviewTypeFilter)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All types</option>
            <option value="ekg">EKG</option>
            <option value="liver">Liver</option>
            <option value="both">EKG + Liver</option>
            <option value="questionnaire">Questionnaire</option>
            <option value="general">General</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
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
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={pendingOnly}
            onChange={(event) => setPendingOnly(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Pending only
        </label>
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

      {activeView === 'grouped' ? (
        <div className="space-y-4">
          {canManageRequests && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <div>
                <div className="text-sm font-semibold text-gray-900">Grouped reviews</div>
                <div className="text-xs text-gray-500">Unlock assignments to drag an MRR into the correct packet. Every move is logged.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPacketAssignmentUnlocked((current) => !current);
                    handleRequestDragEnd();
                  }}
                  disabled={packetMoveSaving}
                  className={`inline-flex w-auto shrink-0 items-center gap-2 whitespace-nowrap rounded-md border px-4 py-2 text-sm font-medium ${
                    packetAssignmentUnlocked
                      ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon icon={packetAssignmentUnlocked ? FiLock : FiUnlock} className="h-4 w-4" />
                  {packetAssignmentUnlocked ? 'Lock assignments' : 'Unlock assignments'}
                </button>
                <button
                  type="button"
                  onClick={autoAssignRequestsToPackets}
                  disabled={autoAssignSaving}
                  className="inline-flex w-auto shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-60"
                  title="Assign unfiled MRRs only when exactly one packet matches their retreat"
                >
                  <Icon icon={FiZap} className="h-4 w-4" />
                  {autoAssignSaving ? 'Assigning...' : 'Assign unfiled by retreat'}
                </button>
                {visibleGroups.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setGroupOrderUnlocked((current) => !current);
                      handleGroupDragEnd();
                    }}
                    className={`inline-flex w-auto shrink-0 items-center gap-2 whitespace-nowrap rounded-md border px-4 py-2 text-sm font-medium ${
                      groupOrderUnlocked
                        ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon icon={groupOrderUnlocked ? FiLock : FiUnlock} className="h-4 w-4" />
                    {groupOrderUnlocked ? 'Lock order' : 'Unlock order'}
                  </button>
                )}
                <button
                  onClick={openGroupModal}
                  className="inline-flex w-auto shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                >
                  <Icon icon={FiLink} className="h-4 w-4" />
                  Create Group
                </button>
              </div>
            </div>
          )}

          {autoAssignMessage && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800" role="status">
              {autoAssignMessage}
            </div>
          )}

          {packetMoveMessage && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800" role="status">
              {packetMoveMessage}
            </div>
          )}

          <div className="space-y-3">
            {lifecycleGroups.map((group, groupIndex) => {
              const groupId = group._id || group.title;
              const expanded = expandedGroupIds.includes(groupId || '');
              const groupUrl = group.url || '';
              const isDragged = draggedGroupId === groupId;
              const isOver = draggedOverGroupId === groupId && draggedGroupId !== groupId;
              const isRequestDropTarget = draggedOverPacketId === groupId && draggedRequestSourceGroupId !== groupId;
              const packetSearch = packetSearchTerms[groupId || ''] || '';
              const normalizedPacketSearch = packetSearch.trim().toLowerCase();
              const packetRequests = normalizedPacketSearch
                ? (group.requests || []).filter((request) => getReviewRequestFilterText(request).includes(normalizedPacketSearch))
                : (group.requests || []);
              const originalGroupIndex = visibleGroups.findIndex((candidate) => candidate._id === group._id);
              return (
                <React.Fragment key={`packet-section-${groupId}`}>
                {groupIndex === 0 && activeGroups.length > 0 && (
                  <div className="flex items-center justify-between px-1 pb-1 pt-2">
                    <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-gray-600">Active packets</h3>
                    <span className="text-xs text-gray-500">{activeGroups.length}</span>
                  </div>
                )}
                {groupIndex === activeGroups.length && pastGroups.length > 0 && (
                  <div className="mt-6 flex items-center justify-between border-t border-gray-200 px-1 pb-1 pt-5">
                    <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Past packets</h3>
                    <span className="text-xs text-gray-500">{pastGroups.length}</span>
                  </div>
                )}
                <div
                  onDragOver={(event) => {
                    if (canManageRequests && packetAssignmentUnlocked && draggedRequestId) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      setDraggedOverPacketId(groupId || '');
                      return;
                    }
                    if (!canManageRequests || !groupOrderUnlocked || !draggedGroupId) return;
                    event.preventDefault();
                    setDraggedOverGroupId(groupId || '');
                  }}
                  onDragLeave={() => {
                    if (draggedOverPacketId === groupId) setDraggedOverPacketId('');
                    if (draggedOverGroupId === groupId) setDraggedOverGroupId('');
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (packetAssignmentUnlocked && draggedRequestId && groupId) {
                      void moveRequestToPacket(draggedRequestId, draggedRequestSourceGroupId, groupId);
                      return;
                    }
                    if (groupOrderUnlocked && groupId) void reorderGroups(draggedGroupId, groupId);
                  }}
                  className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                    isDragged ? 'opacity-50' : 'opacity-100'
                  } ${isOver ? 'border-blue-500 ring-2 ring-blue-200' : isRequestDropTarget ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-gray-200'}`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedGroupIds((current) => (
                      groupId && current.includes(groupId)
                        ? current.filter((id) => id !== groupId)
                        : [...current, groupId || '']
                    ).filter(Boolean))}
                    className="flex w-full items-center justify-between gap-3 border-b border-gray-200 px-4 py-4 text-left"
                  >
                  <div className="flex min-w-0 items-center gap-3">
                    {canManageRequests && groupOrderUnlocked && (
                      <span
                        role="button"
                        tabIndex={0}
                        draggable={Boolean(groupId) && !groupReorderSaving}
                        onClick={(event) => event.stopPropagation()}
                        onDragStart={(event) => {
                          event.stopPropagation();
                          handleGroupDragStart(groupId || '');
                          event.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={handleGroupDragEnd}
                        onKeyDown={(event) => {
                          if (!groupId || groupReorderSaving) return;
                          const direction = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
                          if (!direction) return;
                          event.preventDefault();
                          event.stopPropagation();
                          const target = visibleGroups[originalGroupIndex + direction]?._id;
                          if (target) void reorderGroups(groupId, target);
                        }}
                        className="inline-flex h-9 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 active:cursor-grabbing"
                        title="Drag to move packet; use Up or Down arrow keys when focused"
                        aria-label={`Move ${group.title}`}
                      >
                        <Icon icon={FiMenu} className="h-5 w-5" />
                      </span>
                    )}
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                      <Icon icon={FiFolder} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className={`truncate text-sm font-semibold ${group.requests?.length ? 'text-gray-900' : 'text-gray-400'}`}>{group.title}</div>
                      <div className="text-xs text-gray-500">
                        {group.retreatName || 'No retreat'}{group.ceremonyNumber ? ` • Ceremony #${group.ceremonyNumber}` : ''} • {formatPacketEndDate(group.endDate)} • {group.requests?.length || 0} requests
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {(group.pendingCount || 0) > 0 && (
                      <span
                        className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-100 px-2 text-xs font-bold text-amber-800"
                        title={`${group.pendingCount} pending medical review request${group.pendingCount === 1 ? '' : 's'}`}
                        aria-label={`${group.pendingCount} pending medical review requests`}
                      >
                        {group.pendingCount}
                      </span>
                    )}
                    {groupReorderSaving && draggedGroupId === groupId && (
                      <span className="text-xs font-medium text-blue-700">Saving...</span>
                    )}
                    {groupUrl && (
                      <>
                        <button
                          type="button"
                          onClick={(event) => {
                              event.stopPropagation();
                              copyText(groupUrl);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
                            title="Copy permanent link"
                            aria-label="Copy permanent link"
                          >
                            <Icon icon={FiCopy} className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openWhatsAppShare(groupUrl, group.title);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                            title="Send link in WhatsApp"
                            aria-label="Send link in WhatsApp"
                          >
                            <Icon icon={FiSend} className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                  {canManageRequests && (
                        <>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openAddToPacketModal(group);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
                            title="Add MRRs"
                            aria-label="Add MRRs"
                          >
                            <Icon icon={FiPlus} className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditGroupModal(group);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            title="Edit packet"
                            aria-label="Edit packet"
                          >
                            <Icon icon={FiEdit2} className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteGroup(group);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                            title="Delete packet"
                            aria-label="Delete packet"
                          >
                            <Icon icon={FiTrash2} className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      <Icon icon={expanded ? FiChevronDown : FiChevronRight} className="h-5 w-5 shrink-0 text-gray-500" />
                    </div>
                  </button>
                  {expanded && (
                    <div className="divide-y divide-gray-100">
                      <div className="bg-gray-50 px-4 py-3">
                        <label className="relative block">
                          <span className="sr-only">Search within {group.title}</span>
                          <Icon icon={FiSearch} className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                          <input
                            type="search"
                            value={packetSearch}
                            onChange={(event) => setPacketSearchTerms((current) => ({ ...current, [groupId || '']: event.target.value }))}
                            placeholder="Search this packet by client name or any column..."
                            className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </label>
                        {normalizedPacketSearch && <div className="mt-1 text-xs text-gray-500">Showing {packetRequests.length} of {group.requests?.length || 0} requests</div>}
                      </div>
                      {packetRequests.length ? packetRequests.map((request) => (
                      <div
                        key={request._id}
                        draggable={packetAssignmentUnlocked && !packetMoveSaving}
                        onDragStart={(event) => {
                          if (!packetAssignmentUnlocked) return;
                          setDraggedRequestId(request._id || '');
                          setDraggedRequestSourceGroupId(groupId || '');
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', request._id || '');
                        }}
                        onDragEnd={handleRequestDragEnd}
                        className={`grid gap-3 px-4 py-4 md:items-center ${packetAssignmentUnlocked ? 'cursor-grab bg-amber-50/30 md:grid-cols-[32px_150px_minmax(0,1fr)_220px_150px_180px] active:cursor-grabbing' : 'md:grid-cols-[150px_minmax(0,1fr)_220px_150px_180px]'}`}
                      >
                          {packetAssignmentUnlocked && <div className="text-gray-400" title="Drag MRR to another packet"><Icon icon={FiMenu} className="h-5 w-5" /></div>}
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => navigate(`${basePath}/${request._id}`)}
                              className="text-left text-sm font-semibold text-blue-700 hover:underline"
                            >
                              #{request.display_id || '-'}
                            </button>
                            <div className="mt-1 text-xs text-gray-500">{request.requestType || 'review'}</div>
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-gray-900">{getClientGridLabel(request)}</div>
                            <div className="truncate text-xs text-gray-500">{request.retreatName}</div>
                          </div>
                          <div className="min-w-0">
                            <MedicalReviewTypeBadge requestType={request.requestType} />
                          </div>
                          <div>
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusClass[request.status] || 'bg-gray-100 text-gray-700'}`}>
                              {request.status}
                            </span>
                          </div>
                          <div className="flex justify-start md:justify-end">
                            <div className="flex flex-nowrap gap-2">
                              <button
                                type="button"
                                onClick={() => navigate(`${basePath}/${request._id}`)}
                                className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                              >
                                Open review
                              </button>
                              {canManageRequests && (
                                <button
                                  type="button"
                                  onClick={() => removeRequestFromPacket(group, request._id || '')}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                  title="Remove from packet"
                                  aria-label="Remove from packet"
                                >
                                  <Icon icon={FiTrash2} className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )) : group.requests?.length ? (
                        <div className="px-4 py-6 text-center text-sm text-gray-500">No requests in this packet match “{packetSearch}”.</div>
                      ) : (
                        <div className="flex items-center justify-between gap-3 px-4 py-4 text-sm text-gray-500">
                          <span>No MRRs in this packet yet. Use the packet add button to populate it later.</span>
                          {canManageRequests && (
                            <button
                              type="button"
                              onClick={() => openAddToPacketModal(group)}
                              className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100"
                            >
                              <Icon icon={FiPlus} className="h-3.5 w-3.5" />
                              Add MRRs
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                </React.Fragment>
              );
            })}

            {ungroupedRequests.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 border-b border-gray-200 px-4 py-4 text-left"
                  onClick={() => setExpandedGroupIds((current) => (
                    current.includes('ungrouped') ? current.filter((id) => id !== 'ungrouped') : [...current, 'ungrouped']
                  ))}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-50 text-gray-700">
                      <Icon icon={FiFolder} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900">Potentials &amp; unmatched</div>
                      <div className="text-xs text-gray-500">{ungroupedRequests.length} requests</div>
                    </div>
                  </div>
                  <Icon icon={expandedGroupIds.includes('ungrouped') ? FiChevronDown : FiChevronRight} className="h-5 w-5 shrink-0 text-gray-500" />
                </button>
                {expandedGroupIds.includes('ungrouped') && (
                  <div className="divide-y divide-gray-100">
                    {ungroupedRequests.map((request) => (
                      <div
                        key={`ungrouped-${request._id}`}
                        draggable={packetAssignmentUnlocked && !packetMoveSaving}
                        onDragStart={(event) => {
                          if (!packetAssignmentUnlocked) return;
                          setDraggedRequestId(request._id || '');
                          setDraggedRequestSourceGroupId('');
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', request._id || '');
                        }}
                        onDragEnd={handleRequestDragEnd}
                        className={`grid gap-3 px-4 py-4 md:items-center ${packetAssignmentUnlocked ? 'cursor-grab bg-amber-50/30 md:grid-cols-[32px_150px_minmax(0,1fr)_220px_150px_130px] active:cursor-grabbing' : 'md:grid-cols-[150px_minmax(0,1fr)_220px_150px_130px]'}`}
                      >
                        {packetAssignmentUnlocked && <div className="text-gray-400" title="Drag MRR to a packet"><Icon icon={FiMenu} className="h-5 w-5" /></div>}
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => navigate(`${basePath}/${request._id}`)}
                            className="text-left text-sm font-semibold text-blue-700 hover:underline"
                          >
                            #{request.display_id || '-'}
                          </button>
                          <div className="mt-1 text-xs text-gray-500">{request.requestType || 'review'}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-gray-900">{getClientGridLabel(request)}</div>
                          <div className="truncate text-xs text-gray-500">{request.retreatName}</div>
                        </div>
                        <div className="min-w-0">
                          <MedicalReviewTypeBadge requestType={request.requestType} />
                        </div>
                        <div>
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusClass[request.status] || 'bg-gray-100 text-gray-700'}`}>
                            {request.status}
                          </span>
                        </div>
                        <div className="flex justify-start md:justify-end">
                          <div className="flex flex-nowrap gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(`${basePath}/${request._id}`)}
                              className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                            >
                              Open review
                            </button>
                            {canDeleteRequests && (
                              <button
                                type="button"
                                onClick={() => handleDelete(request._id || '')}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                title="Delete request"
                                aria-label="Delete request"
                              >
                                <Icon icon={FiTrash2} className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
      <div className="space-y-3 overflow-x-hidden md:hidden">
        {filteredRequests.map((request) => {
          const retreatLabel = request.retreatName || 'Unknown Retreat';
          return (
            <div key={`mobile-${request._id}`} className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="grid w-full grid-cols-[88px_minmax(0,1fr)_44px] gap-3">
                <div className="min-w-0 space-y-2">
                  <button
                    type="button"
                    onClick={() => navigate(`${basePath}/${request._id}`)}
                    className="block max-w-full text-left text-lg font-semibold leading-tight text-blue-700 hover:underline"
                  >
                    #{request.display_id || '—'}
                  </button>
                  <MedicalReviewTypeBadge requestType={request.requestType} className="max-w-full justify-start text-[11px]" />
                </div>

                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-gray-900">{getClientGridLabel(request)}</div>
                  <div className="truncate text-sm text-gray-500">{retreatLabel}</div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`${basePath}/${request._id}`)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50"
                    title="View"
                  >
                    <Icon icon={FiEye} className="h-5 w-5" />
                  </button>
                  <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${statusClass[request.status] || 'bg-gray-100 text-gray-700'}`}>
                    {request.status}
                  </span>
                </div>
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
              {filteredRequests.map((request) => (
                <tr key={request._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-semibold text-blue-600">#{request.display_id || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {getClientGridLabel(request)}
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
                      {canDeleteRequests && (
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
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

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

              <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Search requests</span>
                  <input
                    value={groupSearchTerm}
                    onChange={(event) => setGroupSearchTerm(event.target.value)}
                    placeholder="Search client, booking, retreat, request, notes..."
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  />
                </label>
                <div className="mt-3 text-sm font-semibold text-gray-800">Requests in packet ({selectedGroupRequestIds.length})</div>
                <div className="text-xs text-gray-500">You can create an empty packet now and add requests later.</div>
              </div>

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
                {groupType !== 'custom' && (
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Retreat</span>
                    <select
                      value={groupRetreatId}
                      onChange={(event) => {
                        const retreatId = event.target.value;
                        setGroupRetreatId(retreatId);
                        const retreat = retreatOptions.find((option) => option._id === retreatId);
                        setGroupEndDate(getRetreatEndDate(retreat));
                      }}
                      className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Auto from selected MRRs</option>
                      {retreatOptions.map((retreat) => (
                        <option key={retreat._id} value={retreat._id}>
                          {getRetreatCode(retreat)}
                        </option>
                      ))}
                    </select>
                    {!groupRetreatId && !inferredRetreatId && (
                      <div className="mt-1 text-xs text-amber-700">Pick a retreat if you want this empty packet attached to one now.</div>
                    )}
                  </label>
                )}
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
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Packet end date *</span>
                  <input
                    type="date"
                    required
                    value={groupEndDate}
                    onChange={(event) => setGroupEndDate(event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <span className="mt-1 block text-xs text-gray-500">Defaults to the retreat end date. After this date, the packet moves to Past.</span>
                </label>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex gap-2 text-xs">
                    <button type="button" onClick={() => setSelectedGroupRequestIds(groupModalRequests.map(getRequestId).filter(Boolean))} className="text-blue-700 hover:underline">Select visible</button>
                    <button type="button" onClick={() => setSelectedGroupRequestIds([])} className="text-gray-600 hover:underline">Clear</button>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-md border border-gray-200">
                  {groupModalRequests.map((request) => {
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
                  {!groupModalRequests.length && (
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

      {editingGroupId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Edit packet</h2>
              <p className="mt-1 text-sm text-gray-600">One packet belongs to one retreat. Only MRRs from that retreat can be included.</p>
            </div>
            <div className="max-h-[calc(90vh-150px)] space-y-4 overflow-y-auto px-5 py-4">
              {groupError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{groupError}</div>
              )}
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Packet title</span>
                <input
                  value={editingGroupTitle}
                  onChange={(event) => setEditingGroupTitle(event.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Medical advisor</span>
                  <select value={editingGroupReviewerUserId} onChange={(event) => setEditingGroupReviewerUserId(event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                    <option value="">Select advisor</option>
                    {advisors.map((advisor) => <option key={advisor._id} value={advisor._id}>{[advisor.firstName, advisor.lastName].filter(Boolean).join(' ') || advisor.email}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Packet type</span>
                  <select value={editingGroupType} onChange={(event) => setEditingGroupType(event.target.value as typeof editingGroupType)} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                    <option value="retreat">Retreat</option><option value="ceremony">Ceremony</option><option value="custom">Custom</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Retreat</span>
                  <select value={editingGroupRetreatId} onChange={(event) => { setEditingGroupRetreatId(event.target.value); setEditingGroupRequestIds([]); }} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                    <option value="">Select retreat</option>
                    {retreatOptions.map((retreat) => <option key={retreat._id} value={retreat._id}>{getRetreatCode(retreat)}</option>)}
                  </select>
                  <span className="mt-1 block text-xs text-amber-700">Changing retreat clears the item selection so MRRs cannot silently cross retreats.</span>
                </label>
                {editingGroupType === 'ceremony' && <label className="block"><span className="text-sm font-medium text-gray-700">Ceremony #</span><input type="number" min="1" value={editingGroupCeremonyNumber} onChange={(event) => setEditingGroupCeremonyNumber(event.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></label>}
              </div>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Packet end date</span>
                <input
                  type="date"
                  value={editingGroupEndDate}
                  onChange={(event) => setEditingGroupEndDate(event.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <span className="mt-1 block text-xs text-gray-500">Packets automatically appear under Past after this date.</span>
              </label>
              <section className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-gray-900">MRRs in this packet ({editingGroupRequestIds.length})</h3><p className="text-xs text-gray-500">Current items plus ungrouped MRRs from the selected retreat.</p></div></div>
                <input value={editingGroupSearch} onChange={(event) => setEditingGroupSearch(event.target.value)} placeholder="Search MRR or client" className="mt-3 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" />
                <div className="mt-3 max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white">
                  {editingGroupCandidates.map((request) => { const requestId = getRequestId(request); return <label key={requestId} className="flex cursor-pointer items-start gap-3 border-b border-gray-100 px-3 py-3 last:border-0 hover:bg-gray-50"><input type="checkbox" checked={editingGroupRequestIds.includes(requestId)} onChange={() => setEditingGroupRequestIds((current) => current.includes(requestId) ? current.filter((id) => id !== requestId) : [...current, requestId])} className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600" /><span className="min-w-0 text-sm"><strong>MRR #{request.display_id || requestId.slice(-6)}</strong><span className="ml-2">{request.clientName}</span><span className="ml-2 text-gray-500">{request.retreatName}</span></span></label>; })}
                  {!editingGroupCandidates.length && <div className="px-3 py-5 text-center text-sm text-gray-500">No eligible MRRs for this retreat.</div>}
                </div>
              </section>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setEditingGroupId('')}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEditedGroup}
                disabled={editingGroupSaving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {editingGroupSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {packetAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Add MRRs to packet</h2>
                <p className="mt-1 text-sm text-gray-600">Search and select requests to add to this packet.</p>
              </div>
              <button
                type="button"
                onClick={closeAddToPacketModal}
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
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Search requests</span>
                <input
                  value={packetAddSearchTerm}
                  onChange={(event) => setPacketAddSearchTerm(event.target.value)}
                  placeholder="Search client, booking, retreat, request, notes..."
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
              </label>
              <div className="mt-3 text-sm font-semibold text-gray-800">Requests selected ({packetAddSelectedIds.length})</div>
              <div className="mt-2 max-h-[50vh] overflow-y-auto rounded-md border border-gray-200">
                {packetAddCandidates.map((request) => {
                  const id = getRequestId(request);
                  return (
                    <label key={id} className="flex cursor-pointer items-start gap-3 border-b border-gray-100 px-3 py-3 last:border-b-0 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={packetAddSelectedIds.includes(id)}
                        onChange={() => setPacketAddSelectedIds((current) => (
                          current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
                        ))}
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
                {!packetAddCandidates.length && (
                  <div className="px-3 py-6 text-center text-sm text-gray-500">No requests match the current filter.</div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
              <button
                type="button"
                onClick={closeAddToPacketModal}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addRequestsToPacket}
                disabled={packetAddSaving || !packetAddSelectedIds.length}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {packetAddSaving ? 'Saving...' : `Add ${packetAddSelectedIds.length || ''} request${packetAddSelectedIds.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <ResponsiveModal
        isOpen={Boolean(confirmAction)}
        onClose={() => !confirmSaving && setConfirmAction(null)}
        title={confirmAction?.title || 'Confirm action'}
        size="sm"
        closeOnOverlayClick={!confirmSaving}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">{confirmAction?.message}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmAction(null)}
              disabled={confirmSaving}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runConfirmAction}
              disabled={confirmSaving}
              className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                confirmAction?.kind === 'delete-group'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {confirmSaving ? 'Working...' : 'Confirm'}
            </button>
          </div>
        </div>
      </ResponsiveModal>
    </div>
  );
};

export default MedicalReviewRequestsGrid;
